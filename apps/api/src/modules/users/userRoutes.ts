import { Router } from 'express';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  adminResetPassword,
  forceLogout,
} from './userController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);

// Listing users is available to authenticated users (e.g. Telecaller picking Salesman)
router.get('/', listUsers);
router.get('/:id', getUserById);

// Super Admin only actions
router.post('/', requireRole([USER_ROLES.SUPER_ADMIN]), createUser);
router.patch('/:id', requireRole([USER_ROLES.SUPER_ADMIN]), updateUser);
router.post('/:id/toggle-status', requireRole([USER_ROLES.SUPER_ADMIN]), toggleUserStatus);
router.post('/:id/reset-password', requireRole([USER_ROLES.SUPER_ADMIN]), adminResetPassword);
router.post('/:id/force-logout', requireRole([USER_ROLES.SUPER_ADMIN]), forceLogout);

export default router;
