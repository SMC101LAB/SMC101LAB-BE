// models/SlopeImageBackup.ts
import { Schema, model, Document } from 'mongoose';

interface SlopeImg {
  url: string;
  createdAt: Date;
}

export interface ISlopeImageBackup extends Document {
  historyNumber: string; // 유일 식별자
  images: {
    position?: SlopeImg;
    start?: SlopeImg;
    overview?: SlopeImg;
    end?: SlopeImg;
  };
  lastBackupAt: Date; // 마지막 백업 시간
  createdAt: Date;
}

const slopeImageBackupSchema = new Schema<ISlopeImageBackup>({
  historyNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  images: {
    position: {
      url: { type: String },
      createdAt: { type: Date },
    },
    start: {
      url: { type: String },
      createdAt: { type: Date },
    },
    overview: {
      url: { type: String },
      createdAt: { type: Date },
    },
    end: {
      url: { type: String },
      createdAt: { type: Date },
    },
  },
  lastBackupAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default model<ISlopeImageBackup>(
  'SlopeImageBackup',
  slopeImageBackupSchema
);
