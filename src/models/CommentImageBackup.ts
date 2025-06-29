import { Schema, model, Document } from 'mongoose';

export interface ICommentImageBackup extends Document {
  historyNumber: string;
  commentId: Schema.Types.ObjectId;
  imageUrls: string[];
  lastBackupAt: Date;
}

const commentImageBackupSchema = new Schema<ICommentImageBackup>(
  {
    historyNumber: {
      type: String,
      required: [true, 'History Number는 필수입니다.'],
      index: true, // 검색 성능을 위한 인덱스
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      required: [true, 'Comment ID는 필수입니다.'],
    },
    imageUrls: [
      {
        type: String,
        required: false,
      },
    ],
    lastBackupAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

// 복합 인덱스 생성 - historyNumber와 commentId 조합으로 빠른 검색
commentImageBackupSchema.index(
  { historyNumber: 1, commentId: 1 },
  { unique: true }
);

// historyNumber로 검색하기 위한 인덱스
commentImageBackupSchema.index({ historyNumber: 1, lastBackupAt: -1 });

export default model<ICommentImageBackup>(
  'CommentImageBackup',
  commentImageBackupSchema
);
