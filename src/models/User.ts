import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  phone: string;
  organization: string;
  password: string;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, '이름을 입력해주세요'],
  },

  organization: {
    type: String,
    required: [true, '소속을 입력해주세요'],
  },
  phone: {
    type: String,
    required: [true, '전화번호를 입력해주세요'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, '비밀번호를 입력해주세요'],
    unique: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', function (next) {
  if (this.isAdmin) {
    this.isApproved = true;
  }
  next();
});

export default model<IUser>('User', userSchema);
