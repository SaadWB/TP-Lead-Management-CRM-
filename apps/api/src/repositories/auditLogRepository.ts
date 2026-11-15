import { AuditLogItem } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';

export class AuditLogRepository {
  public async create(data: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: Record<string, any> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    status?: string;
  }): Promise<AuditLogItem> {
    const effectiveUserId = data.userId ? (resolveUserAlias(data.userId) || data.userId) : null;
    const log = await prisma.auditLog.create({
      data: {
        userId: effectiveUserId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        details: data.details ? (data.details as any) : undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        status: data.status || 'SUCCESS',
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return {
      id: log.id,
      userId: log.userId,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email, role: log.user.role as any } : null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: (log.details as Record<string, any>) || null,
      createdAt: log.createdAt.toISOString(),
    };
  }

  public async list(options: { entity?: string; limit?: number } = {}): Promise<AuditLogItem[]> {
    const where: any = {};
    if (options.entity) {
      where.entity = options.entity;
    }
    const limit = options.limit || 100;

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email, role: log.user.role as any } : null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: (log.details as Record<string, any>) || null,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

export const auditLogRepository = new AuditLogRepository();
