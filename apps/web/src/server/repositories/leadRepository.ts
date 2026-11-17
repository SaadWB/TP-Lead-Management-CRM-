import { Lead, Priority, CallOutcome } from '@crm/shared';
import { prisma } from '../config/prisma';
import { resolveUserAlias, areUserIdsEquivalent } from './userRepository';
import { parseSafeDateObject } from '../utils/dateUtils';

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
    alternateName: l.alternateName || undefined,
    phone: l.phone,
    email: l.email || undefined,
    alternatePhone: l.alternatePhone || undefined,
    website: l.website || undefined,
    city: l.city || undefined,
    state: l.state || undefined,
    priority: l.priority as Priority,
    pipelineStage: l.pipelineStage === 'Connected – Discussed' ? 'Connected' : (l.pipelineStage || 'New Lead'),
    salesStage: l.salesStage || undefined,
    callAttempts: l.callAttempts || 0,
    isRetry: l.isRetry || false,
    retryCount: l.retryCount || 0,
    lastCallOutcome: l.lastCallOutcome ?? undefined,
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
  excludeWebsiteLeads?: boolean;
}

export class LeadRepository {
  async findById(id: string, options?: { includeRelations?: boolean }): Promise<Lead | null> {
    const include = options?.includeRelations === false
      ? {
          assignedTelecaller: { select: { id: true, name: true, email: true } },
          assignedSalesman: { select: { id: true, name: true, email: true } },
        }
      : leadIncludeFull;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include,
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
      const normStage = options.pipelineStage.trim();
      if (normStage === 'Closed Won' || normStage === 'CONVERTED') {
        const closedWonConditions = [
          { pipelineStage: { in: ['Closed Won', 'CONVERTED'] } },
          { salesStage: 'CONVERTED' },
          { convertedAt: { not: null } },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: closedWonConditions }];
          delete where.OR;
        } else {
          where.OR = closedWonConditions;
        }
      } else {
        where.pipelineStage = options.pipelineStage;
        // Closed Won leads should NEVER show up in any running pipeline stage!
        where.AND = where.AND || [];
        where.AND.push({
          pipelineStage: { notIn: ['Closed Won', 'CONVERTED'] },
          salesStage: { not: 'CONVERTED' },
          convertedAt: null,
        });
      }
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
    if (options.excludeWebsiteLeads) {
      const websiteConditions = [
        { leadSource: { contains: 'website' } },
        { leadSource: { contains: 'Website' } },
        { leadSource: 'Website' },
        { leadSource: 'website' },
      ];
      where.NOT = where.NOT || [];
      if (Array.isArray(where.NOT)) {
        where.NOT.push(...websiteConditions);
      } else {
        where.NOT = [where.NOT, ...websiteConditions];
      }
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
        { alternateName: { contains: q } },
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

    // Sorting - default to createdAt asc so table sequence matches sheet order and doesn't shift on update
    const sortField = options.sortBy || 'createdAt';
    const sortDirection = options.sortOrder === 'desc' ? ('desc' as const) : ('asc' as const);
    let orderBy: any = { createdAt: sortDirection };

    if (sortField === 'createdAt') orderBy = { createdAt: sortDirection };
    else if (sortField === 'updatedAt') orderBy = { updatedAt: sortDirection };
    else if (sortField === 'companyName') orderBy = { companyName: sortDirection };
    else if (sortField === 'priority') orderBy = { priority: sortDirection };
    else if (sortField === 'nextFollowUpDate') orderBy = { nextFollowUpDate: sortDirection };
    else orderBy = { createdAt: sortDirection };

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

  async create(
    leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Date | string; updatedAt?: Date | string },
    options?: { includeRelations?: boolean }
  ): Promise<Lead> {
    const assignedTelecallerId = leadData.assignedTelecallerId
      ? (resolveUserAlias(leadData.assignedTelecallerId) || leadData.assignedTelecallerId)
      : null;
    const assignedSalesmanId = leadData.assignedSalesmanId
      ? (resolveUserAlias(leadData.assignedSalesmanId) || leadData.assignedSalesmanId)
      : null;
    const createdById = leadData.createdById
      ? (resolveUserAlias(leadData.createdById) || leadData.createdById)
      : null;

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const rawPriority = String(leadData.priority || '').toUpperCase().trim();
    const priority = validPriorities.includes(rawPriority) ? (rawPriority as any) : 'MEDIUM';

    const created = await prisma.lead.create({
      data: {
        companyName: String(leadData.companyName || '').slice(0, 150),
        serviceProduct: String(leadData.serviceProduct || 'General Procurement').slice(0, 150),
        contactPerson: leadData.contactPerson ? String(leadData.contactPerson).slice(0, 100) : null,
        alternateName: leadData.alternateName ? String(leadData.alternateName).slice(0, 100) : null,
        phone: String(leadData.phone || '').slice(0, 30),
        email: leadData.email ? String(leadData.email).toLowerCase().trim().slice(0, 100) : null,
        alternatePhone: leadData.alternatePhone ? String(leadData.alternatePhone).slice(0, 30) : null,
        website: leadData.website ? String(leadData.website).slice(0, 255) : null,
        city: leadData.city ? String(leadData.city).slice(0, 100) : null,
        state: leadData.state ? String(leadData.state).slice(0, 100) : null,
        priority,
        pipelineStage: String(leadData.pipelineStage || 'New Lead').slice(0, 50),
        salesStage: leadData.salesStage ? String(leadData.salesStage).slice(0, 50) : null,
        callAttempts: Number.isFinite(leadData.callAttempts) ? Number(leadData.callAttempts) : 0,
        isRetry: leadData.isRetry || false,
        retryCount: Number.isFinite(leadData.retryCount) ? Number(leadData.retryCount) : 0,
        lastCallOutcome: leadData.lastCallOutcome ? String(leadData.lastCallOutcome).slice(0, 50) : null,
        lastContactDate: parseSafeDateObject(leadData.lastContactDate),
        lastStatusUpdatedAt: parseSafeDateObject(leadData.lastStatusUpdatedAt),
        nextFollowUpDate: parseSafeDateObject(leadData.nextFollowUpDate),
        nextAction: leadData.nextAction || null,
        notes: leadData.notes || null,
        leadSource: leadData.leadSource ? String(leadData.leadSource).slice(0, 100) : null,
        leadSourceOther: leadData.leadSourceOther ? String(leadData.leadSourceOther).slice(0, 100) : null,
        assignedTelecallerId,
        assignedSalesmanId,
        createdById,
        isDeleted: false,
        ...(leadData.createdAt ? { createdAt: new Date(leadData.createdAt), updatedAt: new Date(leadData.createdAt) } : {}),
      },
      ...(options?.includeRelations === false ? {} : { include: leadIncludeFull }),
    });

    return mapPrismaLeadToShared(created);
  }

  async update(id: string, updateData: Partial<Lead>): Promise<Lead | null> {
    const data: any = {};
    if (updateData.companyName !== undefined) data.companyName = String(updateData.companyName || '').slice(0, 150);
    if (updateData.serviceProduct !== undefined) data.serviceProduct = String(updateData.serviceProduct || '').slice(0, 150);
    if (updateData.contactPerson !== undefined) data.contactPerson = updateData.contactPerson ? String(updateData.contactPerson).slice(0, 100) : null;
    if (updateData.alternateName !== undefined) data.alternateName = updateData.alternateName ? String(updateData.alternateName).slice(0, 100) : null;
    if (updateData.phone !== undefined) data.phone = String(updateData.phone || '').slice(0, 30);
    if (updateData.email !== undefined) data.email = updateData.email ? String(updateData.email).toLowerCase().trim().slice(0, 100) : null;
    if (updateData.alternatePhone !== undefined) data.alternatePhone = updateData.alternatePhone ? String(updateData.alternatePhone).slice(0, 30) : null;
    if (updateData.website !== undefined) data.website = updateData.website ? String(updateData.website).slice(0, 255) : null;
    if (updateData.city !== undefined) data.city = updateData.city ? String(updateData.city).slice(0, 100) : null;
    if (updateData.state !== undefined) data.state = updateData.state ? String(updateData.state).slice(0, 100) : null;
    if (updateData.priority !== undefined) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const raw = String(updateData.priority || '').toUpperCase().trim();
      data.priority = validPriorities.includes(raw) ? raw : 'MEDIUM';
    }
    if (updateData.pipelineStage !== undefined) data.pipelineStage = String(updateData.pipelineStage || 'New Lead').slice(0, 50);
    if (updateData.salesStage !== undefined) data.salesStage = updateData.salesStage ? String(updateData.salesStage).slice(0, 50) : null;
    if (updateData.callAttempts !== undefined) data.callAttempts = Number.isFinite(updateData.callAttempts) ? Number(updateData.callAttempts) : 0;
    if (updateData.isRetry !== undefined) data.isRetry = updateData.isRetry;
    if (updateData.retryCount !== undefined) data.retryCount = Number.isFinite(updateData.retryCount) ? Number(updateData.retryCount) : 0;
    if (updateData.lastCallOutcome !== undefined) data.lastCallOutcome = updateData.lastCallOutcome ? String(updateData.lastCallOutcome).slice(0, 50) : null;
    if (updateData.lastContactDate !== undefined) {
      data.lastContactDate = parseSafeDateObject(updateData.lastContactDate);
    }
    if (updateData.lastStatusUpdatedAt !== undefined) {
      data.lastStatusUpdatedAt = parseSafeDateObject(updateData.lastStatusUpdatedAt);
    }
    if (updateData.nextFollowUpDate !== undefined) {
      data.nextFollowUpDate = parseSafeDateObject(updateData.nextFollowUpDate);
    }
    if (updateData.nextAction !== undefined) data.nextAction = updateData.nextAction;
    if (updateData.notes !== undefined) data.notes = updateData.notes;
    if (updateData.leadSource !== undefined) data.leadSource = updateData.leadSource ? String(updateData.leadSource).slice(0, 100) : null;
    if (updateData.leadSourceOther !== undefined) data.leadSourceOther = updateData.leadSourceOther ? String(updateData.leadSourceOther).slice(0, 100) : null;
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
