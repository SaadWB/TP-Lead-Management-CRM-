import { Lead, PipelineStage, Priority, CallOutcome, normalizeCallOutcome } from '@crm/shared';
import { dbStore } from './dbStore';

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
}

export class LeadRepository {
  private enrichLead(lead: Lead, store = dbStore.store, userMap?: Map<string, any>): Lead {
    const users = userMap || new Map(store.users.map((u) => [u.id, u]));
    const telecaller = lead.assignedTelecallerId ? users.get(lead.assignedTelecallerId) || null : null;
    const salesman = lead.assignedSalesmanId ? users.get(lead.assignedSalesmanId) || null : null;

    const activities = store.activities
      .filter((a) => a.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => {
        const author = a.userId ? users.get(a.userId) : null;
        return {
          ...a,
          user: author ? { id: author.id, name: author.name, email: author.email, role: author.role } : null,
        };
      });

    const callLogs = store.callLogs
      .filter((c) => c.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((c) => {
        const caller = c.userId ? users.get(c.userId) : null;
        return {
          ...c,
          user: caller ? { id: caller.id, name: caller.name, email: caller.email } : null,
        };
      });

    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    const followUpTasks = store.followUpTasks
      .filter((t) => t.leadId === lead.id)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .map((t) => {
        const assignee = t.assignedUserId ? users.get(t.assignedUserId) : null;
        const isOverdue = t.status === 'PENDING' && new Date(t.dueDate).getTime() < todayMidnight;
        return {
          ...t,
          assignedUser: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
          isOverdue,
        };
      });

    const assignmentHistories = store.assignmentHistories
      .filter((h) => h.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((h) => {
        const assignedBy = h.assignedById ? users.get(h.assignedById) : null;
        const previousUser = h.previousUserId ? users.get(h.previousUserId) : null;
        const newUser = h.newUserId ? users.get(h.newUserId) : null;
        return {
          ...h,
          assignedBy: assignedBy ? { id: assignedBy.id, name: assignedBy.name, email: assignedBy.email } : undefined,
          previousUser: previousUser ? { id: previousUser.id, name: previousUser.name, email: previousUser.email } : null,
          newUser: newUser ? { id: newUser.id, name: newUser.name, email: newUser.email } : undefined,
        };
      });

    return {
      ...lead,
      assignedTelecaller: telecaller ? { id: telecaller.id, name: telecaller.name, email: telecaller.email } : null,
      assignedSalesman: salesman ? { id: salesman.id, name: salesman.name, email: salesman.email } : null,
      activities,
      callLogs,
      followUpTasks,
      assignmentHistories,
    };
  }

  private enrichLeadsBatch(leads: Lead[]): Lead[] {
    if (leads.length === 0) return [];
    const store = dbStore.store;
    const userMap = new Map(store.users.map((u) => [u.id, u]));
    const leadIdSet = new Set(leads.map((l) => l.id));

    const activitiesMap = new Map<string, any[]>();
    for (const a of store.activities) {
      if (leadIdSet.has(a.leadId)) {
        let list = activitiesMap.get(a.leadId);
        if (!list) {
          list = [];
          activitiesMap.set(a.leadId, list);
        }
        const author = a.userId ? userMap.get(a.userId) : null;
        list.push({
          ...a,
          user: author ? { id: author.id, name: author.name, email: author.email, role: author.role } : null,
        });
      }
    }

    const callLogsMap = new Map<string, any[]>();
    for (const c of store.callLogs) {
      if (leadIdSet.has(c.leadId)) {
        let list = callLogsMap.get(c.leadId);
        if (!list) {
          list = [];
          callLogsMap.set(c.leadId, list);
        }
        const caller = c.userId ? userMap.get(c.userId) : null;
        list.push({
          ...c,
          user: caller ? { id: caller.id, name: caller.name, email: caller.email } : null,
        });
      }
    }

    const tasksMap = new Map<string, any[]>();
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    for (const t of store.followUpTasks) {
      if (leadIdSet.has(t.leadId)) {
        let list = tasksMap.get(t.leadId);
        if (!list) {
          list = [];
          tasksMap.set(t.leadId, list);
        }
        const assignee = t.assignedUserId ? userMap.get(t.assignedUserId) : null;
        const isOverdue = t.status === 'PENDING' && new Date(t.dueDate).getTime() < todayMidnight;
        list.push({
          ...t,
          assignedUser: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
          isOverdue,
        });
      }
    }

    const historiesMap = new Map<string, any[]>();
    for (const h of store.assignmentHistories) {
      if (leadIdSet.has(h.leadId)) {
        let list = historiesMap.get(h.leadId);
        if (!list) {
          list = [];
          historiesMap.set(h.leadId, list);
        }
        const assignedBy = h.assignedById ? userMap.get(h.assignedById) : null;
        const previousUser = h.previousUserId ? userMap.get(h.previousUserId) : null;
        const newUser = h.newUserId ? userMap.get(h.newUserId) : null;
        list.push({
          ...h,
          assignedBy: assignedBy ? { id: assignedBy.id, name: assignedBy.name, email: assignedBy.email } : undefined,
          previousUser: previousUser ? { id: previousUser.id, name: previousUser.name, email: previousUser.email } : null,
          newUser: newUser ? { id: newUser.id, name: newUser.name, email: newUser.email } : undefined,
        });
      }
    }

    return leads.map((lead) => {
      const telecaller = lead.assignedTelecallerId ? userMap.get(lead.assignedTelecallerId) || null : null;
      const salesman = lead.assignedSalesmanId ? userMap.get(lead.assignedSalesmanId) || null : null;

      const activities = (activitiesMap.get(lead.id) || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const callLogs = (callLogsMap.get(lead.id) || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const followUpTasks = (tasksMap.get(lead.id) || []).sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const assignmentHistories = (historiesMap.get(lead.id) || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        ...lead,
        assignedTelecaller: telecaller ? { id: telecaller.id, name: telecaller.name, email: telecaller.email } : null,
        assignedSalesman: salesman ? { id: salesman.id, name: salesman.name, email: salesman.email } : null,
        activities,
        callLogs,
        followUpTasks,
        assignmentHistories,
      };
    });
  }

  async findById(id: string): Promise<Lead | null> {
    dbStore.processAutomaticRules();
    const lead = dbStore.store.leads.find((l) => l.id === id);
    if (!lead) return null;
    return this.enrichLead(lead);
  }

  async findMany(options: LeadFilterOptions = {}): Promise<{ leads: Lead[]; total: number }> {
    dbStore.processAutomaticRules();
    // Exclude archived/deleted leads by default
    let filtered = dbStore.store.leads.filter((l) => !l.archivedAt);

    // Operational KPI Filter Mapping
    if (options.kpi) {
      const k = options.kpi.toLowerCase();
      const todayStr = new Date().toISOString().split('T')[0];
      if (k === 'new') {
        filtered = filtered.filter((l) => l.pipelineStage === 'New Lead' || l.pipelineStage === 'NEW');
      } else if (k === 'unassigned') {
        filtered = filtered.filter((l) => !l.assignedTelecallerId && !l.assignedSalesmanId);
      } else if (k === 'assigned_telecaller') {
        filtered = filtered.filter((l) => !!l.assignedTelecallerId);
      } else if (k === 'in_progress') {
        filtered = filtered.filter((l) =>
          ['Attempting Contact', 'Connected', 'Follow-up', 'Demo'].includes(l.pipelineStage)
        );
      } else if (k === 'interested') {
        filtered = filtered.filter((l) =>
          ['Connected', 'Demo'].includes(l.pipelineStage) ||
          ['Connected – Discussed', 'Demo Interested', 'Demo Scheduled', 'Demo Completed', 'Details Requested'].includes(l.lastCallOutcome || '')
        );
      } else if (k === 'assigned_salesman') {
        filtered = filtered.filter(
          (l) => l.pipelineStage === 'Assign to Salesman' || l.pipelineStage === 'ASSIGNED_TO_SALESMAN' || !!l.assignedSalesmanId
        );
      } else if (k === 'demos_scheduled') {
        filtered = filtered.filter(
          (l) =>
            l.pipelineStage === 'Demo' ||
            l.lastCallOutcome === 'Demo Scheduled' ||
            l.salesStage === 'DEMO_SCHEDULED'
        );
      } else if (k === 'followups_today') {
        filtered = filtered.filter((l) => {
          const directMatch = !!(l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] === todayStr);
          const taskMatch = dbStore.store.followUpTasks.some(
            (t) => t.leadId === l.id && t.status === 'PENDING' && t.dueDate.split('T')[0] === todayStr
          );
          return directMatch || taskMatch;
        });
      } else if (k === 'overdue') {
        filtered = filtered.filter((l) => {
          const directMatch = !!(l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] < todayStr);
          const taskMatch = dbStore.store.followUpTasks.some(
            (t) => t.leadId === l.id && t.status === 'PENDING' && t.dueDate.split('T')[0] < todayStr
          );
          return directMatch || taskMatch;
        });
      } else if (k === 'converted') {
        filtered = filtered.filter(
          (l) => (l.pipelineStage === 'Closed' && l.lastCallOutcome !== 'Not Interested' && l.lastCallOutcome !== 'Wrong Number') || l.salesStage === 'CONVERTED'
        );
      } else if (k === 'lost') {
        filtered = filtered.filter(
          (l) =>
            (l.pipelineStage === 'Closed' && (l.lastCallOutcome === 'Not Interested' || l.lastCallOutcome === 'Wrong Number')) ||
            l.salesStage === 'LOST' ||
            !!l.lostReason
        );
      }
    }

    if (options.pipelineStage) {
      const target = options.pipelineStage;
      filtered = filtered.filter((l) => {
        if (l.pipelineStage === target) return true;
        const norm = normalizeCallOutcome(l.pipelineStage);
        return norm === target;
      });
    }
    if (options.lastCallOutcome) {
      filtered = filtered.filter((l) => l.lastCallOutcome === options.lastCallOutcome);
    }
    if (options.salesStage) {
      filtered = filtered.filter((l) => l.salesStage === options.salesStage || l.pipelineStage === options.salesStage);
    }
    if (options.priority) {
      filtered = filtered.filter((l) => l.priority === options.priority);
    }

    if (options.leadSource) {
      filtered = filtered.filter(
        (l) => l.leadSource && l.leadSource.toLowerCase() === options.leadSource!.toLowerCase()
      );
    }
    if (options.assignedTelecallerId) {
      filtered = filtered.filter((l) => l.assignedTelecallerId === options.assignedTelecallerId);
    }
    if (options.assignedSalesmanId) {
      filtered = filtered.filter((l) => l.assignedSalesmanId === options.assignedSalesmanId);
    }
    if (options.isUnassigned) {
      filtered = filtered.filter((l) => !l.assignedTelecallerId && !l.assignedSalesmanId);
    }
    if (options.leadSource) {
      filtered = filtered.filter((l) => l.leadSource?.toLowerCase().includes(options.leadSource!.toLowerCase()));
    }
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
          l.phone.toLowerCase().includes(q) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          l.id.toLowerCase().includes(q) ||
          (l.serviceProduct && l.serviceProduct.toLowerCase().includes(q))
      );
    }

    if (options.followUpStatus) {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = filtered.filter((l) => {
        if (!l.nextFollowUpDate) return false;
        const taskDate = l.nextFollowUpDate.split('T')[0];
        if (options.followUpStatus === 'TODAY') return taskDate === todayStr;
        if (options.followUpStatus === 'OVERDUE') return taskDate < todayStr;
        if (options.followUpStatus === 'UPCOMING') return taskDate > todayStr;
        return true;
      });
    }

    // Date range filtering
    if (options.dateField) {
      const field = options.dateField;
      const fromTimestamp = options.fromDate ? new Date(options.fromDate).setHours(0, 0, 0, 0) : null;
      const toTimestamp = options.toDate ? new Date(options.toDate).setHours(23, 59, 59, 999) : null;

      filtered = filtered.filter((l) => {
        let val: string | null | undefined;
        if (field === 'createdAt') val = l.createdAt;
        else if (field === 'updatedAt') val = l.lastActivityAt || l.updatedAt;
        else if (field === 'nextFollowUpDate') val = l.nextFollowUpDate;

        if (!val) return false;
        const leadTime = new Date(val).getTime();
        if (isNaN(leadTime)) return false;

        if (fromTimestamp !== null && leadTime < fromTimestamp) return false;
        if (toTimestamp !== null && leadTime > toTimestamp) return false;
        return true;
      });
    }

    // Sorting (custom or default most recent)
    const sortField = options.sortBy || 'updatedAt';
    const isAsc = options.sortOrder === 'asc';

    filtered.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortField === 'updatedAt') {
        valA = new Date(a.lastActivityAt || a.updatedAt).getTime();
        valB = new Date(b.lastActivityAt || b.updatedAt).getTime();
      } else if (sortField === 'nextFollowUpDate') {
        valA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : 0;
        valB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : 0;
      } else if (sortField === 'companyName') {
        valA = a.companyName.toLowerCase();
        valB = b.companyName.toLowerCase();
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = new Date(a.lastActivityAt || a.updatedAt).getTime();
        valB = new Date(b.lastActivityAt || b.updatedAt).getTime();
      }

      return isAsc ? valA - valB : valB - valA;
    });

    const total = filtered.length;
    const page = options.page || 1;
    const limit = options.limit !== undefined ? options.limit : 50;
    const startIndex = (page - 1) * (limit > 0 ? limit : 50);
    const paginated = limit <= 0 ? filtered : filtered.slice(startIndex, startIndex + limit);

    return {
      leads: this.enrichLeadsBatch(paginated),
      total,
    };
  }

  async findDuplicates(phone: string, email?: string | null, companyName?: string): Promise<Lead[]> {
    const cleanPhone = (p: string) => p.replace(/\D/g, '');
    const targetPhoneDigits = cleanPhone(phone);
    const targetEmail = email?.trim().toLowerCase();
    const targetCompany = companyName?.trim().toLowerCase();

    return dbStore.store.leads
      .filter((l) => {
        // Phone match (last 8 digits)
        const leadDigits = cleanPhone(l.phone);
        if (targetPhoneDigits && leadDigits && (leadDigits.endsWith(targetPhoneDigits) || targetPhoneDigits.endsWith(leadDigits))) {
          return true;
        }
        // Email match
        if (targetEmail && l.email && l.email.trim().toLowerCase() === targetEmail) {
          return true;
        }
        // Exact company name match
        if (targetCompany && l.companyName.trim().toLowerCase() === targetCompany) {
          return true;
        }
        return false;
      })
      .map((l) => this.enrichLead(l));
  }

  async create(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const newLead: Lead = {
      ...leadData,
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      callAttempts: leadData.callAttempts || 0,
      isDeleted: false,
    };
    dbStore.store.leads.push(newLead);
    dbStore.persist();
    dbStore.syncLeadToDatabase(newLead).catch(console.error);
    return this.enrichLead(newLead);
  }

  async update(id: string, updateData: Partial<Lead>): Promise<Lead | null> {
    const index = dbStore.store.leads.findIndex((l) => l.id === id);
    if (index === -1) return null;

    dbStore.store.leads[index] = {
      ...dbStore.store.leads[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
      lastActivityAt: updateData.lastActivityAt || new Date().toISOString(),
    };
    dbStore.persist();
    dbStore.syncLeadToDatabase(dbStore.store.leads[index]).catch(console.error);
    return this.enrichLead(dbStore.store.leads[index]);
  }

  async bulkCreate(leadsData: Array<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lead[]> {
    const created: Lead[] = [];
    const now = new Date().toISOString();
    for (const data of leadsData) {
      const item: Lead = {
        ...data,
        id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        callAttempts: data.callAttempts || 0,
        isDeleted: false,
      };
      dbStore.store.leads.push(item);
      created.push(item);
      dbStore.syncLeadToDatabase(item).catch(console.error);
    }
    dbStore.persist();
    return created.map((l) => this.enrichLead(l));
  }

  async delete(id: string): Promise<boolean> {
    const index = dbStore.store.leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    const now = new Date().toISOString();
    dbStore.store.leads[index].archivedAt = now;
    dbStore.store.leads[index].isDeleted = true;
    dbStore.store.leads[index].deletedAt = now;
    dbStore.store.leads[index].updatedAt = now;
    dbStore.persist();
    dbStore.syncLeadToDatabase(dbStore.store.leads[index]).catch(console.error);
    return true;
  }

  async restore(id: string): Promise<boolean> {
    const index = dbStore.store.leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    const now = new Date().toISOString();
    dbStore.store.leads[index].archivedAt = null;
    dbStore.store.leads[index].isDeleted = false;
    dbStore.store.leads[index].deletedAt = null;
    dbStore.store.leads[index].deletedById = null;
    dbStore.store.leads[index].updatedAt = now;
    dbStore.persist();
    dbStore.syncLeadToDatabase(dbStore.store.leads[index]).catch(console.error);
    return true;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const id of ids) {
      const index = dbStore.store.leads.findIndex((l) => l.id === id);
      if (index !== -1 && !dbStore.store.leads[index].archivedAt) {
        dbStore.store.leads[index].archivedAt = now;
        dbStore.store.leads[index].isDeleted = true;
        dbStore.store.leads[index].deletedAt = now;
        dbStore.store.leads[index].updatedAt = now;
        dbStore.syncLeadToDatabase(dbStore.store.leads[index]).catch(console.error);
        count++;
      }
    }
    if (count > 0) dbStore.persist();
    return count;
  }

  async bulkUpdatePriority(ids: string[], priority: Priority): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const id of ids) {
      const index = dbStore.store.leads.findIndex((l) => l.id === id);
      if (index !== -1 && !dbStore.store.leads[index].archivedAt) {
        dbStore.store.leads[index].priority = priority;
        dbStore.store.leads[index].updatedAt = now;
        dbStore.syncLeadToDatabase(dbStore.store.leads[index]).catch(console.error);
        count++;
      }
    }
    if (count > 0) dbStore.persist();
    return count;
  }
}

export const leadRepository = new LeadRepository();
