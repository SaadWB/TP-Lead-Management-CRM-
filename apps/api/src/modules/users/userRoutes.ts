import { Router } from 'express';
import { listUsers, getUserById, createUser, updateUser, toggleUserStatus } from './userController';
import { authenticate, requireRole } from '../../middleware/auth';
import { USER_ROLES } from '@crm/shared';

const router = Router();

router.use(authenticate);

// Listing users is available to all authenticated users (needed for Telecaller to pick active Salesman, etc.)
router.get('/', listUsers);
router.get('/:id', getUserById);

// Admin only actions
router.post('/', requireRole([USER_ROLES.SUPER_ADMIN]), createUser);
router.patch('/:id', requireRole([USER_ROLES.SUPER_ADMIN]), updateUser);
router.post('/:id/toggle-status', requireRole([USER_ROLES.SUPER_ADMIN]), toggleUserStatus);

export default router;
