import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Slope from '../../models/Slope';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

interface ExcelRow {
  관리번호: string;
  급경사지명: string;
  시행청명: string;
  관리주체구분코드: string;
  소관부서명: string;
  시도: string;
  시군구: string;
  읍면동: string;
  상세주소: string;
  도로명주소: string;
  산주소여부: string;
  주지번: string;
  부지번: string;
  GIS좌표시점위도도: string;
  GIS좌표시점위도분: string;
  GIS좌표시점위도초: string;
  GIS좌표시점경도도: string;
  GIS좌표시점경도분: string;
  GIS좌표시점경도초: string;
  GIS좌표종점위도도: string;
  GIS좌표종점위도분: string;
  GIS좌표종점위도초: string;
  GIS좌표종점경도도: string;
  GIS좌표종점경도분: string;
  GIS좌표종점경도초: string;
  급경사지일제조사이력번호: string;
  일제조사일자: string;
  붕괴위험지구번호?: string;
  붕괴위험지구명?: string;
  붕괴위험지구지정여부?: string;
  붕괴위험지구지정일자?: string;
  정비사업년도?: string;
  정비사업유형코드?: string;
  안전점검일련번호?: string;
  안전점검일자?: string;
  안전점검결과코드?: string;
  재해위험도평가일련번호: string;
  재해위험도평가일자: string;
  재해위험도평가등급코드?: string;
  재해위험도평가점수합계: string;
  재해위험도평가종류코드?: string;
}

export const batchAddSlopeData = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: '파일이 업로드되지 않았습니다.' });
      }

      const workbook = XLSX.read(req.file.buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

      const slopeData = rows
        .filter((row) => row.관리번호 && row.급경사지명)
        .map((row) => {
          return {
            managementNo: row.관리번호,
            name: row.급경사지명,
            location: {
              province: row.시도,
              city: row.시군구,
              district: row.읍면동,
              address: row.상세주소,
              roadAddress: row.도로명주소,
              mountainAddress: row.산주소여부, // 추가
              mainLotNumber: row.주지번, // 추가
              subLotNumber: row.부지번, // 추가
              coordinates: {
                start: {
                  coordinates: [
                    Number(row.GIS좌표시점경도도) +
                      Number(row.GIS좌표시점경도분) / 60 +
                      Number(row.GIS좌표시점경도초) / 3600,
                    Number(row.GIS좌표시점위도도) +
                      Number(row.GIS좌표시점위도분) / 60 +
                      Number(row.GIS좌표시점위도초) / 3600,
                  ],
                  startLatDegree: Number(row.GIS좌표시점위도도),
                  startLatMinute: Number(row.GIS좌표시점위도분),
                  startLatSecond: Number(row.GIS좌표시점위도초),
                  startLongDegree: Number(row.GIS좌표시점경도도),
                  startLongMinute: Number(row.GIS좌표시점경도분),
                  startLongSecond: Number(row.GIS좌표시점경도초),
                },
                end: {
                  coordinates: [
                    Number(row.GIS좌표종점경도도) +
                      Number(row.GIS좌표종점경도분) / 60 +
                      Number(row.GIS좌표종점경도초) / 3600,
                    Number(row.GIS좌표종점위도도) +
                      Number(row.GIS좌표종점위도분) / 60 +
                      Number(row.GIS좌표종점위도초) / 3600,
                  ],
                  endLatDegree: Number(row.GIS좌표종점위도도),
                  endLatMinute: Number(row.GIS좌표종점위도분),
                  endLatSecond: Number(row.GIS좌표종점위도초),
                  endLongDegree: Number(row.GIS좌표종점경도도),
                  endLongMinute: Number(row.GIS좌표종점경도분),
                  endLongSecond: Number(row.GIS좌표종점경도초),
                },
              },
            },
            management: {
              organization: row.시행청명,
              department: row.소관부서명,
              authority: row.관리주체구분코드,
            },
            inspections: row.안전점검일자
              ? [
                  {
                    date: new Date(row.안전점검일자),
                    result: row.안전점검결과코드,
                    riskLevel: row.재해위험도평가등급코드,
                    riskType: row.재해위험도평가종류코드,
                    riskScore: row.재해위험도평가점수합계, // 추가
                    serialNumber: row.재해위험도평가일련번호, // 추가
                  },
                ]
              : [],
            collapseRisk: {
              districtNo: row.붕괴위험지구번호,
              districtName: row.붕괴위험지구명,
              designated: row.붕괴위험지구지정여부 === 'Y',
              designationDate: row.붕괴위험지구지정일자
                ? new Date(row.붕괴위험지구지정일자)
                : null,
            },
            maintenanceProject:
              row.정비사업년도 || row.정비사업유형코드
                ? {
                    year: String(row.정비사업년도 || ''),
                    type: String(row.정비사업유형코드 || ''),
                  }
                : null,
            slopeInspectionHistory: {
              // 추가
              historyNumber: row.급경사지일제조사이력번호,
              inspectionDate: row.일제조사일자,
            },
          };
        });
      await Slope.insertMany(slopeData);

      res.status(200).json({
        message: '데이터가 성공적으로 업로드되었습니다.',
        count: slopeData.length,
      });
    } catch (error: any) {
      console.error('Error uploading slope data:', error);
      res.status(500).json({
        message: '데이터 업로드 중 오류가 발생했습니다.',
        error: error.message,
      });
    }
  },
];
