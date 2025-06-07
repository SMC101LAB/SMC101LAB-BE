import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
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

// JWT 토큰 생성 헬퍼 함수
const generateTokens = (user: any) => {
  const secretKey = process.env.JWT_SECRET;
  const refreshSecretKey = process.env.JWT_REFRESH_SECRET;

  if (!secretKey || !refreshSecretKey) {
    throw new Error('JWT secret keys are not defined');
  }

  const accessToken = jwt.sign(
    {
      id: user._id,
      phone: user.phone,
      name: user.name,
      isAdmin: user.isAdmin,
    },
    secretKey,
    {
      expiresIn: '15m', // Access Token: 15분
    }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      phone: user.phone,
    },
    refreshSecretKey,
    {
      expiresIn: '7d', // Refresh Token: 7일
    }
  );

  return { accessToken, refreshToken };
};

// 회원가입 (기존과 동일)
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

// 로그인 - Access Token + Refresh Token 발급
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

    // 5. 기존 Refresh Token 삭제 (선택적)
    await RefreshToken.deleteMany({ userId: user._id });

    // 6. 새로운 토큰들 생성
    const { accessToken, refreshToken } = generateTokens(user);

    // 7. Refresh Token을 DB에 저장
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    });

    // 8. 응답
    return res.status(200).json({
      success: true,
      message: '로그인 성공',
      accessToken,
      refreshToken,
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

// 토큰 갱신
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.headers.authorization?.split(' ')[1];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token이 필요합니다.',
      });
    }

    // 1. DB에서 Refresh Token 확인
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 refresh token입니다.',
      });
    }

    // 2. Refresh Token 만료 확인
    if (storedToken.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      return res.status(401).json({
        success: false,
        message: 'Refresh token이 만료되었습니다.',
      });
    }

    // 3. Refresh Token 검증
    const refreshSecretKey = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecretKey) {
      throw new Error('JWT refresh secret key is not defined');
    }

    const decoded = jwt.verify(refreshToken, refreshSecretKey) as {
      id: string;
      phone: string;
    };

    // 4. 사용자 정보 확인
    const user = await User.findById(decoded.id);
    if (!user || !user.isApproved) {
      return res.status(401).json({
        success: false,
        message: '사용자를 찾을 수 없거나 승인되지 않았습니다.',
      });
    }

    // 5. 새로운 토큰들 생성
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // 6. 기존 Refresh Token 삭제 후 새로운 것으로 교체
    await RefreshToken.deleteOne({ _id: storedToken._id });
    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
    });

    // 7. 응답
    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 refresh token입니다.',
      });
    }
    next(error);
  }
};

// 로그아웃
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.headers.authorization?.split(' ')[1];

    if (refreshToken) {
      // DB에서 Refresh Token 삭제
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    return res.status(200).json({
      success: true,
      message: '로그아웃되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// 미들웨어 - Access Token 검증
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
      phone: string;
      name: string;
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
