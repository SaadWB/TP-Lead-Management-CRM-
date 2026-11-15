import { NotificationItem } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';

export class NotificationRepository {
  async create(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    link?: string | null;
  }): Promise<NotificationItem> {
    const effectiveUserId = resolveUserAlias(data.userId) || data.userId;
    const notif = await prisma.notification.create({
      data: {
        userId: effectiveUserId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link || null,
        isRead: false,
      },
    });

    return {
      id: notif.id,
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      link: notif.link,
      isRead: notif.isRead,
      createdAt: notif.createdAt.toISOString(),
    };
  }

  async findByUserId(userId: string): Promise<NotificationItem[]> {
    const effectiveUserId = resolveUserAlias(userId) || userId;
    const notifications = await prisma.notification.findMany({
      where: { userId: effectiveUserId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const effectiveUserId = resolveUserAlias(userId) || userId;
    try {
      await prisma.notification.updateMany({
        where: { id, userId: effectiveUserId },
        data: { isRead: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    const effectiveUserId = resolveUserAlias(userId) || userId;
    const res = await prisma.notification.updateMany({
      where: { userId: effectiveUserId, isRead: false },
      data: { isRead: true },
    });
    return res.count;
  }
}

export const notificationRepository = new NotificationRepository();
