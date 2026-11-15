import { Lead, Priority, CallOutcome } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias, areUserIdsEquivalent } from './userRepository';

const leadIncludeFull = {
  assignedTelecaller: { select: { id: true, name: true, email: true } },
  assignedSalesman: { select: { id: true, name: true, email: true } },
  activities: {
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  callLogs: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { contactDate: 'desc' as const },
  },
  followUpTasks: {
    include: { assignedUser: { select: { id: true, name: true, email: true } } },
    orderBy: { dueDate: 'asc' as const },
  },
  assignmentHistories: {
    include: {
      assignedBy: { select: { id: true, name: true, email: true } },
      previousUser: { select: { id: true, name: true, email: true } },
      newUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

const leadIncludeList = {
  assignedTelecaller: { select: { id: true, name: true, email: true } },
  assignedSalesman: { select: { id: true, name: true, email: true } },
  activities: {
    take: 5,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  callLogs: {
    take: 5,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { contactDate: 'desc' as const },
  },
  followUpTasks: {
    where: { status: 'PENDING' as const },
    include: { assignedUser: { select: { id: true, name: true, email: true } } },
    orderBy: { dueDate: 'asc' as const },
  },
};

function mapPrismaLeadToShared(l: any): Lead {
  const todayMidnight = new Date().setHours(0, 0, 0, 0);

  const activities = (l.activities || []).map((a: any) => ({
    id: a.id,
    leadId: a.leadId,
    userId: a.userId,
    user: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email, role: a.user.role } : null,
    type: a.type,
    description: a.description,
    metadata: a.metadata || null,
    createdAt: new Date(a.createdAt).toISOString(),
  }));

  const callLogs = (l.callLogs || []).map((c: any) => ({
    id: c.id,
    leadId: c.leadId,
    userId: c.userId,
    user: c.user ? { id: c.user.id, name: c.user.name, email: c.user.email } : null,
    outcome: c.outcome,
    notes: c.notes,
    contactDate: new Date(c.contactDate).toISOString(),
    followUpNeeded: c.followUpNeeded,
    nextFollowUpDate: c.nextFollowUpDate ? new Date(c.nextFollowUpDate).toISOString() : null,
    nextAction: c.nextAction,
    durationSeconds: c.durationSeconds,
    createdAt: new Date(c.createdAt).toISOString(),
  }));

  const followUpTasks = (l.followUpTasks || []).map((t: any) => {
    const dueDate = new Date(t.dueDate);
    const isOverdue = t.status === 'PENDING' && dueDate.getTime() < todayMidnight;
    return {
      id: t.id,
      leadId: t.leadId,
      assignedUserId: t.assignedUserId,
      assignedUser: t.assignedUser ? { id: t.assignedUser.id, name: t.assignedUser.name, email: t.assignedUser.email } : undefined,
      taskType: t.taskType,
      dueDate: dueDate.toISOString().split('T')[0],
      dueTime: t.dueTime,
      notes: t.notes,
      status: t.status,
      isOverdue,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
    };
  });

  const assignmentHistories = (l.assignmentHistories || []).map((h: any) => ({
    id: h.id,
    leadId: h.leadId,
    assignedById: h.assignedById,
    assignedBy: h.assignedBy ? { id: h.assignedBy.id, name: h.assignedBy.name, email: h.assignedBy.email } : undefined,
    previousUserId: h.previousUserId,
    previousUser: h.previousUser ? { id: h.previousUser.id, name: h.previousUser.name, email: h.previousUser.email } : null,
    newUserId: h.newUserId,
    newUser: h.newUser ? { id: h.newUser.id, name: h.newUser.name, email: h.newUser.email } : undefined,
    roleType: h.roleType,
    handoverSummary: h.handoverSummary,
    createdAt: new Date(h.createdAt).toISOString(),
  }));

  return {
    id: l.id,
    companyName: l.companyName,
    serviceProduct: l.serviceProduct,
    contactPerson: l.contactPerson || undefined,
    phone: l.phone,
    email: l.email || undefined,
    alternatePhone: l.alternatePhone || undefined,
    website: l.website || undefined,
    city: l.city || undefined,
    state: l.state || undefined,
    priority: l.priority as Priority,
    pipelineStage: l.pipelineStage,
    salesStage: l.salesStage || undefined,
    callAttempts: l.callAttempts || 0,
    isRetry: l.isRetry || false,
    retryCount: l.retryCount || 0,
    lastCallOutcome: l.lastCallOutcome || undefined,
    lastContactDate: l.lastContactDate ? new Date(l.lastContactDate).toISOString() : undefined,
    lastStatusUpdatedAt: l.lastStatusUpdatedAt ? new Date(l.lastStatusUpdatedAt).toISOString() : undefined,
    nextFollowUpDate: l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toISOString() : undefined,
    nextAction: l.nextAction || undefined,
    notes: l.notes || undefined,
    leadSource: l.leadSource || undefined,
    leadSourceOther: l.leadSourceOther || undefined,
    assignedTelecallerId: l.assignedTelecallerId || undefined,
    assignedTelecaller: l.assignedTelecaller ? { id: l.assignedTelecaller.id, name: l.assignedTelecaller.name, email: l.assignedTelecaller.email } : null,
    assignedSalesmanId: l.assignedSalesmanId || undefined,
    assignedSalesman: l.assignedSalesman ? { id: l.assignedSalesman.id, name: l.assignedSalesman.name, email: l.assignedSalesman.email } : null,
    createdById: l.createdById || undefined,
    convertedAt: l.convertedAt ? new Date(l.convertedAt).toISOString() : undefined,
    dealValue: l.dealValue || undefined,
    lostReason: l.lostReason || undefined,
    lostNotes: l.lostNotes || undefined,
    archivedAt: l.archivedAt ? new Date(l.archivedAt).toISOString() : undefined,
    isDeleted: l.isDeleted || false,
    deletedAt: l.deletedAt ? new Date(l.deletedAt).toISOString() : undefined,
    deletedById: l.deletedById || undefined,
    createdAt: new Date(l.createdAt).toISOString(),
    updatedAt: new Date(l.updatedAt).toISOString(),
    lastActivityAt: l.lastActivityAt ? new Date(l.lastActivityAt).toISOString() : undefined,
    activities,
    callLogs,
    followUpTasks,
    assignmentHistories,
  };
}

export interface LeadFilterOptions {
  search?: string;
  pipelineStage?: string;
  lastCallOutcome?: string;
  salesStage?: string;
  priority?: Priority;
  assignedTelecallerId?: string;
  assignedSalesmanId?: string;
  isUnassigned?: boolean;
  followUpStatus?: 'TODAY' | 'OVERDUE' | 'UPCOMING';
  kpi?: string;
  leadSource?: string;
  dateField?: 'createdAt' | 'updatedAt' | 'nextFollowUpDate';
  fromDate?: string;
  toDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'nextFollowUpDate' | 'companyName' | 'priority';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  isDeleted?: boolean;
}

export class LeadRepository {
  async findById(id: string): Promise<Lead | null> {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: leadIncludeFull,
    });
    if (!lead) return null;
    return mapPrismaLeadToShared(lead);
  }

  async findMany(options: LeadFilterOptions = {}): Promise<{ leads: Lead[]; total: number }> {
    const where: any = {
      isDeleted: options.isDeleted !== undefined ? options.isDeleted : false,
      archivedAt: null,
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Operational KPI Filter Mapping
    if (options.kpi) {
      const k = options.kpi.toLowerCase();
      if (k === 'new') {
        where.pipelineStage = { in: ['New Lead', 'NEW'] };
      } else if (k === 'unassigned') {
        where.assignedTelecallerId = null;
        where.assignedSalesmanId = null;
      } else if (k === 'assigned_telecaller') {
        where.assignedTelecallerId = { not: null };
      } else if (k === 'in_progress') {
        where.pipelineStage = { in: ['Attempting Contact', 'Connected', 'Follow-up', 'Demo'] };
      } else if (k === 'interested') {
        where.OR = [
          { pipelineStage: { in: ['Connected', 'Demo'] } },
          { lastCallOutcome: { in: ['Connected – Discussed', 'Demo Interested', 'Demo Scheduled', 'Demo Completed', 'Details Requested'] } },
        ];
      } else if (k === 'assigned_salesman') {
        where.OR = [
          { pipelineStage: { in: ['Assign to Salesman', 'ASSIGNED_TO_SALESMAN'] } },
          { assignedSalesmanId: { not: null } },
        ];
      } else if (k === 'demos_scheduled') {
        where.OR = [
          { pipelineStage: 'Demo' },
          { lastCallOutcome: 'Demo Scheduled' },
          { salesStage: 'DEMO_SCHEDULED' },
        ];
      } else if (k === 'followups_today') {
        where.nextFollowUpDate = { gte: todayStart, lte: todayEnd };
      } else if (k === 'overdue') {
        where.nextFollowUpDate = { lt: todayStart };
      } else if (k === 'converted') {
        where.OR = [
          { AND: [{ pipelineStage: 'Closed' }, { lastCallOutcome: { notIn: ['Not Interested', 'Wrong Number'] } }] },
          { salesStage: 'CONVERTED' },
        ];
      } else if (k === 'lost') {
        where.OR = [
          { AND: [{ pipelineStage: 'Closed' }, { lastCallOutcome: { in: ['Not Interested', 'Wrong Number'] } }] },
          { salesStage: 'LOST' },
          { lostReason: { not: null } },
        ];
      }
    }

    if (options.pipelineStage) {
      where.pipelineStage = options.pipelineStage;
    }
    if (options.lastCallOutcome) {
      where.lastCallOutcome = options.lastCallOutcome;
    }
    if (options.salesStage) {
      where.OR = [
        { salesStage: options.salesStage },
        { pipelineStage: options.salesStage },
      ];
    }
    if (options.priority) {
      where.priority = options.priority;
    }
    if (options.leadSource) {
      where.leadSource = { contains: options.leadSource };
    }
    if (options.assignedTelecallerId) {
      const effId = resolveUserAlias(options.assignedTelecallerId) || options.assignedTelecallerId;
      where.assignedTelecallerId = effId;
    }
    if (options.assignedSalesmanId) {
      const effId = resolveUserAlias(options.assignedSalesmanId) || options.assignedSalesmanId;
      where.assignedSalesmanId = effId;
    }
    if (options.isUnassigned) {
      where.assignedTelecallerId = null;
      where.assignedSalesmanId = null;
    }

    if (options.search) {
      const q = options.search.trim();
      const searchConditions = [
        { companyName: { contains: q } },
        { contactPerson: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { id: { contains: q } },
        { serviceProduct: { contains: q } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    if (options.followUpStatus) {
      if (options.followUpStatus === 'TODAY') {
        where.nextFollowUpDate = { gte: todayStart, lte: todayEnd };
      } else if (options.followUpStatus === 'OVERDUE') {
        where.nextFollowUpDate = { lt: todayStart };
      } else if (options.followUpStatus === 'UPCOMING') {
        where.nextFollowUpDate = { gt: todayEnd };
      }
    }

    // Date range filtering
    if (options.dateField) {
      const field = options.dateField;
      const from = options.fromDate ? new Date(options.fromDate) : null;
      if (from) from.setHours(0, 0, 0, 0);
      const to = options.toDate ? new Date(options.toDate) : null;
      if (to) to.setHours(23, 59, 59, 999);

      if (from || to) {
        const range: any = {};
        if (from) range.gte = from;
        if (to) range.lte = to;
        where[field] = range;
      }
    }

    // Sorting
    const sortField = options.sortBy || 'updatedAt';
    const sortDirection = options.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const);
    let orderBy: any = { updatedAt: sortDirection };

      if (valA !== valB) {
        return isAsc ? valA - valB : valB - valA;
      }
      // Deterministic tie-breaker: Preserve exact import row sequence
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return isAsc ? timeA - timeB : timeB - timeA;
    });

    const total = await prisma.lead.count({ where });
    const page = options.page || 1;
    const limit = options.limit !== undefined ? options.limit : 50;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    const take = limit > 0 ? limit : undefined;

    const leads = await prisma.lead.findMany({
      where,
      orderBy,
      skip,
      take,
      include: leadIncludeList,
    });

    return {
      leads: leads.map(mapPrismaLeadToShared),
      total,
    };
  }

  async findDuplicates(phone: string, email?: string | null, companyName?: string): Promise<Lead[]> {
    const cleanDigits = phone.replace(/\D/g, '');
    const conditions: any[] = [];

    if (cleanDigits.length >= 6) {
      conditions.push({ phone: { contains: cleanDigits.slice(-8) } });
    }
    if (email && email.trim()) {
      conditions.push({ email: email.trim().toLowerCase() });
    }
    if (companyName && companyName.trim()) {
      conditions.push({ companyName: companyName.trim() });
    }

    if (conditions.length === 0) return [];

    const leads = await prisma.lead.findMany({
      where: {
        isDeleted: false,
        OR: conditions,
      },
      include: leadIncludeList,
    });

    return leads.map(mapPrismaLeadToShared);
  }

  async create(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const assignedTelecallerId = leadData.assignedTelecallerId
      ? (resolveUserAlias(leadData.assignedTelecallerId) || leadData.assignedTelecallerId)
      : null;
    const assignedSalesmanId = leadData.assignedSalesmanId
      ? (resolveUserAlias(leadData.assignedSalesmanId) || leadData.assignedSalesmanId)
      : null;
    const createdById = leadData.createdById
      ? (resolveUserAlias(leadData.createdById) || leadData.createdById)
      : null;

    const created = await prisma.lead.create({
      data: {
        companyName: leadData.companyName,
        serviceProduct: leadData.serviceProduct,
        contactPerson: leadData.contactPerson || null,
        phone: leadData.phone,
        email: leadData.email ? leadData.email.toLowerCase().trim() : null,
        alternatePhone: leadData.alternatePhone || null,
        website: leadData.website || null,
        city: leadData.city || null,
        state: leadData.state || null,
        priority: (leadData.priority as any) || 'MEDIUM',
        pipelineStage: leadData.pipelineStage || 'New Lead',
        salesStage: leadData.salesStage || null,
        callAttempts: leadData.callAttempts || 0,
        isRetry: leadData.isRetry || false,
        retryCount: leadData.retryCount || 0,
        lastCallOutcome: leadData.lastCallOutcome || null,
        lastContactDate: leadData.lastContactDate ? new Date(leadData.lastContactDate) : null,
        lastStatusUpdatedAt: leadData.lastStatusUpdatedAt ? new Date(leadData.lastStatusUpdatedAt) : null,
        nextFollowUpDate: leadData.nextFollowUpDate ? new Date(leadData.nextFollowUpDate) : null,
        nextAction: leadData.nextAction || null,
        notes: leadData.notes || null,
        leadSource: leadData.leadSource || null,
        leadSourceOther: leadData.leadSourceOther || null,
        assignedTelecallerId,
        assignedSalesmanId,
        createdById,
        isDeleted: false,
      },
      include: leadIncludeFull,
    });

    return mapPrismaLeadToShared(created);
  }

  async update(id: string, updateData: Partial<Lead>): Promise<Lead | null> {
    const data: any = {};
    if (updateData.companyName !== undefined) data.companyName = updateData.companyName;
    if (updateData.serviceProduct !== undefined) data.serviceProduct = updateData.serviceProduct;
    if (updateData.contactPerson !== undefined) data.contactPerson = updateData.contactPerson;
    if (updateData.phone !== undefined) data.phone = updateData.phone;
    if (updateData.email !== undefined) data.email = updateData.email ? updateData.email.toLowerCase().trim() : null;
    if (updateData.alternatePhone !== undefined) data.alternatePhone = updateData.alternatePhone;
    if (updateData.website !== undefined) data.website = updateData.website;
    if (updateData.city !== undefined) data.city = updateData.city;
    if (updateData.state !== undefined) data.state = updateData.state;
    if (updateData.priority !== undefined) data.priority = updateData.priority;
    if (updateData.pipelineStage !== undefined) data.pipelineStage = updateData.pipelineStage;
    if (updateData.salesStage !== undefined) data.salesStage = updateData.salesStage;
    if (updateData.callAttempts !== undefined) data.callAttempts = updateData.callAttempts;
    if (updateData.isRetry !== undefined) data.isRetry = updateData.isRetry;
    if (updateData.retryCount !== undefined) data.retryCount = updateData.retryCount;
    if (updateData.lastCallOutcome !== undefined) data.lastCallOutcome = updateData.lastCallOutcome;
    if (updateData.lastContactDate !== undefined) {
      data.lastContactDate = updateData.lastContactDate ? new Date(updateData.lastContactDate) : null;
    }
    if (updateData.lastStatusUpdatedAt !== undefined) {
      data.lastStatusUpdatedAt = updateData.lastStatusUpdatedAt ? new Date(updateData.lastStatusUpdatedAt) : null;
    }
    if (updateData.nextFollowUpDate !== undefined) {
      data.nextFollowUpDate = updateData.nextFollowUpDate ? new Date(updateData.nextFollowUpDate) : null;
    }
    if (updateData.nextAction !== undefined) data.nextAction = updateData.nextAction;
    if (updateData.notes !== undefined) data.notes = updateData.notes;
    if (updateData.leadSource !== undefined) data.leadSource = updateData.leadSource;
    if (updateData.leadSourceOther !== undefined) data.leadSourceOther = updateData.leadSourceOther;
    if (updateData.assignedTelecallerId !== undefined) {
      data.assignedTelecallerId = updateData.assignedTelecallerId
        ? (resolveUserAlias(updateData.assignedTelecallerId) || updateData.assignedTelecallerId)
        : null;
    }
    if (updateData.assignedSalesmanId !== undefined) {
      data.assignedSalesmanId = updateData.assignedSalesmanId
        ? (resolveUserAlias(updateData.assignedSalesmanId) || updateData.assignedSalesmanId)
        : null;
    }
    if (updateData.convertedAt !== undefined) {
      data.convertedAt = updateData.convertedAt ? new Date(updateData.convertedAt) : null;
    }
    if (updateData.dealValue !== undefined) data.dealValue = updateData.dealValue;
    if (updateData.lostReason !== undefined) data.lostReason = updateData.lostReason;
    if (updateData.lostNotes !== undefined) data.lostNotes = updateData.lostNotes;
    if (updateData.archivedAt !== undefined) {
      data.archivedAt = updateData.archivedAt ? new Date(updateData.archivedAt) : null;
    }
    if (updateData.isDeleted !== undefined) data.isDeleted = updateData.isDeleted;
    if (updateData.deletedAt !== undefined) {
      data.deletedAt = updateData.deletedAt ? new Date(updateData.deletedAt) : null;
    }
    if (updateData.deletedById !== undefined) data.deletedById = updateData.deletedById;
    if (updateData.lastActivityAt !== undefined) {
      data.lastActivityAt = updateData.lastActivityAt ? new Date(updateData.lastActivityAt) : new Date();
    }

    try {
      const updated = await prisma.lead.update({
        where: { id },
        data,
        include: leadIncludeFull,
      });
      return mapPrismaLeadToShared(updated);
    } catch {
      return null;
    }
  }

  async bulkCreate(leadsData: Array<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lead[]> {
    const results: Lead[] = [];
    for (const item of leadsData) {
      const created = await this.create(item);
      results.push(created);
    }
    return results;
  }

  async delete(id: string, deletedById?: string): Promise<boolean> {
    try {
      const now = new Date();
      await prisma.lead.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: now,
          archivedAt: now,
          deletedById: deletedById || null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async restore(id: string): Promise<boolean> {
    try {
      await prisma.lead.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          archivedAt: null,
          deletedById: null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async bulkDelete(ids: string[], deletedById?: string): Promise<number> {
    const now = new Date();
    const res = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: {
        isDeleted: true,
        deletedAt: now,
        archivedAt: now,
        deletedById: deletedById || null,
      },
    });
    return res.count;
  }

  async bulkUpdatePriority(ids: string[], priority: Priority): Promise<number> {
    const res = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { priority: priority as any },
    });
    return res.count;
  }
}

export const leadRepository = new LeadRepository();
