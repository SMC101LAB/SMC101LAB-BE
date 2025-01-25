import { Router } from 'express';
import { validateAuth } from '../controllers/auth';
import { batchAddSlopeData } from '../controllers/slope/slopeAddBatch';
import { getAllSlopes } from '../controllers/slope/slopeLookUp';

const router = Router();

router.use(validateAuth as any); // 인증 미들웨어를 인증이 필요한 라우트 앞에 배치

router.post('/batch', ...(batchAddSlopeData as any));
router.get('/batch', getAllSlopes as any);

export default router;

// POST /api/slopes          // 단일 데이터 추가
// POST /api/slopes/batch    // 엑셀 업로드
// POST /api/slopes/photos   // 사진 업로드
// GET  /api/slopes/nearby   // 위치 기반 검색
