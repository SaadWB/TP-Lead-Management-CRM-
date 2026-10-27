import { Router } from 'express';
import { getDashboardMetrics, exportLeadsCsv, getTelecallerReport } from './reportController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardMetrics);
router.get('/telecaller-report', getTelecallerReport);
router.get('/export', exportLeadsCsv);

export default router;
