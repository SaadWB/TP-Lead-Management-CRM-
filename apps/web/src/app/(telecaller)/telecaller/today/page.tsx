'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Lead,
  normalizeCallOutcome,
  getSuggestedPipelineForOutcome,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LIST,
  TELECALLER_CALL_OUTCOMES,
  Priority,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData } from '@/lib/apiCache';
import { useAuth } from '@/lib/authContext';
import {
  Clock,
  CheckCircle2,
  Phone,
  PhoneCall,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Undo2,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// Dynamic imports for heavy modals
const CallLogModal = dynamic(() => import('@/components/leads/CallLogModal').then((m) => m.CallLogModal), {
  ssr: false,
});
const FollowUpCompletionModal = dynamic(
  () => import('@/components/leads/FollowUpCompletionModal').then((m) => m.FollowUpCompletionModal),
  { ssr: false }
);
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});

type RangeFilterType = 'ALL' | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'NEXT_3_DAYS';

interface UndoState {
  leadId: string;
  leadName: string;
  previousLead: Lead;
  description: string;
}

interface RequiredPromptTarget {
  lead: Lead;
  newOutcome: string;
  suggestedPipeline: string;
  type: 'DATE_TIME' | 'FOLLOW_UP_DATE' | 'CLOSE_REASON';
}

const DEFAULT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TelecallerTodayPage() {
  const { user } = useAuth();
  const { data: cachedLeads, loading, mutate: mutateLeads, refresh: refreshLeads } =
    useSWRData<Lead[]>('/leads', { limit: 100 });

  const [leads, setLeads] = useState<Lead[]>(cachedLeads || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [rangeFilter, setRangeFilter] = useState<RangeFilterType>('ALL');

  // Modal states
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<Lead | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Follow-up completion modal state (Closed / Not Closed flow)
  const [completionTarget, setCompletionTarget] = useState<{ lead: Lead; mode: 'CLOSED' | 'NOT_CLOSED' } | null>(null);

  // Undo Toast state (7-second window)
  const [undoToast, setUndoToast] = useState<UndoState | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prompt modal for required datetime or closing reason
  const [promptTarget, setPromptTarget] = useState<RequiredPromptTarget | null>(null);
  const [promptInputDate, setPromptInputDate] = useState<string>('');
  const [promptInputReason, setPromptInputReason] = useState<string>('');
  const [promptInputNextAction, setPromptInputNextAction] = useState<string>('');

  // Calls logged today counter
  const [callsDoneToday, setCallsDoneToday] = useState(0);

  // Sync with SWR data
  useEffect(() => {
    if (cachedLeads) {
      setLeads(cachedLeads);
      const todayStr = new Date().toISOString().split('T')[0];
      let todayCallsCount = 0;
      cachedLeads.forEach((lead) => {
        if (lead.callLogs) {
          lead.callLogs.forEach((call) => {
            if (
              call.userId === user?.id &&
              call.createdAt &&
              call.createdAt.split('T')[0] === todayStr
            ) {
              todayCallsCount++;
            }
          });
        }
      });
      setCallsDoneToday(todayCallsCount);
    }
  }, [cachedLeads, user?.id]);

  // Date boundaries for Next 3 Days calculation
  const { todayStr, tomorrowStr, day2Str, day3Str } = useMemo(() => {
    const now = new Date();
    const t0 = now.toISOString().split('T')[0];

    const d1 = new Date(now);
    d1.setDate(d1.getDate() + 1);
    const t1 = d1.toISOString().split('T')[0];

    const d2 = new Date(now);
    d2.setDate(d2.getDate() + 2);
    const t2 = d2.toISOString().split('T')[0];

    const d3 = new Date(now);
    d3.setDate(d3.getDate() + 3);
    const t3 = d3.toISOString().split('T')[0];

    return { todayStr: t0, tomorrowStr: t1, day2Str: t2, day3Str: t3 };
  }, []);

  // Filter only follow-up leads in range (Overdue, Today, Tomorrow, Next 3 Days)
  // Exclude Closed and leads beyond 3 days
  const allInRangeFollowUps = useMemo(() => {
    return leads
      .filter((lead) => {
        // Exclude closed or uncontactable leads
        if (
          lead.pipelineStage === 'Closed' ||
          lead.lastCallOutcome === 'Not Interested' ||
          lead.lastCallOutcome === 'Wrong Number'
        ) {
          return false;
        }

        // Must have a follow-up scheduled
        const fDate = lead.nextFollowUpDate ? lead.nextFollowUpDate.split('T')[0] : null;
        if (!fDate) return false;

        // Must be in range: overdue OR up to day 3
        return fDate <= day3Str;
      })
      .sort((a, b) => {
        const dateA = a.nextFollowUpDate ? a.nextFollowUpDate.split('T')[0] : '9999-99-99';
        const dateB = b.nextFollowUpDate ? b.nextFollowUpDate.split('T')[0] : '9999-99-99';

        const isOverdueA = dateA < todayStr;
        const isOverdueB = dateB < todayStr;

        // Overdue sorted at the very top!
        if (isOverdueA && !isOverdueB) return -1;
        if (!isOverdueA && isOverdueB) return 1;

        // Then sorted chronologically by exact date and time
        const timeA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : 0;
        const timeB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : 0;
        return timeA - timeB;
      });
  }, [leads, todayStr, day3Str]);

  // Sub-ranges and counts
  const { overdueLeads, todayLeads, tomorrowLeads, next3DaysLeads } = useMemo(() => {
    const overdue: Lead[] = [];
    const today: Lead[] = [];
    const tomorrow: Lead[] = [];
    const next3Days: Lead[] = [];

    allInRangeFollowUps.forEach((l) => {
      const d = l.nextFollowUpDate!.split('T')[0];
      if (d < todayStr) overdue.push(l);
      else if (d === todayStr) today.push(l);
      else if (d === tomorrowStr) tomorrow.push(l);
      else if (d <= day3Str) next3Days.push(l);
    });

    return {
      overdueLeads: overdue,
      todayLeads: today,
      tomorrowLeads: tomorrow,
      next3DaysLeads: next3Days,
    };
  }, [allInRangeFollowUps, todayStr, tomorrowStr, day3Str]);

  // Apply active Range Filter tab
  const filteredByRange = useMemo(() => {
    switch (rangeFilter) {
      case 'OVERDUE':
        return overdueLeads;
      case 'TODAY':
        return todayLeads;
      case 'TOMORROW':
        return tomorrowLeads;
      case 'NEXT_3_DAYS':
        return next3DaysLeads;
      case 'ALL':
      default:
        return allInRangeFollowUps;
    }
  }, [rangeFilter, overdueLeads, todayLeads, tomorrowLeads, next3DaysLeads, allInRangeFollowUps]);

  // Apply Search
  const displayLeads = useMemo(() => {
    if (!searchTerm.trim()) return filteredByRange;
    const q = searchTerm.toLowerCase().trim();
    return filteredByRange.filter(
      (l) =>
        l.companyName.toLowerCase().includes(q) ||
        (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
        l.phone.toLowerCase().includes(q) ||
        (l.nextAction && l.nextAction.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [filteredByRange, searchTerm]);

  // Progress metrics calculation
  const totalTodayTarget = callsDoneToday + todayLeads.length;
  const progressPercent =
    totalTodayTarget > 0 ? Math.min(100, Math.round((callsDoneToday / totalTodayTarget) * 100)) : 100;

  // Flash save notice
  function triggerSaveNotice(msg = 'Saved') {
    setSaveSuccessNotice(msg);
    if (saveNoticeTimerRef.current) clearTimeout(saveNoticeTimerRef.current);
    saveNoticeTimerRef.current = setTimeout(() => {
      setSaveSuccessNotice(null);
    }, 2500);
  }

  // Setup undo window
  function triggerUndo(previousLead: Lead, description: string) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({
      leadId: previousLead.id,
      leadName: previousLead.companyName,
      previousLead,
      description,
    });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 7000);
  }

  // Undo Handler
  async function handleUndo() {
    if (!undoToast) return;
    const { previousLead } = undoToast;
    try {
      const res = await api.patch<Lead>(`/leads/${previousLead.id}`, {
        pipelineStage: previousLead.pipelineStage,
        lastCallOutcome: previousLead.lastCallOutcome,
        priority: previousLead.priority,
        nextAction: previousLead.nextAction,
        nextFollowUpDate: previousLead.nextFollowUpDate,
        notes: previousLead.notes,
      });

      if (res.success && res.data) {
        // Re-add to table immediately
        setLeads((prev) => {
          const exists = prev.some((l) => l.id === previousLead.id);
          return exists ? prev.map((l) => (l.id === previousLead.id ? res.data! : l)) : [...prev, res.data!];
        });
        triggerSaveNotice('Reverted successfully');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to undo action');
    } finally {
      setUndoToast(null);
    }
  }

  // Inline Pipeline Change (Dropdown)
  async function handlePipelineChange(lead: Lead, newStage: string) {
    if (lead.pipelineStage === newStage) return;
    const previousLead = { ...lead };

    // If moved to Closed, immediately remove from this table
    if (newStage === 'Closed') {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      triggerUndo(previousLead, `Closed follow-up for ${lead.companyName}`);
    } else {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, pipelineStage: newStage as any } : l))
      );
    }

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: newStage,
      });
      if (res.success && res.data) {
        if (newStage !== 'Closed') {
          setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        }
        triggerSaveNotice(`Pipeline: ${newStage}`);
      }
    } catch (err: any) {
      setLeads((prev) => [...prev.filter((l) => l.id !== lead.id), previousLead]);
      alert(err.message || 'Failed to update pipeline stage');
    }
  }

  // Inline Outcome Change (Dropdown)
  async function handleOutcomeChange(lead: Lead, newOutcome: string) {
    if (!newOutcome || lead.lastCallOutcome === newOutcome) return;
    const suggestedPipeline = getSuggestedPipelineForOutcome(newOutcome);

    // 1. Prompt for date & time if Call Back Later or Demo Scheduled
    if (newOutcome === 'Call Back Later' || newOutcome === 'Demo Scheduled') {
      setPromptTarget({
        lead,
        newOutcome,
        suggestedPipeline,
        type: 'DATE_TIME',
      });
      setPromptInputDate(lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 16) : '');
      setPromptInputNextAction(lead.nextAction || (newOutcome === 'Demo Scheduled' ? 'Conduct software demo' : 'Call back prospect'));
      return;
    }

    // 2. Prompt for Closing Reason if Not Interested or Wrong Number
    if (newOutcome === 'Not Interested' || newOutcome === 'Wrong Number') {
      setPromptTarget({
        lead,
        newOutcome,
        suggestedPipeline: 'Closed',
        type: 'CLOSE_REASON',
      });
      setPromptInputReason('');
      return;
    }

    await executeOutcomeUpdate(lead, newOutcome, suggestedPipeline);
  }

  // Execute Outcome Update
  async function executeOutcomeUpdate(
    lead: Lead,
    newOutcome: string,
    targetPipeline: string,
    extraPayload: { nextFollowUpDate?: string; nextAction?: string; notes?: string } = {}
  ) {
    const previousLead = { ...lead };

    // If outcome sets Closed, remove immediately from list
    const isClosed = targetPipeline === 'Closed' || newOutcome === 'Not Interested' || newOutcome === 'Wrong Number';
    if (isClosed) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      triggerUndo(previousLead, `Closed follow-up for ${lead.companyName}`);
    }

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: targetPipeline,
        lastCallOutcome: newOutcome,
        ...extraPayload,
      });

      if (res.success && res.data) {
        if (!isClosed) {
          // If the new date is beyond 3 days, remove from current table
          const newDate = res.data.nextFollowUpDate ? res.data.nextFollowUpDate.split('T')[0] : null;
          if (newDate && newDate > day3Str) {
            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
            triggerUndo(previousLead, `Rescheduled ${lead.companyName} to ${formatDate(res.data.nextFollowUpDate!)}`);
          } else {
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
            triggerSaveNotice(`Saved: ${newOutcome}`);
            triggerUndo(previousLead, `Updated ${lead.companyName} with outcome ${newOutcome}`);
          }
        }
      }
    } catch (err: any) {
      setLeads((prev) => [...prev.filter((l) => l.id !== lead.id), previousLead]);
      alert(err.message || 'Failed to update outcome');
    }
  }

  // Next Action change
  async function handleNextActionBlur(lead: Lead, val: string) {
    if ((lead.nextAction || '') === val) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { nextAction: val });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice('Next Action saved');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save next action');
    }
  }

  // Next Follow-up Date change
  async function handleFollowUpDateChange(lead: Lead, val: string) {
    if ((lead.nextFollowUpDate || '') === val) return;
    const previousLead = { ...lead };
    const newDateStr = val ? new Date(val).toISOString().split('T')[0] : null;

    // If rescheduled beyond day 3, remove immediately from view
    if (newDateStr && newDateStr > day3Str) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      triggerUndo(previousLead, `Rescheduled ${lead.companyName} to ${formatDate(val)}`);
    }

    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        nextFollowUpDate: val ? new Date(val).toISOString() : null,
      });
      if (res.success && res.data) {
        if (!newDateStr || newDateStr <= day3Str) {
          setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
          triggerSaveNotice('Follow-up scheduled');
        }
      }
    } catch (err: any) {
      setLeads((prev) => [...prev.filter((l) => l.id !== lead.id), previousLead]);
      alert(err.message || 'Failed to save follow-up date');
    }
  }

  // Priority change
  async function handlePriorityChange(lead: Lead, newPriority: Priority) {
    if (lead.priority === newPriority) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { priority: newPriority });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice(`Priority: ${newPriority}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  // Notes change
  async function handleNotesBlur(lead: Lead, val: string) {
    if ((lead.notes || '') === val) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { notes: val });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice('Notes saved');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save notes');
    }
  }

  // Confirm Prompt Modal
  async function handleConfirmPrompt() {
    if (!promptTarget) return;
    const { lead, newOutcome, suggestedPipeline, type } = promptTarget;

    if (type === 'DATE_TIME' || type === 'FOLLOW_UP_DATE') {
      if (!promptInputDate) {
        alert('Please select a valid date and time.');
        return;
      }
      const selectedTime = new Date(promptInputDate).getTime();
      if (isNaN(selectedTime) || selectedTime < Date.now() - 60000) {
        alert('Past dates are not allowed. Please choose a future date & time.');
        return;
      }
      await executeOutcomeUpdate(lead, newOutcome, suggestedPipeline, {
        nextFollowUpDate: new Date(promptInputDate).toISOString(),
        nextAction: promptInputNextAction || lead.nextAction || undefined,
      });
    } else if (type === 'CLOSE_REASON') {
      if (!promptInputReason.trim()) {
        alert('Please enter a short reason for closing this lead.');
        return;
      }
      const closingNotes = lead.notes
        ? `${lead.notes} | Closed reason (${newOutcome}): ${promptInputReason}`
        : `Closed reason (${newOutcome}): ${promptInputReason}`;

      await executeOutcomeUpdate(lead, newOutcome, 'Closed', {
        nextFollowUpDate: undefined,
        notes: closingNotes,
      });
    }

    setPromptTarget(null);
  }

  // Handle follow-up completion (Closed / Not Closed)
  function handleCompletionSuccess(updated: Lead) {
    // Immediately remove from this table
    setLeads((prev) => prev.filter((l) => l.id !== updated.id));
    setCallsDoneToday((prev) => prev + 1);
    triggerSaveNotice(`Follow-up marked as ${completionTarget?.mode === 'CLOSED' ? 'Closed' : 'Rescheduled (+3 days)'}`);
    setCompletionTarget(null);
  }

  // Pipeline Badge Colors
  function getPipelineBadgeColor(stageName: string) {
    const norm = normalizeCallOutcome(stageName);
    switch (norm) {
      case 'New Lead':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Attempting Contact':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Connected':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Follow-up':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Demo':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  return (
    <AppLayout
      title="Today's Work"
      subtitle="Prioritized follow-up table for today, overdue commitments, and the next 3 days."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search follow-ups by company, contact, phone, notes..."
    >
      <div className="space-y-4 max-w-[1600px] mx-auto">
        {/* Floating Top Notifications */}
        <div className="fixed top-16 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {saveSuccessNotice && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-soft-lg flex items-center gap-2 pointer-events-auto animate-fade-in">
              <CheckCircle2 className="h-4 w-4" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}

          {undoToast && (
            <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-soft-xl flex items-center gap-3 border border-slate-700 pointer-events-auto animate-slide-up">
              <div className="flex flex-col">
                <span className="font-bold text-sky-400">Action Complete</span>
                <span className="text-slate-300 text-[11px] max-w-xs truncate">
                  {undoToast.description}
                </span>
              </div>
              <button
                onClick={handleUndo}
                className="ml-2 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
            </div>
          )}
        </div>

        {/* Progress & Target Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-soft-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Today&apos;s Follow-up Progress
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  {progressPercent}% Done
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Calling target: Complete all scheduled follow-ups and overdue commitments
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Score</span>
                <span className="text-base font-black text-slate-900">
                  {callsDoneToday}{' '}
                  <span className="text-xs font-semibold text-slate-400">
                    / {totalTodayTarget} follow-ups done
                  </span>
                </span>
              </div>
              <button
                onClick={() => refreshLeads()}
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                title="Refresh follow-ups"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-linear-to-r from-sky-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Quick Range Filter Tabs with Count Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* ALL IN RANGE */}
          <button
            onClick={() => setRangeFilter('ALL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              rangeFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-soft-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All in Range</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                rangeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {allInRangeFollowUps.length}
            </span>
          </button>

          {/* OVERDUE */}
          <button
            onClick={() => setRangeFilter('OVERDUE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              rangeFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white border-rose-600 shadow-soft-sm'
                : overdueLeads.length > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Overdue</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                rangeFilter === 'OVERDUE'
                  ? 'bg-rose-800 text-white'
                  : overdueLeads.length > 0
                  ? 'bg-rose-200 text-rose-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {overdueLeads.length}
            </span>
          </button>

          {/* TODAY */}
          <button
            onClick={() => setRangeFilter('TODAY')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              rangeFilter === 'TODAY'
                ? 'bg-amber-600 text-white border-amber-600 shadow-soft-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Today</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                rangeFilter === 'TODAY' ? 'bg-amber-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {todayLeads.length}
            </span>
          </button>

          {/* TOMORROW */}
          <button
            onClick={() => setRangeFilter('TOMORROW')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              rangeFilter === 'TOMORROW'
                ? 'bg-sky-600 text-white border-sky-600 shadow-soft-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Tomorrow</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                rangeFilter === 'TOMORROW' ? 'bg-sky-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tomorrowLeads.length}
            </span>
          </button>

          {/* NEXT 3 DAYS */}
          <button
            onClick={() => setRangeFilter('NEXT_3_DAYS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              rangeFilter === 'NEXT_3_DAYS'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>Next 3 Days</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                rangeFilter === 'NEXT_3_DAYS' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {next3DaysLeads.length}
            </span>
          </button>
        </div>

        {/* Follow-up Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[72vh] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Header */}
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-soft-xs">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-900 w-12 min-w-[48px] max-w-[48px] p-3 text-center border-r border-slate-800">
                    #
                  </th>
                  <th className="sticky left-[48px] z-30 bg-slate-900 w-64 min-w-[240px] max-w-[280px] p-3 border-r border-slate-800">
                    Company
                  </th>
                  <th className="w-40 min-w-[150px] p-3">Contact Person</th>
                  <th className="w-36 min-w-[140px] p-3">Phone</th>
                  <th className="w-32 min-w-[120px] p-3">Priority</th>
                  <th className="w-48 min-w-[180px] p-3">Pipeline</th>
                  <th className="w-56 min-w-[220px] p-3">Last Call Outcome</th>
                  <th className="w-52 min-w-[200px] p-3">Next Action</th>
                  <th className="w-52 min-w-[200px] p-3">Follow-up Date & Time</th>
                  <th className="w-64 min-w-[240px] p-3">Notes</th>
                  <th className="w-48 min-w-[190px] p-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {displayLeads.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        <span className="font-bold text-sm text-slate-700">No follow-ups in this range!</span>
                        <span className="text-xs text-slate-400">
                          All commitments are up to date or completed. Great job!
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayLeads.map((lead, idx) => {
                    const rowNumber = idx + 1;
                    const priorityMeta = getPriorityColor(lead.priority);
                    const leadDateStr = lead.nextFollowUpDate ? lead.nextFollowUpDate.split('T')[0] : '';
                    const isOverdue = leadDateStr && leadDateStr < todayStr;
                    const isToday = leadDateStr && leadDateStr === todayStr;

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors group cursor-default ${
                          isOverdue
                            ? 'bg-rose-50/30 hover:bg-rose-50/70 border-l-4 border-l-rose-500'
                            : isToday
                            ? 'bg-amber-50/20 hover:bg-amber-50/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => {
                          setDrawerLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {/* Column 1: # */}
                        <td
                          className={`sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] p-3 text-center font-bold border-r border-slate-100 select-none ${
                            isOverdue
                              ? 'bg-rose-50/70 text-rose-700'
                              : 'bg-white group-hover:bg-slate-50/90 text-slate-400'
                          }`}
                        >
                          {rowNumber}
                        </td>

                        {/* Column 2: Company */}
                        <td
                          className={`sticky left-[48px] z-10 w-64 min-w-[240px] max-w-[280px] p-3 border-r border-slate-100 ${
                            isOverdue
                              ? 'bg-rose-50/70'
                              : 'bg-white group-hover:bg-slate-50/90'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span
                              className="font-bold text-slate-900 truncate hover:text-sky-600 transition-colors cursor-pointer"
                              title={lead.companyName}
                            >
                              {lead.companyName}
                            </span>
                            {lead.serviceProduct && (
                              <span className="text-[11px] text-slate-500 truncate" title={lead.serviceProduct}>
                                {lead.serviceProduct}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="inline-block mt-1 w-max text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Contact Person */}
                        <td className="w-40 min-w-[150px] p-3 text-slate-700 font-medium truncate">
                          {lead.contactPerson || '-'}
                        </td>

                        {/* Phone with Click-to-Call */}
                        <td className="w-36 min-w-[140px] p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5"
                            title={`Call ${lead.phone}`}
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{lead.phone}</span>
                          </a>
                        </td>

                        {/* Priority Dropdown */}
                        <td className="w-32 min-w-[120px] p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.priority}
                            onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {DEFAULT_PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Pipeline Status Dropdown */}
                        <td className="w-48 min-w-[180px] p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.pipelineStage}
                            onChange={(e) => handlePipelineChange(lead, e.target.value)}
                            className={`w-full text-xs font-bold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs transition-colors ${getPipelineBadgeColor(
                              lead.pipelineStage
                            )}`}
                          >
                            {PIPELINE_STAGE_LIST.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Last Call Outcome Dropdown */}
                        <td className="w-56 min-w-[220px] p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.lastCallOutcome || ''}
                            onChange={(e) => handleOutcomeChange(lead, e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs"
                          >
                            <option value="">-- Select Outcome --</option>
                            {TELECALLER_CALL_OUTCOMES.map((oc) => (
                              <option key={oc} value={oc}>
                                {oc}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Next Action (Editable) */}
                        <td className="w-52 min-w-[200px] p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={lead.nextAction || ''}
                            onBlur={(e) => handleNextActionBlur(lead, e.target.value)}
                            placeholder="Next action..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Follow-up Date and Time (Editable) */}
                        <td className="w-52 min-w-[200px] p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <input
                              type="datetime-local"
                              defaultValue={lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 16) : ''}
                              onChange={(e) => handleFollowUpDateChange(lead, e.target.value)}
                              className={`w-full text-xs border rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                                isOverdue
                                  ? 'border-rose-300 bg-rose-50/50 text-rose-800 font-bold'
                                  : 'border-slate-200 bg-slate-50/80 text-slate-800'
                              }`}
                            />
                            {lead.nextFollowUpDate && (
                              <span
                                className={`text-[10px] ${
                                  isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'
                                }`}
                              >
                                {isOverdue ? 'Overdue: ' : 'Due: '}
                                {formatDateTime(lead.nextFollowUpDate)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Notes (Editable) */}
                        <td className="w-64 min-w-[240px] p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={lead.notes || ''}
                            onBlur={(e) => handleNotesBlur(lead, e.target.value)}
                            placeholder="Follow-up notes..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Actions (Call, Closed, Not Closed, Details) */}
                        <td className="w-48 min-w-[190px] p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Call Button */}
                            <button
                              onClick={() => {
                                setSelectedLeadForCall(lead);
                                setIsCallModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer transition-colors"
                              title="Log Call"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </button>

                            {/* Closed Button */}
                            <button
                              onClick={() => setCompletionTarget({ lead, mode: 'CLOSED' })}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold cursor-pointer transition-colors"
                              title="Mark Follow-up as Closed"
                            >
                              Closed
                            </button>

                            {/* Not Closed Button */}
                            <button
                              onClick={() => setCompletionTarget({ lead, mode: 'NOT_CLOSED' })}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold cursor-pointer transition-colors"
                              title="Reschedule +3 Days with Note"
                            >
                              Not Closed
                            </button>

                            {/* Details Button */}
                            <button
                              onClick={() => {
                                setDrawerLeadId(lead.id);
                                setIsDrawerOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer transition-colors"
                              title="View Details"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Required Outcome Prompt Modal */}
        {promptTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-soft-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {promptTarget.type === 'CLOSE_REASON'
                        ? 'Closing Reason Required'
                        : `${promptTarget.newOutcome} Details`}
                    </h3>
                    <p className="text-xs text-slate-500">{promptTarget.lead.companyName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPromptTarget(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {promptTarget.type === 'CLOSE_REASON' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Marking this lead as <strong className="text-slate-900">{promptTarget.newOutcome}</strong> will move its pipeline to <strong className="text-slate-900">Closed</strong> and clear upcoming follow-ups. Please provide a brief reason:
                  </p>
                  <textarea
                    rows={3}
                    value={promptInputReason}
                    onChange={(e) => setPromptInputReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    A follow-up date and time is required for{' '}
                    <strong className="text-slate-900">{promptTarget.newOutcome}</strong>. (Pipeline suggested as{' '}
                    <strong className="text-sky-700">{promptTarget.suggestedPipeline}</strong>).
                  </p>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Date & Time (Cannot be in the past) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      value={promptInputDate}
                      onChange={(e) => setPromptInputDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Next Action Description
                    </label>
                    <input
                      type="text"
                      value={promptInputNextAction}
                      onChange={(e) => setPromptInputNextAction(e.target.value)}
                      placeholder="e.g. Call back for feedback"
                      className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPromptTarget(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPrompt}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-soft-sm cursor-pointer"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Call Modal */}
        <CallLogModal
          isOpen={isCallModalOpen}
          onClose={() => {
            setIsCallModalOpen(false);
            setSelectedLeadForCall(null);
          }}
          lead={selectedLeadForCall}
          onSuccess={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
            setCallsDoneToday((prev) => prev + 1);
            setIsCallModalOpen(false);
            setSelectedLeadForCall(null);
          }}
        />

        {/* Follow-up Completion Flow Modal (Closed & Not Closed) */}
        {completionTarget && (
          <FollowUpCompletionModal
            isOpen={!!completionTarget}
            onClose={() => setCompletionTarget(null)}
            lead={completionTarget.lead}
            mode={completionTarget.mode}
            onSuccess={handleCompletionSuccess}
          />
        )}

        {/* Slide-over Lead Detail Drawer */}
        <LeadDrawer
          leadId={drawerLeadId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setDrawerLeadId(null);
          }}
          onLeadUpdated={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
          }}
        />
      </div>
    </AppLayout>
  );
}
