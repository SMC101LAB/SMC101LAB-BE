import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';

//급경사지 삭제 api
export const deleteSlopes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slopeIds } = req.body; // 배열 또는 단일 ID
    const ids = Array.isArray(slopeIds) ? slopeIds : [slopeIds];

    const result = await Slope.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '삭제할 급경사지를 찾을 수 없습니다.',
      });
    }

    res.status(200).json({
      success: true,
      message: `${result.deletedCount}개의 급경사지가 삭제되었습니다.`,
    });
  } catch (error) {
    next(error);
  }
};
