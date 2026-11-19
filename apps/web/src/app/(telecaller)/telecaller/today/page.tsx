'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Lead,
  normalizeCallOutcome,
  normalizePipelineStage,
  getSuggestedPipelineForOutcome,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LIST,
  TELECALLER_CALL_OUTCOMES,
  Priority,
  isLeadClosedWon,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData, updateCachedLead } from '@/lib/apiCache';
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
  Search,
  Copy,
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor, getPriorityLabel, toDatetimeLocalValue, toIsoFromDatetimeLocal, getMinDatetimeLocal } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { WhatsAppButton, WhatsAppIcon } from '@/components/leads/WhatsAppButton';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { FollowUpDatePicker } from '@/components/leads/FollowUpDatePicker';

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
    useSWRData<Lead[]>('/leads', { limit: 1000 });

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

  // WhatsApp auto-suggestion prompt state
  const [whatsAppPromptLead, setWhatsAppPromptLead] = useState<Lead | null>(null);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>(PIPELINE_STAGE_LIST);

  // Pagination & Copy states (Default 150+ rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(150);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Load active pipeline stages dynamically
  useEffect(() => {
    fetchOptions();
    const handleInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ prefix?: string }>;
      const prefix = customEvent.detail?.prefix;
      if (!prefix || prefix.startsWith('/options') || prefix.startsWith('/leads')) {
        fetchOptions();
      }
    };
    window.addEventListener('crm:cache-invalidated', handleInvalidation);
    window.addEventListener('focus', fetchOptions);
    return () => {
      window.removeEventListener('crm:cache-invalidated', handleInvalidation);
      window.removeEventListener('focus', fetchOptions);
    };
  }, []);

  async function fetchOptions() {
    try {
      const res = await api.get<{
        pipelineStages?: { name: string; isActive: boolean; order?: number }[];
        stages?: { name: string; isActive: boolean; order?: number }[];
      }>('/options');
      if (res.success && res.data) {
        const stages = res.data.pipelineStages || res.data.stages;
        if (stages && stages.length > 0) {
          const activeStages = stages
            .filter((s) => s.isActive !== false)
            .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            .map((s) => s.name);
          if (activeStages.length > 0) {
            setPipelineOptions(activeStages);
          }
        }
      }
    } catch {
      // Keep defaults on fallback
    }
  }

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
        // Exclude closed, closed won, or uncontactable leads
        if (
          isLeadClosedWon(lead) ||
          lead.pipelineStage === 'Closed' ||
          lead.pipelineStage === 'Closed Won' ||
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

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rangeFilter, pageSize]);

  // Apply Search
  const displayLeads = useMemo(() => {
    if (!searchTerm.trim()) return filteredByRange;
    const q = searchTerm.toLowerCase().trim();
    return filteredByRange.filter(
      (l) =>
        l.companyName.toLowerCase().includes(q) ||
        (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
        (l.alternateName && l.alternateName.toLowerCase().includes(q)) ||
        l.phone.toLowerCase().includes(q) ||
        (l.alternatePhone && l.alternatePhone.toLowerCase().includes(q)) ||
        (l.nextAction && l.nextAction.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [filteredByRange, searchTerm]);

  // Pagination (default 150 rows per page)
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(displayLeads.length / pageSize));
  const paginatedLeads = useMemo(() => {
    if (pageSize === 'all') return displayLeads;
    const start = (currentPage - 1) * pageSize;
    return displayLeads.slice(start, start + pageSize);
  }, [displayLeads, currentPage, pageSize]);

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

    // If moved to Closed or Closed Won, immediately remove from this table
    const isClosed = newStage === 'Closed' || newStage === 'Closed Won';
    if (isClosed) {
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
        lastCallOutcome: lead.lastCallOutcome || null,
      });
      if (res.success && res.data) {
        updateCachedLead(res.data);
        if (!isClosed) {
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
    const currentPipeline = lead.pipelineStage;

    // Prompt rules:
    // 1. Date & Time required for Call Back Later and Demo Scheduled
    if (newOutcome === 'Call Back Later' || newOutcome === 'Demo Scheduled') {
      setPromptTarget({
        lead,
        newOutcome,
        suggestedPipeline: currentPipeline,
        type: 'DATE_TIME',
      });
      setPromptInputDate(lead.nextFollowUpDate ? toDatetimeLocalValue(lead.nextFollowUpDate) : '');
      setPromptInputNextAction(lead.nextAction || (newOutcome === 'Demo Scheduled' ? 'Conduct software demo' : 'Call back prospect'));
      return;
    }

    // 2. Follow-up date required for follow-up outcomes
    if (
      ['Demo Interested', 'Details Requested', 'Demo Completed', 'Decision Pending'].includes(newOutcome)
    ) {
      if (!lead.nextFollowUpDate) {
        setPromptTarget({
          lead,
          newOutcome,
          suggestedPipeline: currentPipeline,
          type: 'FOLLOW_UP_DATE',
        });
        setPromptInputDate('');
        setPromptInputNextAction(lead.nextAction || `Follow up after ${newOutcome}`);
        return;
      }
    }

    await executeOutcomeUpdate(lead, newOutcome, currentPipeline);
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
        updateCachedLead(res.data);
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
        if (newOutcome === 'Details Requested') {
          setWhatsAppPromptLead(res.data);
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
  async function handleFollowUpDateChange(lead: Lead, val: string | null) {
    const nextDate = val ? (val.endsWith('Z') ? val : toIsoFromDatetimeLocal(val)) : null;
    if ((lead.nextFollowUpDate || null) === nextDate) return;
    const previousLead = { ...lead };
    const newDateStr = nextDate ? nextDate.split('T')[0] : null;

    // If rescheduled beyond day 3, remove immediately from view
    if (newDateStr && newDateStr > day3Str) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      triggerUndo(previousLead, `Rescheduled ${lead.companyName} to ${formatDateTime(nextDate)}`);
    }

    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        nextFollowUpDate: nextDate,
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
        updateCachedLead(res.data);
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
      const isoDate = toIsoFromDatetimeLocal(promptInputDate);
      const nextAct = promptInputNextAction || lead.nextAction || undefined;

      // Close modal immediately and clear inputs to prevent popup freezing or delays
      setPromptTarget(null);
      setPromptInputDate('');
      setPromptInputNextAction('');

      await executeOutcomeUpdate(lead, newOutcome, lead.pipelineStage, {
        nextFollowUpDate: isoDate || undefined,
        nextAction: nextAct,
      });
      return;
    } else if (type === 'CLOSE_REASON') {
      if (!promptInputReason.trim()) {
        alert('Please enter a short reason for closing this lead.');
        return;
      }
      const closingNotes = lead.notes
        ? `${lead.notes} | Closed reason (${newOutcome}): ${promptInputReason}`
        : `Closed reason (${newOutcome}): ${promptInputReason}`;

      // Close modal immediately and clear inputs to prevent popup freezing or delays
      setPromptTarget(null);
      setPromptInputReason('');

      await executeOutcomeUpdate(lead, newOutcome, 'Closed', {
        nextFollowUpDate: undefined,
        notes: closingNotes,
      });
      return;
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
    const norm = normalizePipelineStage(stageName);
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

        {/* Mobile Search Bar (Always visible on mobile) */}
        <div className="md:hidden relative">
          <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search follow-ups by company, phone, contact..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-soft-xs min-h-[44px]"
          />
        </div>

        {/* Quick Range Filter Tabs with Count Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0">
          {/* ALL IN RANGE */}
          <button
            onClick={() => setRangeFilter('ALL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${rangeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-soft-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>All in Range</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${rangeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}
            >
              {allInRangeFollowUps.length}
            </span>
          </button>

          {/* OVERDUE */}
          <button
            onClick={() => setRangeFilter('OVERDUE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${rangeFilter === 'OVERDUE'
              ? 'bg-rose-600 text-white border-rose-600 shadow-soft-sm'
              : overdueLeads.length > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Overdue</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${rangeFilter === 'OVERDUE'
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${rangeFilter === 'TODAY'
              ? 'bg-amber-600 text-white border-amber-600 shadow-soft-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Today</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${rangeFilter === 'TODAY' ? 'bg-amber-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {todayLeads.length}
            </span>
          </button>

          {/* TOMORROW */}
          <button
            onClick={() => setRangeFilter('TOMORROW')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${rangeFilter === 'TOMORROW'
              ? 'bg-sky-600 text-white border-sky-600 shadow-soft-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Tomorrow</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${rangeFilter === 'TOMORROW' ? 'bg-sky-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {tomorrowLeads.length}
            </span>
          </button>

          {/* NEXT 3 DAYS */}
          <button
            onClick={() => setRangeFilter('NEXT_3_DAYS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${rangeFilter === 'NEXT_3_DAYS'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>Next 3 Days</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${rangeFilter === 'NEXT_3_DAYS' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
            >
              {next3DaysLeads.length}
            </span>
          </button>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="md:hidden space-y-3">
          {paginatedLeads.length === 0 ? (
            <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <span className="font-bold text-sm text-slate-700 block">No follow-ups in this range!</span>
              <span className="text-xs text-slate-400">All commitments are up to date or completed.</span>
            </div>
          ) : (
            paginatedLeads.map((lead, idx) => {
              const rowNumber = (currentPage - 1) * (typeof pageSize === 'number' ? pageSize : 0) + idx + 1;
              const priorityMeta = getPriorityColor(lead.priority);
              const leadDateStr = lead.nextFollowUpDate ? lead.nextFollowUpDate.split('T')[0] : '';
              const isOverdue = leadDateStr && leadDateStr < todayStr;
              const isToday = leadDateStr && leadDateStr === todayStr;

              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border shadow-soft-sm p-4 space-y-3 ${isOverdue
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isToday
                      ? 'border-amber-300 ring-1 ring-amber-100'
                      : 'border-slate-200'
                    }`}
                >
                  {/* Top row: # Serial, Company Name, Contact, Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md font-black text-xs shrink-0 ${isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                        #{rowNumber}
                      </span>
                      <div className="min-w-0">
                        <h3
                          onClick={() => {
                            setDrawerLeadId(lead.id);
                            setIsDrawerOpen(true);
                          }}
                          className="font-extrabold text-sm text-slate-900 truncate hover:text-sky-600 cursor-pointer"
                        >
                          {lead.companyName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                          <span className="font-semibold text-slate-700">{lead.contactPerson || 'No contact'}</span>
                          {lead.serviceProduct && (
                            <>
                              <span>•</span>
                              <span className="truncate">{lead.serviceProduct}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Priority Dropdown */}
                    <select
                      value={lead.priority}
                      onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border shrink-0 ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                    >
                      {DEFAULT_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{getPriorityLabel(p)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Phone Row with Click-to-Call + WhatsApp */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 truncate min-w-0">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs border border-emerald-200 min-h-[40px] min-w-[40px]"
                        title={`Call ${lead.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <WhatsAppButton
                        phone={lead.phone}
                        leadId={lead.id}
                        leadName={lead.contactPerson || lead.companyName}
                        size="sm"
                        showText={false}
                        className="min-h-[40px] min-w-[40px]"
                      />
                    </div>
                  </div>

                  {/* Pipeline & Outcome Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Pipeline Stage
                      </label>
                      <select
                        value={lead.pipelineStage}
                        onChange={(e) => handlePipelineChange(lead, e.target.value)}
                        className={`w-full text-xs font-bold rounded-lg px-2.5 py-2 border cursor-pointer ${getPipelineBadgeColor(
                          lead.pipelineStage
                        )}`}
                      >
                        {PIPELINE_STAGE_LIST.map((stage) => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Last Call Outcome
                      </label>
                      <select
                        value={lead.lastCallOutcome || ''}
                        onChange={(e) => handleOutcomeChange(lead, e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="">-- Select Outcome --</option>
                        {TELECALLER_CALL_OUTCOMES.map((oc) => (
                          <option key={oc} value={oc}>{oc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Next Action & Follow-up */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Next Action
                      </label>
                      <input
                        type="text"
                        defaultValue={lead.nextAction || ''}
                        onBlur={(e) => handleNextActionBlur(lead, e.target.value)}
                        placeholder="Next action..."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Follow-up Due
                      </label>
                      <FollowUpDatePicker
                        value={lead.nextFollowUpDate}
                        onChange={(val) => handleFollowUpDateChange(lead, val)}
                        isOverdue={Boolean(isOverdue)}
                      />
                    </div>
                  </div>

                  {/* Mobile Actions: Call, Closed, Not Closed, Details */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedLeadForCall(lead);
                        setIsCallModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 min-h-[38px] cursor-pointer"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>Log Call</span>
                    </button>
                    <button
                      onClick={() => setCompletionTarget({ lead, mode: 'CLOSED' })}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold min-h-[38px] cursor-pointer"
                    >
                      Closed
                    </button>
                    <button
                      onClick={() => setCompletionTarget({ lead, mode: 'NOT_CLOSED' })}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold min-h-[38px] cursor-pointer"
                    >
                      Not Closed
                    </button>
                    <button
                      onClick={() => {
                        setDrawerLeadId(lead.id);
                        setIsDrawerOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-[38px] cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Follow-up Table (Desktop & Tablet) */}
        <div className="hidden md:flex bg-white rounded-xl border border-slate-200 shadow-soft-sm overflow-hidden flex-col">
          <div className="overflow-x-auto max-h-[72vh] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Header */}
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-soft-xs">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-900 w-12 min-w-[48px] max-w-[48px] py-2 px-2.5 text-center border-r border-slate-800">
                    #
                  </th>
                  <th className="sticky left-[48px] z-30 bg-slate-900 w-64 min-w-[240px] max-w-[280px] py-2 px-2.5 border-r border-slate-800">
                    Company & Contact
                  </th>
                  <th className="sticky left-[308px] z-30 bg-slate-900 w-44 min-w-[170px] py-2 px-2.5 border-r border-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                    Phone
                  </th>
                  <th className="w-28 min-w-[110px] py-2 px-2.5">Priority</th>
                  <th className="w-44 min-w-[170px] py-2 px-2.5">Pipeline</th>
                  <th className="w-52 min-w-[200px] py-2 px-2.5">Last Call Outcome</th>
                  <th className="w-48 min-w-[180px] py-2 px-2.5">Next Action</th>
                  <th className="w-48 min-w-[180px] py-2 px-2.5">Follow-up Date & Time</th>
                  <th className="w-56 min-w-[210px] py-2 px-2.5">Notes</th>
                  <th className="w-52 min-w-[200px] py-2 px-2.5 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && leads.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="sticky left-0 z-10 bg-white py-2 px-2.5 text-center border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-6 mx-auto" /></td>
                      <td className="sticky left-[48px] z-10 bg-white py-2 px-2.5 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-36 mb-1" /><div className="h-3 bg-slate-100 rounded w-20" /></td>
                      <td className="sticky left-[308px] z-10 bg-white py-2 px-2.5 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-20" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-28" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-32" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-28" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-28" /></td>
                      <td className="py-2 px-2.5"><div className="h-6 bg-slate-200 rounded w-32" /></td>
                      <td className="py-2 px-2.5 text-center"><div className="h-6 bg-slate-200 rounded w-24 mx-auto" /></td>
                    </tr>
                  ))
                ) : paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
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
                  paginatedLeads.map((lead, idx) => {
                    const rowNumber = (currentPage - 1) * (typeof pageSize === 'number' ? pageSize : 0) + idx + 1;
                    const priorityMeta = getPriorityColor(lead.priority);
                    const leadDateStr = lead.nextFollowUpDate ? lead.nextFollowUpDate.split('T')[0] : '';
                    const isOverdue = leadDateStr && leadDateStr < todayStr;
                    const isToday = leadDateStr && leadDateStr === todayStr;

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors group cursor-default ${isOverdue
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
                          className={`sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] py-2 px-2.5 text-center font-bold border-r border-slate-100 select-none ${isOverdue
                            ? 'bg-rose-50/70 text-rose-700'
                            : 'bg-white group-hover:bg-slate-50/90 text-slate-400'
                            }`}
                        >
                          {rowNumber}
                        </td>

                        {/* Column 2: Company & Contact */}
                        <td
                          className={`sticky left-[48px] z-10 w-64 min-w-[240px] max-w-[280px] py-2 px-2.5 border-r border-slate-100 ${isOverdue
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
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                              <span className="font-semibold text-slate-700">{lead.contactPerson || 'No contact'}</span>
                              {lead.serviceProduct && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-400 truncate max-w-[110px]" title={lead.serviceProduct}>
                                    {lead.serviceProduct}
                                  </span>
                                </>
                              )}
                            </div>
                            {isOverdue && (
                              <span className="inline-block mt-0.5 w-max text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Sticky Column 3: Phone (Showing primary + alternate phone stacked vertically with single-click copy button) */}
                        <td
                          className={`sticky left-[308px] z-10 w-44 min-w-[170px] py-2 px-2.5 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${isOverdue
                            ? 'bg-rose-50/70'
                            : 'bg-white group-hover:bg-slate-50/90'
                            }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-1 group/p1">
                              <a
                                href={lead.phone ? `tel:${lead.phone}` : undefined}
                                className="text-emerald-700 font-bold hover:underline flex items-center gap-1.5 text-[13px] tracking-wide font-mono truncate"
                                title={lead.phone ? `Dial ${lead.phone}` : undefined}
                              >
                                <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{lead.phone || 'No Phone'}</span>
                              </a>
                              {lead.phone && (
                                <button
                                  onClick={(e) => copyToClipboard(lead.phone, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                  title="Copy phone"
                                >
                                  {copiedPhone === lead.phone ? (
                                    <span className="text-xs text-emerald-600 font-bold">✓</span>
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            {lead.alternatePhone && (
                              <div className="flex items-center justify-between gap-1 group/p2 pt-0.5 border-t border-slate-100">
                                <a
                                  href={`tel:${lead.alternatePhone}`}
                                  className="text-slate-700 font-semibold hover:underline flex items-center gap-1.5 text-xs font-mono truncate"
                                  title={`Alt: ${lead.alternatePhone}`}
                                >
                                  <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                                  <span className="truncate">{lead.alternatePhone}</span>
                                </a>
                                <button
                                  onClick={(e) => copyToClipboard(lead.alternatePhone!, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                  title="Copy alternate phone"
                                >
                                  {copiedPhone === lead.alternatePhone ? (
                                    <span className="text-xs text-emerald-600 font-bold">✓</span>
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Priority Dropdown */}
                        <td className="w-28 min-w-[110px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.priority}
                            onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {DEFAULT_PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {getPriorityLabel(p)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Pipeline Status Dropdown */}
                        <td className="w-44 min-w-[170px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.pipelineStage}
                            onChange={(e) => handlePipelineChange(lead, e.target.value)}
                            className={`w-full text-xs font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs transition-colors ${getPipelineBadgeColor(
                              lead.pipelineStage
                            )}`}
                          >
                            {pipelineOptions.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Last Call Outcome Dropdown */}
                        <td className="w-52 min-w-[200px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.lastCallOutcome || ''}
                            onChange={(e) => handleOutcomeChange(lead, e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs"
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
                        <td className="w-48 min-w-[180px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={lead.nextAction || ''}
                            onBlur={(e) => handleNextActionBlur(lead, e.target.value)}
                            placeholder="Next action..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Follow-up Date and Time (Editable) */}
                        <td className="w-52 min-w-[210px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <FollowUpDatePicker
                            value={lead.nextFollowUpDate}
                            onChange={(val) => handleFollowUpDateChange(lead, val)}
                            compact
                            isOverdue={Boolean(isOverdue)}
                          />
                        </td>

                        {/* Notes (Editable) */}
                        <td className="w-56 min-w-[210px] py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={lead.notes || ''}
                            onBlur={(e) => handleNotesBlur(lead, e.target.value)}
                            placeholder="Follow-up notes..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Actions (Call, WhatsApp, Closed, Not Closed, Details) */}
                        <td className="w-52 min-w-[200px] py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Call Button */}
                            <button
                              onClick={() => {
                                setSelectedLeadForCall(lead);
                                setIsCallModalOpen(true);
                              }}
                              className="p-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer transition-colors"
                              title="Log Call"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </button>

                            {/* WhatsApp Button */}
                            <WhatsAppButton
                              phone={lead.phone}
                              leadId={lead.id}
                              leadName={lead.contactPerson || lead.companyName}
                              size="sm"
                              showText={false}
                            />

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

          {/* Table Pagination Footer (Default 150+ Rows Per Page) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Rows per page:</span>
              <select
                value={pageSize === 'all' ? 'all' : pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value={150}>150 (Default)</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value="all">All ({displayLeads.length})</option>
              </select>
              <span className="text-slate-400">|</span>
              <span>
                Showing {displayLeads.length === 0 ? 0 : pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1} -{' '}
                {pageSize === 'all' ? displayLeads.length : Math.min(currentPage * pageSize, displayLeads.length)} of{' '}
                <span className="font-bold text-slate-700">{displayLeads.length}</span> follow-up leads
              </span>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
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
                      min={getMinDatetimeLocal()}
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
          initialLead={leads.find((l) => l.id === drawerLeadId) || null}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setDrawerLeadId(null);
          }}
          onLeadUpdated={(updated) => {
            updateCachedLead(updated);
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
            mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) : [{ ...updated }]));
          }}
        />

        {/* WhatsApp Auto-Suggestion Prompt when "Details Requested" is chosen */}
        {whatsAppPromptLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-soft-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <WhatsAppIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Open WhatsApp now?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {whatsAppPromptLead.companyName} requested details.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                A pre-filled greeting message will be prepared with the prospect&apos;s phone number (
                <strong className="text-emerald-900">{whatsAppPromptLead.phone}</strong>).
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsAppPromptLead(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-[40px] cursor-pointer"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = whatsAppPromptLead;
                    setWhatsAppPromptLead(null);
                    openWhatsAppChat({
                      phone: l.phone,
                      leadId: l.id,
                      callerName: user?.name,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-soft-sm min-h-[40px] flex items-center gap-1.5 cursor-pointer"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Open WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
