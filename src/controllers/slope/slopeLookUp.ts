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

//근처 급경사지 조회
export const findNearbySlopes = async (req: Request, res: Response) => {
  try {
    const { longitude, latitude, maxDistance = 5000 } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({
        message: '위도와 경도가 필요합니다.',
      });
    }

    const nearbySlopes = await Slope.find({
      'location.coordinates.start.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)],
          },
          $maxDistance: Number(maxDistance),
        },
      },
    });

    res.status(200).json({
      message: '주변 경사지 조회 성공',
      data: nearbySlopes,
    });
  } catch (error: any) {
    console.error('Error finding nearby slopes:', error);
    res.status(500).json({
      message: '주변 경사지 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};
