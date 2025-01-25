import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';

//이상 데이터 찾기 ( 중복 manageNo,managementNo,name, 도, 시, 상세주소)
export const getOutlierData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.',
      });
    }

    const [duplicates, emptyFields] = await Promise.all([
      findDuplicates(),
      findEmptyFields(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        dup: duplicates,
        empty: emptyFields,
      },
    });
  } catch (error) {
    next(error);
  }
};
//중복값찾기
const findDuplicates = async () => {
  const duplicates = await Slope.aggregate([
    {
      $group: {
        _id: '$managementNo', // 확인하고 싶은 필드
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);
  console.log('Duplicates:', duplicates);
  return duplicates;
};

// 빈 값 확인
const findEmptyFields = async () => {
  const emptyFields = await Slope.find({
    $or: [
      { managementNo: { $in: [null, ''] } },
      { name: { $in: [null, ''] } },
      { 'location.province': { $in: [null, ''] } },
      { 'location.city': { $in: [null, ''] } },
      { 'location.district': { $in: [null, ''] } },
    ],
  });
  console.log('Empty fields:', emptyFields);
  return emptyFields;
};
