import { FollowUpTask, TaskStatus, TaskType } from '@crm/shared';
import { dbStore } from './dbStore';

export interface TaskFilterOptions {
  assignedUserId?: string;
  leadId?: string;
  status?: TaskStatus;
  timeFilter?: 'TODAY' | 'OVERDUE' | 'UPCOMING' | 'ALL';
  taskType?: TaskType;
}

export class FollowUpTaskRepository {
  private enrichTask(t: FollowUpTask): FollowUpTask {
    const assignee = dbStore.store.users.find((u) => u.id === t.assignedUserId);
    const lead = dbStore.store.leads.find((l) => l.id === t.leadId);
    const isOverdue = t.status === 'PENDING' && new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

    return {
      ...t,
      assignedUser: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
      lead: lead
        ? {
            id: lead.id,
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
            phone: lead.phone,
            pipelineStage: lead.pipelineStage,
          }
        : undefined,
      isOverdue,
    };
  }

  async findById(id: string): Promise<FollowUpTask | null> {
    const task = dbStore.store.followUpTasks.find((t) => t.id === id);
    if (!task) return null;
    return this.enrichTask(task);
  }

  async findMany(filter: TaskFilterOptions = {}): Promise<FollowUpTask[]> {
    let tasks = [...dbStore.store.followUpTasks];

    if (filter.assignedUserId) {
      tasks = tasks.filter((t) => t.assignedUserId === filter.assignedUserId);
    }
    if (filter.leadId) {
      tasks = tasks.filter((t) => t.leadId === filter.leadId);
    }
    if (filter.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter.taskType) {
      tasks = tasks.filter((t) => t.taskType === filter.taskType);
    }

    if (filter.timeFilter && filter.timeFilter !== 'ALL') {
      const todayStr = new Date().toISOString().split('T')[0];
      tasks = tasks.filter((t) => {
        const d = t.dueDate.split('T')[0];
        if (filter.timeFilter === 'TODAY') return d === todayStr;
        if (filter.timeFilter === 'OVERDUE') return d < todayStr && t.status === 'PENDING';
        if (filter.timeFilter === 'UPCOMING') return d > todayStr;
        return true;
      });
    }

    tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return tasks.map((t) => this.enrichTask(t));
  }

  async create(data: {
    leadId: string;
    assignedUserId: string;
    taskType: TaskType;
    dueDate: string;
    dueTime?: string | null;
    notes?: string | null;
  }): Promise<FollowUpTask> {
    const newTask: FollowUpTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      leadId: data.leadId,
      assignedUserId: data.assignedUserId,
      taskType: data.taskType,
      dueDate: data.dueDate,
      dueTime: data.dueTime || null,
      notes: data.notes || null,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dbStore.store.followUpTasks.push(newTask);
    dbStore.persist();
    return this.enrichTask(newTask);
  }

  async update(id: string, data: Partial<FollowUpTask>): Promise<FollowUpTask | null> {
    const index = dbStore.store.followUpTasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    dbStore.store.followUpTasks[index] = {
      ...dbStore.store.followUpTasks[index],
      ...data,
      updatedAt: new Date().toISOString(),
      ...(data.status === 'COMPLETED' && !data.completedAt ? { completedAt: new Date().toISOString() } : {}),
    };
    dbStore.persist();
    return this.enrichTask(dbStore.store.followUpTasks[index]);
  }
}

export const followUpTaskRepository = new FollowUpTaskRepository();
