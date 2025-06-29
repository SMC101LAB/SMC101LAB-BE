import { Schema, model, Document } from 'mongoose';

export interface IComment extends Document {
  historyNumber: string; // slopeId 대신 historyNumber 사용
  userId: Schema.Types.ObjectId;
  content: string;
  imageUrls: string[]; // S3 URL들이 저장될 배열
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    historyNumber: {
      type: String,
      required: [true, 'History Number는 필수입니다.'],
      index: true, // 검색 성능을 위한 인덱스
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

// 인덱스 생성 - historyNumber 기준으로 변경
commentSchema.index({ historyNumber: 1, createdAt: -1 }); // historyNumber별 최신 댓글 순 조회
commentSchema.index({ userId: 1 }); // 사용자별 댓글 조회
commentSchema.index({ historyNumber: 1, userId: 1 }); // 특정 historyNumber에서 특정 사용자 댓글 조회

export default model<IComment>('Comment', commentSchema);
