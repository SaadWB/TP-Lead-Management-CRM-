import { Router } from 'express';
import { getDashboardMetrics, exportLeadsCsv, getTelecallerReport, getAuditLogs } from './reportController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardMetrics);
router.get('/telecaller-report', getTelecallerReport);
router.get('/export', requireRole([USER_ROLES.SUPER_ADMIN]), exportLeadsCsv);
router.get('/audit-logs', requireRole([USER_ROLES.SUPER_ADMIN]), getAuditLogs);

export default router;
