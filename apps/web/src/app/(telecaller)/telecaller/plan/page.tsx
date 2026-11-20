'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import { MyDayQueueItem, Lead } from '@crm/shared';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/apiClient';
import { invalidateCache, updateCachedLead } from '@/lib/apiCache';
import { useMyDayReport, PerformanceStats } from '@/components/telecaller/MyPerformancePanel';
import { FollowUpDatePicker } from '@/components/leads/FollowUpDatePicker';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';
import { formatDateTime, getPriorityColor, getPriorityLabel } from '@/lib/utils';
import {
  Sunrise,
  AlertTriangle,
  Clock,
  Presentation,
  UserPlus,
  CalendarX,
  Phone,
  ArrowRight,
  RefreshCw,
  Target,
  CheckCircle2,
} from 'lucide-react';

const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});

/** How many untouched new leads we suggest calling per day on top of follow-ups. */
const NEW_LEADS_DAILY_GOAL = 20;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeOnly(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function daysOverdue(iso?: string | null): number {
  if (!iso) return 0;
  const due = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.max(1, Math.round((startOfToday.getTime() - dueDay.getTime()) / 86400000));
}

function LeadRow({
  lead,
  right,
  onOpen,
  sub,
}: {
  lead: MyDayQueueItem;
  right?: React.ReactNode;
  onOpen: (id: string) => void;
  sub?: React.ReactNode;
}) {
  const pr = getPriorityColor(lead.priority);
  return (
    <li className="flex items-center gap-3 py-2.5 px-3 hover:bg-slate-50 rounded-lg">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(lead.id)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-slate-900 truncate hover:text-sky-700">{lead.companyName}</span>
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${pr.bg} ${pr.text} ${pr.border}`}>
            {getPriorityLabel(lead.priority)}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 truncate mt-0.5">
          {[lead.contactPerson, lead.serviceProduct, lead.lastCallOutcome].filter(Boolean).join(' · ') || '—'}
        </div>
        {sub && <div className="text-[11px] mt-0.5">{sub}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {right}
        {lead.phone && (
          <>
            <a
              href={`tel:${lead.phone}`}
              className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              title={`Call ${lead.phone}`}
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
            <WhatsAppButton
              phone={lead.phone}
              leadId={lead.id}
              leadName={lead.contactPerson || lead.companyName}
              size="sm"
              showText={false}
            />
          </>
        )}
      </div>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  tone,
  description,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  tone: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-soft-sm overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900">
              {title} <span className="text-slate-400 font-bold">({count})</span>
            </h2>
            <p className="text-[11px] text-slate-500">{description}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function TelecallerMorningPlanPage() {
  const { user } = useAuth();
  const { data, loading, refresh } = useMyDayReport();
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );

  const plan = useMemo(() => {
    if (!data) return null;
    const q = data.queue;
    const newGoal = Math.min(q.untouchedNew, NEW_LEADS_DAILY_GOAL);
    const target = q.overdue + q.dueToday + newGoal;
    const doneToday = data.today.leadsWorked;
    const progress = target > 0 ? Math.min(100, Math.round((doneToday / target) * 100)) : 100;
    const steps: { key: string; text: string; href: string; count: number; urgent?: boolean }[] = [];
    if (q.overdue > 0)
      steps.push({
        key: 'overdue',
        text: `Clear ${q.overdue} overdue follow-up${q.overdue === 1 ? '' : 's'} first (oldest on top)`,
        href: '/telecaller/today?range=OVERDUE',
        count: q.overdue,
        urgent: true,
      });
    if (q.demosToday > 0)
      steps.push({
        key: 'demos',
        text: `Confirm ${q.demosToday} demo${q.demosToday === 1 ? '' : 's'} scheduled today`,
        href: '/telecaller/today?range=TODAY',
        count: q.demosToday,
      });
    if (q.dueToday > 0)
      steps.push({
        key: 'today',
        text: `Call ${q.dueToday} follow-up${q.dueToday === 1 ? '' : 's'} due today at their scheduled time`,
        href: '/telecaller/today?range=TODAY',
        count: q.dueToday,
      });
    if (newGoal > 0)
      steps.push({
        key: 'new',
        text: `Make first contact with ${newGoal} new lead${newGoal === 1 ? '' : 's'} (hot ones first)`,
        href: '/telecaller/leads?pipeline=New%20Lead',
        count: newGoal,
      });
    if (q.missingFollowUp > 0)
      steps.push({
        key: 'missing',
        text: `Give a next follow-up date to ${q.missingFollowUp} contacted lead${q.missingFollowUp === 1 ? '' : 's'} so none slip through`,
        href: '#missing-follow-up',
        count: q.missingFollowUp,
      });
    return { target, doneToday, progress, steps };
  }, [data]);

  async function setFollowUp(item: MyDayQueueItem, iso: string | null) {
    if (!iso) return;
    try {
      const res = await api.patch<Lead>(`/leads/${item.id}`, { nextFollowUpDate: iso });
      if (res.success && res.data) {
        updateCachedLead(res.data);
        setFixedIds((prev) => new Set([...prev, item.id]));
        invalidateCache('/reports');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save follow-up date');
    }
  }

  const maxWeek = data ? Math.max(1, ...data.last7Days.map((d) => d.leadsWorked)) : 1;

  return (
    <AppLayout
      title="Morning Plan"
      subtitle="Everything you need to do today for your tender leads, in the right order."
    >
      <div className="space-y-5 max-w-6xl mx-auto">
        {/* Greeting + target */}
        <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-5 text-white shadow-soft-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sky-100 text-xs font-semibold">
                <Sunrise className="h-4 w-4" />
                <span>{todayLabel}</span>
              </div>
              <h1 className="text-2xl font-black mt-1">
                {greeting()}, {user?.name?.split(' ')[0] || 'there'}!
              </h1>
              <p className="text-sm text-sky-100 mt-1">
                {plan
                  ? plan.target > 0
                    ? `Your target today: ${plan.target} leads (${data!.queue.overdue} overdue, ${data!.queue.dueToday} due today, ${Math.min(
                        data!.queue.untouchedNew,
                        NEW_LEADS_DAILY_GOAL
                      )} new).`
                    : 'Nothing scheduled. Use the time to open new leads.'
                  : 'Loading your plan...'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {plan && (
                <div className="bg-white/10 rounded-xl px-4 py-3 min-w-[180px]">
                  <div className="flex items-center justify-between text-xs font-semibold text-sky-100">
                    <span className="flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" /> Progress
                    </span>
                    <span>
                      {plan.doneToday}/{plan.target}
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2 mt-2 overflow-hidden">
                    <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${plan.progress}%` }} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => refresh()}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                title="Refresh plan"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {!data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Step-by-step plan */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-soft-sm p-4">
              <h2 className="text-sm font-extrabold text-slate-900 mb-3">Today&apos;s plan, step by step</h2>
              {plan && plan.steps.length > 0 ? (
                <ol className="space-y-2">
                  {plan.steps.map((s, i) => (
                    <li key={s.key}>
                      <Link
                        href={s.href}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          s.urgent
                            ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            s.urgent ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 flex-1">{s.text}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-5 w-5" /> All caught up. No pending follow-ups or new leads.
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>Tomorrow: {data.queue.dueTomorrow} follow-ups</span>
                <span>·</span>
                <span>Next 7 days: {data.queue.upcoming7Days}</span>
                <span>·</span>
                <span>Hot / urgent leads open: {data.queue.hotLeads}</span>
              </div>
            </section>

            {/* Performance */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Today so far</h2>
                <span className="text-[11px] text-slate-500">
                  Yesterday: {data.yesterday.leadsWorked} leads worked, {data.yesterday.connected} connected,{' '}
                  {data.yesterday.newLeadsWorked} new
                </span>
              </div>
              <PerformanceStats
                day={data.today}
                previous={data.yesterday}
                pending={data.queue.overdue + data.queue.dueToday}
              />
              {/* 7-day trend */}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-slate-500 mb-2">Leads worked – last 7 days</div>
                <div className="flex items-end gap-2 h-24">
                  {data.last7Days.map((d) => {
                    const h = Math.round((d.leadsWorked / maxWeek) * 100);
                    const isToday = d.date === data.today.date;
                    const label = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.leadsWorked} leads, ${d.connected} connected`}>
                        <span className="text-[10px] font-bold text-slate-600">{d.leadsWorked}</span>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className={`w-full rounded-t ${isToday ? 'bg-sky-500' : 'bg-slate-300'}`}
                            style={{ height: `${Math.max(h, d.leadsWorked > 0 ? 6 : 2)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${isToday ? 'font-bold text-sky-700' : 'text-slate-500'}`}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overdue */}
              <Section
                icon={AlertTriangle}
                title="Overdue follow-ups"
                count={data.queue.overdue}
                tone="bg-rose-100 text-rose-700"
                description="Promised calls you missed. Do these first."
                action={
                  data.queue.overdue > 0 ? (
                    <Link href="/telecaller/today?range=OVERDUE" className="text-xs font-bold text-sky-700 hover:underline shrink-0">
                      Open all →
                    </Link>
                  ) : undefined
                }
              >
                {data.lists.overdue.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">No overdue follow-ups. 👍</p>
                ) : (
                  <ul className="divide-y divide-slate-100 p-1">
                    {data.lists.overdue.map((l) => (
                      <LeadRow
                        key={l.id}
                        lead={l}
                        onOpen={setDrawerLeadId}
                        sub={
                          <span className="text-rose-600 font-bold">
                            {daysOverdue(l.nextFollowUpDate)} day(s) overdue · was due {formatDateTime(l.nextFollowUpDate)}
                          </span>
                        }
                      />
                    ))}
                  </ul>
                )}
              </Section>

              {/* Today's schedule */}
              <Section
                icon={Clock}
                title="Today's schedule"
                count={data.queue.dueToday}
                tone="bg-amber-100 text-amber-700"
                description="Follow-ups due today, in time order."
                action={
                  data.queue.dueToday > 0 ? (
                    <Link href="/telecaller/today?range=TODAY" className="text-xs font-bold text-sky-700 hover:underline shrink-0">
                      Open all →
                    </Link>
                  ) : undefined
                }
              >
                {data.lists.dueToday.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">Nothing scheduled for today.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 p-1">
                    {data.lists.dueToday.map((l) => {
                      const passed = l.nextFollowUpDate ? new Date(l.nextFollowUpDate).getTime() < Date.now() : false;
                      return (
                        <LeadRow
                          key={l.id}
                          lead={l}
                          onOpen={setDrawerLeadId}
                          right={
                            <span
                              className={`text-xs font-black px-2 py-1 rounded-lg ${
                                passed ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                              }`}
                              title={passed ? 'Time has passed, call now' : 'Scheduled time'}
                            >
                              {timeOnly(l.nextFollowUpDate)}
                            </span>
                          }
                          sub={l.nextAction ? <span className="text-slate-600">Next: {l.nextAction}</span> : undefined}
                        />
                      );
                    })}
                  </ul>
                )}
              </Section>

              {/* Demos */}
              <Section
                icon={Presentation}
                title="Demos today"
                count={data.queue.demosToday}
                tone="bg-cyan-100 text-cyan-700"
                description="Call 1 hour before to confirm the demo slot."
              >
                {data.lists.demosToday.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">No demos today.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 p-1">
                    {data.lists.demosToday.map((l) => (
                      <LeadRow
                        key={l.id}
                        lead={l}
                        onOpen={setDrawerLeadId}
                        right={<span className="text-xs font-black px-2 py-1 rounded-lg bg-cyan-50 text-cyan-800">{timeOnly(l.nextFollowUpDate)}</span>}
                      />
                    ))}
                  </ul>
                )}
              </Section>

              {/* New leads */}
              <Section
                icon={UserPlus}
                title="New leads to open"
                count={data.queue.untouchedNew}
                tone="bg-sky-100 text-sky-700"
                description={`Never contacted. Suggested: ${Math.min(data.queue.untouchedNew, NEW_LEADS_DAILY_GOAL)} today, hot & newest first.`}
                action={
                  data.queue.untouchedNew > 0 ? (
                    <Link href="/telecaller/leads?pipeline=New%20Lead" className="text-xs font-bold text-sky-700 hover:underline shrink-0">
                      Open all →
                    </Link>
                  ) : undefined
                }
              >
                {data.lists.untouchedNew.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">No untouched new leads.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 p-1 max-h-[420px] overflow-y-auto">
                    {data.lists.untouchedNew.slice(0, NEW_LEADS_DAILY_GOAL).map((l) => (
                      <LeadRow key={l.id} lead={l} onOpen={setDrawerLeadId} />
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* Missing follow-up */}
            <div id="missing-follow-up">
              <Section
                icon={CalendarX}
                title="Contacted but no next follow-up"
                count={data.queue.missingFollowUp}
                tone="bg-violet-100 text-violet-700"
                description="These leads will be forgotten unless you give them a date. Set one right here."
              >
                {data.lists.missingFollowUp.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center">Every contacted lead has a next follow-up. 👍</p>
                ) : (
                  <ul className="divide-y divide-slate-100 p-1">
                    {data.lists.missingFollowUp.map((l) => (
                      <LeadRow
                        key={l.id}
                        lead={l}
                        onOpen={setDrawerLeadId}
                        right={
                          fixedIds.has(l.id) ? (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Scheduled
                            </span>
                          ) : (
                            <div className="w-44">
                              <FollowUpDatePicker
                                value={null}
                                compact
                                showPreview={false}
                                onChange={(iso) => setFollowUp(l, iso)}
                              />
                            </div>
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </>
        )}

        <LeadDrawer
          leadId={drawerLeadId}
          initialLead={null}
          isOpen={!!drawerLeadId}
          onClose={() => {
            setDrawerLeadId(null);
            invalidateCache('/reports');
          }}
          onLeadUpdated={(updated) => updateCachedLead(updated)}
        />
      </div>
    </AppLayout>
  );
}
