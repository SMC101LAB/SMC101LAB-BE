import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import Slope from '../../models/Slope';
import SlopeImageBackup from '../../models/SlopeImageBackup';
import { AnyAaaaRecord } from 'node:dns';

// AWS S3 Client 설정 (AWS SDK v3)
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION!,
});

// 타입 정의
type ImagePosition = 'position' | 'start' | 'overview' | 'end';

interface SlopeImageRequest extends Request {
  params: {
    historyNumber: string;
  };
  files?: { [fieldname: string]: Express.MulterS3.File[] };
  body: {
    deletePositions?: string | string[]; // 문자열 또는 배열 모두 허용
  };
}

interface ImageData {
  url: string;
  createdAt: Date;
}

interface SlopeImages {
  position?: ImageData;
  start?: ImageData;
  overview?: ImageData;
  end?: ImageData;
}

// Multer S3 설정 (AWS SDK v3 S3Client 사용)
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME!,
    key: function (req, file, cb) {
      const { historyNumber } = (req as any).params;
      const position = file.fieldname; // fieldname이 position
      const timestamp = Date.now();
      const uuid = uuidv4();
      const ext = file.originalname.split('.').pop();
      cb(
        null,
        `slopes/${historyNumber}/${position}/${timestamp}_${uuid}.${ext}`
      );
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: function (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    const validPositions: ImagePosition[] = [
      'position',
      'start',
      'overview',
      'end',
    ];
    if (!validPositions.includes(file.fieldname as ImagePosition)) {
      cb(
        new Error(`유효하지 않은 위치입니다: ${file.fieldname}`) as any,
        false
      );
      return;
    }

    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.') as any, false);
    }
  },
});

// S3에서 이미지 삭제 헬퍼 함수 (AWS SDK v3용)
const deleteImageFromS3 = async (imageUrl: string): Promise<void> => {
  try {
    const s3Key = imageUrl.split('.com/')[1];
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
    });
    await s3.send(command);
  } catch (error) {
    console.error('S3 이미지 삭제 실패:', error);
    throw error;
  }
};

// 백업 컬렉션 업데이트 헬퍼 함수
const updateImageBackup = async (
  historyNumber: string,
  imageType: ImagePosition,
  imageData: ImageData | null
): Promise<void> => {
  try {
    // 백업 데이터 찾기 또는 생성
    let backup = await SlopeImageBackup.findOne({ historyNumber });

    if (!backup) {
      // 새 백업 문서 생성
      backup = new SlopeImageBackup({
        historyNumber,
        images: {},
        lastBackupAt: new Date(),
      });
    }

    // 이미지 업데이트 또는 삭제
    if (imageData) {
      // 이미지 추가/수정
      backup.images[imageType] = imageData;
    } else {
      // 이미지 삭제
      backup.images[imageType] = undefined;
    }

    backup.lastBackupAt = new Date();
    await backup.save();

    console.log(`백업 업데이트 완료: ${historyNumber}/${imageType}`);
  } catch (error) {
    console.error(`백업 업데이트 실패: ${historyNumber}/${imageType}`, error);
    // 백업 실패해도 메인 작업은 계속 진행
  }
};

// historyNumber로 급경사지 조회
export const getSlopeByHistoryNumber = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { historyNumber } = req.params;

    const slope = await Slope.findOne({
      'slopeInspectionHistory.historyNumber': historyNumber,
    });

    if (!slope) {
      res
        .status(404)
        .json({ error: '해당 이력번호의 급경사지를 찾을 수 없습니다.' });
      return;
    }

    res.status(200).json({
      message: '급경사지 조회 성공',
      historyNumber: slope.slopeInspectionHistory.historyNumber,
      name: slope.name,
      data: slope,
      images: {
        position: slope.priority.images.position || null,
        start: slope.priority.images.start || null,
        overview: slope.priority.images.overview || null,
        end: slope.priority.images.end || null,
      },
    });
  } catch (error) {
    console.error('급경사지 조회 에러:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 전체 이미지 수정 (추가/덮어쓰기/삭제를 한 번에 처리) + 백업 동시 적용
export const updateAllSlopeImages = async (
  req: SlopeImageRequest,
  res: Response
): Promise<void> => {
  try {
    const { historyNumber } = req.params;

    // 급경사지 존재 확인
    const slope = await Slope.findOne({
      'slopeInspectionHistory.historyNumber': historyNumber,
    });
    if (!slope) {
      res.status(404).json({ error: '급경사지를 찾을 수 없습니다.' });
      return;
    }

    // Multer 파일 업로드 처리
    const multerFields = [
      { name: 'position', maxCount: 1 },
      { name: 'start', maxCount: 1 },
      { name: 'overview', maxCount: 1 },
      { name: 'end', maxCount: 1 },
    ];

    upload.fields(multerFields)(req, res, async (err: any) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      try {
        const { deletePositions } = req.body;

        // deletePositions 정규화 (문자열, 배열, undefined 모두 처리)
        let positionsToDelete: string[] = [];
        if (deletePositions) {
          if (Array.isArray(deletePositions)) {
            positionsToDelete = deletePositions.filter(Boolean);
          } else if (typeof deletePositions === 'string') {
            positionsToDelete = [deletePositions];
          }
        }

        const updatedPositions: string[] = [];
        const deletedPositions: string[] = [];
        const errors: string[] = [];

        // 1. 삭제 처리
        for (const position of positionsToDelete) {
          const validPositions: ImagePosition[] = [
            'position',
            'start',
            'overview',
            'end',
          ];
          if (!validPositions.includes(position as ImagePosition)) {
            errors.push(`유효하지 않은 삭제 위치: ${position}`);
            continue;
          }

          const pos = position as ImagePosition;
          const existingImage = slope.priority.images[pos];
          if (existingImage && existingImage.url) {
            try {
              // S3에서 이미지 삭제
              await deleteImageFromS3(existingImage.url);

              // Slope 컬렉션에서 이미지 삭제
              slope.priority.images[pos] = undefined;
              slope.markModified(`priority.images.${pos}`);

              // 백업 컬렉션에서도 이미지 삭제
              await updateImageBackup(
                historyNumber,
                pos,
                null // null = 삭제
              );

              deletedPositions.push(position);
            } catch (error) {
              errors.push(`${position} 위치 이미지 삭제 실패`);
            }
          }
        }

        // 2. 새 이미지 업로드/덮어쓰기 처리
        if (req.files && typeof req.files === 'object') {
          for (const [position, files] of Object.entries(req.files)) {
            if (files && files.length > 0) {
              const file = files[0] as Express.MulterS3.File;
              const pos = position as ImagePosition;

              try {
                // 기존 이미지가 있고 삭제 대상이 아니라면 S3에서 삭제
                const existingImage = slope.priority.images[pos];
                if (
                  existingImage &&
                  existingImage.url &&
                  !positionsToDelete.includes(position)
                ) {
                  await deleteImageFromS3(existingImage.url);
                }

                // 새 이미지 데이터 준비
                const newImageData: ImageData = {
                  url: file.location,
                  createdAt: new Date(),
                };

                // Slope 컬렉션에 새 이미지 정보 업데이트
                slope.priority.images[pos] = newImageData;

                // 백업 컬렉션에도 새 이미지 정보 업데이트
                await updateImageBackup(historyNumber, pos, newImageData);

                updatedPositions.push(position);
              } catch (error) {
                errors.push(`${position} 위치 이미지 업로드 실패`);
              }
            }
          }
        }

        // Slope 컬렉션 변경사항 저장
        await slope.save();

        // 최종 이미지 상태
        const finalImages: SlopeImages = {
          position: slope.priority.images.position || undefined,
          start: slope.priority.images.start || undefined,
          overview: slope.priority.images.overview || undefined,
          end: slope.priority.images.end || undefined,
        };

        const totalImages = Object.values(finalImages).filter(
          (img) => img !== undefined
        ).length;

        res.status(200).json({
          message: '이미지 수정 및 백업 완료',
          historyNumber: slope.slopeInspectionHistory.historyNumber,
          summary: {
            updated: updatedPositions.length,
            deleted: deletedPositions.length,
            errors: errors.length,
          },
          details: {
            updatedPositions,
            deletedPositions,
            errors,
          },
          images: finalImages,
          totalImages,
        });
      } catch (saveError) {
        console.error('이미지 수정 에러:', saveError);
        res.status(500).json({ error: '이미지 수정 중 오류가 발생했습니다.' });
      }
    });
  } catch (error) {
    console.error('이미지 수정 에러:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 백업 상태 확인 함수 (선택사항)
export const getImageBackupStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { historyNumber } = req.params;

    const backup = await SlopeImageBackup.findOne({ historyNumber });

    if (!backup) {
      res.status(404).json({
        error: '해당 historyNumber의 백업 데이터를 찾을 수 없습니다.',
      });
      return;
    }

    const imageCount = Object.values(backup.images).filter(
      (img) => img && img.url
    ).length;

    res.status(200).json({
      message: '백업 상태 조회 성공',
      historyNumber: backup.historyNumber,
      totalImages: imageCount,
      images: {
        position: backup.images.position || null,
        start: backup.images.start || null,
        overview: backup.images.overview || null,
        end: backup.images.end || null,
      },
      lastBackupAt: backup.lastBackupAt,
    });
  } catch (error) {
    console.error('백업 상태 조회 에러:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

interface RestoreResult {
  success: boolean;
  totalBackups: number;
  foundSlopes: number;
  restoredSlopes: number;
  restoredImages: number;
  notFoundSlopes: string[];
  errors: string[];
  details: {
    historyNumber: string;
    restoredImageTypes: string[];
  }[];
}

// 백업에서 이미지 전체 복구 함수
export const restoreImagesFromBackup = async (): Promise<RestoreResult> => {
  console.log('이미지 복구 시작:', new Date());

  const result: RestoreResult = {
    success: false,
    totalBackups: 0,
    foundSlopes: 0,
    restoredSlopes: 0,
    restoredImages: 0,
    notFoundSlopes: [],
    errors: [],
    details: [],
  };

  try {
    // 1. 모든 백업 데이터 조회
    const backups = await SlopeImageBackup.find({});
    result.totalBackups = backups.length;

    console.log(`총 ${backups.length}개의 백업 데이터 발견`);

    if (backups.length === 0) {
      result.success = true;
      console.log('복구할 백업 데이터가 없습니다.');
      return result;
    }

    // 2. 각 백업 데이터 처리
    for (const backup of backups) {
      try {
        const { historyNumber } = backup;

        // 해당 historyNumber로 slope 찾기
        const slope = await Slope.findOne({
          'slopeInspectionHistory.historyNumber': historyNumber,
        });

        if (!slope) {
          result.notFoundSlopes.push(historyNumber);
          continue;
        }

        result.foundSlopes++;

        // 복구할 이미지가 있는지 확인 및 복구 진행
        let hasRestoredImages = false;
        const restoredImageTypes: string[] = [];
        const imageTypes = ['position', 'start', 'overview', 'end'] as const;

        for (const imageType of imageTypes) {
          const backupImage = backup.images[imageType];
          const currentImage = slope.priority.images[imageType];

          // 백업에 이미지가 있고, 현재 slope에 해당 이미지가 없는 경우 복구
          if (
            backupImage &&
            backupImage.url &&
            (!currentImage || !currentImage.url)
          ) {
            slope.priority.images[imageType] = {
              url: backupImage.url,
              createdAt: backupImage.createdAt,
            };

            hasRestoredImages = true;
            restoredImageTypes.push(imageType);
            result.restoredImages++;

            console.log(
              `복구: ${historyNumber}/${imageType} → ${backupImage.url}`
            );
          }
        }

        // 복구된 이미지가 있으면 저장
        if (hasRestoredImages) {
          await slope.save();
          result.restoredSlopes++;
          result.details.push({
            historyNumber,
            restoredImageTypes,
          });

          console.log(
            `${historyNumber}: ${restoredImageTypes.join(
              ', '
            )} 이미지 복구 완료`
          );
        }
      } catch (error: any) {
        const errorMsg = `${backup.historyNumber}: ${error.message}`;
        result.errors.push(errorMsg);
        console.error('개별 복구 실패:', errorMsg);
      }
    }

    result.success = true;
    console.log('이미지 복구 완료:', {
      총백업: result.totalBackups,
      매칭된slope: result.foundSlopes,
      복구된slope: result.restoredSlopes,
      복구된이미지: result.restoredImages,
      에러: result.errors.length,
    });
  } catch (error: any) {
    result.success = false;
    result.errors.push(`전체 복구 실패: ${error.message}`);
    console.error('이미지 복구 실패:', error);
  }

  return result;
};

// 복구 컨트롤러 함수
export const restoreImagesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('이미지 복구 요청 받음');

    const result = await restoreImagesFromBackup();

    const responseData = {
      message: result.success ? '이미지 복구 완료' : '이미지 복구 실패',
      success: result.success,
      summary: {
        totalBackups: result.totalBackups,
        foundSlopes: result.foundSlopes,
        restoredSlopes: result.restoredSlopes,
        restoredImages: result.restoredImages,
        notFoundCount: result.notFoundSlopes.length,
        errorCount: result.errors.length,
      },
      details: {
        restoredDetails: result.details,
        notFoundSlopes: result.notFoundSlopes.slice(0, 10), // 최대 10개만 표시
        errors: result.errors.slice(0, 10), // 최대 10개만 표시
      },
      timestamp: new Date(),
    };

    if (result.success) {
      res.status(200).json(responseData);
    } else {
      res.status(500).json(responseData);
    }
  } catch (error: any) {
    console.error('복구 컨트롤러 에러:', error);
    res.status(500).json({
      message: '이미지 복구 중 오류가 발생했습니다.',
      success: false,
      error: error.message,
      timestamp: new Date(),
    });
  }
};
