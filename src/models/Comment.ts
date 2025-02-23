import { Schema, model, Document } from 'mongoose';

export interface IComment extends Document {
  slopeId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  content: string;
  imageUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    slopeId: {
      type: Schema.Types.ObjectId,
      ref: 'Slope',
      required: [true, '급경사지 정보는 필수입니다.'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '사용자 정보는 필수입니다.'],
    },
    content: {
      type: String,
      required: [true, '댓글 내용은 필수입니다.'],
    },
    imageUrls: [
      {
        type: String,
        required: false,
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

// 인덱스 생성
commentSchema.index({ slopeId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });

export default model<IComment>('Comment', commentSchema);
