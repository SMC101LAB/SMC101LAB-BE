import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';

//급경사지 검색 조회
export const searchSlopes = async (req: Request, res: Response) => {
  try {
    const { keyWord, longitude, latitude } = req.body;

    const searchSlopes = await Slope.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)],
          },
          distanceField: 'distance',
          spherical: true,
          query: {
            $or: [
              { managementNo: { $regex: keyWord, $options: 'i' } },
              { name: { $regex: keyWord, $options: 'i' } },
              { 'location.province': { $regex: keyWord, $options: 'i' } },
              { 'location.city': { $regex: keyWord, $options: 'i' } },
              { 'location.district': { $regex: keyWord, $options: 'i' } },
              { 'location.address': { $regex: keyWord, $options: 'i' } },
              { 'location.roadAddress': { $regex: keyWord, $options: 'i' } },
              { 'management.organization': { $regex: keyWord, $options: 'i' } },
              { 'management.department': { $regex: keyWord, $options: 'i' } },
              { 'management.authority': { $regex: keyWord, $options: 'i' } },
              {
                'collapseRisk.districtName': { $regex: keyWord, $options: 'i' },
              },
            ],
          },
        },
      },
    ]);

    res.status(200).json({
      message: '급경사지 검색 성공',
      data: searchSlopes,
    });
  } catch (error: any) {
    console.error('Error searching slopes:', error);
    res.status(500).json({
      message: '급경사지 검색 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};
