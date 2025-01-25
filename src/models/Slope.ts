import { Schema, model, Document } from 'mongoose';

export interface ISlope extends Document {
  managementNo: string;
  name: string;
  location: {
    province: string;
    city: string;
    district: string;
    address?: string;
    roadAddress?: string;
    coordinates: {
      start: {
        coordinates: [number, number];
        startLatDegree: number;
        startLatMinute: number;
        startLatSecond: number;
        startLongDegree: number;
        startLongMinute: number;
        startLongSecond: number;
      };
      end: {
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
  inspections: Array<{
    date: Date;
    result: string;
    riskLevel: string;
    riskType: string;
  }>;
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
  createdAt: Date;
}

const slopeSchema = new Schema<ISlope>({
  managementNo: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  location: {
    province: { type: String },
    city: { type: String },
    district: { type: String },
    address: String,
    roadAddress: String,
    coordinates: {
      start: {
        coordinates: {
          type: [Number],
          required: true,
        },
        startLatDegree: Number,
        startLatMinute: Number,
        startLatSecond: Number,
        startLongDegree: Number,
        startLongMinute: Number,
        startLongSecond: Number,
      },
      end: {
        coordinates: {
          type: [Number],
          required: true,
        },
        endLatDegree: Number,
        endLatMinute: Number,
        endLatSecond: Number,
        endLongDegree: Number,
        endLongMinute: Number,
        endLongSecond: Number,
      },
    },
  },
  management: {
    organization: String,
    department: String,
    authority: String,
  },
  inspections: [
    {
      date: Date,
      result: String,
      riskLevel: String,
      riskType: String,
    },
  ],
  collapseRisk: {
    districtNo: String,
    districtName: String,
    designated: Boolean,
    designationDate: Date,
  },
  maintenanceProject: {
    year: String,
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

//위도 경도 계산함수 Props타입
interface CoordinateInput {
  Degree: number;
  Minute: number;
  Second: number;
}

//위도 경도 계산산
const calcCoordinate = ({
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

    const startLat: CoordinateInput = {
      Degree: start.startLatDegree,
      Minute: start.startLatMinute,
      Second: start.startLatSecond,
    };

    const startLong: CoordinateInput = {
      Degree: start.startLongDegree,
      Minute: start.startLongMinute,
      Second: start.startLongSecond,
    };

    const endLat: CoordinateInput = {
      Degree: end.endLatDegree,
      Minute: end.endLatMinute,
      Second: end.endLatSecond,
    };

    const endLong: CoordinateInput = {
      Degree: end.endLongDegree,
      Minute: end.endLongMinute,
      Second: end.endLongSecond,
    };

    this.location.coordinates.start.coordinates = [
      calcCoordinate(startLong),
      calcCoordinate(startLat),
    ];

    this.location.coordinates.end.coordinates = [
      calcCoordinate(endLong),
      calcCoordinate(endLat),
    ];
  }
  next();
});

export default model<ISlope>('Slope', slopeSchema);
