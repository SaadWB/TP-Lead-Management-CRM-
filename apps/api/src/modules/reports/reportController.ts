import { Request, Response, NextFunction } from 'express';
import {
  USER_ROLES,
  TELECALLER_KANBAN_COLUMNS,
  DashboardMetrics,
  normalizeCallOutcome,
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

export async function getTelecallerReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { range = 'TODAY', fromDate, toDate, telecallerId } = req.query as {
      range?: string;
      fromDate?: string;
      toDate?: string;
      telecallerId?: string;
    };

    // Determine target telecaller ID
    let targetTelecallerId: string | null = null;
    if (user.role === USER_ROLES.TELECALLER) {
      targetTelecallerId = user.id;
    } else if (user.role === USER_ROLES.SUPER_ADMIN) {
      if (telecallerId && telecallerId !== 'ALL') {
        targetTelecallerId = telecallerId;
      }
    }

    // Determine Date Bounds
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (range === 'TODAY') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'YESTERDAY') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'LAST_7_DAYS') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (range === 'CUSTOM' && fromDate) {
      start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      end = toDate ? new Date(toDate) : new Date(fromDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const store = dbStore.store;

    // Filter relevant callLogs
    const callLogsInRange = store.callLogs.filter((c) => {
      if (targetTelecallerId && c.userId !== targetTelecallerId) return false;
      const t = c.contactDate || c.createdAt;
      return t >= startIso && t <= endIso;
    });

    // Filter relevant activities (STAGE_CHANGED, CALL_LOGGED)
    const activitiesInRange = store.activities.filter((a) => {
      if (targetTelecallerId && a.userId !== targetTelecallerId) return false;
      if (a.createdAt < startIso || a.createdAt > endIso) return false;
      return a.type === 'STAGE_CHANGED' || a.type === 'CALL_LOGGED';
    });

    // Map touched leads and their latest outcome in range
    // Key: leadId -> latest outcome in this range
    const leadLatestOutcomeMap = new Map<string, { outcome: string; timestamp: string }>();

    // Feed call logs
    for (const log of callLogsInRange) {
      const normOutcome = normalizeCallOutcome(log.outcome);
      const prev = leadLatestOutcomeMap.get(log.leadId);
      const logTime = log.contactDate || log.createdAt;
      if (!prev || logTime > prev.timestamp) {
        leadLatestOutcomeMap.set(log.leadId, { outcome: normOutcome, timestamp: logTime });
      }
    }

    // Feed activities
    for (const act of activitiesInRange) {
      const meta = act.metadata as any;
      let outcome = meta?.newOutcome || meta?.outcome;
      if (!outcome && act.description) {
        // Fallback parse outcome from description
        const match = act.description.match(/Outcome:\s*"([^"]+)"/i) || act.description.match(/Outcome:\s*([^,\.]+)/i);
        if (match) outcome = match[1];
      }
      if (outcome) {
        const norm = normalizeCallOutcome(outcome);
        const prev = leadLatestOutcomeMap.get(act.leadId);
        if (!prev || act.createdAt > prev.timestamp) {
          leadLatestOutcomeMap.set(act.leadId, { outcome: norm, timestamp: act.createdAt });
        }
      }
    }

    // Also include leads updated within the date range if they have an outcome
    const leadsUpdatedInRange = store.leads.filter((l) => {
      if (targetTelecallerId && l.assignedTelecallerId !== targetTelecallerId) return false;
      const updateTime = l.lastStatusUpdatedAt || l.lastContactDate || l.lastActivityAt;
      if (!updateTime) return false;
      return updateTime >= startIso && updateTime <= endIso && !!l.lastCallOutcome;
    });

    for (const lead of leadsUpdatedInRange) {
      const norm = normalizeCallOutcome(lead.lastCallOutcome);
      const updateTime = lead.lastStatusUpdatedAt || lead.lastContactDate || lead.lastActivityAt!;
      const prev = leadLatestOutcomeMap.get(lead.id);
      if (!prev || updateTime > prev.timestamp) {
        leadLatestOutcomeMap.set(lead.id, { outcome: norm, timestamp: updateTime });
      }
    }

    // Unique Lead outcome categories
    const connectedOutcomes = new Set([
      'Connected – Discussed',
      'Details Requested',
      'Demo Interested',
      'Demo Scheduled',
      'Demo Completed',
      'Decision Pending',
    ]);
    const interestedOutcomes = new Set([
      'Demo Interested',
      'Demo Scheduled',
      'Demo Completed',
      'Details Requested',
    ]);
    const notReachedOutcomes = new Set(['No Answer', 'Busy', 'Call Cut']);

    let peopleConnectedCount = 0;
    let interestedCount = 0;
    let demoScheduledCount = 0;
    let demoCompletedCount = 0;
    let notReachedCount = 0;
    let notInterestedCount = 0;
    let wrongNumberCount = 0;

    const outcomeDistribution: Record<string, number> = {};

    leadLatestOutcomeMap.forEach(({ outcome }) => {
      outcomeDistribution[outcome] = (outcomeDistribution[outcome] || 0) + 1;

      if (connectedOutcomes.has(outcome)) peopleConnectedCount++;
      if (interestedOutcomes.has(outcome)) interestedCount++;
      if (outcome === 'Demo Scheduled') demoScheduledCount++;
      if (outcome === 'Demo Completed') demoCompletedCount++;
      if (notReachedOutcomes.has(outcome)) notReachedCount++;
      if (outcome === 'Not Interested') notInterestedCount++;
      if (outcome === 'Wrong Number') wrongNumberCount++;
    });

    const uniqueLeadsCount = leadLatestOutcomeMap.size;
    const totalCallsMade = Math.max(
      uniqueLeadsCount,
      callLogsInRange.length + activitiesInRange.filter((a) => a.type === 'CALL_LOGGED').length
    );

    // Follow-ups calculation
    const startDayStr = startIso.split('T')[0];
    const endDayStr = endIso.split('T')[0];

    const tasksInRange = store.followUpTasks.filter((t) => {
      if (targetTelecallerId && t.assignedUserId !== targetTelecallerId) return false;
      const day = t.dueDate.split('T')[0];
      return day >= startDayStr && day <= endDayStr;
    });

    const leadsWithFollowUpInRange = store.leads.filter((l) => {
      if (targetTelecallerId && l.assignedTelecallerId !== targetTelecallerId) return false;
      if (!l.nextFollowUpDate) return false;
      const day = l.nextFollowUpDate.split('T')[0];
      return day >= startDayStr && day <= endDayStr;
    });

    const followUpLeadIdsDue = new Set([
      ...tasksInRange.map((t) => t.leadId),
      ...leadsWithFollowUpInRange.map((l) => l.id),
    ]);

    const followUpsDueCount = followUpLeadIdsDue.size;

    // Follow-ups done: tasks completed or leads with follow-up due that had a call/stage update in range
    const followUpsDoneCount = Array.from(followUpLeadIdsDue).filter((leadId) => {
      const taskDone = tasksInRange.some((t) => t.leadId === leadId && t.status === 'COMPLETED');
      const touched = leadLatestOutcomeMap.has(leadId);
      return taskDone || touched;
    }).length;

    const followUpsPendingCount = Math.max(0, followUpsDueCount - followUpsDoneCount);

    // Outcome Breakdown list
    const breakdownList = Object.entries(outcomeDistribution)
      .map(([outcome, count]) => ({
        outcome,
        count,
        percentage: uniqueLeadsCount > 0 ? Math.round((count / uniqueLeadsCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Daily Trend Chart
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isMultiDay = diffDays > 1;

    const dailyTrend: { date: string; label: string; calls: number; connected: number }[] = [];

    if (isMultiDay) {
      const iter = new Date(start);
      while (iter <= end) {
        const dayStr = iter.toISOString().split('T')[0];
        const dayLabel = iter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const callsOnDay = callLogsInRange.filter((c) => (c.contactDate || c.createdAt).startsWith(dayStr)).length;
        const actsOnDay = activitiesInRange.filter((a) => a.createdAt.startsWith(dayStr)).length;

        // Connected on day
        let connectedOnDay = 0;
        leadLatestOutcomeMap.forEach(({ outcome, timestamp }) => {
          if (timestamp.startsWith(dayStr) && connectedOutcomes.has(outcome)) {
            connectedOnDay++;
          }
        });

        dailyTrend.push({
          date: dayStr,
          label: dayLabel,
          calls: Math.max(callsOnDay, actsOnDay),
          connected: connectedOnDay,
        });

        iter.setDate(iter.getDate() + 1);
      }
    }

    // Conversion line: Calls -> Connected -> Interested -> Demo
    const totalDemos = demoScheduledCount + demoCompletedCount;
    const funnel = {
      calls: { count: totalCallsMade, rate: 100 },
      connected: {
        count: peopleConnectedCount,
        rate: totalCallsMade > 0 ? Math.round((peopleConnectedCount / totalCallsMade) * 100) : 0,
      },
      interested: {
        count: interestedCount,
        rate: peopleConnectedCount > 0 ? Math.round((interestedCount / peopleConnectedCount) * 100) : 0,
      },
      demo: {
        count: totalDemos,
        rate: interestedCount > 0 ? Math.round((totalDemos / interestedCount) * 100) : 0,
      },
    };

    // Telecaller options list (for Admin filter)
    const telecallersList = store.users
      .filter((u) => u.role === USER_ROLES.TELECALLER)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));

    sendSuccess(res, {
      range,
      startDate: startIso,
      endDate: endIso,
      isMultiDay,
      targetTelecallerId: targetTelecallerId || 'ALL',
      cards: {
        totalCallsMade,
        peopleConnected: peopleConnectedCount,
        interested: interestedCount,
        demoScheduled: demoScheduledCount,
        demoCompleted: demoCompletedCount,
        totalDemos,
        notReached: notReachedCount,
        notInterested: notInterestedCount,
        wrongNumber: wrongNumberCount,
        followUpsDue: followUpsDueCount,
        followUpsDone: followUpsDoneCount,
        followUpsPending: followUpsPendingCount,
      },
      breakdown: breakdownList,
      dailyTrend,
      funnel,
      telecallers: telecallersList,
    });
  } catch (error) {
    next(error);
  }
}

