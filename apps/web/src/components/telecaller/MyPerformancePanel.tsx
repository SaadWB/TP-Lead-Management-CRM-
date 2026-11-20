'use client';

import React from 'react';
import { MyDayReport, DailyPerformance } from '@crm/shared';
import { useSWRData } from '@/lib/apiCache';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function useMyDayReport() {
  return useSWRData<MyDayReport>('/reports/my-day');
}

interface StatProps {
  label: string;
  value: number;
  hint?: string;
  tone?: 'slate' | 'sky' | 'emerald' | 'rose' | 'amber' | 'violet';
  previous?: number;
}

const TONES: Record<NonNullable<StatProps['tone']>, string> = {
  slate: 'text-slate-900',
  sky: 'text-sky-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  violet: 'text-violet-700',
};

function Stat({ label, value, hint, tone = 'slate', previous }: StatProps) {
  const diff = previous === undefined ? null : value - previous;
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 min-w-0">
      <div className="text-[11px] font-semibold text-slate-500 truncate" title={hint || label}>
        {label}
      </div>
      <div className="flex items-end justify-between gap-1 mt-0.5">
        <span className={`text-xl font-black leading-none ${TONES[tone]}`}>{value}</span>
        {diff !== null && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-bold ${
              diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-500' : 'text-slate-400'
            }`}
            title="Compared with yesterday"
          >
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </div>
    </div>
  );
}

export function PerformanceStats({
  day,
  previous,
  pending,
}: {
  day: DailyPerformance;
  previous?: DailyPerformance;
  pending: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      <Stat
        label="Leads worked"
        value={day.leadsWorked}
        previous={previous?.leadsWorked}
        hint="Distinct leads you recorded an outcome for (new + follow-ups)"
      />
      <Stat
        label="New leads updated"
        value={day.newLeadsWorked}
        previous={previous?.newLeadsWorked}
        tone="sky"
        hint="Leads contacted for the very first time"
      />
      <Stat
        label="Connected"
        value={day.connected}
        previous={previous?.connected}
        tone="emerald"
        hint="Prospect picked up and you spoke (latest outcome of the day)"
      />
      <Stat
        label="Not connected"
        value={day.notConnected}
        previous={previous?.notConnected}
        tone="rose"
        hint="No answer, busy, call cut or wrong number"
      />
      <Stat
        label="Follow-ups done"
        value={day.followUpsDone}
        previous={previous?.followUpsDone}
        tone="violet"
        hint="Leads you had contacted before and worked again"
      />
      <Stat
        label="Follow-ups scheduled"
        value={day.followUpsScheduled}
        previous={previous?.followUpsScheduled}
        tone="amber"
        hint="Leads given a new next follow-up date"
      />
      <Stat label="Follow-ups pending" value={pending} tone={pending > 0 ? 'rose' : 'emerald'} hint="Overdue + due today, not yet moved" />
    </div>
  );
}

/**
 * "My Performance" panel for Today's Work: accurate numbers from the server
 * (activity log + call logs, user's local day, distinct leads), refreshed after every save.
 */
export function MyPerformancePanel({ compact = false }: { compact?: boolean }) {
  const { data, loading, refresh } = useMyDayReport();

  const pending = data ? data.queue.overdue + data.queue.dueToday : 0;
  const done = data ? data.today.followUpsDone : 0;
  const progress = done + pending > 0 ? Math.round((done / (done + pending)) * 100) : 100;

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-900">My Performance – Today</span>
            {data && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                Follow-ups {progress}% done
              </span>
            )}
          </div>
          {!compact && (
            <p className="text-xs text-slate-500 mt-0.5">
              New leads and follow-ups combined. Each lead counts once per day.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data && (
            <span className="hidden sm:inline text-[11px] text-slate-500">
              {data.today.totalCalls} calls logged · Yesterday: {data.yesterday.leadsWorked} leads
            </span>
          )}
          <button
            type="button"
            onClick={() => refresh()}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
            title="Refresh performance"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {data ? (
        <>
          <PerformanceStats day={data.today} previous={data.yesterday} pending={pending} />
          <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[58px] bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
