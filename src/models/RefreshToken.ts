// models/RefreshToken.ts
import mongoose, { Schema, Document } from 'mongoose';

interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // MongoDB TTL로 자동 삭제
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 인덱스 추가 (성능 향상)
RefreshTokenSchema.index({ userId: 1, token: 1 });

export default mongoose.model<IRefreshToken>(
  'RefreshToken',
  RefreshTokenSchema
);
