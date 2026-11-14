import { Router } from 'express';
import { login, refreshTokenHandler, changePassword, getMe, logout } from './authController';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/login', authRateLimiter.middleware(), login);
router.post('/refresh', authRateLimiter.middleware(), refreshTokenHandler);
router.post('/change-password', authenticate, changePassword);
router.get('/me', authenticate, getMe);
router.post('/logout', logout);

export default router;
