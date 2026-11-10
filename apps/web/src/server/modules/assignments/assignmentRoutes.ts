import { Router } from 'express';
import { assignSingleLead, bulkAssignLeads } from './assignmentController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);

// Super Admin or Telecaller (for handover) can assign single lead
router.post('/lead/:leadId', assignSingleLead);

// Super Admin only can bulk assign
router.post('/bulk', requireRole([USER_ROLES.SUPER_ADMIN]), bulkAssignLeads);

export default router;
