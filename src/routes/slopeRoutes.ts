import { Router } from 'express';
import { validateAuth } from '../controllers/auth';
import { batchAddSlopeData } from '../controllers/slope/slopeAddBatch';
import {
  findNearbySlopes,
  getAllSlopes,
} from '../controllers/slope/slopeLookUp';
import { getOutlierData } from '../controllers/slope/slopeOutlierData';
import { deleteSlopes } from '../controllers/slope/slopeController';
import { searchSlopes } from '../controllers/slope/slopeSearch';

const router = Router();

router.get('/nearby', findNearbySlopes as any);
router.get('/search', searchSlopes as any);

router.use(validateAuth as any); // 인증 미들웨어를 인증이 필요한 라우트 앞에 배치

router.post('/batch', ...(batchAddSlopeData as any));
router.get('/batch', getAllSlopes as any);
router.get('/outlier', getOutlierData as any);
router.delete('/delete', deleteSlopes as any);
export default router;

// POST /api/slopes          // 단일 데이터 추가
// POST /api/slopes/batch    // 엑셀 업로드
// POST /api/slopes/photos   // 사진 업로드
// GET  /api/slopes/nearby   // 위치 기반 검색
