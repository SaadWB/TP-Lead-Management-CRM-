import { NotificationItem } from '@crm/shared';
import { dbStore } from './dbStore';

export class NotificationRepository {
  async create(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    link?: string | null;
  }): Promise<NotificationItem> {
    const item: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    dbStore.store.notifications.push(item);
    dbStore.persist();
    return item;
  }

  async findByUserId(userId: string): Promise<NotificationItem[]> {
    return dbStore.store.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const notif = dbStore.store.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notif) return false;
    notif.isRead = true;
    dbStore.persist();
    return true;
  }

  async markAllAsRead(userId: string): Promise<number> {
    let count = 0;
    dbStore.store.notifications.forEach((n) => {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        count++;
      }
    });
    if (count > 0) dbStore.persist();
    return count;
  }
}

export const notificationRepository = new NotificationRepository();
