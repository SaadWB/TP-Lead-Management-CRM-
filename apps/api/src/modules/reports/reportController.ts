import { Request, Response, NextFunction } from 'express';
import {
  USER_ROLES,
  TELECALLER_KANBAN_COLUMNS,
  DashboardMetrics,
} from '@crm/shared';
import { dbStore } from '../../repositories/dbStore';
import { activityRepository } from '../../repositories/activityRepository';
import { sendSuccess } from '../../utils/response';

export async function getDashboardMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const leads = dbStore.store.leads.filter((l) => !l.archivedAt);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Filter leads if Telecaller or Salesman is requesting their personal dashboard
    let visibleLeads = leads;
    if (user.role === USER_ROLES.TELECALLER) {
      visibleLeads = leads.filter((l) => l.assignedTelecallerId === user.id);
    } else if (user.role === USER_ROLES.SALESMAN) {
      visibleLeads = leads.filter((l) => l.assignedSalesmanId === user.id);
    }

    const totalLeads = visibleLeads.length;
    const newLeads = visibleLeads.filter((l) => l.pipelineStage === 'New Lead' || l.pipelineStage === 'NEW').length;
    const unassignedLeads = leads.filter((l) => !l.assignedTelecallerId && !l.assignedSalesmanId).length;
    const leadsAssignedToTelecallers = leads.filter((l) => !!l.assignedTelecallerId).length;
    const leadsInProgress = visibleLeads.filter((l) =>
      ['Attempting Contact', 'Connected', 'Follow-up', 'Demo'].includes(l.pipelineStage)
    ).length;
    const interestedLeads = visibleLeads.filter((l) =>
      ['Connected', 'Demo'].includes(l.pipelineStage) ||
      ['Connected – Discussed', 'Demo Interested', 'Demo Scheduled', 'Demo Completed', 'Details Requested'].includes(l.lastCallOutcome || '')
    ).length;
    const leadsAssignedToSalesmen = visibleLeads.filter((l) =>
      l.pipelineStage === 'Assign to Salesman' || l.pipelineStage === 'ASSIGNED_TO_SALESMAN' || !!l.assignedSalesmanId
    ).length;
    const demosMeetingsScheduled = visibleLeads.filter((l) =>
      l.pipelineStage === 'Demo' ||
      l.lastCallOutcome === 'Demo Scheduled' ||
      l.salesStage === 'DEMO_SCHEDULED'
    ).length;

    // Follow-up calculations strictly aligned with lead rows
    const store = dbStore.store;
    const todayTaskLeadIds = new Set(
      store.followUpTasks
        .filter(
          (t) =>
            t.status === 'PENDING' &&
            t.dueDate.split('T')[0] === todayStr &&
            (user.role === USER_ROLES.SUPER_ADMIN || t.assignedUserId === user.id)
        )
        .map((t) => t.leadId)
    );
    const overdueTaskLeadIds = new Set(
      store.followUpTasks
        .filter(
          (t) =>
            t.status === 'PENDING' &&
            t.dueDate.split('T')[0] < todayStr &&
            (user.role === USER_ROLES.SUPER_ADMIN || t.assignedUserId === user.id)
        )
        .map((t) => t.leadId)
    );

    const followUpsDueToday = visibleLeads.filter(
      (l) => (l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] === todayStr) || todayTaskLeadIds.has(l.id)
    ).length;

    const overdueFollowUps = visibleLeads.filter(
      (l) => (l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] < todayStr) || overdueTaskLeadIds.has(l.id)
    ).length;

    const convertedLeads = visibleLeads.filter(
      (l) => (l.pipelineStage === 'Closed' && l.lastCallOutcome !== 'Not Interested' && l.lastCallOutcome !== 'Wrong Number') || l.salesStage === 'CONVERTED'
    ).length;
    const lostLeads = visibleLeads.filter(
      (l) =>
        (l.pipelineStage === 'Closed' && (l.lastCallOutcome === 'Not Interested' || l.lastCallOutcome === 'Wrong Number')) ||
        l.salesStage === 'LOST' ||
        l.lostReason
    ).length;

    const closedLeads = convertedLeads + lostLeads;
    const conversionRate = closedLeads > 0 ? Math.round((convertedLeads / closedLeads) * 100) : 0;

    // Stage distribution
    const stageCounts: Record<string, number> = {};
    visibleLeads.forEach((l) => {
      stageCounts[l.pipelineStage] = (stageCounts[l.pipelineStage] || 0) + 1;
    });

    const stageDistribution = TELECALLER_KANBAN_COLUMNS.map((col) => ({
      stage: col.id,
      label: col.title,
      color: col.color,
      count: stageCounts[col.id] || 0,
    }));

    // Priority distribution
    const priorityCounts: Record<string, number> = {};
    visibleLeads.forEach((l) => {
      priorityCounts[l.priority] = (priorityCounts[l.priority] || 0) + 1;
    });
    const priorityDistribution = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
    }));

    // Source distribution
    const sourceCounts: Record<string, number> = {};
    visibleLeads.forEach((l) => {
      const src = l.leadSource || 'Other';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const sourceDistribution = Object.entries(sourceCounts).map(([source, count]) => ({
      source,
      count,
    }));

    // Inactive leads count (>7 days without activity)
    const inactiveLeadsCount = visibleLeads.filter(
      (l) => l.lastActivityAt && l.lastActivityAt < sevenDaysAgo && !['CONVERTED', 'LOST', 'NOT_INTERESTED'].includes(l.pipelineStage)
    ).length;

    // Performance tables for Super Admin
    let telecallerPerformance;
    let salesmanPerformance;

    if (user.role === USER_ROLES.SUPER_ADMIN) {
      const telecallers = dbStore.store.users.filter((u) => u.role === USER_ROLES.TELECALLER);
      telecallerPerformance = telecallers.map((t) => {
        const assigned = leads.filter((l) => l.assignedTelecallerId === t.id);
        const calls = dbStore.store.callLogs.filter((c) => c.userId === t.id);
        const connected = calls.filter((c) =>
          !['No Answer', 'Busy', 'Call Cut', 'Wrong Number', 'No Answer / Ringing', 'Busy / Declined', 'Invalid / Wrong Number', 'NO_ANSWER', 'BUSY', 'INVALID_NUMBER'].includes(c.outcome as string)
        ).length;
        const handedOver = leads.filter((l) => l.assignedTelecallerId === t.id && l.assignedSalesmanId).length;
        return {
          userId: t.id,
          name: t.name,
          assignedCount: assigned.length,
          callsLogged: calls.length,
          connectedCount: connected,
          demosHandedOver: handedOver,
        };
      });

      const salesmen = dbStore.store.users.filter((u) => u.role === USER_ROLES.SALESMAN);
      salesmanPerformance = salesmen.map((s) => {
        const assigned = leads.filter((l) => l.assignedSalesmanId === s.id);
        const demos = dbStore.store.followUpTasks.filter((t) => t.assignedUserId === s.id && t.taskType === 'DEMO');
        const converted = assigned.filter((l) => l.salesStage === 'CONVERTED' || l.pipelineStage === 'Closed' || l.pipelineStage === 'CONVERTED');
        const lost = assigned.filter((l) => l.salesStage === 'LOST' || l.pipelineStage === 'LOST');
        const revenue = converted.reduce((sum, l) => sum + (l.dealValue || 0), 0);

        return {
          userId: s.id,
          name: s.name,
          assignedCount: assigned.length,
          demosScheduled: demos.length,
          demosCompleted: demos.filter((d) => d.status === 'COMPLETED').length,
          convertedCount: converted.length,
          lostCount: lost.length,
          totalRevenue: revenue,
        };
      });
    }

    const recentActivities = await activityRepository.findRecent(12);

    const metrics: DashboardMetrics = {
      totalLeads,
      newLeads,
      unassignedLeads,
      leadsAssignedToTelecallers,
      leadsInProgress,
      interestedLeads,
      leadsAssignedToSalesmen,
      demosMeetingsScheduled,
      followUpsDueToday,
      overdueFollowUps,
      convertedLeads,
      lostLeads,
      conversionRate,
      stageDistribution,
      priorityDistribution,
      sourceDistribution,
      telecallerPerformance,
      salesmanPerformance,
      recentActivities,
      inactiveLeadsCount,
    };

    sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
}

export async function exportLeadsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const leads = dbStore.store.leads.filter((l) => !l.archivedAt);
    const rows = leads.map((l) => ({
      'Lead ID': l.id,
      Company: l.companyName,
      'Contact Person': l.contactPerson || '-',
      Phone: l.phone,
      Email: l.email || '',
      'Service/Product': l.serviceProduct,
      Priority: l.priority,
      'Pipeline Stage': l.pipelineStage,
      'Call Attempts': l.callAttempts,
      'Last Outcome': l.lastCallOutcome || '',
      'Next Follow-Up': l.nextFollowUpDate || '',
      'Next Action': l.nextAction || '',
      'Lead Source': l.leadSource || '',
      'Assigned Telecaller': l.assignedTelecaller?.name || '',
      'Assigned Salesman': l.assignedSalesman?.name || '',
      'Created Date': l.createdAt,
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads_export.csv"');

    const headers = Object.keys(rows[0] || {}).join(',');
    const csvContent = [
      headers,
      ...rows.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}
