// controllers/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

interface CustomRequest extends Request {
  body: {
    phone?: string;
    password?: string;
    name?: string;
    organization?: string;
    isAdmin?: boolean;
  };
}

// 회원가입
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, phone, organization, password, isAdmin } = req.body;

    // 1. 입력값 검증
    if (!name || !phone || !organization || !password) {
      return res.status(400).json({
        success: false,
        message: '모든 필드를 입력해주세요.',
      });
    }

    // 2. 기존 사용자 확인
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 전화번호입니다.',
      });
    }

    // 3. 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. 사용자 생성
    const user = await User.create({
      name,
      phone,
      organization,
      password: hashedPassword,
      isAdmin: isAdmin || false,
    });

    return res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        organization: user.organization,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 로그인
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, password } = req.body;

    // 1. 입력값 검증
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '전화번호와 비밀번호를 입력해주세요.',
      });
    }

    // 2. 사용자 확인
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '등록되지 않은 사용자입니다.',
      });
    }

    // 3. 승인 여부 확인
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: '관리자 승인 대기중입니다.',
      });
    }

    // 4. 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다.',
      });
    }

    // 5. JWT 생성
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error('JWT secret key is not defined');
    }

    const token = jwt.sign(
      {
        id: user._id,
        phone: user.phone,
        name: user.name,
        isAdmin: user.isAdmin,
      },
      secretKey,
      {
        expiresIn: '12h',
      }
    );

    // 6. 응답
    return res.status(200).json({
      success: true,
      message: '로그인 성공',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        organization: user.organization,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 미들웨어 - 토큰 검증
export const validateAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.',
      });
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error('JWT secret key is not defined');
    }

    const decoded = jwt.verify(token, secretKey) as {
      id: string;
      isAdmin: boolean;
    };

    // req에 사용자 정보 추가
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      });
    }
    next(error);
  }
};
