import { RequestHandler } from 'express';
import User from '../models/User';

// ID를 사용하는 라우트들에 대한 타입 정의
interface IdParams {
  id: string;
}

// Create user
export const createUser: RequestHandler = async (req, res) => {
  try {
    const userData = req.body;
    const user = await User.create(userData);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ success: false, error: 'Error occurred' });
  }
};

// Get all users
export const getAllUsers: RequestHandler = async (_req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ success: false, error: 'Error occurred' });
  }
};

// Get single user
export const getUser: RequestHandler<IdParams> = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ success: false, error: 'Error occurred' });
  }
};

// Update user
export const updateUser: RequestHandler<IdParams> = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ success: false, error: 'Error occurred' });
  }
};

// Delete user
export const deleteUser: RequestHandler<IdParams> = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Error occurred' });
  }
};
