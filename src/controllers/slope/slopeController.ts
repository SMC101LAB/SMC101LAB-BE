import { Request, Response, NextFunction } from 'express';
import Slope, { calcCoordinate } from '../../models/Slope';

//급경사지 데이터 삭제 api
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

//급경사지 데이터 수정 api
export const updateSlopes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slopeId, updateData } = req.body;

    // 필수 필드 검증
    if (!slopeId || !updateData) {
      return res.status(400).json({
        success: false,
        message: '급경사지 ID와 수정할 데이터가 필요합니다.',
      });
    }

    // coordinates가 변경되는 경우 위도/경도 계산
    if (updateData.location?.coordinates) {
      const { start, end } = updateData.location.coordinates;

      if (start) {
        const startLat = calcCoordinate({
          Degree: start.startLatDegree,
          Minute: start.startLatMinute,
          Second: start.startLatSecond,
        });

        const startLong = calcCoordinate({
          Degree: start.startLongDegree,
          Minute: start.startLongMinute,
          Second: start.startLongSecond,
        });

        updateData.location.coordinates.start.coordinates = [
          startLong,
          startLat,
        ];
        updateData.location.coordinates.start.type = 'Point';
      }

      if (end) {
        const endLat = calcCoordinate({
          Degree: end.endLatDegree,
          Minute: end.endLatMinute,
          Second: end.endLatSecond,
        });

        const endLong = calcCoordinate({
          Degree: end.endLongDegree,
          Minute: end.endLongMinute,
          Second: end.endLongSecond,
        });

        updateData.location.coordinates.end.coordinates = [endLong, endLat];
        updateData.location.coordinates.end.type = 'Point';
      }
    }

    const updatedSlope = await Slope.findByIdAndUpdate(
      slopeId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedSlope) {
      return res.status(404).json({
        success: false,
        message: '수정할 급경사지를 찾을 수 없습니다.',
      });
    }

    res.status(200).json({
      success: true,
      message: '급경사지 정보가 수정되었습니다.',
      data: updatedSlope,
    });
  } catch (error: any) {
    next(error);
  }
};
