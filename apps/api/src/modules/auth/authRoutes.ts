import { Router } from 'express';
import { login, getMe, logout } from './authController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);

export default router;
