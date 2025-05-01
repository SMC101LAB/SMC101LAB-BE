import { Request, Response, NextFunction } from 'express';
import Slope from '../../models/Slope';
import ExcelJS from 'exceljs';
import { ExcelRow } from './slopeAddBatch';

// 전체 급경사지지 조회 (관리자용)
interface FilterQuery {
  'location.province'?: string;
  'location.city'?: RegExp;
  $or?: Array<{ [key: string]: RegExp }>;
}

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

    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const city = req.query.city as string;
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
      ];
    }

    // 전체 문서 수 계산
    const totalCount = await Slope.countDocuments(filterQuery);

    // 페이지네이션된 데이터 조회
    const slopes = await Slope.find(filterQuery)
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

//엑셀파일 다운로드
export const downloadSlopesExcel = async (
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

    const { city, county, searchQuery } = req.query;

    // 필터 쿼리 구성
    let filterQuery: FilterQuery = {};

    if (city) {
      filterQuery['location.province'] = city as string;
      if (county && county !== '모두') {
        filterQuery['location.city'] = new RegExp(county as string, 'i');
      }
    }

    if (searchQuery) {
      filterQuery.$or = [
        { managementNo: new RegExp(searchQuery as string, 'i') },
        { name: new RegExp(searchQuery as string, 'i') },
        { 'management.organization': new RegExp(searchQuery as string, 'i') },
        { 'management.authority': new RegExp(searchQuery as string, 'i') },
        { 'management.department': new RegExp(searchQuery as string, 'i') },
        { 'location.province': new RegExp(searchQuery as string, 'i') },
        { 'location.city': new RegExp(searchQuery as string, 'i') },
        { 'location.district': new RegExp(searchQuery as string, 'i') },
        { 'location.address': new RegExp(searchQuery as string, 'i') },
        { 'location.roadAddress': new RegExp(searchQuery as string, 'i') },
        { 'disaster.riskType': new RegExp(searchQuery as string, 'i') },
        { 'disaster.riskLevel': new RegExp(searchQuery as string, 'i') },
      ];
    }

    // 데이터 조회
    const slopes = await Slope.find(filterQuery);

    // 엑셀 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('급경사지 목록');

    // 헤더 설정
    const headers: (keyof ExcelRow)[] = [
      '관리번호',
      '급경사지명',
      '시행청명',
      '관리주체구분코드',
      '소관부서명',
      '시도',
      '시군구',
      '읍면동',
      '상세주소',
      '도로명상세주소',
      '산주소여부',
      '주지번',
      '부지번',
      'GIS좌표시점위도도',
      'GIS좌표시점위도분',
      'GIS좌표시점위도초',
      'GIS좌표시점경도도',
      'GIS좌표시점경도분',
      'GIS좌표시점경도초',
      'GIS좌표종점위도도',
      'GIS좌표종점위도분',
      'GIS좌표종점위도초',
      'GIS좌표종점경도도',
      'GIS좌표종점경도분',
      'GIS좌표종점경도초',
      '급경사지일제조사이력번호',
      '일제조사일자',
      '안전점검일련번호',
      '안전점검일자',
      '안전점검결과코드',
      '재해위험도평가일련번호',
      '재해위험도평가일자',
      '재해위험도평가등급코드',
      '재해위험도평가점수합계',
      '재해위험도평가종류코드',
      '붕괴위험지구번호',
      '붕괴위험지구명',
      '붕괴위험지구지정여부',
      '붕괴위험지구지정일자',
      '정비사업년도',
      '정비사업유형코드',
      '비탈면용도',
      '자연/인공',
      '비탈면유형',
      '비탈면구조',
      '최고수직고',
      '종단길이',
      '평균경사',
      '위치도',
      '점수',
      '등급',
    ];

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: 20,
    }));
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAEAEA' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    function formatDate(date: Date | string | undefined): string {
      if (!date) return '';

      const d = date instanceof Date ? date : new Date(date);

      // 유효한 날짜인지 확인
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    // 데이터 추가
    slopes.forEach((slope) => {
      const row: ExcelRow = {
        관리번호: slope.managementNo,
        급경사지명: slope.name,
        시행청명: slope.management?.organization || '',
        관리주체구분코드: slope.management?.authority || '',
        소관부서명: slope.management?.department || '',
        시도: slope.location.province,
        시군구: slope.location.city,
        읍면동: slope.location.district,
        상세주소: slope.location.address || '',
        도로명상세주소: slope.location.roadAddress || '',
        산주소여부: slope.location.mountainAddress || '',
        주지번: slope.location.mainLotNumber || '',
        부지번: slope.location.subLotNumber || '',
        GIS좌표시점위도도: String(
          slope.location.coordinates.start.startLatDegree || ''
        ),
        GIS좌표시점위도분: String(
          slope.location.coordinates.start.startLatMinute || ''
        ),
        GIS좌표시점위도초: String(
          slope.location.coordinates.start.startLatSecond || ''
        ),
        GIS좌표시점경도도: String(
          slope.location.coordinates.start.startLongDegree || ''
        ),
        GIS좌표시점경도분: String(
          slope.location.coordinates.start.startLongMinute || ''
        ),
        GIS좌표시점경도초: String(
          slope.location.coordinates.start.startLongSecond || ''
        ),
        GIS좌표종점위도도: String(
          slope.location.coordinates.end.endLatDegree || ''
        ),
        GIS좌표종점위도분: String(
          slope.location.coordinates.end.endLatMinute || ''
        ),
        GIS좌표종점위도초: String(
          slope.location.coordinates.end.endLatSecond || ''
        ),
        GIS좌표종점경도도: String(
          slope.location.coordinates.end.endLongDegree || ''
        ),
        GIS좌표종점경도분: String(
          slope.location.coordinates.end.endLongMinute || ''
        ),
        GIS좌표종점경도초: String(
          slope.location.coordinates.end.endLongSecond || ''
        ),
        급경사지일제조사이력번호:
          slope.slopeInspectionHistory?.historyNumber || '',
        일제조사일자: slope.slopeInspectionHistory?.inspectionDate || '',
        붕괴위험지구번호: slope.collapseRisk?.districtNo || '',
        붕괴위험지구명: slope.collapseRisk?.districtName || '',
        붕괴위험지구지정여부: slope.collapseRisk?.designated
          ? '지정'
          : '미지정',
        붕괴위험지구지정일자: slope.collapseRisk?.designationDate || '',
        정비사업년도: slope.maintenanceProject?.year || '',
        정비사업유형코드: slope.maintenanceProject?.type || '',
        안전점검일련번호: slope.inspections?.serialNumber || '',
        안전점검일자: slope.inspections?.date || '',
        안전점검결과코드: slope.inspections?.result || '',
        재해위험도평가일련번호: slope.disaster?.serialNumber || '',
        재해위험도평가일자: slope.disaster?.riskDate || '',
        재해위험도평가등급코드: slope.disaster?.riskLevel || '',
        재해위험도평가점수합계: slope.disaster?.riskScore || '',
        재해위험도평가종류코드: slope.disaster?.riskType || '',
        // Priority 필드 추가
        비탈면용도: slope.priority?.usage || '',
        '자연/인공': slope.priority?.slopeNature || '',
        비탈면유형: slope.priority?.slopeType || '',
        비탈면구조: slope.priority?.slopeStructure || '',
        최고수직고: String(slope.priority?.maxVerticalHeight || ''),
        종단길이: String(slope.priority?.longitudinalLength || ''),
        평균경사: String(slope.priority?.averageSlope || ''),
        위치도:
          slope.priority?.images && slope.priority.images.length > 0
            ? slope.priority.images[0].url || ''
            : '',
        점수: slope.priority?.Score || '',
        등급: slope.priority?.grade || '',
      };
      worksheet.addRow(row);
    });

    // 파일 이름 설정
    const fileName = `slopes_${new Date().toISOString().split('T')[0]}.xlsx`;

    // 응답 헤더 설정
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // 엑셀 파일 스트림 전송
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
