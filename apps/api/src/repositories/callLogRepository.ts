import { CallLog, CallOutcome } from '@crm/shared';
import { dbStore } from './dbStore';

export class CallLogRepository {
  async create(data: {
    leadId: string;
    userId: string;
    outcome: CallOutcome;
    notes: string;
    contactDate?: string;
    followUpNeeded: boolean;
    nextFollowUpDate?: string | null;
    nextAction?: string | null;
    durationSeconds?: number | null;
  }): Promise<CallLog> {
    const caller = dbStore.store.users.find((u) => u.id === data.userId);
    const newLog: CallLog = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      leadId: data.leadId,
      userId: data.userId,
      user: caller ? { id: caller.id, name: caller.name, email: caller.email } : null,
      outcome: data.outcome,
      notes: data.notes,
      contactDate: data.contactDate || new Date().toISOString(),
      followUpNeeded: data.followUpNeeded,
      nextFollowUpDate: data.nextFollowUpDate || null,
      nextAction: data.nextAction || null,
      durationSeconds: data.durationSeconds || null,
      createdAt: new Date().toISOString(),
    };
    dbStore.store.callLogs.push(newLog);
    dbStore.persist();
    return newLog;
  }

  async findByLeadId(leadId: string): Promise<CallLog[]> {
    return dbStore.store.callLogs
      .filter((c) => c.leadId === leadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async countByUser(userId: string): Promise<number> {
    return dbStore.store.callLogs.filter((c) => c.userId === userId).length;
  }
}

export const callLogRepository = new CallLogRepository();
