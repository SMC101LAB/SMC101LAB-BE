import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Comment from '../models/Comment';
import path from 'path';
import fs from 'fs';

interface AuthRequest extends Request {
  user: {
    id: string;
    isAdmin: boolean;
  };
}
interface UpdateData {
  content: string;
  updatedAt: Date;
  imageUrls?: string[];
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
  },
});

// 댓글 조회
export const getCommentsSlope = async (req: Request, res: Response) => {
  try {
    const { slopeId } = req.params;

    // slopeId의 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(slopeId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 slopeId입니다.',
      });
    }

    const comments = await Comment.find({ slopeId })
      .populate('userId', 'name organization isAdmin') // 사용자 정보 포함
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

// 댓글 추가
export const addCommentsSlope = async (req: AuthRequest, res: Response) => {
  try {
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      const { slopeId, content } = req.body;
      const userId = req.user.id;

      if (!mongoose.Types.ObjectId.isValid(slopeId)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 slopeId입니다.',
        });
      }

      // 이미지 처리 부분 수정
      const files = req.files as Express.Multer.File[];
      const imageUrls =
        files && Array.isArray(files)
          ? files.map((file) => `/uploads/${file.filename}`)
          : [];

      const newComment = new Comment({
        slopeId: new mongoose.Types.ObjectId(slopeId),
        userId: new mongoose.Types.ObjectId(userId),
        content,
        imageUrls,
      });

      await newComment.save();

      // populate 시 모든 필요 필드를 명시적으로 포함
      const populatedComment = await Comment.findById(newComment._id)
        .populate('userId', 'name organization')
        .lean();

      res.status(201).json({
        success: true,
        data: populatedComment,
      });
    });
  } catch (error) {
    console.error('Error in addCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글 작성 중 오류가 발생했습니다.',
    });
  }
};

// 댓글 수정
export const updateCommentsSlope = async (req: AuthRequest, res: Response) => {
  try {
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      const { commentId, content, keepImageUrls } = req.body;
      const userId = req.user.id;

      if (!mongoose.Types.ObjectId.isValid(commentId)) {
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

      let updateData: UpdateData = {
        content,
        updatedAt: new Date(),
      };

      // keepImageUrls가 존재하면 배열로 변환, 없으면 빈 배열
      const keepUrls = keepImageUrls
        ? (JSON.parse(keepImageUrls) as string[])
        : [];

      // 유지하지 않을 이미지들 삭제
      if (comment.imageUrls) {
        comment.imageUrls.forEach((url) => {
          if (!keepUrls.includes(url)) {
            const oldImagePath = path.join(__dirname, '..', url);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
        });
      }

      // 새로운 이미지 URL 배열 생성
      let newImageUrls = [...keepUrls];

      // 새로 업로드된 파일이 있으면 추가
      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        const newUrls = (req.files as Express.Multer.File[]).map(
          (file) => `/uploads/${file.filename}`
        );
        newImageUrls = [...newImageUrls, ...newUrls];
      }

      // 최종 이미지 URL 배열 업데이트
      updateData.imageUrls = newImageUrls;

      const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        updateData,
        { new: true }
      ).populate('userId', 'name organization isAdmin');

      res.status(200).json({
        success: true,
        data: updatedComment,
      });
    });
  } catch (error) {
    console.error('Error in updateCommentsSlope:', error);
    res.status(500).json({
      success: false,
      error: '댓글 수정 중 오류가 발생했습니다.',
    });
  }
};

export const deleteCommentsSlope = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
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

    // 이미지 파일 삭제
    if (comment.imageUrls && comment.imageUrls.length > 0) {
      comment.imageUrls.forEach((url) => {
        try {
          // 이미지 경로 처리 수정
          const imagePath = path.join(process.cwd(), url);
          console.log('Deleting image at:', imagePath);
          fs.unlinkSync(imagePath); //이미지 삭제
        } catch (error) {
          console.error('Error deleting image:', url, error);
        }
      });
    }

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
