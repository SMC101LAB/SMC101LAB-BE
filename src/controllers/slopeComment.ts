import { S3Client } from '@aws-sdk/client-s3';
import { Request, Response } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Comment from '../models/Comment';
import CommentImageBackup from '../models/CommentImageBackup';
import { deleteImageFromS3 } from './slope/slopeImgController';

// s3 직접 생성
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION!,
});
interface AuthRequest extends Request {
  user: {
    id: string;
    isAdmin: boolean;
  };
}

interface CommentRequest extends AuthRequest {
  params: {
    historyNumber: string;
    commentId?: string;
  };
  files?: Express.MulterS3.File[];
  body: {
    historyNumber?: string;
    content: string;
    keepImageUrls?: string;
  };
}

interface UpdateData {
  content: string;
  updatedAt: Date;
  imageUrls?: string[];
}

// Comment 백업 업데이트 헬퍼 함수
const updateCommentImageBackup = async (
  historyNumber: string,
  commentId: string,
  imageUrls: string[] | null
): Promise<void> => {
  try {
    // 백업 데이터 찾기 또는 생성
    let backup = await CommentImageBackup.findOne({
      historyNumber,
      commentId: new mongoose.Types.ObjectId(commentId),
    });

    if (!backup) {
      // 새 백업 문서 생성
      backup = new CommentImageBackup({
        historyNumber,
        commentId: new mongoose.Types.ObjectId(commentId),
        imageUrls: [],
        lastBackupAt: new Date(),
      });
    }

    // 이미지 업데이트 또는 삭제
    if (imageUrls) {
      // 이미지 추가/수정
      backup.imageUrls = imageUrls;
    } else {
      // 이미지 삭제
      backup.imageUrls = [];
    }

    backup.lastBackupAt = new Date();
    await backup.save();

    console.log(`Comment 백업 업데이트 완료: ${historyNumber}/${commentId}`);
  } catch (error) {
    console.error(
      `Comment 백업 업데이트 실패: ${historyNumber}/${commentId}`,
      error
    );
    // 백업 실패해도 메인 작업은 계속 진행
  }
};

// Comment용 Multer S3 설정
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME!,
    key: function (req, file, cb) {
      const { historyNumber } = (req as any).body;
      const commentId = (req as any).commentId || 'temp'; // 새 댓글의 경우 임시 ID
      const timestamp = Date.now();
      const uuid = uuidv4();
      const ext = file.originalname.split('.').pop();
      cb(
        null,
        `defectImg/${historyNumber}/comments/${commentId}/${timestamp}_${uuid}.${ext}`
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.') as any, false);
    }
  },
});

// 댓글 조회 (historyNumber 기준으로 변경)
export const getCommentsSlope = async (req: Request, res: Response) => {
  try {
    const { historyNumber } = req.params;

    if (!historyNumber) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 historyNumber입니다.',
      });
    }

    const comments = await Comment.find({ historyNumber })
      .populate('userId', 'name organization isAdmin')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error in getCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글을 불러오는 중 오류가 발생했습니다.',
    });
  }
};

// 댓글 추가 (S3 + 백업)
export const addCommentsSlope = async (req: CommentRequest, res: Response) => {
  try {
    const userId = req.user.id;
    let newComment: any = null;
    // 먼저 multer로 파일 업로드 처리
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      try {
        // multer 실행 후에 body 접근
        const { historyNumber, content } = req.body;

        if (!historyNumber) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 historyNumber입니다.',
          });
        }

        // 1. 먼저 댓글을 생성하여 commentId를 얻음
        const newComment = new Comment({
          historyNumber,
          userId: new mongoose.Types.ObjectId(userId),
          content,
          imageUrls: [], // 일단 빈 배열로 생성
        });

        await newComment.save();

        // 2. 이미지 URL 처리
        const files = req.files as Express.MulterS3.File[];
        const imageUrls =
          files && Array.isArray(files)
            ? files.map((file) => file.location)
            : [];

        // 3. 댓글에 이미지 URL 업데이트
        newComment.imageUrls = imageUrls;
        await newComment.save();

        // 4. 백업 생성
        if (imageUrls.length > 0) {
          await updateCommentImageBackup(
            historyNumber,
            (newComment._id as mongoose.Types.ObjectId).toString(),
            imageUrls
          );
        }

        // 5. populate하여 응답
        const populatedComment = await Comment.findById(newComment._id)
          .populate('userId', 'name organization')
          .lean();

        res.status(201).json({
          success: true,
          data: populatedComment,
        });
      } catch (saveError) {
        console.error('댓글 이미지 저장 에러:', saveError);

        // S3에 업로드된 이미지들 삭제
        const files = req.files as Express.MulterS3.File[];
        if (files && Array.isArray(files)) {
          for (const file of files) {
            try {
              await deleteImageFromS3(file.location);
            } catch (deleteError) {
              console.error('S3 이미지 삭제 실패:', deleteError);
            }
          }
        }

        // 생성된 댓글도 삭제
        if (newComment && newComment._id) {
          await Comment.findByIdAndDelete(newComment._id);
        }

        res.status(500).json({
          success: false,
          error: '댓글 작성 중 오류가 발생했습니다.',
        });
      }
    });
  } catch (error) {
    console.error('Error in addCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글 작성 중 오류가 발생했습니다.',
    });
  }
};
// 댓글 수정 (S3 + 백업)
export const updateCommentsSlope = async (
  req: CommentRequest,
  res: Response
) => {
  try {
    const { commentId } = req.params;
    const { content, keepImageUrls } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(commentId!)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 commentId입니다.',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: '댓글을 찾을 수 없습니다.',
      });
    }

    if (comment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: '댓글 수정 권한이 없습니다.',
      });
    }

    // commentId를 req에 추가
    (req as any).commentId = commentId;

    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      try {
        let updateData: UpdateData = {
          content,
          updatedAt: new Date(),
        };

        // keepImageUrls 정규화
        const keepUrls = keepImageUrls
          ? (JSON.parse(keepImageUrls) as string[])
          : [];

        // 삭제할 이미지들 S3에서 삭제
        if (comment.imageUrls) {
          const imagesToDelete = comment.imageUrls.filter(
            (url) => !keepUrls.includes(url)
          );
          for (const url of imagesToDelete) {
            try {
              await deleteImageFromS3(url);
            } catch (deleteError) {
              console.error('S3 이미지 삭제 실패:', url, deleteError);
            }
          }
        }

        // 새로운 이미지 URL 배열 생성
        let newImageUrls = [...keepUrls];

        // 새로 업로드된 파일이 있으면 추가
        const files = req.files as Express.MulterS3.File[];
        if (files && files.length > 0) {
          const newUrls = files.map((file) => file.location);
          newImageUrls = [...newImageUrls, ...newUrls];
        }

        // 최종 이미지 URL 배열 업데이트
        updateData.imageUrls = newImageUrls;

        const updatedComment = await Comment.findByIdAndUpdate(
          commentId,
          updateData,
          { new: true }
        ).populate('userId', 'name organization isAdmin');

        // 백업 업데이트
        await updateCommentImageBackup(
          comment.historyNumber,
          commentId!,
          newImageUrls
        );

        res.status(200).json({
          success: true,
          data: updatedComment,
        });
      } catch (saveError) {
        console.error('댓글 수정 에러:', saveError);
        res.status(500).json({
          success: false,
          error: '댓글 수정 중 오류가 발생했습니다.',
        });
      }
    });
  } catch (error) {
    console.error('Error in updateCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글 수정 중 오류가 발생했습니다.',
    });
  }
};

// 댓글 삭제 (S3 + 백업)
export const deleteCommentsSlope = async (
  req: CommentRequest,
  res: Response
) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(commentId!)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 commentId입니다.',
      });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: '댓글을 찾을 수 없습니다.',
      });
    }

    if (comment.userId.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: '댓글 삭제 권한이 없습니다.',
      });
    }

    // S3에서 이미지 삭제
    if (comment.imageUrls && comment.imageUrls.length > 0) {
      for (const url of comment.imageUrls) {
        try {
          await deleteImageFromS3(url);
          console.log('S3 이미지 삭제 완료:', url);
        } catch (error) {
          console.error('S3 이미지 삭제 실패:', url, error);
        }
      }
    }

    // 백업에서도 삭제
    await updateCommentImageBackup(
      comment.historyNumber,
      commentId!,
      null // null = 삭제
    );

    // 댓글 삭제
    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({
      success: true,
      message: '댓글과 관련 이미지가 성공적으로 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Error in deleteCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글 삭제 중 오류가 발생했습니다.',
    });
  }
};

// Comment 이미지 복구 함수
export const restoreCommentImagesFromBackup = async (): Promise<{
  success: boolean;
  totalBackups: number;
  foundComments: number;
  restoredComments: number;
  restoredImages: number;
  notFoundComments: string[];
  errors: string[];
}> => {
  console.log('Comment 이미지 복구 시작:', new Date());

  const result = {
    success: false,
    totalBackups: 0,
    foundComments: 0,
    restoredComments: 0,
    restoredImages: 0,
    notFoundComments: [] as string[],
    errors: [] as string[],
  };

  try {
    const backups = await CommentImageBackup.find({});
    result.totalBackups = backups.length;

    console.log(`총 ${backups.length}개의 Comment 백업 데이터 발견`);

    for (const backup of backups) {
      try {
        const comment = await Comment.findById(backup.commentId);

        if (!comment) {
          result.notFoundComments.push(backup.commentId.toString());
          continue;
        }

        result.foundComments++;

        // 백업에 이미지가 있고, 현재 댓글에 이미지가 없거나 적은 경우 복구
        if (
          backup.imageUrls.length > 0 &&
          backup.imageUrls.length > comment.imageUrls.length
        ) {
          comment.imageUrls = backup.imageUrls;
          await comment.save();

          result.restoredComments++;
          result.restoredImages += backup.imageUrls.length;

          console.log(
            `복구: ${backup.historyNumber}/${backup.commentId} → ${backup.imageUrls.length}개 이미지`
          );
        }
      } catch (error: any) {
        const errorMsg = `${backup.commentId}: ${error.message}`;
        result.errors.push(errorMsg);
        console.error('개별 복구 실패:', errorMsg);
      }
    }

    result.success = true;
    console.log('Comment 이미지 복구 완료:', result);
  } catch (error: any) {
    result.success = false;
    result.errors.push(`전체 복구 실패: ${error.message}`);
    console.error('Comment 이미지 복구 실패:', error);
  }

  return result;
};

// Comment 복구 컨트롤러
export const restoreCommentImagesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('Comment 이미지 복구 요청 받음');

    const result = await restoreCommentImagesFromBackup();

    const responseData = {
      message: result.success
        ? 'Comment 이미지 복구 완료'
        : 'Comment 이미지 복구 실패',
      success: result.success,
      summary: {
        totalBackups: result.totalBackups,
        foundComments: result.foundComments,
        restoredComments: result.restoredComments,
        restoredImages: result.restoredImages,
        notFoundCount: result.notFoundComments.length,
        errorCount: result.errors.length,
      },
      timestamp: new Date(),
    };

    if (result.success) {
      res.status(200).json(responseData);
    } else {
      res.status(500).json(responseData);
    }
  } catch (error: any) {
    console.error('Comment 복구 컨트롤러 에러:', error);
    res.status(500).json({
      message: 'Comment 이미지 복구 중 오류가 발생했습니다.',
      success: false,
      error: error.message,
      timestamp: new Date(),
    });
  }
};
