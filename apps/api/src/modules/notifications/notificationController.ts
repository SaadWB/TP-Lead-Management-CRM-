import { Request, Response, NextFunction } from 'express';
import { notificationRepository } from '../../repositories/notificationRepository';
import { followUpTaskRepository } from '../../repositories/followUpTaskRepository';
import { notificationService } from '../../services/notificationService';
import { sendSuccess } from '../../utils/response';

export async function listMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notifications = await notificationRepository.findByUserId(req.user!.id);
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    sendSuccess(res, { notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const success = await notificationRepository.markAsRead(req.params.id, req.user!.id);
    sendSuccess(res, { success });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updatedCount = await notificationRepository.markAllAsRead(req.user!.id);
    sendSuccess(res, { updatedCount });
  } catch (error) {
    next(error);
  }
}

/**
 * Scheduled job endpoint to trigger follow-up reminders.
 * Can be invoked by a cron job or background scheduler.
 */
export async function processFollowUpReminders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pendingTasks = await followUpTaskRepository.findMany({ status: 'PENDING' });
    const todayStr = new Date().toISOString().split('T')[0];
    let processedCount = 0;

    for (const task of pendingTasks) {
      const taskDate = task.dueDate.split('T')[0];
      const isOverdue = taskDate < todayStr;
      const isToday = taskDate === todayStr;

      if ((isOverdue || isToday) && task.lead) {
        await notificationService.notifyFollowUp(
          task.assignedUserId,
          task.leadId,
          task.lead.companyName,
          task.taskType,
          task.dueDate,
          task.dueTime,
          isOverdue
        );
        processedCount++;
      }
    }

    sendSuccess(res, { processedCount, message: `Processed ${processedCount} reminder notifications` });
  } catch (error) {
    next(error);
  }
}
