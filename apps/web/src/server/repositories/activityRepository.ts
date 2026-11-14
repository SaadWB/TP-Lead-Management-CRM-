import { LeadActivity, ActivityType } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';

export class ActivityRepository {
  async create(data: {
    leadId: string;
    userId?: string | null;
    type: ActivityType | string;
    description: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<LeadActivity> {
    const effectiveUserId = data.userId ? (resolveUserAlias(data.userId) || data.userId) : null;
    const act = await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        userId: effectiveUserId,
        type: data.type,
        description: data.description,
        metadata: data.metadata ? (data.metadata as any) : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return {
      id: act.id,
      leadId: act.leadId,
      userId: act.userId,
      user: act.user ? { id: act.user.id, name: act.user.name, email: act.user.email, role: act.user.role as any } : null,
      type: act.type as ActivityType,
      description: act.description,
      metadata: (act.metadata as Record<string, unknown>) || null,
      createdAt: act.createdAt.toISOString(),
    };
  }

  async findRecent(limit = 20): Promise<LeadActivity[]> {
    const activities = await prisma.leadActivity.findMany({
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities.map((act) => ({
      id: act.id,
      leadId: act.leadId,
      userId: act.userId,
      user: act.user ? { id: act.user.id, name: act.user.name, email: act.user.email, role: act.user.role as any } : null,
      type: act.type as ActivityType,
      description: act.description,
      metadata: (act.metadata as Record<string, unknown>) || null,
      createdAt: act.createdAt.toISOString(),
    }));
  }

  async findByLeadId(leadId: string): Promise<LeadActivity[]> {
    const activities = await prisma.leadActivity.findMany({
      where: { leadId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities.map((act) => ({
      id: act.id,
      leadId: act.leadId,
      userId: act.userId,
      user: act.user ? { id: act.user.id, name: act.user.name, email: act.user.email, role: act.user.role as any } : null,
      type: act.type as ActivityType,
      description: act.description,
      metadata: (act.metadata as Record<string, unknown>) || null,
      createdAt: act.createdAt.toISOString(),
    }));
  }
}

export const activityRepository = new ActivityRepository();
