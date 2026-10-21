import { Router } from 'express';
import { getDashboardMetrics, exportLeadsCsv } from './reportController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardMetrics);
router.get('/export', exportLeadsCsv);

export default router;
