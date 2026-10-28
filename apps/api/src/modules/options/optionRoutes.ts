import { Router } from 'express';
import {
  listOptions,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  createCallOutcome,
  updateCallOutcome,
  deleteCallOutcome,
  reorderCallOutcomes,
  getOptionsAuditLogs,
} from './optionController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

// All option routes require authentication
router.use(authenticate);

// Public read: Admin, Telecaller, and Salesman can fetch options
router.get('/', listOptions);

// Admin-only mutation endpoints
router.post('/pipeline', requireRole([USER_ROLES.SUPER_ADMIN]), createPipelineStage);
router.patch('/pipeline/:id', requireRole([USER_ROLES.SUPER_ADMIN]), updatePipelineStage);
router.delete('/pipeline/:id', requireRole([USER_ROLES.SUPER_ADMIN]), deletePipelineStage);
router.post('/pipeline/reorder', requireRole([USER_ROLES.SUPER_ADMIN]), reorderPipelineStages);

router.post('/outcomes', requireRole([USER_ROLES.SUPER_ADMIN]), createCallOutcome);
router.patch('/outcomes/:id', requireRole([USER_ROLES.SUPER_ADMIN]), updateCallOutcome);
router.delete('/outcomes/:id', requireRole([USER_ROLES.SUPER_ADMIN]), deleteCallOutcome);
router.post('/outcomes/reorder', requireRole([USER_ROLES.SUPER_ADMIN]), reorderCallOutcomes);

router.get('/audit-logs', requireRole([USER_ROLES.SUPER_ADMIN]), getOptionsAuditLogs);

export default router;
