import { Request, Response, NextFunction } from 'express';
import {
  createFollowUpTaskSchema,
  updateFollowUpTaskSchema,
  USER_ROLES,
} from '@crm/shared';
import { followUpTaskRepository } from '../../repositories/followUpTaskRepository';
import { leadRepository } from '../../repositories/leadRepository';
import { activityRepository } from '../../repositories/activityRepository';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export async function listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const assignedUserId =
      user.role === USER_ROLES.SUPER_ADMIN
        ? (req.query.assignedUserId as string) || undefined
        : user.id;

    const timeFilter = req.query.timeFilter as any;
    const status = req.query.status as any;
    const taskType = req.query.taskType as any;
    const leadId = req.query.leadId as string | undefined;

    const tasks = await followUpTaskRepository.findMany({
      assignedUserId,
      timeFilter,
      status,
      taskType,
      leadId,
    });

    sendSuccess(res, tasks);
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createFollowUpTaskSchema.parse(req.body);
    const lead = await leadRepository.findById(data.leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const assignedUserId = data.assignedUserId || req.user!.id;

    const task = await followUpTaskRepository.create({
      leadId: data.leadId,
      assignedUserId,
      taskType: data.taskType,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      notes: data.notes,
    });

    // Update lead next follow-up date if earlier or empty
    await leadRepository.update(lead.id, {
      nextFollowUpDate: data.dueDate,
      nextAction: data.notes || `${data.taskType} scheduled`,
    });

    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: data.taskType === 'DEMO' ? 'DEMO_SCHEDULED' : 'FOLLOW_UP_SCHEDULED',
      description: `${data.taskType} scheduled for ${data.dueDate}${data.dueTime ? ` at ${data.dueTime}` : ''} by ${req.user!.name}`,
    });

    sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const taskId = req.params.id;
    const existing = await followUpTaskRepository.findById(taskId);
    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    if (
      req.user!.role !== USER_ROLES.SUPER_ADMIN &&
      existing.assignedUserId !== req.user!.id
    ) {
      throw new ForbiddenError('You can only update tasks assigned to you');
    }

    const data = updateFollowUpTaskSchema.parse(req.body);
    const updated = await followUpTaskRepository.update(taskId, data);

    if (data.status === 'COMPLETED') {
      await activityRepository.create({
        leadId: existing.leadId,
        userId: req.user!.id,
        type: existing.taskType === 'DEMO' ? 'DEMO_COMPLETED' : 'FOLLOW_UP_COMPLETED',
        description: `${existing.taskType} marked COMPLETED by ${req.user!.name}.${
          data.outcomeNotes ? ` Outcome: ${data.outcomeNotes}` : ''
        }`,
      });
    }

    sendSuccess(res, updated, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
}
