import { Router } from 'express';
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  processFollowUpReminders,
} from './notificationController';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listMyNotifications);
router.patch('/:id/read', markNotificationRead);
router.post('/read-all', markAllNotificationsRead);
router.post('/process-reminders', processFollowUpReminders);

export default router;
