import { Schema, model, Document } from 'mongoose';
interface SlopeImg {
  // 이미지
  url: string; // url
  createdAt: Date; // 이미지 생성날짜
}
export interface ISlope extends Document {
  managementNo: string;
  name: string;
  location: {
    province: string;
    city: string;
    district: string;
    address?: string;
    roadAddress?: string;
    mountainAddress: string; // 추가
    mainLotNumber: string; // 추가
    subLotNumber: string; // 추가
    coordinates: {
      start: {
        type: string;
        coordinates: [number, number];
        startLatDegree: number;
        startLatMinute: number;
        startLatSecond: number;
        startLongDegree: number;
        startLongMinute: number;
        startLongSecond: number;
      };
      end: {
        type: string;
        coordinates: [number, number];
        endLatDegree: number;
        endLatMinute: number;
        endLatSecond: number;
        endLongDegree: number;
        endLongMinute: number;
        endLongSecond: number;
      };
    };
  };
  management: {
    organization?: string;
    department?: string;
    authority?: string;
  };
  inspections: {
    serialNumber: string;
    date: Date;
    result: string;
  };
  disaster: {
    serialNumber: string;
    riskDate: Date;
    riskLevel: string;
    riskScore: string;
    riskType: string;
  };
  collapseRisk: {
    districtNo: string;
    districtName: string;
    designated: boolean;
    designationDate: Date;
  };
  maintenanceProject: {
    year: string;
    type: string;
  };
  slopeInspectionHistory: {
    historyNumber: string;
    inspectionDate: Date;
  };
  priority: {
    usage: string; // 비탈면용도
    slopeNature: string; // 자연/인공 구분
    slopeType: string; // 비탈면유형
    slopeStructure: string; // 비탈면구조
    maxVerticalHeight: string; // 최고수직고 (단위: m)
    longitudinalLength: string; // 종단길이 (단위: m)
    averageSlope: string; // 평균경사 (단위: 도)
    images: {
      position?: SlopeImg;
      start?: SlopeImg;
      overview?: SlopeImg;
      end?: SlopeImg;
    };
    Score: string; //점수
    grade: string; // 등급
  };
  createdAt: Date;
}

const slopeSchema = new Schema<ISlope>({
  managementNo: {
    type: String, // 관리번호
    required: true,
  },
  name: {
    type: String, // 급경사지명
    required: true,
  },
  location: {
    province: { type: String }, // 시도
    city: { type: String }, // 시군구
    district: { type: String }, // 읍면동
    address: String, // 상세주소
    roadAddress: String, // 도로명주소
    mountainAddress: String, // 산주소여부
    mainLotNumber: String, // 주지번
    subLotNumber: String, // 부지번
    coordinates: {
      start: {
        type: { type: String, default: 'Point' },
        coordinates: {
          type: [Number], // 계산된 시작점 좌표
          required: true,
        },
        startLatDegree: Number, // GIS좌표시점위도도
        startLatMinute: Number, // GIS좌표시점위도분
        startLatSecond: Number, // GIS좌표시점위도초
        startLongDegree: Number, // GIS좌표시점경도도
        startLongMinute: Number, // GIS좌표시점경도분
        startLongSecond: Number, // GIS좌표시점경도초
      },
      end: {
        type: { type: String, default: 'Point' },
        coordinates: {
          type: [Number], // 계산된 종점 좌표
          required: true,
        },
        endLatDegree: Number, // GIS좌표종점위도도
        endLatMinute: Number, // GIS좌표종점위도분
        endLatSecond: Number, // GIS좌표종점위도초
        endLongDegree: Number, // GIS좌표종점경도도
        endLongMinute: Number, // GIS좌표종점경도분
        endLongSecond: Number, // GIS좌표종점경도초
      },
    },
  },
  management: {
    organization: String, // 시행청명
    department: String, // 소관부서명
    authority: String, // 관리주체구분코드
  },
  inspections: {
    serialNumber: String, // 안전점검일련번호
    date: Date, // 안전점검일자
    result: String, // 안전점검결과코드
  },
  disaster: {
    serialNumber: String, // 재해위험도평가일련번호
    riskDate: Date, //재해위험도평가일자
    riskLevel: String, // 재해위험도평가등급코드
    riskScore: String, // 재해위험도평가점수합계
    riskType: String, // 재해위험도평가종류코드
  },
  collapseRisk: {
    districtNo: String, // 붕괴위험지구번호
    districtName: String, // 붕괴위험지구명
    designated: Boolean, // 붕괴위험지구지정여부
    designationDate: Date, // 붕괴위험지구지정일자
  },
  maintenanceProject: {
    year: { type: String }, // 정비사업년도
    type: { type: String }, // 정비사업유형코드
  },
  slopeInspectionHistory: {
    historyNumber: String, // 급경사지일제조사이력번호
    inspectionDate: Date, // 일제조사일자
  },
  priority: {
    usage: String, // 비탈면용도
    slopeNature: String, // 자연/인공 구분
    slopeType: String, // 비탈면유형
    slopeStructure: String, // 비탈면구조
    maxVerticalHeight: String, // 최고수직고 (단위: m)
    longitudinalLength: String, // 종단길이 (단위: m)
    averageSlope: String, // 평균경사 (단위: 도)
    images: {
      position: {
        url: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
      start: {
        url: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
      overview: {
        url: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
      end: {
        url: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    },
    Score: String, // 점수
    grade: String, // 등급
  },
  createdAt: {
    type: Date,
    default: Date.now, // DB 생성일자
  },
});

//위도 경도 계산함수 Props타입
interface CoordinateInput {
  Degree: number;
  Minute: number;
  Second: number;
}

export const calcCoordinate = ({
  Degree,
  Minute,
  Second,
}: CoordinateInput): number => {
  return Math.round(Degree || 0) + (Minute || 0) / 60 + (Second || 0) / 3600;
};
slopeSchema.pre('save', function (next) {
  if (this.isModified('location.coordinates')) {
    const start = this.location.coordinates.start;
    const end = this.location.coordinates.end;

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

    // GeoJSON format: [longitude, latitude]
    this.location.coordinates.start.coordinates = [startLong, startLat];
    this.location.coordinates.start.type = 'Point';

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

    this.location.coordinates.end.coordinates = [endLong, endLat];
    this.location.coordinates.end.type = 'Point';
  }
  next();
});

slopeSchema.index({ 'location.coordinates.start.coordinates': '2dsphere' });
export default model<ISlope>('Slope', slopeSchema);
