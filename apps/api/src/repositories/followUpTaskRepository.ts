import { FollowUpTask, TaskStatus, TaskType } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias } from './userRepository';
import { parseSafeDateObject } from '../utils/dateUtils';

export interface TaskFilterOptions {
  assignedUserId?: string;
  leadId?: string;
  status?: TaskStatus;
  timeFilter?: 'TODAY' | 'OVERDUE' | 'UPCOMING' | 'ALL';
  taskType?: TaskType;
}

export class FollowUpTaskRepository {
  private formatTask(t: any): FollowUpTask {
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    const dueDate = new Date(t.dueDate);
    const isOverdue = t.status === 'PENDING' && dueDate.getTime() < todayMidnight;

    return {
      id: t.id,
      leadId: t.leadId,
      assignedUserId: t.assignedUserId,
      assignedUser: t.assignedUser
        ? { id: t.assignedUser.id, name: t.assignedUser.name, email: t.assignedUser.email }
        : undefined,
      lead: t.lead
        ? {
            id: t.lead.id,
            companyName: t.lead.companyName,
            contactPerson: t.lead.contactPerson || undefined,
            phone: t.lead.phone,
            pipelineStage: t.lead.pipelineStage,
          }
        : undefined,
      taskType: t.taskType as TaskType,
      dueDate: dueDate.toISOString().split('T')[0],
      dueTime: t.dueTime || null,
      notes: t.notes || null,
      status: t.status as TaskStatus,
      isOverdue,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
    };
  }

  async findById(id: string): Promise<FollowUpTask | null> {
    const task = await prisma.followUpTask.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, companyName: true, contactPerson: true, phone: true, pipelineStage: true } },
      },
    });
    if (!task) return null;
    return this.formatTask(task);
  }

  async findMany(filter: TaskFilterOptions = {}): Promise<FollowUpTask[]> {
    const where: any = {};

    if (filter.assignedUserId) {
      const effId = resolveUserAlias(filter.assignedUserId) || filter.assignedUserId;
      where.assignedUserId = effId;
    }
    if (filter.leadId) {
      where.leadId = filter.leadId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.taskType) {
      where.taskType = filter.taskType;
    }

    if (filter.timeFilter && filter.timeFilter !== 'ALL') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (filter.timeFilter === 'TODAY') {
        where.dueDate = { gte: todayStart, lte: todayEnd };
      } else if (filter.timeFilter === 'OVERDUE') {
        where.dueDate = { lt: todayStart };
        where.status = 'PENDING';
      } else if (filter.timeFilter === 'UPCOMING') {
        where.dueDate = { gt: todayEnd };
      }
    }

    const tasks = await prisma.followUpTask.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, companyName: true, contactPerson: true, phone: true, pipelineStage: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map((t) => this.formatTask(t));
  }

  async create(data: {
    leadId: string;
    assignedUserId: string;
    taskType: TaskType;
    dueDate: string;
    dueTime?: string | null;
    notes?: string | null;
  }): Promise<FollowUpTask> {
    const effectiveUserId = resolveUserAlias(data.assignedUserId) || data.assignedUserId;
    const safeDueDate = parseSafeDateObject(data.dueDate) || new Date();

    let task: any;
    try {
      task = await prisma.followUpTask.create({
        data: {
          leadId: data.leadId,
          assignedUserId: effectiveUserId,
          taskType: data.taskType,
          dueDate: safeDueDate,
          dueTime: data.dueTime || null,
          notes: data.notes || null,
          status: 'PENDING',
        },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, companyName: true, contactPerson: true, phone: true, pipelineStage: true } },
        },
      });
    } catch (err: any) {
      if (err.code === 'P2003' && effectiveUserId) {
        const firstUser = await prisma.user.findFirst({ select: { id: true } });
        if (firstUser) {
          task = await prisma.followUpTask.create({
            data: {
              leadId: data.leadId,
              assignedUserId: firstUser.id,
              taskType: data.taskType,
              dueDate: safeDueDate,
              dueTime: data.dueTime || null,
              notes: data.notes || null,
              status: 'PENDING',
            },
            include: {
              assignedUser: { select: { id: true, name: true, email: true } },
              lead: { select: { id: true, companyName: true, contactPerson: true, phone: true, pipelineStage: true } },
            },
          });
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    return this.formatTask(task);
  }

  async update(id: string, data: Partial<FollowUpTask>): Promise<FollowUpTask | null> {
    const updateData: any = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') {
        updateData.completedAt = parseSafeDateObject(data.completedAt) || new Date();
      }
    }
    if (data.dueDate !== undefined) {
      const d = parseSafeDateObject(data.dueDate);
      if (d) updateData.dueDate = d;
    }
    if (data.dueTime !== undefined) updateData.dueTime = data.dueTime;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.assignedUserId !== undefined) {
      updateData.assignedUserId = resolveUserAlias(data.assignedUserId) || data.assignedUserId;
    }

    const task = await prisma.followUpTask.update({
      where: { id },
      data: updateData,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, companyName: true, contactPerson: true, phone: true, pipelineStage: true } },
      },
    });

    return this.formatTask(task);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.followUpTask.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}

export const followUpTaskRepository = new FollowUpTaskRepository();
