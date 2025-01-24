import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import bcrypt from 'bcrypt';

// 전체 회원 조회 (관리자용)
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 관리자 권한 확인
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.',
      });
    }

    const users = await User.find().select('-password'); // 비밀번호 필드 제외

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// 단일 회원 조회
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    // 본인이거나 관리자만 조회 가능
    if (req.user?.id !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.',
      });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// 회원 정보 수정
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const { name, phone, organization, password, currentPassword } = req.body;

    // 본인이거나 관리자만 수정 가능
    if (req.user?.id !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.',
      });
    }

    // 비밀번호 변경 시 현재 비밀번호 확인
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: '현재 비밀번호를 입력해주세요.',
        });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '현재 비밀번호가 일치하지 않습니다.',
        });
      }
    }

    // 업데이트할 데이터 객체 생성
    const updateData: any = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (organization) updateData.organization = organization;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    // 전화번호 중복 확인
    if (phone) {
      const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '이미 등록된 전화번호입니다.',
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select('-password');

    res.status(200).json({
      success: true,
      message: '회원 정보가 수정되었습니다.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// 회원 삭제
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    console.log('Attempting to delete user with ID:', userId);
    // 본인이거나 관리자만 삭제 가능
    if (req.user?.id !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.',
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// 회원 승인
export const appoveUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 관리자 권한 확인
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '관리자 권한이 필요합니다.',
      });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.',
      });
    }

    const updateData = { isApproved: true };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select('-password');

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
