import { LeadAssignmentHistory } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';

export class AssignmentHistoryRepository {
  async create(data: {
    leadId: string;
    assignedById: string;
    previousUserId?: string | null;
    newUserId: string;
    roleType: 'TELECALLER' | 'SALESMAN';
    handoverSummary?: string | null;
  }): Promise<LeadAssignmentHistory> {
    const assignedById = resolveUserAlias(data.assignedById) || data.assignedById;
    const newUserId = resolveUserAlias(data.newUserId) || data.newUserId;
    const previousUserId = data.previousUserId ? (resolveUserAlias(data.previousUserId) || data.previousUserId) : null;

    let record: any;
    try {
      record = await prisma.leadAssignmentHistory.create({
        data: {
          leadId: data.leadId,
          assignedById,
          previousUserId,
          newUserId,
          roleType: data.roleType as any,
          handoverSummary: data.handoverSummary || null,
        },
        include: {
          assignedBy: { select: { id: true, name: true, email: true } },
          previousUser: { select: { id: true, name: true, email: true } },
          newUser: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (err: any) {
      if (err.code === 'P2003') {
        // Fallback with previousUserId as null if previousUser failed foreign key
        record = await prisma.leadAssignmentHistory.create({
          data: {
            leadId: data.leadId,
            assignedById,
            previousUserId: null,
            newUserId,
            roleType: data.roleType as any,
            handoverSummary: data.handoverSummary || null,
          },
          include: {
            assignedBy: { select: { id: true, name: true, email: true } },
            previousUser: { select: { id: true, name: true, email: true } },
            newUser: { select: { id: true, name: true, email: true } },
          },
        });
      } else {
        throw err;
      }
    }

    return {
      id: record.id,
      leadId: record.leadId,
      assignedById: record.assignedById,
      assignedBy: record.assignedBy ? { id: record.assignedBy.id, name: record.assignedBy.name, email: record.assignedBy.email } : undefined,
      previousUserId: record.previousUserId,
      previousUser: record.previousUser ? { id: record.previousUser.id, name: record.previousUser.name, email: record.previousUser.email } : null,
      newUserId: record.newUserId,
      newUser: record.newUser ? { id: record.newUser.id, name: record.newUser.name, email: record.newUser.email } : undefined,
      roleType: record.roleType as any,
      handoverSummary: record.handoverSummary,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async findByLeadId(leadId: string): Promise<LeadAssignmentHistory[]> {
    const records = await prisma.leadAssignmentHistory.findMany({
      where: { leadId },
      include: {
        assignedBy: { select: { id: true, name: true, email: true } },
        previousUser: { select: { id: true, name: true, email: true } },
        newUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      leadId: record.leadId,
      assignedById: record.assignedById,
      assignedBy: record.assignedBy ? { id: record.assignedBy.id, name: record.assignedBy.name, email: record.assignedBy.email } : undefined,
      previousUserId: record.previousUserId,
      previousUser: record.previousUser ? { id: record.previousUser.id, name: record.previousUser.name, email: record.previousUser.email } : null,
      newUserId: record.newUserId,
      newUser: record.newUser ? { id: record.newUser.id, name: record.newUser.name, email: record.newUser.email } : undefined,
      roleType: record.roleType as any,
      handoverSummary: record.handoverSummary,
      createdAt: record.createdAt.toISOString(),
    }));
  }
}

export const assignmentHistoryRepository = new AssignmentHistoryRepository();
