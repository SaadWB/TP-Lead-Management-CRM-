import { Lead, PipelineStage, Priority, CallOutcome, normalizeCallOutcome } from '@crm/shared';
import { dbStore } from './dbStore';

export interface LeadFilterOptions {
  search?: string;
  pipelineStage?: string;
  salesStage?: string;
  priority?: Priority;
  assignedTelecallerId?: string;
  assignedSalesmanId?: string;
  isUnassigned?: boolean;
  followUpStatus?: 'TODAY' | 'OVERDUE' | 'UPCOMING';
  kpi?: string;
  leadSource?: string;
  page?: number;
  limit?: number;
}

export class LeadRepository {
  private enrichLead(lead: Lead): Lead {
    const telecaller = lead.assignedTelecallerId
      ? dbStore.store.users.find((u) => u.id === lead.assignedTelecallerId)
      : null;
    const salesman = lead.assignedSalesmanId
      ? dbStore.store.users.find((u) => u.id === lead.assignedSalesmanId)
      : null;

    const activities = dbStore.store.activities
      .filter((a) => a.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((a) => {
        const author = a.userId ? dbStore.store.users.find((u) => u.id === a.userId) : null;
        return {
          ...a,
          user: author ? { id: author.id, name: author.name, email: author.email, role: author.role } : null,
        };
      });

    const callLogs = dbStore.store.callLogs
      .filter((c) => c.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((c) => {
        const caller = dbStore.store.users.find((u) => u.id === c.userId);
        return {
          ...c,
          user: caller ? { id: caller.id, name: caller.name, email: caller.email } : null,
        };
      });

    const followUpTasks = dbStore.store.followUpTasks
      .filter((t) => t.leadId === lead.id)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .map((t) => {
        const assignee = dbStore.store.users.find((u) => u.id === t.assignedUserId);
        const isOverdue = t.status === 'PENDING' && new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
        return {
          ...t,
          assignedUser: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : undefined,
          isOverdue,
        };
      });

    const assignmentHistories = dbStore.store.assignmentHistories
      .filter((h) => h.leadId === lead.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((h) => {
        const assignedBy = dbStore.store.users.find((u) => u.id === h.assignedById);
        const previousUser = h.previousUserId ? dbStore.store.users.find((u) => u.id === h.previousUserId) : null;
        const newUser = dbStore.store.users.find((u) => u.id === h.newUserId);
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
          [
            'No Answer / Ringing',
            'Busy / Declined',
            'Callback Requested',
            'Details on WhatsApp',
            'Demo Requested',
            'CONTACT_ATTEMPTED',
            'CONNECTED',
            'INTERESTED',
            'FOLLOW_UP_SCHEDULED',
          ].includes(l.pipelineStage)
        );
      } else if (k === 'interested') {
        filtered = filtered.filter((l) =>
          ['Interested', 'INTERESTED', 'Demo Requested', 'DEMO_REQUESTED'].includes(l.pipelineStage)
        );
      } else if (k === 'assigned_salesman') {
        filtered = filtered.filter(
          (l) => l.pipelineStage === 'Assign to Salesman' || l.pipelineStage === 'ASSIGNED_TO_SALESMAN' || !!l.assignedSalesmanId
        );
      } else if (k === 'demos_scheduled') {
        filtered = filtered.filter(
          (l) =>
            ['Demo Requested', 'DEMO_MEETING_REQUIRED', 'DEMO_SCHEDULED'].includes(l.pipelineStage) ||
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
          (l) => l.pipelineStage === 'Closed' || l.pipelineStage === 'CONVERTED' || l.salesStage === 'CONVERTED'
        );
      } else if (k === 'lost') {
        filtered = filtered.filter(
          (l) =>
            [
              'Not Interested',
              'Invalid / Wrong Number',
              'Do Not Contact',
              'NOT_INTERESTED',
              'INVALID_CONTACT',
              'DO_NOT_CONTACT',
              'LOST',
            ].includes(l.pipelineStage) || l.salesStage === 'LOST'
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
    if (options.salesStage) {
      filtered = filtered.filter((l) => l.salesStage === options.salesStage || l.pipelineStage === options.salesStage);
    }
    if (options.priority) {
      filtered = filtered.filter((l) => l.priority === options.priority);
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

    // Default sorting: most recent activity or updated
    filtered.sort((a, b) => {
      const timeA = new Date(a.lastActivityAt || a.updatedAt).getTime();
      const timeB = new Date(b.lastActivityAt || b.updatedAt).getTime();
      return timeB - timeA;
    });

    const total = filtered.length;
    const page = options.page || 1;
    const limit = options.limit || 50;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      leads: paginated.map((l) => this.enrichLead(l)),
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
    };
    dbStore.store.leads.push(newLead);
    dbStore.persist();
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
      };
      dbStore.store.leads.push(item);
      created.push(item);
    }
    dbStore.persist();
    return created.map((l) => this.enrichLead(l));
  }

  async delete(id: string): Promise<boolean> {
    const index = dbStore.store.leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    dbStore.store.leads[index].archivedAt = new Date().toISOString();
    dbStore.store.leads[index].updatedAt = new Date().toISOString();
    dbStore.persist();
    return true;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const id of ids) {
      const index = dbStore.store.leads.findIndex((l) => l.id === id);
      if (index !== -1 && !dbStore.store.leads[index].archivedAt) {
        dbStore.store.leads[index].archivedAt = now;
        dbStore.store.leads[index].updatedAt = now;
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
        count++;
      }
    }
    if (count > 0) dbStore.persist();
    return count;
  }
}

export const leadRepository = new LeadRepository();
