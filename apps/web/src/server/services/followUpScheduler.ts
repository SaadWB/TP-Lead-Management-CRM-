import { prisma } from '../config/prisma';
import { followUpTaskRepository } from '../repositories/followUpTaskRepository';
import { localTimeHHmm } from '../utils/timezone';

type TaskType = 'CALL' | 'FOLLOW_UP' | 'DEMO' | 'MEETING' | 'OTHER';

/**
 * A lead has exactly ONE next follow-up. Scheduling a new one supersedes
 * every older pending task for that lead, otherwise tasks pile up and the
 * "pending follow-ups" numbers become inflated.
 *
 * The task keeps the real instant as dueDate and the user's LOCAL time as dueTime
 * (previously the UTC time was stored, e.g. "05:30" for an 11:00 AM IST call).
 */
export async function scheduleFollowUpTask(params: {
  leadId: string;
  assignedUserId: string;
  followUpIso: string;
  taskType: TaskType;
  notes?: string | null;
  tzOffsetMinutes: number;
}): Promise<void> {
  const due = new Date(params.followUpIso);
  if (isNaN(due.getTime())) return;

  try {
    await prisma.followUpTask.updateMany({
      where: { leadId: params.leadId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  } catch (err) {
    console.warn('[followUpScheduler] Could not supersede older tasks:', (err as Error).message);
  }

  await followUpTaskRepository.create({
    leadId: params.leadId,
    assignedUserId: params.assignedUserId,
    taskType: params.taskType,
    dueDate: due.toISOString(),
    dueTime: localTimeHHmm(due, params.tzOffsetMinutes),
    notes: params.notes || null,
  });
}

/** Marks every pending task of a lead as completed (used when a lead is closed). */
export async function completePendingTasks(leadId: string): Promise<void> {
  try {
    await prisma.followUpTask.updateMany({
      where: { leadId, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  } catch (err) {
    console.warn('[followUpScheduler] Task completion notice:', (err as Error).message);
  }
}
