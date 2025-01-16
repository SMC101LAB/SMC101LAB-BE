import { Router } from 'express';
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import { register, login, validateAuth } from '../controllers/auth';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);

// Protected routes (authentication required)
router.use(validateAuth as any); // 인증 미들웨어를 인증이 필요한 라우트 앞에 배치

router.get('/users', getAllUsers as any);
router.get('/users/:userId', getUser as any);
router.put('/users/:userId', updateUser as any);
router.delete('/users/:userId', deleteUser as any);

export default router;
