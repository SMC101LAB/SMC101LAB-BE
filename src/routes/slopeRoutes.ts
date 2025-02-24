import { Router } from 'express';
import { validateAuth } from '../controllers/auth';
import { batchAddSlopeData } from '../controllers/slope/slopeAddBatch'; //데이터 엑셀 추가
import {
  downloadSlopesExcel,
  findNearbySlopes,
  getAllSlopes,
} from '../controllers/slope/slopeLookUp'; // 근처 데이터 조회, 전체 데이터 조회
import { getOutlierData } from '../controllers/slope/slopeOutlierData'; // 이상값 찾기
import {
  deleteSlopes,
  updateSlopes,
} from '../controllers/slope/slopeController'; //데이터 삭제 및 수정
import { searchSlopes } from '../controllers/slope/slopeSearch'; // 데이터 검색

const router = Router();

router.post('/nearby', findNearbySlopes as any);
router.post('/search', searchSlopes as any);
router.use(validateAuth as any); // 인증 미들웨어를 인증이 필요한 라우트 앞에 배치

router.post('/batch', ...(batchAddSlopeData as any));
router.get('/batch', getAllSlopes as any);
router.get('/outlier', getOutlierData as any);
router.delete('/delete', deleteSlopes as any);
router.put('/update', updateSlopes as any);
router.get('/download', downloadSlopesExcel as any);
export default router;

// POST /api/slopes          // 단일 데이터 추가
// POST /api/slopes/batch    // 엑셀 업로드
// POST /api/slopes/photos   // 사진 업로드
// GET  /api/slopes/nearby   // 위치 기반 검색
