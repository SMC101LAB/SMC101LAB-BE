import { Router } from 'express';
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  appoveUser,
} from '../controllers/userController';
import {
  register,
  login,
  validateAuth,
  refresh,
  logout,
} from '../controllers/auth';

const router = Router();

router.post('/register', register as any); // 회원가입
router.post('/login', login as any); // 로그인
router.post('/refresh', refresh as any); // 토큰 갱신
router.post('/logout', logout as any); // 로그아웃

router.use(validateAuth as any); // 인증 미들웨어를 인증이 필요한 라우트 앞에 배치

router.get('/users', getAllUsers as any);
router.get('/users/:userId', getUser as any);
router.put('/users/:userId', updateUser as any);
router.delete('/users/:userId', deleteUser as any);
router.put('/users/approve/:userId', appoveUser as any);
export default router;
