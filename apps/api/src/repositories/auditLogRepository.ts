import { AuditLogItem } from '@crm/shared';
import { dbStore } from './dbStore';

export class AuditLogRepository {
  public async create(data: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: Record<string, any> | null;
  }): Promise<AuditLogItem> {
    const store = dbStore.store;
    if (!Array.isArray(store.auditLogs)) {
      store.auditLogs = [];
    }

    const user = data.userId ? store.users.find((u) => u.id === data.userId) : null;
    const item: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId || null,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || null,
      details: data.details || null,
      createdAt: new Date().toISOString(),
    };

    store.auditLogs.unshift(item);
    dbStore.persist();
    return item;
  }

  public async list(options: { entity?: string; limit?: number } = {}): Promise<AuditLogItem[]> {
    const store = dbStore.store;
    let logs = store.auditLogs || [];
    if (options.entity) {
      logs = logs.filter((l) => l.entity === options.entity);
    }
    const limit = options.limit || 100;
    return logs.slice(0, limit);
  }
}

export const auditLogRepository = new AuditLogRepository();
