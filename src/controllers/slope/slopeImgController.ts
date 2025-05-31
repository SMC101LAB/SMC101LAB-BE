import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import Slope from '../../models/Slope';

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
      managementNo: slope.managementNo,
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

// 전체 이미지 수정 (추가/덮어쓰기/삭제를 한 번에 처리)
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
              await deleteImageFromS3(existingImage.url);
              slope.priority.images[pos] = undefined;
              slope.markModified(`priority.images.${pos}`);
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

                // 새 이미지 정보로 업데이트
                slope.priority.images[pos] = {
                  url: file.location,
                  createdAt: new Date(),
                };
                updatedPositions.push(position);
              } catch (error) {
                errors.push(`${position} 위치 이미지 업로드 실패`);
              }
            }
          }
        }

        // 변경사항 저장
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
          message: '이미지 수정 완료',
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
