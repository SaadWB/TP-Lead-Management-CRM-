'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
  RefreshCw,
  Phone,
  AlertTriangle,
  CheckCircle2,
  X,
  Undo2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Plus,
  Search,
  MessageSquare,
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor } from '@/lib/utils';
import { WhatsAppButton, WhatsAppIcon } from '@/components/leads/WhatsAppButton';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

// Dynamic imports for heavy modals
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});
const CallLogModal = dynamic(() => import('@/components/leads/CallLogModal').then((m) => m.CallLogModal), {
  ssr: false,
});
const AddCustomOptionModal = dynamic(
  () => import('@/components/leads/AddCustomOptionModal').then((m) => m.AddCustomOptionModal),
  { ssr: false }
);

const DEFAULT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

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

const DATE_FIELDS = [
  { id: 'createdAt', label: 'Date Added' },
  { id: 'updatedAt', label: 'Last Updated' },
  { id: 'nextFollowUpDate', label: 'Next Follow-up Date' },
];

const DATE_PRESETS = [
  { id: 'ALL', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'LAST_MONTH', label: 'Last Month' },
  { id: 'LAST_3_MONTHS', label: 'Last 3 Months' },
  { id: 'CUSTOM', label: 'Custom Range...' },
];

function getDatePresetRange(preset: string): { fromDate: string; toDate: string } {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (preset === 'TODAY') {
    return { fromDate: todayStr, toDate: todayStr };
  }
  if (preset === 'YESTERDAY') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().split('T')[0];
    return { fromDate: yStr, toDate: yStr };
  }
  if (preset === 'LAST_7_DAYS') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { fromDate: d.toISOString().split('T')[0], toDate: todayStr };
  }
  if (preset === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromDate: start.toISOString().split('T')[0], toDate: todayStr };
  }
  if (preset === 'LAST_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { fromDate: start.toISOString().split('T')[0], toDate: end.toISOString().split('T')[0] };
  }
  if (preset === 'LAST_3_MONTHS') {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return { fromDate: start.toISOString().split('T')[0], toDate: todayStr };
  }
  return { fromDate: '', toDate: '' };
}

export default function TelecallerMyLeadsPage() {
  // Load initial filter state from localStorage if available
  const initialFilters = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('telecaller_myleads_filters');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Search and Filters state
  const [searchTerm, setSearchTerm] = useState<string>(initialFilters?.searchTerm || '');
  const [pipelineFilter, setPipelineFilter] = useState<string>(initialFilters?.pipelineFilter || 'ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>(initialFilters?.outcomeFilter || '');
  const [priorityFilter, setPriorityFilter] = useState<string>(initialFilters?.priorityFilter || '');

  // Date filter state
  const [dateField, setDateField] = useState<'createdAt' | 'updatedAt' | 'nextFollowUpDate'>(
    initialFilters?.dateField || 'createdAt'
  );
  const [datePreset, setDatePreset] = useState<string>(initialFilters?.datePreset || 'ALL');
  const [customFromDate, setCustomFromDate] = useState<string>(initialFilters?.customFromDate || '');
  const [customToDate, setCustomToDate] = useState<string>(initialFilters?.customToDate || '');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'nextFollowUpDate' | 'companyName'>(
    initialFilters?.sortBy || 'updatedAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialFilters?.sortOrder || 'desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Undo Toast state (7-second undo window)
  const [undoToast, setUndoToast] = useState<UndoState | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom options state
  const [customPriorities, setCustomPriorities] = useState<string[]>([]);
  const [customOutcomes, setCustomOutcomes] = useState<string[]>([]);
  const [addOptionModal, setAddOptionModal] = useState<{
    isOpen: boolean;
    type: 'PRIORITY' | 'CALL_OUTCOME';
  }>({
    isOpen: false,
    type: 'CALL_OUTCOME',
  });

  // Modal targets
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [promptTarget, setPromptTarget] = useState<RequiredPromptTarget | null>(null);
  const [promptInputDate, setPromptInputDate] = useState<string>('');
  const [promptInputReason, setPromptInputReason] = useState<string>('');
  const [promptInputNextAction, setPromptInputNextAction] = useState<string>('');

  // User & URL query parameters sync
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // WhatsApp auto-suggestion modal target
  const [whatsAppPromptLead, setWhatsAppPromptLead] = useState<Lead | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Sync URL query params if present (from report cards click)
  useEffect(() => {
    if (!searchParams) return;
    const oc = searchParams.get('lastCallOutcome') || searchParams.get('outcome');
    const pl = searchParams.get('pipelineStage') || searchParams.get('pipeline');
    const pr = searchParams.get('priority');
    const q = searchParams.get('search');
    const rg = searchParams.get('range');

    if (oc) setOutcomeFilter(oc);
    if (pl) setPipelineFilter(pl);
    if (pr) setPriorityFilter(pr);
    if (q) setSearchTerm(q);
    if (rg) setDatePreset(rg);
  }, [searchParams]);

  // Persist filters to localStorage
  useEffect(() => {
    try {
      const state = {
        searchTerm,
        pipelineFilter,
        outcomeFilter,
        priorityFilter,
        dateField,
        datePreset,
        customFromDate,
        customToDate,
        sortBy,
        sortOrder,
      };
      localStorage.setItem('telecaller_myleads_filters', JSON.stringify(state));
    } catch {
      // ignore localStorage quota errors
    }
  }, [
    searchTerm,
    pipelineFilter,
    outcomeFilter,
    priorityFilter,
    dateField,
    datePreset,
    customFromDate,
    customToDate,
    sortBy,
    sortOrder,
  ]);

  // Compute effective date range
  const { fromDate, toDate } = useMemo(() => {
    if (datePreset === 'CUSTOM') {
      return { fromDate: customFromDate, toDate: customToDate };
    }
    return getDatePresetRange(datePreset);
  }, [datePreset, customFromDate, customToDate]);

  // Query parameters for SWR hook
  const queryParams = useMemo(() => {
    const p: Record<string, any> = { limit: 100 };
    if (pipelineFilter !== 'ALL') p.pipelineStage = pipelineFilter;
    if (outcomeFilter) p.lastCallOutcome = outcomeFilter;
    if (priorityFilter) p.priority = priorityFilter;
    if (searchTerm) p.search = searchTerm;
    if (datePreset !== 'ALL' && dateField) {
      p.dateField = dateField;
      if (fromDate) p.fromDate = fromDate;
      if (toDate) p.toDate = toDate;
    }
    if (sortBy) p.sortBy = sortBy;
    if (sortOrder) p.sortOrder = sortOrder;
    return p;
  }, [pipelineFilter, outcomeFilter, priorityFilter, searchTerm, datePreset, dateField, fromDate, toDate, sortBy, sortOrder]);

  // SWR Caching
  const { data: cachedLeads, loading: swrLoading, mutate: mutateLeads, refresh: refreshLeads } =
    useSWRData<Lead[]>('/leads', queryParams);

  const [leads, setLeads] = useState<Lead[]>(cachedLeads || []);

  // Sync leads when SWR data arrives
  useEffect(() => {
    if (cachedLeads) {
      setLeads(cachedLeads);
    }
  }, [cachedLeads]);

  useEffect(() => {
    fetchCustomOptions();
  }, []);

  async function fetchCustomOptions() {
    try {
      const res = await api.get<{ priorities: string[]; callOutcomes: string[] }>('/leads/custom-options');
      if (res.success && res.data) {
        setCustomPriorities(res.data.priorities || []);
        setCustomOutcomes(
          (res.data.callOutcomes || []).filter(
            (o) => o && o.trim().toLowerCase() !== 'special inquiry'
          )
        );
      }
    } catch (err) {
      console.error('Error loading custom options:', err);
    }
  }

  // Combined options list
  const allPriorities = useMemo(() => {
    return Array.from(new Set([...DEFAULT_PRIORITIES, ...customPriorities]));
  }, [customPriorities]);

  const allOutcomes = useMemo(() => {
    return Array.from(
      new Set([
        ...TELECALLER_CALL_OUTCOMES,
        ...customOutcomes.filter(
          (o) => !TELECALLER_CALL_OUTCOMES.includes(o as any) && o.trim().toLowerCase() !== 'special inquiry'
        ),
      ])
    );
  }, [customOutcomes]);

  // Filter leads client-side for ultra-fast response
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Pipeline filter
      if (pipelineFilter !== 'ALL') {
        const normLeadPipeline = normalizeCallOutcome(lead.pipelineStage);
        if (normLeadPipeline !== pipelineFilter && lead.pipelineStage !== pipelineFilter) {
          return false;
        }
      }

      // 2. Outcome filter
      if (outcomeFilter && lead.lastCallOutcome !== outcomeFilter) {
        return false;
      }

      // 3. Priority filter
      if (priorityFilter && lead.priority !== priorityFilter) {
        return false;
      }

      // 4. Search query (company, contact person, phone, email)
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCompany = lead.companyName.toLowerCase().includes(q);
        const matchesContact = !!(lead.contactPerson && lead.contactPerson.toLowerCase().includes(q));
        const matchesPhone = lead.phone.toLowerCase().includes(q);
        const matchesEmail = !!(lead.email && lead.email.toLowerCase().includes(q));
        const matchesProduct = !!(lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q));
        if (!matchesCompany && !matchesContact && !matchesPhone && !matchesEmail && !matchesProduct) {
          return false;
        }
      }

      // 5. Client date range check
      if (datePreset !== 'ALL' && (fromDate || toDate)) {
        let val: string | null | undefined;
        if (dateField === 'createdAt') val = lead.createdAt;
        else if (dateField === 'updatedAt') val = lead.lastActivityAt || lead.updatedAt;
        else if (dateField === 'nextFollowUpDate') val = lead.nextFollowUpDate;

        if (!val) return false;
        const time = new Date(val).getTime();
        if (isNaN(time)) return false;

        if (fromDate) {
          const fromTime = new Date(fromDate).setHours(0, 0, 0, 0);
          if (time < fromTime) return false;
        }
        if (toDate) {
          const toTime = new Date(toDate).setHours(23, 59, 59, 999);
          if (time > toTime) return false;
        }
      }

      return true;
    });
  }, [leads, pipelineFilter, outcomeFilter, priorityFilter, searchTerm, datePreset, dateField, fromDate, toDate]);

  // Sort leads client-side
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortBy === 'updatedAt') {
        valA = new Date(a.lastActivityAt || a.updatedAt).getTime();
        valB = new Date(b.lastActivityAt || b.updatedAt).getTime();
      } else if (sortBy === 'nextFollowUpDate') {
        valA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : 0;
        valB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : 0;
      } else if (sortBy === 'companyName') {
        valA = a.companyName.toLowerCase();
        valB = b.companyName.toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = new Date(a.lastActivityAt || a.updatedAt).getTime();
        valB = new Date(b.lastActivityAt || b.updatedAt).getTime();
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredLeads, sortBy, sortOrder]);

  // Stage count aggregation for filter chips
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: leads.length };
    PIPELINE_STAGE_LIST.forEach((st) => {
      counts[st] = 0;
    });
    leads.forEach((l) => {
      const norm = normalizeCallOutcome(l.pipelineStage);
      if (counts[norm] !== undefined) {
        counts[norm]++;
      } else if (counts[l.pipelineStage] !== undefined) {
        counts[l.pipelineStage]++;
      }
    });
    return counts;
  }, [leads]);

  // Pagination calculation
  const totalItems = sortedLeads.length;
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const paginatedLeads = useMemo(() => {
    if (pageSize === 0) return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // Sorting header toggle
  function handleHeaderSort(field: 'createdAt' | 'updatedAt' | 'nextFollowUpDate' | 'companyName') {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Newest first by default
    }
  }

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

  // Revert via Undo
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
        setLeads((prev) => prev.map((l) => (l.id === previousLead.id ? res.data! : l)));
        triggerSaveNotice('Reverted successfully');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to undo action');
    } finally {
      setUndoToast(null);
    }
  }

  // Inline Pipeline Change
  async function handlePipelineChange(lead: Lead, newStage: string) {
    if (lead.pipelineStage === newStage) return;
    const previousLead = { ...lead };

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, pipelineStage: newStage as any } : l))
    );

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: newStage,
      });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice(`Pipeline changed to "${newStage}"`);
        triggerUndo(previousLead, `Changed pipeline of ${lead.companyName} to ${newStage}`);
      } else {
        throw new Error(res.message || 'Failed to update pipeline');
      }
    } catch (err: any) {
      // Revert optimistic update
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? previousLead : l)));
      alert(err.message || 'Failed to update pipeline stage');
    }
  }

  // Inline Outcome Change
  async function handleOutcomeChange(lead: Lead, newOutcome: string) {
    if (!newOutcome || lead.lastCallOutcome === newOutcome) return;
    const suggestedPipeline = getSuggestedPipelineForOutcome(newOutcome);

    // Prompt rules:
    // 1. Date & Time required for Call Back Later and Demo Scheduled
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

    // 2. Follow-up date required for follow-up outcomes
    if (
      ['Demo Interested', 'Details Requested', 'Demo Completed', 'Decision Pending'].includes(newOutcome)
    ) {
      if (!lead.nextFollowUpDate) {
        setPromptTarget({
          lead,
          newOutcome,
          suggestedPipeline,
          type: 'FOLLOW_UP_DATE',
        });
        setPromptInputDate('');
        setPromptInputNextAction(lead.nextAction || `Follow up after ${newOutcome}`);
        return;
      }
    }

    // 3. Reason required for Closed outcomes (Not Interested, Wrong Number)
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

    // Direct save
    await executeOutcomeUpdate(lead, newOutcome, suggestedPipeline);
  }

  // Execute Outcome & Pipeline update
  async function executeOutcomeUpdate(
    lead: Lead,
    newOutcome: string,
    targetPipeline: string,
    extraPayload: { nextFollowUpDate?: string; nextAction?: string; notes?: string } = {}
  ) {
    const previousLead = { ...lead };

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? {
              ...l,
              lastCallOutcome: newOutcome,
              pipelineStage: (targetPipeline || l.pipelineStage) as any,
              ...(extraPayload.nextFollowUpDate !== undefined ? { nextFollowUpDate: extraPayload.nextFollowUpDate } : {}),
              ...(extraPayload.nextAction !== undefined ? { nextAction: extraPayload.nextAction } : {}),
              ...(extraPayload.notes !== undefined ? { notes: extraPayload.notes } : {}),
            }
          : l
      )
    );

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: targetPipeline,
        lastCallOutcome: newOutcome,
        ...extraPayload,
      });

      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice(`Saved: ${newOutcome}`);
        triggerUndo(previousLead, `Logged outcome "${newOutcome}" for ${lead.companyName}`);
        if (newOutcome === 'Details Requested') {
          setWhatsAppPromptLead(res.data);
        }
      } else {
        throw new Error(res.message || 'Failed to save outcome');
      }
    } catch (err: any) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? previousLead : l)));
      alert(err.message || 'Failed to update call outcome');
    }
  }

  // Inline Next Action Change
  async function handleNextActionBlur(lead: Lead, val: string) {
    if ((lead.nextAction || '') === val) return;
    const previousLead = { ...lead };
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { nextAction: val });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice('Next Action saved');
        triggerUndo(previousLead, `Updated next action for ${lead.companyName}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save next action');
    }
  }

  // Inline Next Follow-up Date Change
  async function handleFollowUpDateChange(lead: Lead, val: string) {
    if ((lead.nextFollowUpDate || '') === val) return;
    const previousLead = { ...lead };
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        nextFollowUpDate: val ? new Date(val).toISOString() : null,
      });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice('Follow-up scheduled');
        triggerUndo(previousLead, `Updated follow-up for ${lead.companyName}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save follow-up date');
    }
  }

  // Inline Priority Change
  async function handlePriorityChange(lead: Lead, newPriority: Priority) {
    if (lead.priority === newPriority) return;
    const previousLead = { ...lead };
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, priority: newPriority } : l))
    );
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { priority: newPriority });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice(`Priority: ${newPriority}`);
        triggerUndo(previousLead, `Changed priority of ${lead.companyName}`);
      }
    } catch (err: any) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? previousLead : l)));
      alert(err.message || 'Failed to update priority');
    }
  }

  // Inline Notes Change
  async function handleNotesBlur(lead: Lead, val: string) {
    if ((lead.notes || '') === val) return;
    const previousLead = { ...lead };
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { notes: val });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)));
        triggerSaveNotice('Notes saved');
        triggerUndo(previousLead, `Updated notes for ${lead.companyName}`);
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

  // Pipeline Badge Colors for Dropdown
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

  // Label for active date filter chip
  const activeDateLabel = useMemo(() => {
    if (datePreset === 'ALL') return null;
    const fieldObj = DATE_FIELDS.find((f) => f.id === dateField);
    const fieldLabel = fieldObj ? fieldObj.label : 'Date';

    if (datePreset === 'CUSTOM') {
      if (customFromDate && customToDate) {
        return `${customFromDate} to ${customToDate} (${fieldLabel})`;
      }
      if (customFromDate) return `From ${customFromDate} (${fieldLabel})`;
      if (customToDate) return `Until ${customToDate} (${fieldLabel})`;
      return `Custom (${fieldLabel})`;
    }

    const presetObj = DATE_PRESETS.find((p) => p.id === datePreset);
    return `${presetObj?.label || datePreset} (${fieldLabel})`;
  }, [datePreset, dateField, customFromDate, customToDate]);

  return (
    <AppLayout
      title="My Leads"
      subtitle="Complete table directory with instant inline editing, date filters, and multi-stage tracking."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search company, contact person, phone, email..."
    >
      <div className="space-y-4 max-w-[1600px] mx-auto">
        {/* Floating Notifications (safe positioning on mobile) */}
        <div className="fixed bottom-16 sm:bottom-auto sm:top-16 right-3 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {saveSuccessNotice && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-soft-lg flex items-center gap-2 pointer-events-auto animate-fade-in">
              <CheckCircle2 className="h-4 w-4" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}

          {undoToast && (
            <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-soft-xl flex items-center gap-3 border border-slate-700 pointer-events-auto animate-slide-up">
              <div className="flex flex-col">
                <span className="font-bold text-sky-400">Action Saved</span>
                <span className="text-slate-300 text-[11px] max-w-xs truncate">
                  {undoToast.description}
                </span>
              </div>
              <button
                onClick={handleUndo}
                className="ml-2 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Search Bar (Always visible on mobile) */}
        <div className="md:hidden relative">
          <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, phone, contact..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-soft-xs min-h-[44px]"
          />
        </div>

        {/* 7 Filter Chips Above Table (Counts for All + 6 Playbook Stages) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0">
          <button
            onClick={() => {
              setPipelineFilter('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${
              pipelineFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-soft-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Leads</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                pipelineFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {stageCounts['ALL'] || 0}
            </span>
          </button>

          {PIPELINE_STAGE_LIST.map((stageName) => {
            const count = stageCounts[stageName] || 0;
            const isSelected = pipelineFilter === stageName;
            return (
              <button
                key={stageName}
                onClick={() => {
                  setPipelineFilter(isSelected ? 'ALL' : stageName);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600 shadow-soft-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{stageName}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-sky-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile-Only Filter Bar Trigger */}
        <div className="md:hidden flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-soft-sm">
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 text-sky-800 font-bold text-xs border border-sky-200 min-h-[40px] cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-sky-600" />
            <span>
              Filters{' '}
              {Boolean(outcomeFilter || priorityFilter || datePreset !== 'ALL') ? `(Active)` : ''}
            </span>
          </button>

          <span className="text-xs font-bold text-slate-500">
            {sortedLeads.length} {sortedLeads.length === 1 ? 'lead' : 'leads'}
          </span>

          <button
            onClick={() => refreshLeads()}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            title="Refresh leads"
          >
            <RefreshCw className={`h-4 w-4 ${swrLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Desktop Toolbar: Date Filter, Outcomes, Priority, and Results Count */}
        <div className="hidden md:flex bg-white p-3 rounded-xl border border-slate-200 shadow-soft-sm items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Filter Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${
                  datePreset !== 'ALL'
                    ? 'bg-sky-50 text-sky-800 border-sky-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-sky-600" />
                <span>Date Filter:</span>
                <span className="font-extrabold text-sky-700">
                  {DATE_PRESETS.find((p) => p.id === datePreset)?.label || 'All Time'}
                </span>
              </button>

              {isDateMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-soft-xl p-3 w-72 space-y-3 animate-fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Filter By Date Field:
                    </label>
                    <select
                      value={dateField}
                      onChange={(e) => setDateField(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {DATE_FIELDS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Quick Presets:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DATE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setDatePreset(preset.id);
                            if (preset.id !== 'CUSTOM') {
                              setIsDateMenuOpen(false);
                            }
                          }}
                          className={`text-left text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                            datePreset === preset.id
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {datePreset === 'CUSTOM' && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">From Date:</span>
                        <input
                          type="date"
                          value={customFromDate}
                          onChange={(e) => setCustomFromDate(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">To Date:</span>
                        <input
                          type="date"
                          value={customToDate}
                          onChange={(e) => setCustomToDate(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-800"
                        />
                      </div>
                      <button
                        onClick={() => setIsDateMenuOpen(false)}
                        className="w-full py-1 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Apply Custom Range
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Date Chip with Clear Button */}
            {activeDateLabel && (
              <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-800 px-2.5 py-1 rounded-full text-xs font-bold animate-fade-in">
                <span>{activeDateLabel}</span>
                <button
                  onClick={() => {
                    setDatePreset('ALL');
                    setCustomFromDate('');
                    setCustomToDate('');
                  }}
                  className="hover:text-sky-950 p-0.5 rounded-full hover:bg-sky-100 cursor-pointer"
                  title="Clear date filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Call Outcome Filter Dropdown */}
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Call Outcomes</option>
              {allOutcomes.map((oc) => (
                <option key={oc} value={oc}>
                  {oc}
                </option>
              ))}
            </select>

            {/* Priority Filter Dropdown */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Priorities</option>
              {allPriorities.map((p) => (
                <option key={p} value={p}>
                  {p} Priority
                </option>
              ))}
            </select>

            {/* Reset All Filters */}
            {(pipelineFilter !== 'ALL' || outcomeFilter || priorityFilter || datePreset !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setPipelineFilter('ALL');
                  setOutcomeFilter('');
                  setPriorityFilter('');
                  setDatePreset('ALL');
                  setCustomFromDate('');
                  setCustomToDate('');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 underline cursor-pointer"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Matching Count Badge */}
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Showing {sortedLeads.length} {sortedLeads.length === 1 ? 'lead' : 'leads'}
            </span>

            {/* Refresh Data */}
            <button
              onClick={() => refreshLeads()}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              title="Refresh leads"
            >
              <RefreshCw className={`h-4 w-4 ${swrLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="md:hidden space-y-3">
          {paginatedLeads.length === 0 ? (
            <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
              <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <span className="font-bold text-sm text-slate-700 block">No leads match current filters</span>
              <span className="text-xs text-slate-400">Try adjusting your search query, date filter, or pipeline chips.</span>
            </div>
          ) : (
            paginatedLeads.map((lead, idx) => {
              const rowNumber = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
              const priorityMeta = getPriorityColor(lead.priority);
              const isOpenLead = lead.pipelineStage !== 'Closed';
              const isMissingAction = isOpenLead && !lead.nextAction?.trim();
              const isMissingFollowUp = isOpenLead && !lead.nextFollowUpDate;

              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-soft-sm p-4 space-y-3"
                >
                  {/* Top row: # Serial, Company Name, Contact, Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-xs shrink-0">
                        #{rowNumber}
                      </span>
                      <div className="min-w-0">
                        <h3
                          onClick={() => {
                            setSelectedLeadId(lead.id);
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
                    {/* Priority Select */}
                    <select
                      value={lead.priority}
                      onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border shrink-0 ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                    >
                      {allPriorities.map((p) => (
                        <option key={p} value={p}>{p}</option>
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
                      <WhatsAppButton phone={lead.phone} leadId={lead.id} size="sm" showText={false} className="min-h-[40px] min-w-[40px]" />
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
                        {allOutcomes.map((oc) => (
                          <option key={oc} value={oc}>{oc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Next Action & Follow-up Date */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Next Action
                        </label>
                        <input
                          type="text"
                          defaultValue={lead.nextAction || ''}
                          onBlur={(e) => handleNextActionBlur(lead, e.target.value)}
                          placeholder="e.g. Call back for details"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Next Follow-up
                        </label>
                        <input
                          type="datetime-local"
                          defaultValue={lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 16) : ''}
                          onChange={(e) => handleFollowUpDateChange(lead, e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Row: Details Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      Updated: {formatDate(lead.lastActivityAt || lead.updatedAt)}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setIsDrawerOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs transition-colors cursor-pointer min-h-[36px]"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Table View (Desktop & Tablet) */}
        <div className="hidden md:flex bg-white rounded-xl border border-slate-200 shadow-soft-sm overflow-hidden flex-col">
          {/* Scrollable Container with Fixed Columns */}
          <div className="overflow-x-auto max-h-[72vh] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Table Header */}
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-soft-xs">
                <tr>
                  {/* Sticky Column 1: # */}
                  <th className="sticky left-0 z-30 bg-slate-900 w-12 min-w-[48px] max-w-[48px] p-3 text-center border-r border-slate-800">
                    #
                  </th>

                  {/* Sticky Column 2: Company & Contact */}
                  <th
                    onClick={() => handleHeaderSort('companyName')}
                    className="sticky left-[48px] z-30 bg-slate-900 w-64 min-w-[240px] max-w-[280px] p-3 border-r border-slate-800 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Company & Contact</span>
                      {sortBy === 'companyName' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-400" /> : <ArrowDown className="h-3 w-3 text-sky-400" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Phone */}
                  <th className="w-36 min-w-[140px] p-3">Phone</th>

                  {/* Priority */}
                  <th className="w-32 min-w-[120px] p-3">Priority</th>

                  {/* Pipeline Status (Dropdown) */}
                  <th className="w-48 min-w-[180px] p-3">Pipeline Status</th>

                  {/* Last Call Outcome (Dropdown) */}
                  <th className="w-56 min-w-[220px] p-3">Last Call Outcome</th>

                  {/* Next Action (Editable) */}
                  <th className="w-52 min-w-[200px] p-3">Next Action</th>

                  {/* Next Follow-up (Editable) */}
                  <th
                    onClick={() => handleHeaderSort('nextFollowUpDate')}
                    className="w-48 min-w-[190px] p-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Next Follow-up</span>
                      {sortBy === 'nextFollowUpDate' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-400" /> : <ArrowDown className="h-3 w-3 text-sky-400" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Last Updated (Sortable) */}
                  <th
                    onClick={() => handleHeaderSort('updatedAt')}
                    className="w-36 min-w-[140px] p-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Last Updated</span>
                      {sortBy === 'updatedAt' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-400" /> : <ArrowDown className="h-3 w-3 text-sky-400" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Notes (Editable) */}
                  <th className="w-64 min-w-[240px] p-3">Notes</th>

                  {/* Action Buttons */}
                  <th className="w-24 min-w-[90px] p-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-slate-300" />
                        <span className="font-bold text-sm text-slate-700">No leads match current filters</span>
                        <span className="text-xs text-slate-400">
                          Try adjusting the search query, date filter, or pipeline chips.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const rowNumber =
                      pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    const priorityMeta = getPriorityColor(lead.priority);
                    const isOpenLead = lead.pipelineStage !== 'Closed';
                    const isMissingAction = isOpenLead && !lead.nextAction?.trim();
                    const isMissingFollowUp = isOpenLead && !lead.nextFollowUpDate;

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-default"
                        onClick={() => {
                          setSelectedLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {/* Sticky Column 1: # */}
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 w-12 min-w-[48px] max-w-[48px] p-3 text-center font-bold text-slate-400 border-r border-slate-100 select-none">
                          {rowNumber}
                        </td>

                        {/* Sticky Column 2: Company & Contact */}
                        <td className="sticky left-[48px] z-10 bg-white group-hover:bg-slate-50/90 w-64 min-w-[240px] max-w-[280px] p-3 border-r border-slate-100">
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
                            {lead.isRetry && (
                              <span className="inline-block mt-1 w-max text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Retry #{lead.retryCount || 1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Phone with Click-to-Call & WhatsApp */}
                        <td className="w-40 min-w-[160px] p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${lead.phone}`}
                              className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5"
                              title={`Dial ${lead.phone}`}
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{lead.phone}</span>
                            </a>
                            <WhatsAppButton
                              phone={lead.phone}
                              leadId={lead.id}
                              leadName={lead.contactPerson || lead.companyName}
                              size="sm"
                              showText={false}
                            />
                            <button
                              onClick={() => {
                                setActiveCallLead(lead);
                              }}
                              className="p-1 rounded hover:bg-emerald-50 text-emerald-600 cursor-pointer"
                              title="Log Call Outcome"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Priority Dropdown */}
                        <td className="w-32 min-w-[120px] p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.priority}
                            onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {allPriorities.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Pipeline Status Dropdown (Round 8: Dropdown instead of pills) */}
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
                            {allOutcomes.map((oc) => (
                              <option key={oc} value={oc}>
                                {oc}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Next Action (Editable with Missing warning) */}
                        <td className="w-52 min-w-[200px] p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              defaultValue={lead.nextAction || ''}
                              onBlur={(e) => handleNextActionBlur(lead, e.target.value)}
                              placeholder="e.g. Call back for feedback"
                              className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            {isMissingAction && (
                              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Missing Action
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Next Follow-up (Editable with Missing warning) */}
                        <td className="w-48 min-w-[190px] p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <input
                              type="datetime-local"
                              defaultValue={lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 16) : ''}
                              onChange={(e) => handleFollowUpDateChange(lead, e.target.value)}
                              className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            {isMissingFollowUp ? (
                              <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Missing Follow-up
                              </span>
                            ) : (
                              lead.nextFollowUpDate && (
                                <span className="text-[10px] text-slate-400">
                                  Due: {formatDate(lead.nextFollowUpDate)}
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td className="w-36 min-w-[140px] p-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDateTime(lead.lastActivityAt || lead.updatedAt)}
                        </td>

                        {/* Notes (Editable) */}
                        <td className="w-64 min-w-[240px] p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            defaultValue={lead.notes || ''}
                            onBlur={(e) => handleNotesBlur(lead, e.target.value)}
                            placeholder="Add brief note..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Action Buttons */}
                        <td className="w-32 min-w-[120px] p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
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
                            <button
                              onClick={() => {
                                setSelectedLeadId(lead.id);
                                setIsDrawerOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                              title="Open Full Details"
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

          {/* Table Footer with Pagination Controls */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All Rows</option>
              </select>
              <span className="text-slate-400">|</span>
              <span className="font-semibold text-slate-700">
                {totalItems === 0
                  ? '0 leads'
                  : pageSize === 0
                  ? `Showing all ${totalItems} leads`
                  : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(
                      currentPage * pageSize,
                      totalItems
                    )} of ${totalItems}`}
              </span>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                    placeholder="Enter reason (e.g. Budget constraints, Not relevant, Invalid contact)..."
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
                      Next Action Description (Recommended)
                    </label>
                    <input
                      type="text"
                      value={promptInputNextAction}
                      onChange={(e) => setPromptInputNextAction(e.target.value)}
                      placeholder="e.g. Call back with updated pricing sheet"
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

        {/* Lead Drawer */}
        <LeadDrawer
          leadId={selectedLeadId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedLeadId(null);
          }}
          onLeadUpdated={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
          }}
        />

        {/* Call Log Modal */}
        {activeCallLead && (
          <CallLogModal
            isOpen={!!activeCallLead}
            onClose={() => setActiveCallLead(null)}
            lead={activeCallLead}
            onSuccess={(updated) => {
              setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
              mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
              setActiveCallLead(null);
            }}
          />
        )}

        {/* Custom Option Modal */}
        <AddCustomOptionModal
          isOpen={addOptionModal.isOpen}
          onClose={() => setAddOptionModal({ isOpen: false, type: 'CALL_OUTCOME' })}
          type={addOptionModal.type}
          existingOptions={addOptionModal.type === 'PRIORITY' ? allPriorities : allOutcomes}
          onSuccess={(newOption) => {
            if (addOptionModal.type === 'PRIORITY') {
              setCustomPriorities((prev) => [...prev, newOption]);
            } else {
              setCustomOutcomes((prev) => [...prev, newOption]);
            }
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
                    openWhatsAppChat(l.phone, {
                      leadId: l.id,
                      telecallerName: user?.name,
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

        {/* Mobile Filters Modal / Bottom Sheet */}
        <Modal
          isOpen={isMobileFiltersOpen}
          onClose={() => setIsMobileFiltersOpen(false)}
          title="Filter Leads"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left min-h-[40px] ${
                      datePreset === preset.id
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {datePreset === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From</label>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="w-full text-base sm:text-xs bg-white border border-slate-200 rounded-lg p-2 min-h-[44px] sm:min-h-0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To</label>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="w-full text-base sm:text-xs bg-white border border-slate-200 rounded-lg p-2 min-h-[44px] sm:min-h-0"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Call Outcome</label>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 min-h-[44px] sm:min-h-0"
              >
                <option value="">All Call Outcomes</option>
                {allOutcomes.map((oc) => (
                  <option key={oc} value={oc}>
                    {oc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 min-h-[44px] sm:min-h-0"
              >
                <option value="">All Priorities</option>
                {allPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p} Priority
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPipelineFilter('ALL');
                  setOutcomeFilter('');
                  setPriorityFilter('');
                  setDatePreset('ALL');
                  setCustomFromDate('');
                  setCustomToDate('');
                  setCurrentPage(1);
                  setIsMobileFiltersOpen(false);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl min-h-[44px]"
              >
                Clear All
              </button>
              <Button
                variant="primary"
                onClick={() => {
                  setCurrentPage(1);
                  setIsMobileFiltersOpen(false);
                }}
                className="min-h-[44px] px-6"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
