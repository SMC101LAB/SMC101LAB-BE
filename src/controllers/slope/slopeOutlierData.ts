import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';

interface FilterQuery {
  'location.province'?: string;
  'location.city'?: RegExp;
  'priority.grade'?: RegExp;
  $or?: Array<{ [key: string]: RegExp }>;
  [key: string]: any;
}

// 중복된 관리번호를 가진 경사지 조회 (관리자용)
export const getOutlierDup = async (
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

    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const city = req.query.city as string;
    const grade = req.query.grade as string;
    const county = req.query.county as string;
    const searchQuery = req.query.searchQuery as string;

    // 기본 필터 쿼리
    let filterQuery: FilterQuery = {};

    // 지역 필터 적용
    if (city) {
      filterQuery['location.province'] = city;
      if (county && county !== '모두') {
        filterQuery['location.city'] = new RegExp(county, 'i');
      }
    }
    if (grade && grade !== '선택안함')
      filterQuery['priority.grade'] = new RegExp(`^${grade}$`);

    // 검색어 필터 적용
    if (searchQuery) {
      filterQuery.$or = [
        { managementNo: new RegExp(searchQuery, 'i') },
        { name: new RegExp(searchQuery, 'i') },
        { 'management.organization': new RegExp(searchQuery, 'i') },
        { 'management.authority': new RegExp(searchQuery, 'i') },
        { 'management.department': new RegExp(searchQuery, 'i') },
        { 'location.province': new RegExp(searchQuery, 'i') },
        { 'location.city': new RegExp(searchQuery, 'i') },
        { 'location.district': new RegExp(searchQuery, 'i') },
        { 'location.address': new RegExp(searchQuery, 'i') },
        { 'location.roadAddress': new RegExp(searchQuery, 'i') },
        { 'disaster.riskType': new RegExp(searchQuery, 'i') },
        { 'disaster.riskLevel': new RegExp(searchQuery, 'i') },
        { 'priority.usage': new RegExp(searchQuery, 'i') },
        { 'priority.slopeNature': new RegExp(searchQuery, 'i') },
        { 'priority.slopeType': new RegExp(searchQuery, 'i') },
        { 'priority.slopeStructure': new RegExp(searchQuery, 'i') },
        { 'priority.grade': new RegExp(searchQuery, 'i') },
      ];
    }

    try {
      // 1단계: 중복된 managementNo 값 찾기
      // 중복된 관리번호 그룹 찾기
      const duplicateManagementNosGroups = await Slope.aggregate([
        { $match: filterQuery },
        {
          $group: {
            _id: '$managementNo',
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
            _id: { $nin: [null, ''] }, // null이나 빈 문자열 제외
          },
        },
      ]);

      // 중복된 관리번호가 없는 경우 빈 결과 반환
      if (duplicateManagementNosGroups.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: {
            totalCount: 0,
            currentPage: page,
            pageSize,
            hasMore: false,
          },
        });
      }

      // 중복된 관리번호 목록 추출
      const duplicateManagementNos = duplicateManagementNosGroups.map(
        (group) => group._id
      );

      // 2단계: 중복된 관리번호를 가진 전체 문서 개수 계산
      const totalCount = await Slope.countDocuments({
        ...filterQuery,
        managementNo: { $in: duplicateManagementNos },
      });

      // 3단계: 페이지네이션된 결과 조회
      const slopes = await Slope.find({
        ...filterQuery,
        managementNo: { $in: duplicateManagementNos },
      })
        .lean()
        .skip(page * pageSize)
        .limit(pageSize)
        .sort({ managementNo: 1, createdAt: -1 }); // 먼저 관리번호로 정렬하고, 같은 번호 내에서는 최신순

      // 결과 반환
      res.status(200).json({
        success: true,
        data: slopes,
        meta: {
          totalCount,
          currentPage: page,
          pageSize,
          hasMore: (page + 1) * pageSize < totalCount,
        },
      });
    } catch (aggregateError: any) {
      console.error('중복 항목 조회 오류:', aggregateError);
      return res.status(500).json({
        success: false,
        message: '중복 항목 조회 중 오류가 발생했습니다.',
        error: aggregateError.message,
      });
    }
  } catch (error) {
    console.error('getOutlierDup 오류:', error);
    next(error);
  }
};

// 빈 값이 있는 경사지 조회 (관리자용)
export const getOutlierEmpty = async (
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

    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const city = req.query.city as string;
    const grade = req.query.grade as string;
    const county = req.query.county as string;
    const searchQuery = req.query.searchQuery as string;

    // 기본 필터 쿼리
    let filterQuery: FilterQuery = {};

    // 지역 필터 적용
    if (city) {
      filterQuery['location.province'] = city;
      if (county && county !== '모두') {
        filterQuery['location.city'] = new RegExp(county, 'i');
      }
    }
    if (grade && grade !== '선택안함')
      filterQuery['priority.grade'] = new RegExp(`^${grade}$`);

    // 검색어 필터 적용
    if (searchQuery) {
      filterQuery.$or = [
        { managementNo: new RegExp(searchQuery, 'i') },
        { name: new RegExp(searchQuery, 'i') },
        { 'management.organization': new RegExp(searchQuery, 'i') },
        { 'management.authority': new RegExp(searchQuery, 'i') },
        { 'management.department': new RegExp(searchQuery, 'i') },
        { 'location.province': new RegExp(searchQuery, 'i') },
        { 'location.city': new RegExp(searchQuery, 'i') },
        { 'location.district': new RegExp(searchQuery, 'i') },
        { 'location.address': new RegExp(searchQuery, 'i') },
        { 'location.roadAddress': new RegExp(searchQuery, 'i') },
        { 'disaster.riskType': new RegExp(searchQuery, 'i') },
        { 'disaster.riskLevel': new RegExp(searchQuery, 'i') },
        { 'priority.usage': new RegExp(searchQuery, 'i') },
        { 'priority.slopeNature': new RegExp(searchQuery, 'i') },
        { 'priority.slopeType': new RegExp(searchQuery, 'i') },
        { 'priority.slopeStructure': new RegExp(searchQuery, 'i') },
        { 'priority.grade': new RegExp(searchQuery, 'i') },
      ];
    }

    // 빈 값 조건 추가
    const emptyFieldsQuery = {
      ...filterQuery,
      $or: [
        { managementNo: { $in: [null, ''] } },
        { name: { $in: [null, ''] } },
        { 'location.province': { $in: [null, ''] } },
        { 'location.city': { $in: [null, ''] } },
        { 'location.district': { $in: [null, ''] } },
      ],
    };

    // 전체 문서 수 계산
    const totalCount = await Slope.countDocuments(emptyFieldsQuery);

    // 페이지네이션된 데이터 조회
    const slopes = await Slope.find(emptyFieldsQuery)
      .lean()
      .skip(page * pageSize)
      .limit(pageSize)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: slopes,
      meta: {
        totalCount,
        currentPage: page,
        pageSize,
        hasMore: (page + 1) * pageSize < totalCount,
      },
    });
  } catch (error) {
    console.error('getOutlierEmpty 오류:', error);
    next(error);
  }
};
