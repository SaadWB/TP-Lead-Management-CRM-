import { Request, Response, NextFunction } from 'express';
import {
  USER_ROLES,
  DailyPerformance,
  MyDayReport,
  MyDayQueueItem,
  getOutcomeConnection,
  isLeadOutOfQueue,
  normalizeCallOutcome,
  normalizePipelineStage,
} from '@crm/shared';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import {
  getTzOffsetMinutes,
  localDateKey,
  localDayRange,
  addDaysToKey,
  isValidDateKey,
} from '../../utils/timezone';

/**
 * One "touch" = the telecaller recorded something that counts as working a lead:
 * a call log, a changed call outcome, a follow-up completion (Closed / Not Closed).
 */
interface TouchEvent {
  leadId: string;
  at: Date;
  outcome: string | null; // normalized call outcome recorded by this event (if any)
  previousOutcome: string | null; // outcome before this event, when known
  isTouch: boolean; // counts as working the lead
  followUpSet: boolean; // a next follow-up date was set
  closed: boolean; // lead closed / lost / won
}

const CLOSING_OUTCOMES = new Set(['Not Interested', 'Wrong Number', 'Converted', 'Won', 'Closed']);
const LIST_LIMIT = 25;

function asObject(val: unknown): Record<string, any> {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, any>;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isClosingStage(stage: unknown): boolean {
  if (typeof stage !== 'string' || !stage) return false;
  const norm = normalizePipelineStage(stage);
  return norm === 'Closed' || norm === 'Closed Won' || stage.toLowerCase() === 'lost';
}

/** Converts raw activity rows into touch events. CALL_LOGGED activities are skipped (call logs cover them). */
export function activityToEvent(a: { leadId: string; type: string; metadata: unknown; createdAt: Date }): TouchEvent | null {
  const md = asObject(a.metadata);

  if (a.type === 'STAGE_CHANGED') {
    if (md.action === 'CLOSED') {
      return { leadId: a.leadId, at: a.createdAt, outcome: null, previousOutcome: null, isTouch: true, followUpSet: false, closed: true };
    }
    const newOutcome = md.newOutcome ? normalizeCallOutcome(String(md.newOutcome)) : null;
    const oldOutcome = md.oldOutcome ? normalizeCallOutcome(String(md.oldOutcome)) : null;
    const outcomeChanged = Boolean(newOutcome) && newOutcome !== oldOutcome;
    const closed = isClosingStage(md.newPipeline) || (newOutcome ? CLOSING_OUTCOMES.has(newOutcome) : false);
    return {
      leadId: a.leadId,
      at: a.createdAt,
      outcome: outcomeChanged ? newOutcome : null,
      previousOutcome: oldOutcome,
      isTouch: outcomeChanged || (closed && !isClosingStage(md.oldStage)),
      followUpSet: Boolean(md.followUpDate),
      closed,
    };
  }

  if (a.type === 'NOTE_ADDED' && md.action === 'NOT_CLOSED') {
    return { leadId: a.leadId, at: a.createdAt, outcome: null, previousOutcome: null, isTouch: true, followUpSet: true, closed: false };
  }

  if (a.type === 'FOLLOW_UP_SCHEDULED') {
    return { leadId: a.leadId, at: a.createdAt, outcome: null, previousOutcome: null, isTouch: false, followUpSet: true, closed: false };
  }

  return null;
}

function emptyDay(date: string): DailyPerformance {
  return {
    date,
    totalCalls: 0,
    leadsWorked: 0,
    newLeadsWorked: 0,
    followUpsDone: 0,
    connected: 0,
    notConnected: 0,
    followUpsScheduled: 0,
    closedToday: 0,
    demosScheduled: 0,
  };
}

export function computeDay(
  dateKey: string,
  tz: number,
  events: TouchEvent[],
  firstEverTouch: Map<string, Date>
): DailyPerformance {
  const { start, end } = localDayRange(dateKey, tz);
  const day = emptyDay(dateKey);
  const dayEvents = events.filter((e) => e.at >= start && e.at <= end).sort((a, b) => a.at.getTime() - b.at.getTime());

  const worked = new Map<string, TouchEvent[]>();
  const scheduled = new Set<string>();
  const closed = new Set<string>();
  const demos = new Set<string>();

  for (const ev of dayEvents) {
    if (ev.followUpSet) scheduled.add(ev.leadId);
    if (ev.closed) closed.add(ev.leadId);
    if (ev.outcome === 'Demo Scheduled') demos.add(ev.leadId);
    if (!ev.isTouch) continue;
    day.totalCalls++;
    const list = worked.get(ev.leadId) || [];
    list.push(ev);
    worked.set(ev.leadId, list);
  }

  worked.forEach((leadEvents, leadId) => {
    // New lead = first contact EVER happened on this day and the lead had no prior outcome.
    const firstEver = firstEverTouch.get(leadId);
    const firstToday = leadEvents[0];
    const hadPriorOutcome =
      Boolean(firstToday.previousOutcome) && firstToday.previousOutcome !== 'New Lead';
    const isNew = (!firstEver || firstEver >= start) && !hadPriorOutcome;
    if (isNew) day.newLeadsWorked++;
    else day.followUpsDone++;

    // Connection status = the LAST outcome recorded for this lead today
    const lastWithOutcome = [...leadEvents].reverse().find((e) => e.outcome);
    const conn = getOutcomeConnection(lastWithOutcome?.outcome);
    if (conn === 'CONNECTED') day.connected++;
    else if (conn === 'NOT_CONNECTED') day.notConnected++;
  });

  day.leadsWorked = worked.size;
  day.followUpsScheduled = scheduled.size;
  day.closedToday = closed.size;
  day.demosScheduled = demos.size;
  return day;
}

function toQueueItem(l: any): MyDayQueueItem {
  return {
    id: l.id,
    companyName: l.companyName,
    contactPerson: l.contactPerson,
    phone: l.phone,
    serviceProduct: l.serviceProduct,
    priority: l.priority,
    pipelineStage: l.pipelineStage,
    lastCallOutcome: l.lastCallOutcome,
    nextFollowUpDate: l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toISOString() : null,
    nextAction: l.nextAction,
    leadSource: l.leadSource,
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : undefined,
  };
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * GET /reports/my-day?date=YYYY-MM-DD&tz=330[&telecallerId=...]
 * Morning plan + accurate daily performance for one telecaller.
 */
export async function getMyDay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    let targetUserId = user.id;
    if (user.role === USER_ROLES.SUPER_ADMIN && typeof req.query.telecallerId === 'string' && req.query.telecallerId) {
      targetUserId = req.query.telecallerId;
    }

    const tz = getTzOffsetMinutes(req);
    const now = new Date();
    const todayKey = isValidDateKey(req.query.date) ? (req.query.date as string) : localDateKey(now, tz);
    const yesterdayKey = addDaysToKey(todayKey, -1);
    const weekStartKey = addDaysToKey(todayKey, -6);
    const windowStart = localDayRange(weekStartKey, tz).start;
    const { start: todayStart, end: todayEnd } = localDayRange(todayKey, tz);
    const tomorrowEnd = localDayRange(addDaysToKey(todayKey, 1), tz).end;
    const weekEnd = localDayRange(addDaysToKey(todayKey, 7), tz).end;

    // ---------- 1. Activity in the last 7 days (performance) ----------
    const [activities, callLogs] = await Promise.all([
      prisma.leadActivity.findMany({
        where: {
          userId: targetUserId,
          createdAt: { gte: windowStart, lte: todayEnd },
          type: { in: ['STAGE_CHANGED', 'NOTE_ADDED', 'FOLLOW_UP_SCHEDULED'] },
        },
        select: { leadId: true, type: true, metadata: true, createdAt: true },
      }),
      prisma.callLog.findMany({
        where: { userId: targetUserId, contactDate: { gte: windowStart, lte: todayEnd } },
        select: { leadId: true, outcome: true, contactDate: true, nextFollowUpDate: true },
      }),
    ]);

    const events: TouchEvent[] = [];
    for (const a of activities) {
      const ev = activityToEvent(a);
      if (ev) events.push(ev);
    }
    for (const c of callLogs) {
      const outcome = normalizeCallOutcome(c.outcome) || null;
      events.push({
        leadId: c.leadId,
        at: c.contactDate,
        outcome,
        previousOutcome: null,
        isTouch: true,
        followUpSet: Boolean(c.nextFollowUpDate),
        closed: outcome ? CLOSING_OUTCOMES.has(outcome) : false,
      });
    }

    // First-ever touch per lead (by anyone) decides "new lead" vs "follow-up"
    const touchedIds = Array.from(new Set(events.filter((e) => e.isTouch).map((e) => e.leadId)));
    const firstEverTouch = new Map<string, Date>();
    if (touchedIds.length > 0) {
      const [firstCalls, priorActivities] = await Promise.all([
        prisma.callLog.groupBy({
          by: ['leadId'],
          where: { leadId: { in: touchedIds } },
          _min: { contactDate: true },
        }),
        prisma.leadActivity.findMany({
          where: {
            leadId: { in: touchedIds },
            createdAt: { lt: todayEnd },
            type: { in: ['STAGE_CHANGED', 'NOTE_ADDED'] },
          },
          select: { leadId: true, type: true, metadata: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      for (const row of firstCalls) {
        if (row._min.contactDate) firstEverTouch.set(row.leadId, row._min.contactDate);
      }
      for (const a of priorActivities) {
        const ev = activityToEvent(a);
        if (!ev || !ev.isTouch) continue;
        const prev = firstEverTouch.get(a.leadId);
        if (!prev || a.createdAt < prev) firstEverTouch.set(a.leadId, a.createdAt);
      }
    }

    const last7Days: DailyPerformance[] = [];
    for (let i = 6; i >= 0; i--) {
      last7Days.push(computeDay(addDaysToKey(todayKey, -i), tz, events, firstEverTouch));
    }
    const today = last7Days[6];
    const yesterday = last7Days.find((d) => d.date === yesterdayKey) || emptyDay(yesterdayKey);

    // ---------- 2. Live queue (what to do today) ----------
    const openLeads = await prisma.lead.findMany({
      where: { assignedTelecallerId: targetUserId, isDeleted: false, archivedAt: null },
      select: {
        id: true,
        companyName: true,
        contactPerson: true,
        phone: true,
        serviceProduct: true,
        priority: true,
        pipelineStage: true,
        salesStage: true,
        convertedAt: true,
        lastCallOutcome: true,
        nextFollowUpDate: true,
        nextAction: true,
        leadSource: true,
        createdAt: true,
      },
    });

    const running = openLeads.filter(
      (l) =>
        !isLeadOutOfQueue({
          pipelineStage: l.pipelineStage,
          salesStage: l.salesStage,
          convertedAt: l.convertedAt,
          lastCallOutcome: l.lastCallOutcome,
        })
    );

    const byFollowUp = (a: any, b: any) =>
      new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
    const byPriorityThenNewest = (a: any, b: any) =>
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const overdue = running.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate < todayStart).sort(byFollowUp);
    const dueToday = running
      .filter((l) => l.nextFollowUpDate && l.nextFollowUpDate >= todayStart && l.nextFollowUpDate <= todayEnd)
      .sort(byFollowUp);
    const dueTomorrow = running.filter(
      (l) => l.nextFollowUpDate && l.nextFollowUpDate > todayEnd && l.nextFollowUpDate <= tomorrowEnd
    );
    const upcoming7Days = running.filter(
      (l) => l.nextFollowUpDate && l.nextFollowUpDate > todayEnd && l.nextFollowUpDate <= weekEnd
    );
    const untouchedNew = running
      .filter(
        (l) =>
          !l.lastCallOutcome &&
          !l.nextFollowUpDate &&
          normalizePipelineStage(l.pipelineStage) === 'New Lead'
      )
      .sort(byPriorityThenNewest);
    const missingFollowUp = running
      .filter((l) => l.lastCallOutcome && !l.nextFollowUpDate)
      .sort(byPriorityThenNewest);
    const isDemo = (l: any) =>
      normalizeCallOutcome(l.lastCallOutcome) === 'Demo Scheduled' || normalizePipelineStage(l.pipelineStage) === 'Demo';
    const demosToday = dueToday.filter(isDemo);
    const hotLeads = running.filter((l) => l.priority === 'HIGH' || l.priority === 'URGENT');

    const report: MyDayReport = {
      today,
      yesterday,
      last7Days,
      queue: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        dueTomorrow: dueTomorrow.length,
        upcoming7Days: upcoming7Days.length,
        untouchedNew: untouchedNew.length,
        missingFollowUp: missingFollowUp.length,
        hotLeads: hotLeads.length,
        demosToday: demosToday.length,
      },
      lists: {
        overdue: overdue.slice(0, LIST_LIMIT).map(toQueueItem),
        dueToday: dueToday.slice(0, 60).map(toQueueItem),
        demosToday: demosToday.slice(0, LIST_LIMIT).map(toQueueItem),
        untouchedNew: untouchedNew.slice(0, LIST_LIMIT).map(toQueueItem),
        missingFollowUp: missingFollowUp.slice(0, LIST_LIMIT).map(toQueueItem),
      },
      generatedAt: now.toISOString(),
      tzOffsetMinutes: tz,
    };

    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
}
