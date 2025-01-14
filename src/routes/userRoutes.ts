// routes/userRoutes.ts
import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';

const router = Router();

// Routes
router.post('/join', createUser);
router.get('/search', getAllUsers);
router.get('/search/:id', getUser);
router.put('/modify/:id', updateUser);
router.delete('/delete/:id', deleteUser);

export default router;
