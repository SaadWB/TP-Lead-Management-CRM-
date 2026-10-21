import { Router } from 'express';
import {
  listLeads,
  getLeadById,
  createLead,
  updateLead,
  updateLeadStage,
  updateSalesStage,
  updateLeadPriority,
  bulkUpdatePriority,
  deleteLead,
  bulkDeleteLeads,
  checkDuplicates,
  completeFollowUp,
  getCustomOptions,
  addCustomOption,
} from './leadController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);

router.get('/', listLeads);
router.get('/custom-options', getCustomOptions);
router.post('/custom-options', addCustomOption);
router.get('/check-duplicate', checkDuplicates);
router.get('/:id', getLeadById);
router.post('/', requireRole([USER_ROLES.SUPER_ADMIN]), createLead);
router.patch('/:id', updateLead);
router.patch('/:id/priority', requireRole([USER_ROLES.SUPER_ADMIN]), updateLeadPriority);
router.post('/bulk-priority', requireRole([USER_ROLES.SUPER_ADMIN]), bulkUpdatePriority);
router.delete('/:id', requireRole([USER_ROLES.SUPER_ADMIN]), deleteLead);
router.post('/bulk-delete', requireRole([USER_ROLES.SUPER_ADMIN]), bulkDeleteLeads);
router.post('/:id/stage', updateLeadStage);
router.patch('/:id/sales-stage', updateSalesStage);
router.post('/:id/follow-up-completion', completeFollowUp);

export default router;
