import { LeadActivity, ActivityType } from '@crm/shared';
import { dbStore } from './dbStore';

export class ActivityRepository {
  async create(data: {
    leadId: string;
    userId?: string | null;
    type: ActivityType;
    description: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<LeadActivity> {
    const user = data.userId ? dbStore.store.users.find((u) => u.id === data.userId) : null;
    const newActivity: LeadActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      leadId: data.leadId,
      userId: data.userId || null,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      type: data.type,
      description: data.description,
      metadata: data.metadata || null,
      createdAt: new Date().toISOString(),
    };
    dbStore.store.activities.push(newActivity);
    dbStore.persist();
    return newActivity;
  }

  async findRecent(limit = 20): Promise<LeadActivity[]> {
    return [...dbStore.store.activities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((a) => {
        const user = a.userId ? dbStore.store.users.find((u) => u.id === a.userId) : null;
        return {
          ...a,
          user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
        };
      });
  }

  async findByLeadId(leadId: string): Promise<LeadActivity[]> {
    return dbStore.store.activities
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => {
        const user = a.userId ? dbStore.store.users.find((u) => u.id === a.userId) : null;
        return {
          ...a,
          user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
        };
      });
  }
}

export const activityRepository = new ActivityRepository();
