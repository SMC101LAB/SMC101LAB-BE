import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';

// 전체 급경사지지 조회 (관리자용)
export const getAllSlopes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 관리자 권한 확인
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.',
      });
    }

    const slope = await Slope.find();

    res.status(200).json({
      success: true,
      data: slope,
    });
  } catch (error) {
    next(error);
  }
};
