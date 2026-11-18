import { CallLog, CallOutcome } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';
import { parseSafeDateObject } from '../utils/dateUtils';

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
    const effectiveUserId = resolveUserAlias(data.userId) || data.userId;
    const safeContactDate = parseSafeDateObject(data.contactDate) || new Date();
    const safeNextFollowUpDate = parseSafeDateObject(data.nextFollowUpDate);

    let log: any;
    try {
      log = await prisma.callLog.create({
        data: {
          leadId: data.leadId,
          userId: effectiveUserId,
          outcome: data.outcome,
          notes: data.notes,
          contactDate: safeContactDate,
          followUpNeeded: Boolean(data.followUpNeeded),
          nextFollowUpDate: safeNextFollowUpDate,
          nextAction: data.nextAction || null,
          durationSeconds: data.durationSeconds ?? null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (err: any) {
      if (err.code === 'P2003' && effectiveUserId) {
        // Fallback in case effectiveUserId has foreign key issue
        const firstUser = await prisma.user.findFirst({ select: { id: true } });
        if (firstUser) {
          log = await prisma.callLog.create({
            data: {
              leadId: data.leadId,
              userId: firstUser.id,
              outcome: data.outcome,
              notes: data.notes,
              contactDate: safeContactDate,
              followUpNeeded: Boolean(data.followUpNeeded),
              nextFollowUpDate: safeNextFollowUpDate,
              nextAction: data.nextAction || null,
              durationSeconds: data.durationSeconds ?? null,
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          });
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    return {
      id: log.id,
      leadId: log.leadId,
      userId: log.userId,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
      outcome: log.outcome as CallOutcome,
      notes: log.notes,
      contactDate: log.contactDate.toISOString(),
      followUpNeeded: log.followUpNeeded,
      nextFollowUpDate: log.nextFollowUpDate ? log.nextFollowUpDate.toISOString() : null,
      nextAction: log.nextAction,
      durationSeconds: log.durationSeconds,
      createdAt: log.createdAt.toISOString(),
    };
  }

  async findByLeadId(leadId: string): Promise<CallLog[]> {
    const logs = await prisma.callLog.findMany({
      where: { leadId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { contactDate: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      leadId: log.leadId,
      userId: log.userId,
      user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
      outcome: log.outcome as CallOutcome,
      notes: log.notes,
      contactDate: log.contactDate.toISOString(),
      followUpNeeded: log.followUpNeeded,
      nextFollowUpDate: log.nextFollowUpDate ? log.nextFollowUpDate.toISOString() : null,
      nextAction: log.nextAction,
      durationSeconds: log.durationSeconds,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async countByUser(userId: string): Promise<number> {
    const effectiveUserId = resolveUserAlias(userId) || userId;
    return prisma.callLog.count({
      where: { userId: effectiveUserId },
    });
  }
}

export const callLogRepository = new CallLogRepository();
