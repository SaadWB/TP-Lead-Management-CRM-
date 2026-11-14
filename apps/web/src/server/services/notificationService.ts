import { notificationRepository } from '../repositories/notificationRepository';
import { emailService } from './emailService';
import { userRepository } from '../repositories/userRepository';

export class NotificationService {
  async notifyLeadAssignment(
    recipientUserId: string,
    leadId: string,
    companyName: string,
    contactPerson?: string | null,
    assignedByName = 'Admin'
  ) {
    const user = await userRepository.findById(recipientUserId);
    if (!user) return;

    // Create in-app notification
    await notificationRepository.create({
      userId: recipientUserId,
      title: 'New Lead Assigned',
      message: `${assignedByName} assigned lead "${companyName}" to your pipeline.`,
      type: 'LEAD_ASSIGNMENT',
      link: `/leads/${leadId}`,
    });

    // Send email notification
    await emailService.sendAssignmentNotification(
      user.email,
      user.name,
      companyName,
      contactPerson,
      assignedByName
    );
  }

  async notifyFollowUp(
    recipientUserId: string,
    leadId: string,
    companyName: string,
    taskType: string,
    dueDate: string,
    dueTime?: string | null,
    isOverdue = false
  ) {
    const user = await userRepository.findById(recipientUserId);
    if (!user) return;

    await notificationRepository.create({
      userId: recipientUserId,
      title: isOverdue ? 'Overdue Follow-up' : 'Upcoming Follow-up',
      message: `${isOverdue ? 'Overdue' : 'Scheduled'} ${taskType} for "${companyName}" on ${dueDate}.`,
      type: isOverdue ? 'OVERDUE_TASK' : 'UPCOMING_TASK',
      link: `/leads/${leadId}`,
    });

    await emailService.sendFollowUpReminder(
      user.email,
      user.name,
      companyName,
      taskType,
      dueDate,
      dueTime,
      isOverdue
    );
  }
}

export const notificationService = new NotificationService();
