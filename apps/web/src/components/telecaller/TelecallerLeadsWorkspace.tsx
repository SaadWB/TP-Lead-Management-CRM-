'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Lead,
  normalizeCallOutcome,
  normalizePipelineStage,
  PIPELINE_STAGE_LIST,
  TELECALLER_CALL_OUTCOMES,
  Priority,
  isLeadClosedWon,
  isLeadOutOfQueue,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import {
  useSWRData,
  invalidateCache,
  updateCachedLead,
  patchCachedLead,
  beginLeadMutation,
  endLeadMutation,
} from '@/lib/apiCache';
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
  Search,
  Copy,
  Check,
  CheckSquare,
} from 'lucide-react';
import {
  formatDate,
  formatDateTime,
  getPriorityColor,
  getOutcomeColor,
  getStageColor,
  getPriorityLabel,
  toDatetimeLocalValue,
  toIsoFromDatetimeLocal,
} from '@/lib/utils';
import { localDateKey, addDaysToDateKey, dateKeyBounds } from '@/lib/dateUtils';
import { WhatsAppButton, WhatsAppIcon } from '@/components/leads/WhatsAppButton';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FollowUpDatePicker } from '@/components/leads/FollowUpDatePicker';
import { DateTimePicker } from '@/components/leads/DateTimePicker';

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
const FollowUpCompletionModal = dynamic(
  () => import('@/components/leads/FollowUpCompletionModal').then((m) => m.FollowUpCompletionModal),
  { ssr: false }
);

const DEFAULT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export type LeadsWorkspaceMode = 'all' | 'today';

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

type DateFieldId = 'createdAt' | 'updatedAt' | 'nextFollowUpDate';
type SortField = 'createdAt' | 'updatedAt' | 'nextFollowUpDate' | 'companyName';

const DATE_FIELDS: { id: DateFieldId; label: string }[] = [
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

/** Today's Work: the Next Follow-up Date filter is mandatory, so there is no "All Time" here. */
const FOLLOW_UP_PRESETS = [
  { id: 'DUE_NOW', label: 'Overdue + Today' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'TODAY', label: 'Today' },
  { id: 'TOMORROW', label: 'Tomorrow' },
  { id: 'NEXT_3_DAYS', label: 'Next 3 Days' },
  { id: 'NEXT_7_DAYS', label: 'Next 7 Days' },
  { id: 'ALL_SCHEDULED', label: 'All Scheduled' },
  { id: 'CUSTOM', label: 'Custom Range...' },
];
const DEFAULT_FOLLOW_UP_PRESET = 'DUE_NOW';

/**
 * Inclusive LOCAL date range (YYYY-MM-DD) for a preset. Empty string = open-ended.
 * The old version used toISOString(), i.e. UTC dates: in India "This Month" started on the
 * last day of the previous month, "Today" was yesterday before 05:30 AM, etc.
 */
export function getPresetRange(preset: string): { fromDate: string; toDate: string } {
  const today = localDateKey(new Date());
  const [y, m] = today.split('-').map((p) => parseInt(p, 10));
  switch (preset) {
    case 'TODAY':
      return { fromDate: today, toDate: today };
    case 'YESTERDAY': {
      const yd = addDaysToDateKey(today, -1);
      return { fromDate: yd, toDate: yd };
    }
    case 'LAST_7_DAYS':
      return { fromDate: addDaysToDateKey(today, -6), toDate: today };
    case 'THIS_MONTH':
      return { fromDate: localDateKey(new Date(y, m - 1, 1)), toDate: today };
    case 'LAST_MONTH':
      return { fromDate: localDateKey(new Date(y, m - 2, 1)), toDate: localDateKey(new Date(y, m - 1, 0)) };
    case 'LAST_3_MONTHS':
      return { fromDate: localDateKey(new Date(y, m - 4, 1)), toDate: today };
    // Follow-up presets
    case 'DUE_NOW':
      return { fromDate: '', toDate: today };
    case 'OVERDUE':
      return { fromDate: '', toDate: addDaysToDateKey(today, -1) };
    case 'TOMORROW': {
      const t = addDaysToDateKey(today, 1);
      return { fromDate: t, toDate: t };
    }
    case 'NEXT_3_DAYS':
      return { fromDate: today, toDate: addDaysToDateKey(today, 3) };
    case 'NEXT_7_DAYS':
      return { fromDate: today, toDate: addDaysToDateKey(today, 7) };
    default:
      return { fromDate: '', toDate: '' };
  }
}

function readSavedFilters(storageKey: string): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export interface TelecallerLeadsWorkspaceProps {
  mode?: LeadsWorkspaceMode;
  /** Rendered above the search bar (e.g. the performance panel on Today's Work) */
  topSlot?: React.ReactNode;
}

export function TelecallerLeadsWorkspace({ mode = 'all', topSlot }: TelecallerLeadsWorkspaceProps) {
  const isTodayMode = mode === 'today';
  const storageKey = isTodayMode ? 'telecaller_todaywork_filters' : 'telecaller_myleads_filters';
  const presets = isTodayMode ? FOLLOW_UP_PRESETS : DATE_PRESETS;
  const defaultPreset = isTodayMode ? DEFAULT_FOLLOW_UP_PRESET : 'ALL';

  // Load initial filter state from localStorage if available
  const initialFilters = useMemo(() => readSavedFilters(storageKey), [storageKey]);

  // Search and Filters state
  const [searchTerm, setSearchTerm] = useState<string>(initialFilters?.searchTerm || '');
  const [pipelineFilter, setPipelineFilter] = useState<string>(initialFilters?.pipelineFilter || 'ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>(initialFilters?.outcomeFilter || '');
  const [priorityFilter, setPriorityFilter] = useState<string>(initialFilters?.priorityFilter || '');

  // Date filter. In Today's Work the field is locked to Next Follow-up Date (mandatory filter).
  const [dateFieldState, setDateField] = useState<DateFieldId>(initialFilters?.dateField || 'createdAt');
  const dateField: DateFieldId = isTodayMode ? 'nextFollowUpDate' : dateFieldState;
  const [datePreset, setDatePreset] = useState<string>(() => {
    const saved = initialFilters?.datePreset;
    return saved && presets.some((p) => p.id === saved) ? saved : defaultPreset;
  });
  const [customFromDate, setCustomFromDate] = useState<string>(initialFilters?.customFromDate || '');
  const [customToDate, setCustomToDate] = useState<string>(initialFilters?.customToDate || '');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  // Keep rows you just edited visible until you change a filter (prevents rows vanishing mid-edit)
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set());

  // Sorting: My Leads keeps sheet order; Today's Work = nearest follow-up first
  const [sortBy, setSortBy] = useState<SortField>(
    initialFilters?.sortBy || (isTodayMode ? 'nextFollowUpDate' : 'createdAt')
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialFilters?.sortOrder || 'asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(150);

  // Undo Toast state (7-second undo window)
  const [undoToast, setUndoToast] = useState<UndoState | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom options state
  const [customPriorities, setCustomPriorities] = useState<string[]>([]);
  const [customOutcomes, setCustomOutcomes] = useState<string[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>(() =>
    Array.from(new Set([...PIPELINE_STAGE_LIST, 'Closed Won']))
  );
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
  const [completionTarget, setCompletionTarget] = useState<{ lead: Lead; mode: 'CLOSED' | 'NOT_CLOSED' } | null>(null);
  const [promptTarget, setPromptTarget] = useState<RequiredPromptTarget | null>(null);
  const [promptInputDate, setPromptInputDate] = useState<string>('');
  const [promptInputReason, setPromptInputReason] = useState<string>('');
  const [promptInputNextAction, setPromptInputNextAction] = useState<string>('');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Re-render every minute so "overdue" / "due now" highlighting stays correct through the day
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const copyPhoneToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

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

    if (oc) setOutcomeFilter(normalizeCallOutcome(oc) || oc);
    if (pl) setPipelineFilter(pl);
    if (pr) setPriorityFilter(pr);
    if (q) setSearchTerm(q);
    if (rg && presets.some((p) => p.id === rg)) setDatePreset(rg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Persist filters to localStorage (separately for My Leads and Today's Work)
  useEffect(() => {
    try {
      const state = {
        searchTerm,
        pipelineFilter,
        outcomeFilter,
        priorityFilter,
        dateField: dateFieldState,
        datePreset,
        customFromDate,
        customToDate,
        sortBy,
        sortOrder,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore localStorage quota errors
    }
  }, [
    storageKey,
    searchTerm,
    pipelineFilter,
    outcomeFilter,
    priorityFilter,
    dateFieldState,
    datePreset,
    customFromDate,
    customToDate,
    sortBy,
    sortOrder,
  ]);

  // Any filter change: back to page 1 and release pinned rows.
  // (Previously the date filter did not reset the page, so you could land on an empty page 3,
  // and pinned rows leaked into every other tab forever.)
  useEffect(() => {
    setCurrentPage(1);
    setRecentlyUpdatedIds((prev) => (prev.size ? new Set() : prev));
  }, [pipelineFilter, outcomeFilter, priorityFilter, searchTerm, datePreset, dateField, customFromDate, customToDate]);

  // Compute effective date range (local calendar days)
  const { fromDate, toDate } = useMemo(() => {
    if (datePreset === 'CUSTOM') {
      if (customFromDate && customToDate && customFromDate > customToDate) {
        return { fromDate: customToDate, toDate: customFromDate };
      }
      return { fromDate: customFromDate, toDate: customToDate };
    }
    return getPresetRange(datePreset);
    // nowTick: roll "today" over at midnight without a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customFromDate, customToDate, Math.floor(nowTick / 3600000)]);

  // Data source. Today's Work asks the server for every lead WITH a follow-up, nearest first,
  // so nothing is lost past the first N rows. The table only needs the lead row ("view=table").
  const queryParams = useMemo(
    () =>
      isTodayMode
        ? { limit: 5000, view: 'table', hasFollowUp: 'true', sortBy: 'nextFollowUpDate', sortOrder: 'asc' }
        : { limit: 5000, view: 'table' },
    [isTodayMode]
  );

  const { data: cachedLeads, loading: swrLoading, refresh: refreshLeads } = useSWRData<Lead[]>('/leads', queryParams);

  // Single source of truth = the shared cache. Optimistic edits are written into the cache
  // (patchCachedLead) and protected from stale background re-fetches, so a status you just
  // picked no longer flips back to the old value before the save completes.
  const leads: Lead[] = useMemo(() => cachedLeads || [], [cachedLeads]);

  useEffect(() => {
    fetchCustomOptions();
    const handleInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ prefix?: string }>;
      const prefix = customEvent.detail?.prefix;
      if (!prefix || prefix.startsWith('/options')) {
        fetchCustomOptions();
      }
    };
    window.addEventListener('crm:cache-invalidated', handleInvalidation);
    return () => {
      window.removeEventListener('crm:cache-invalidated', handleInvalidation);
    };
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

    try {
      const optRes = await api.get<{
        pipelineStages?: { name: string; isActive: boolean; order?: number }[];
        stages?: { name: string; isActive: boolean; order?: number }[];
      }>('/options');
      if (optRes.success && optRes.data) {
        const stages = optRes.data.pipelineStages || optRes.data.stages;
        if (stages && stages.length > 0) {
          const activeStages = stages
            .filter((s) => s.isActive)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((s) => s.name);
          const combined = Array.from(new Set([...activeStages, ...PIPELINE_STAGE_LIST, 'Closed Won']));
          setPipelineOptions(combined);
        }
      }
    } catch (err) {
      console.error('Error loading pipeline stage options:', err);
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

  /** Outcome options for one row: legacy values (e.g. "Callback Requested") are normalized, never shown as blank. */
  function outcomeOptionsFor(lead: Lead): { value: string; options: string[] } {
    const raw = lead.lastCallOutcome || '';
    const norm = raw ? normalizeCallOutcome(raw) : '';
    const value = norm && allOutcomes.includes(norm) ? norm : raw;
    const options = value && !allOutcomes.includes(value) ? [value, ...allOutcomes] : allOutcomes;
    return { value, options };
  }

  // Today's Work base set: open leads that have a follow-up scheduled
  const baseLeads = useMemo(() => {
    if (!isTodayMode) return leads;
    return leads.filter(
      (l) => (Boolean(l.nextFollowUpDate) && !isLeadOutOfQueue(l)) || recentlyUpdatedIds.has(l.id)
    );
  }, [leads, isTodayMode, recentlyUpdatedIds]);

  // Filter leads client-side for ultra-fast response
  const filteredLeads = useMemo(() => {
    const fromMs = fromDate ? dateKeyBounds(fromDate).startMs : null;
    const toMs = toDate ? dateKeyBounds(toDate).endMs : null;
    const dateFilterActive = isTodayMode ? datePreset !== 'ALL_SCHEDULED' : datePreset !== 'ALL';
    const q = searchTerm.toLowerCase().trim();

    return baseLeads.filter((lead) => {
      // 0. Search always applies (also to pinned rows)
      if (q) {
        const matches = [
          lead.companyName,
          lead.contactPerson,
          lead.alternateName,
          lead.phone,
          lead.alternatePhone,
          lead.email,
          lead.serviceProduct,
          lead.nextAction,
        ].some((v) => v && String(v).toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Rows edited a moment ago stay visible until a filter changes
      if (recentlyUpdatedIds.has(lead.id)) return true;

      // 1. Pipeline filter
      const won = isLeadClosedWon(lead);
      const normLeadPipeline = normalizePipelineStage(lead.pipelineStage);

      if (pipelineFilter === 'Closed Won') {
        if (!won && normLeadPipeline !== 'Closed Won' && lead.pipelineStage !== 'Closed Won') {
          return false;
        }
      } else if (pipelineFilter === 'ALL') {
        // Closed and Closed Won leads never appear in the running "All Leads" section.
        if (won || lead.pipelineStage === 'Closed' || normLeadPipeline === 'Closed' || normLeadPipeline === 'Closed Won') {
          return false;
        }
      } else {
        if (won) return false;
        if (normLeadPipeline !== pipelineFilter && lead.pipelineStage !== pipelineFilter) {
          return false;
        }
      }

      // 2. Outcome filter (compare normalized values so legacy outcome names still match)
      if (outcomeFilter && normalizeCallOutcome(lead.lastCallOutcome) !== normalizeCallOutcome(outcomeFilter)) {
        return false;
      }

      // 3. Priority filter (case-insensitive)
      if (priorityFilter && (lead.priority || '').toUpperCase() !== priorityFilter.toUpperCase()) {
        return false;
      }

      // 4. Date range check (local calendar days)
      if (dateFilterActive && (fromMs !== null || toMs !== null)) {
        let val: string | null | undefined;
        if (dateField === 'createdAt') val = lead.createdAt;
        else if (dateField === 'updatedAt') val = lead.lastActivityAt || lead.updatedAt;
        else val = lead.nextFollowUpDate;

        if (!val) return false;
        const time = new Date(val).getTime();
        if (isNaN(time)) return false;
        if (fromMs !== null && time < fromMs) return false;
        if (toMs !== null && time > toMs) return false;
      }

      return true;
    });
  }, [
    baseLeads,
    isTodayMode,
    pipelineFilter,
    outcomeFilter,
    priorityFilter,
    searchTerm,
    datePreset,
    dateField,
    fromDate,
    toDate,
    recentlyUpdatedIds,
  ]);

  // Sort with stable tie-breaker so inline edits never shuffle equal rows.
  // Leads without a follow-up date always go to the bottom when sorting by follow-up.
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    const timeOf = (v?: string | null) => (v ? new Date(v).getTime() : NaN);
    list.sort((a, b) => {
      if (sortBy === 'companyName') {
        const cmp = (a.companyName || '').toLowerCase().localeCompare((b.companyName || '').toLowerCase());
        return (sortOrder === 'asc' ? cmp : -cmp) || (a.id || '').localeCompare(b.id || '');
      }
      let valA: number;
      let valB: number;
      if (sortBy === 'nextFollowUpDate') {
        valA = timeOf(a.nextFollowUpDate);
        valB = timeOf(b.nextFollowUpDate);
        const aMissing = isNaN(valA);
        const bMissing = isNaN(valB);
        if (aMissing || bMissing) {
          if (aMissing && bMissing) return (a.id || '').localeCompare(b.id || '');
          return aMissing ? 1 : -1;
        }
      } else if (sortBy === 'updatedAt') {
        valA = timeOf(a.lastActivityAt || a.updatedAt || a.createdAt);
        valB = timeOf(b.lastActivityAt || b.updatedAt || b.createdAt);
      } else {
        valA = timeOf(a.createdAt);
        valB = timeOf(b.createdAt);
      }
      const diff = sortOrder === 'asc' ? valA - valB : valB - valA;
      if (diff !== 0 && !isNaN(diff)) return diff;
      return (a.id || '').localeCompare(b.id || '');
    });
    return list;
  }, [filteredLeads, sortBy, sortOrder]);

  // Stage count chips (counted on the same base set the table uses)
  const stageCounts = useMemo(() => {
    const countable = isTodayMode
      ? baseLeads.filter((l) => {
          if (!l.nextFollowUpDate) return false;
          const active = datePreset !== 'ALL_SCHEDULED';
          if (!active) return true;
          const t = new Date(l.nextFollowUpDate).getTime();
          if (fromDate && t < dateKeyBounds(fromDate).startMs) return false;
          if (toDate && t > dateKeyBounds(toDate).endMs) return false;
          return true;
        })
      : baseLeads;
    const nonClosedCount = countable.filter(
      (l) => !isLeadClosedWon(l) && l.pipelineStage !== 'Closed' && normalizePipelineStage(l.pipelineStage) !== 'Closed'
    ).length;
    const counts: Record<string, number> = { ALL: nonClosedCount };
    pipelineOptions.forEach((st) => {
      counts[st] = 0;
    });
    counts['Closed Won'] = countable.filter(isLeadClosedWon).length;

    countable.forEach((l) => {
      if (isLeadClosedWon(l)) return;
      const norm = normalizePipelineStage(l.pipelineStage);
      if (counts[norm] !== undefined) {
        counts[norm]++;
      } else if (counts[l.pipelineStage] !== undefined) {
        counts[l.pipelineStage]++;
      }
    });
    return counts;
  }, [baseLeads, pipelineOptions, isTodayMode, datePreset, fromDate, toDate]);

  // Today's Work quick counters
  const followUpBuckets = useMemo(() => {
    if (!isTodayMode) return null;
    const today = localDateKey(new Date(nowTick));
    const { startMs, endMs } = dateKeyBounds(today);
    let overdue = 0;
    let dueToday = 0;
    let dueLaterToday = 0;
    baseLeads.forEach((l) => {
      if (!l.nextFollowUpDate || isLeadOutOfQueue(l)) return;
      const t = new Date(l.nextFollowUpDate).getTime();
      if (t < startMs) overdue++;
      else if (t <= endMs) {
        dueToday++;
        if (t > nowTick) dueLaterToday++;
      }
    });
    return { overdue, dueToday, dueLaterToday };
  }, [baseLeads, isTodayMode, nowTick]);

  // Pagination calculation
  const totalItems = sortedLeads.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const paginatedLeads = useMemo(() => {
    if (pageSize === 0) return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // Sorting header toggle - default to ascending order according to date
  function handleHeaderSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  function resetAllFilters() {
    setPipelineFilter('ALL');
    setOutcomeFilter('');
    setPriorityFilter('');
    setDatePreset(defaultPreset);
    setCustomFromDate('');
    setCustomToDate('');
    setSearchTerm('');
    setCurrentPage(1);
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

  function pinRow(leadId: string) {
    setRecentlyUpdatedIds((prev) => (prev.has(leadId) ? prev : new Set([...prev, leadId])));
  }

  /**
   * Every inline edit goes through here:
   *  1. optimistic patch in the shared cache (all lists + drawer),
   *  2. the lead is marked "saving" so background re-fetches cannot overwrite it,
   *  3. on success the server row replaces the optimistic one, on failure the old row is restored.
   */
  async function saveLead(
    lead: Lead,
    optimistic: Partial<Lead>,
    request: () => Promise<{ success: boolean; data?: Lead; message?: string }>,
    messages: { success: string; undo?: string; failure: string }
  ): Promise<Lead | null> {
    const previousLead = { ...lead };
    pinRow(lead.id);
    beginLeadMutation(lead.id);
    if (Object.keys(optimistic).length > 0) patchCachedLead(lead.id, optimistic);
    try {
      const res = await request();
      if (!res.success || !res.data) throw new Error(res.message || messages.failure);
      updateCachedLead(res.data);
      invalidateCache('/reports');
      triggerSaveNotice(messages.success);
      if (messages.undo) triggerUndo(previousLead, messages.undo);
      return res.data;
    } catch (err: any) {
      updateCachedLead(previousLead);
      alert(err?.message || messages.failure);
      return null;
    } finally {
      endLeadMutation(lead.id);
    }
  }

  // Revert via Undo
  async function handleUndo() {
    if (!undoToast) return;
    const { previousLead } = undoToast;
    setUndoToast(null);
    const current = leads.find((l) => l.id === previousLead.id) || previousLead;
    await saveLead(
      current,
      {
        pipelineStage: previousLead.pipelineStage,
        lastCallOutcome: previousLead.lastCallOutcome,
        priority: previousLead.priority,
        nextAction: previousLead.nextAction,
        nextFollowUpDate: previousLead.nextFollowUpDate,
        notes: previousLead.notes,
      },
      () =>
        api.patch<Lead>(`/leads/${previousLead.id}`, {
          pipelineStage: previousLead.pipelineStage,
          lastCallOutcome: previousLead.lastCallOutcome,
          priority: previousLead.priority,
          nextAction: previousLead.nextAction,
          nextFollowUpDate: previousLead.nextFollowUpDate,
          notes: previousLead.notes,
        }),
      { success: 'Reverted successfully', failure: 'Failed to undo action' }
    );
  }

  // Inline Pipeline Change
  async function handlePipelineChange(lead: Lead, newStage: string) {
    if (normalizePipelineStage(lead.pipelineStage) === newStage || lead.pipelineStage === newStage) return;
    const closing = newStage === 'Closed' || newStage === 'Closed Won';
    await saveLead(
      lead,
      { pipelineStage: newStage as any, ...(closing ? { nextFollowUpDate: null } : {}) },
      () =>
        api.post<Lead>(`/leads/${lead.id}/stage`, {
          pipelineStage: newStage,
          lastCallOutcome: lead.lastCallOutcome || null,
        }),
      {
        success: `Pipeline changed to "${newStage}"`,
        undo: `Changed pipeline of ${lead.companyName} to ${newStage}`,
        failure: 'Failed to update pipeline stage',
      }
    );
  }

  // Inline Outcome Change
  async function handleOutcomeChange(lead: Lead, newOutcome: string) {
    if (!newOutcome || normalizeCallOutcome(lead.lastCallOutcome) === newOutcome) return;
    const currentPipeline = lead.pipelineStage;

    // 1. Date & Time required for Call Back Later and Demo Scheduled
    if (newOutcome === 'Call Back Later' || newOutcome === 'Demo Scheduled') {
      setPromptTarget({
        lead,
        newOutcome,
        suggestedPipeline: currentPipeline,
        type: 'DATE_TIME',
      });
      // Only reuse the existing follow-up if it is still in the future
      const existing = lead.nextFollowUpDate && new Date(lead.nextFollowUpDate).getTime() > Date.now()
        ? toDatetimeLocalValue(lead.nextFollowUpDate)
        : '';
      setPromptInputDate(existing);
      setPromptInputNextAction(lead.nextAction || (newOutcome === 'Demo Scheduled' ? 'Conduct software demo' : 'Call back prospect'));
      return;
    }

    // 2. Follow-up date required for follow-up outcomes
    if (['Demo Interested', 'Details Requested', 'Demo Completed', 'Decision Pending'].includes(newOutcome)) {
      if (!lead.nextFollowUpDate || new Date(lead.nextFollowUpDate).getTime() < Date.now()) {
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

  // Execute Outcome & Pipeline update
  async function executeOutcomeUpdate(
    lead: Lead,
    newOutcome: string,
    targetPipeline: string,
    extraPayload: { nextFollowUpDate?: string; nextAction?: string; notes?: string } = {}
  ) {
    const closes = newOutcome === 'Not Interested' || newOutcome === 'Wrong Number' || targetPipeline === 'Closed';
    const updated = await saveLead(
      lead,
      {
        lastCallOutcome: newOutcome,
        pipelineStage: (targetPipeline || lead.pipelineStage) as any,
        ...(closes ? { nextFollowUpDate: null } : {}),
        ...(extraPayload.nextFollowUpDate !== undefined ? { nextFollowUpDate: extraPayload.nextFollowUpDate } : {}),
        ...(extraPayload.nextAction !== undefined ? { nextAction: extraPayload.nextAction } : {}),
      },
      () =>
        api.post<Lead>(`/leads/${lead.id}/stage`, {
          pipelineStage: targetPipeline,
          lastCallOutcome: newOutcome,
          ...extraPayload,
        }),
      {
        success: `Saved: ${newOutcome}`,
        undo: `Logged outcome "${newOutcome}" for ${lead.companyName}`,
        failure: 'Failed to update call outcome',
      }
    );
    if (updated && newOutcome === 'Details Requested') {
      setWhatsAppPromptLead(updated);
    }
  }

  // Inline Next Action Change
  async function handleNextActionBlur(lead: Lead, val: string) {
    if ((lead.nextAction || '') === val) return;
    await saveLead(lead, { nextAction: val }, () => api.patch<Lead>(`/leads/${lead.id}`, { nextAction: val }), {
      success: 'Next Action saved',
      undo: `Updated next action for ${lead.companyName}`,
      failure: 'Failed to save next action',
    });
  }

  // Inline Next Follow-up Date Change
  async function handleFollowUpDateChange(lead: Lead, val: string | null) {
    const nextDate = val ? (val.endsWith('Z') ? val : toIsoFromDatetimeLocal(val)) : null;
    const prev = lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString() : null;
    if (prev === nextDate) return;
    await saveLead(
      lead,
      { nextFollowUpDate: nextDate },
      () => api.patch<Lead>(`/leads/${lead.id}`, { nextFollowUpDate: nextDate }),
      {
        success: nextDate ? `Follow-up set for ${formatDateTime(nextDate)}` : 'Follow-up cleared',
        undo: `Updated follow-up for ${lead.companyName}`,
        failure: 'Failed to save follow-up date',
      }
    );
  }

  // Inline Priority Change
  async function handlePriorityChange(lead: Lead, newPriority: Priority) {
    if ((lead.priority || '').toUpperCase() === newPriority) return;
    await saveLead(
      lead,
      { priority: newPriority },
      () => api.patch<Lead>(`/leads/${lead.id}`, { priority: newPriority }),
      {
        success: `Priority: ${getPriorityLabel(newPriority)}`,
        undo: `Changed priority of ${lead.companyName}`,
        failure: 'Failed to update priority',
      }
    );
  }

  // Inline Notes Change
  async function handleNotesBlur(lead: Lead, val: string) {
    if ((lead.notes || '') === val) return;
    await saveLead(lead, { notes: val }, () => api.patch<Lead>(`/leads/${lead.id}`, { notes: val }), {
      success: 'Notes saved',
      undo: `Updated notes for ${lead.companyName}`,
      failure: 'Failed to save notes',
    });
  }

  // Confirm Prompt Modal
  async function handleConfirmPrompt() {
    if (!promptTarget) return;
    const { lead, newOutcome, type } = promptTarget;

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

      setPromptTarget(null);
      setPromptInputReason('');

      await executeOutcomeUpdate(lead, newOutcome, 'Closed', {
        notes: closingNotes,
      });
      return;
    }

    setPromptTarget(null);
  }

  function handleCompletionSuccess(updated: Lead) {
    pinRow(updated.id);
    updateCachedLead(updated);
    invalidateCache('/reports');
    triggerSaveNotice(
      completionTarget?.mode === 'CLOSED'
        ? `Follow-up closed: ${updated.companyName}`
        : `Rescheduled ${updated.companyName} to ${formatDateTime(updated.nextFollowUpDate)}`
    );
    setCompletionTarget(null);
  }

  // Pipeline Badge Colors for Dropdown
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

  /** Follow-up timing of a row relative to now (for highlighting). */
  function followUpState(lead: Lead): 'OVERDUE' | 'DUE_NOW' | 'TODAY' | 'NONE' {
    if (!lead.nextFollowUpDate) return 'NONE';
    const t = new Date(lead.nextFollowUpDate).getTime();
    const { startMs, endMs } = dateKeyBounds(localDateKey(new Date(nowTick)));
    if (t < startMs) return 'OVERDUE';
    if (t <= nowTick) return 'DUE_NOW';
    if (t <= endMs) return 'TODAY';
    return 'NONE';
  }

  const dateFilterActive = isTodayMode ? datePreset !== 'ALL_SCHEDULED' : datePreset !== 'ALL';

  // Label for active date filter chip
  const activeDateLabel = useMemo(() => {
    if (!isTodayMode && datePreset === 'ALL') return null;
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

    const presetObj = presets.find((p) => p.id === datePreset);
    return `${presetObj?.label || datePreset} (${fieldLabel})`;
  }, [isTodayMode, datePreset, dateField, customFromDate, customToDate, presets]);

  return (
    <AppLayout
      title={isTodayMode ? "Today's Work" : 'My Leads'}
      subtitle={
        isTodayMode
          ? 'Every lead with a scheduled follow-up, nearest date & time first. Overdue rows are highlighted.'
          : 'Complete table directory with instant inline editing, date filters, and multi-stage tracking.'
      }
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={isTodayMode ? 'Search follow-ups by company, contact, phone...' : 'Search company, contact person, phone, email...'}
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

        {topSlot}

        {/* Today's Work: follow-up timing summary (one click = filter) */}
        {isTodayMode && followUpBuckets && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDatePreset('OVERDUE')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                followUpBuckets.overdue > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              Overdue: {followUpBuckets.overdue}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('TODAY')}
              className="px-3 py-1.5 rounded-full text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
            >
              Due today: {followUpBuckets.dueToday}
              {followUpBuckets.dueLaterToday > 0 && (
                <span className="font-semibold text-amber-700"> ({followUpBuckets.dueLaterToday} later today)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('TOMORROW')}
              className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Tomorrow →
            </button>
          </div>
        )}

        {/* Fast Leads Search Bar (Prominently visible on desktop & mobile) */}
        <div className="relative bg-white rounded-xl border border-slate-200/90 shadow-soft-xs p-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Fast Search leads: Company Name, Phone, Contact Person, Alternate Phone..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchTerm && (
            <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg shrink-0">
              {filteredLeads.length} leads found
            </span>
          )}
        </div>

        {/* 7 Filter Chips Above Table (Counts for All + 6 Playbook Stages) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin -mx-2 px-2 sm:mx-0 sm:px-0">
          <button
            onClick={() => {
              setPipelineFilter('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${pipelineFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-soft-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            <span>{isTodayMode ? 'All Follow-ups' : 'All Leads'}</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${pipelineFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}
            >
              {stageCounts['ALL'] || 0}
            </span>
          </button>

          {pipelineOptions.map((stageName) => {
            const count = stageCounts[stageName] || 0;
            const isSelected = pipelineFilter === stageName;
            return (
              <button
                key={stageName}
                onClick={() => {
                  setPipelineFilter(isSelected ? 'ALL' : stageName);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border min-h-[38px] ${isSelected
                  ? 'bg-sky-600 text-white border-sky-600 shadow-soft-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <span>{stageName}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-sky-800 text-white' : 'bg-slate-100 text-slate-600'
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
              {Boolean(outcomeFilter || priorityFilter || datePreset !== defaultPreset) ? `(Active)` : ''}
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
                className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${dateFilterActive
                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
              >
                <Calendar className="h-3.5 w-3.5 text-sky-600" />
                <span>{isTodayMode ? 'Next Follow-up:' : 'Date Filter:'}</span>
                <span className="font-extrabold text-sky-700">
                  {presets.find((p) => p.id === datePreset)?.label || 'All Time'}
                </span>
              </button>

              {isDateMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-soft-xl p-3 w-72 space-y-3 animate-fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Filter By Date Field:
                    </label>
                    {isTodayMode ? (
                      <div className="w-full text-xs bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 font-bold text-sky-800">
                        Next Follow-up Date (required)
                      </div>
                    ) : (
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
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Quick Presets:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setDatePreset(preset.id);
                            if (preset.id !== 'CUSTOM') {
                              setIsDateMenuOpen(false);
                            }
                          }}
                          className={`text-left text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${datePreset === preset.id
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
                {datePreset !== defaultPreset && (
                <button
                  onClick={() => {
                    setDatePreset(defaultPreset);
                    setCustomFromDate('');
                    setCustomToDate('');
                  }}
                  className="hover:text-sky-950 p-0.5 rounded-full hover:bg-sky-100 cursor-pointer"
                  title={isTodayMode ? 'Back to Overdue + Today' : 'Clear date filter'}
                >
                  <X className="h-3 w-3" />
                </button>
                )}
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
            {(pipelineFilter !== 'ALL' || outcomeFilter || priorityFilter || datePreset !== defaultPreset || searchTerm) && (
              <button
                onClick={resetAllFilters}
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
              const fuState = followUpState(lead);

              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border shadow-soft-sm p-4 space-y-3 ${
                    fuState === 'OVERDUE'
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : fuState === 'DUE_NOW'
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : 'border-slate-200'
                  }`}
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
                      value={(lead.priority || 'MEDIUM').toUpperCase()}
                      onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border shrink-0 ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                    >
                      {allPriorities.map((p) => {
                        const pMeta = getPriorityColor(p);
                        return (
                          <option key={p} value={p} className={`font-bold ${pMeta.text} bg-white`}>
                            {getPriorityLabel(p)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Phone Row with Click-to-Call + WhatsApp */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 truncate min-w-0">
                      <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
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
                        value={normalizePipelineStage(lead.pipelineStage)}
                        onChange={(e) => handlePipelineChange(lead, e.target.value)}
                        className={`w-full text-xs font-bold rounded-lg px-2.5 py-2 border cursor-pointer ${getPipelineBadgeColor(
                          lead.pipelineStage
                        )}`}
                      >
                        {pipelineOptions.map((stage) => {
                          const sMeta = getStageColor(stage);
                          return (
                            <option key={stage} value={stage} className={`font-semibold ${sMeta.text} bg-white`}>
                              {stage}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Last Call Outcome
                      </label>
                      {(() => {
                        const ocMeta = getOutcomeColor(lead.lastCallOutcome);
                        const oc = outcomeOptionsFor(lead);
                        return (
                          <select
                            value={oc.value}
                            onChange={(e) => handleOutcomeChange(lead, e.target.value)}
                            className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border cursor-pointer ${lead.lastCallOutcome
                              ? `${ocMeta.bg} ${ocMeta.text} ${ocMeta.border}`
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                          >
                            <option value="" className="bg-white text-slate-500">-- Select Outcome --</option>
                            {oc.options.map((o) => {
                              const oMeta = getOutcomeColor(o);
                              return (
                                <option key={o} value={o} className={`font-semibold ${oMeta.text} bg-white`}>
                                  {o}
                                </option>
                              );
                            })}
                          </select>
                        );
                      })()}
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
                          key={`m_action_${lead.id}_${lead.nextAction || ''}`}
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
                        <FollowUpDatePicker
                          value={lead.nextFollowUpDate}
                          onChange={(val) => handleFollowUpDateChange(lead, val)}
                          isMissing={isMissingFollowUp}
                          isOverdue={fuState === 'OVERDUE' || fuState === 'DUE_NOW'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lead Source */}
                  {lead.leadSource && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 font-semibold text-[11px]">Source:</span>
                      <span className="font-bold text-slate-800 truncate">{lead.leadSource}</span>
                      {lead.leadSource === 'Other' && lead.leadSourceOther && (
                        <span className="text-slate-500 text-[11px] truncate">({lead.leadSourceOther})</span>
                      )}
                    </div>
                  )}

                  {isTodayMode && (
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setActiveCallLead(lead)}
                        className="px-2 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold min-h-[38px] cursor-pointer"
                      >
                        Log Call
                      </button>
                      <button
                        onClick={() => setCompletionTarget({ lead, mode: 'CLOSED' })}
                        className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold min-h-[38px] cursor-pointer"
                      >
                        Done – Close
                      </button>
                      <button
                        onClick={() => setCompletionTarget({ lead, mode: 'NOT_CLOSED' })}
                        className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold min-h-[38px] cursor-pointer"
                      >
                        Not Closed
                      </button>
                    </div>
                  )}

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
            <table className="w-full text-left text-xs border-collapse table-fixed" style={{ minWidth: 1978 }}>
              {/* Rigid Column Groups for Pixel-Perfect Row Alignment */}
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 120 }} />
              </colgroup>

              {/* Sticky Table Header */}
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-soft-xs">
                <tr>
                  {/* Sticky Column 1: # */}
                  <th className="sticky left-0 z-30 bg-slate-900 p-3 text-center border-r border-slate-800">
                    #
                  </th>

                  {/* Sticky Column 2: Company & Contact */}
                  <th
                    onClick={() => handleHeaderSort('companyName')}
                    className="sticky left-[48px] z-30 bg-slate-900 p-3 border-r border-slate-800 cursor-pointer hover:text-white"
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

                  {/* Sticky Column 3: Phone (Fixed like company column per Requirement 4) */}
                  <th className="sticky left-[308px] z-30 bg-slate-900 p-3 border-r border-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                    Phone
                  </th>

                  {/* Priority */}
                  <th className="p-3">Priority</th>

                  {/* Pipeline Status (Dropdown) */}
                  <th className="p-3">Pipeline Status</th>

                  {/* Last Call Outcome (Dropdown) */}
                  <th className="p-3">Last Call Outcome</th>

                  {/* Next Action (Editable) */}
                  <th className="p-3">Next Action</th>

                  {/* Next Follow-up (Editable) */}
                  <th
                    onClick={() => handleHeaderSort('nextFollowUpDate')}
                    className="p-3 cursor-pointer hover:text-white"
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
                    className="p-3 cursor-pointer hover:text-white"
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
                  <th className="p-3">Notes</th>

                  {/* Lead Source (Read-only) */}
                  <th className="p-3">Lead Source</th>

                  {/* Action Buttons */}
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {swrLoading && leads.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="sticky left-0 z-10 bg-white p-3 text-center border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-6 mx-auto" /></td>
                      <td className="sticky left-[48px] z-10 bg-white p-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-40 mb-1" /><div className="h-3 bg-slate-100 rounded w-24" /></td>
                      <td className="sticky left-[308px] z-10 bg-white p-3 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                      <td className="p-3"><div className="h-6 bg-slate-200 rounded w-16" /></td>
                      <td className="p-3"><div className="h-7 bg-slate-200 rounded w-28" /></td>
                      <td className="p-3"><div className="h-7 bg-slate-200 rounded w-32" /></td>
                      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                      <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                      <td className="p-3 text-center"><div className="h-6 bg-slate-200 rounded w-16 mx-auto" /></td>
                    </tr>
                  ))
                ) : paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-slate-300" />
                        <span className="font-bold text-sm text-slate-700">
                          {isTodayMode ? 'No follow-ups in this range' : 'No leads match current filters'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {isTodayMode
                            ? 'Nothing scheduled here. Try "Next 7 Days" or "All Scheduled".'
                            : 'Try adjusting the search query, date filter, or pipeline chips.'}
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
                    const fuState = followUpState(lead);
                    const isOverdue = fuState === 'OVERDUE' || fuState === 'DUE_NOW';
                    const normalizedStage = normalizePipelineStage(lead.pipelineStage);

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors group cursor-default ${
                          isTodayMode && fuState === 'OVERDUE'
                            ? 'bg-rose-50/40 hover:bg-rose-50/80'
                            : isTodayMode && fuState === 'DUE_NOW'
                              ? 'bg-amber-50/40 hover:bg-amber-50/80'
                              : 'hover:bg-slate-50/80'
                        }`}
                        onClick={() => {
                          setSelectedLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {/* Sticky Column 1: # */}
                        <td
                          className={`sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 p-3 text-center font-bold border-r border-slate-100 select-none ${
                            isTodayMode && fuState === 'OVERDUE'
                              ? 'text-rose-600 shadow-[inset_4px_0_0_0_rgb(244,63,94)]'
                              : isTodayMode && fuState === 'DUE_NOW'
                                ? 'text-amber-600 shadow-[inset_4px_0_0_0_rgb(245,158,11)]'
                                : 'text-slate-400'
                          }`}
                        >
                          {rowNumber}
                        </td>

                        {/* Sticky Column 2: Company & Contact */}
                        <td className="sticky left-[48px] z-10 bg-white group-hover:bg-slate-50/90 p-3 border-r border-slate-100">
                          <div className="flex flex-col min-w-0">
                            <span
                              className="font-bold text-slate-900 truncate hover:text-sky-600 transition-colors cursor-pointer"
                              title={lead.companyName}
                            >
                              {lead.companyName || 'Unnamed Lead'}
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

                        {/* Sticky Column 3: Phone (Stacked primary & alternate numbers + single-click copy) */}
                        <td className="sticky left-[308px] z-10 bg-white group-hover:bg-slate-50/90 py-2 px-2.5 whitespace-nowrap border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1 min-w-0">
                            {/* Primary Phone */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <a
                                href={lead.phone ? `tel:${lead.phone}` : undefined}
                                className="text-emerald-700 font-bold hover:underline flex items-center gap-1.5 text-[13px] tracking-wide font-mono truncate"
                                title={lead.phone ? `Call ${lead.phone}` : undefined}
                              >
                                <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{lead.phone || 'No Phone'}</span>
                              </a>
                              {lead.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => copyPhoneToClipboard(lead.phone, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                  title="Copy phone number"
                                >
                                  {copiedPhone === lead.phone ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Alternate Phone (Stacked upar niche) */}
                            {lead.alternatePhone && (
                              <div className="flex items-center gap-1.5 min-w-0 border-t border-slate-100 pt-0.5">
                                <a
                                  href={`tel:${lead.alternatePhone}`}
                                  className="text-purple-700 font-semibold hover:underline flex items-center gap-1 text-xs font-mono truncate"
                                  title={`Call alternate: ${lead.alternatePhone}`}
                                >
                                  <Phone className="h-3 w-3 text-purple-600 shrink-0" />
                                  <span className="truncate">{lead.alternatePhone}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => copyPhoneToClipboard(lead.alternatePhone!, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                  title="Copy alternate phone"
                                >
                                  {copiedPhone === lead.alternatePhone ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Priority Dropdown (Cold, Warm, Hot, Urgent) */}
                        <td className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={(lead.priority || 'MEDIUM').toUpperCase()}
                            onChange={(e) => handlePriorityChange(lead, e.target.value as Priority)}
                            className={`w-full text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {allPriorities.map((p) => {
                              const pMeta = getPriorityColor(p);
                              return (
                                <option key={p} value={p} className={`font-bold ${pMeta.text} bg-white`}>
                                  {getPriorityLabel(p)}
                                </option>
                              );
                            })}
                          </select>
                        </td>

                        {/* Pipeline Status Dropdown */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={normalizedStage}
                            onChange={(e) => handlePipelineChange(lead, e.target.value)}
                            className={`w-full text-xs font-bold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs transition-colors ${getPipelineBadgeColor(
                              normalizedStage
                            )}`}
                          >
                            {pipelineOptions.map((stage) => {
                              const sMeta = getStageColor(stage);
                              return (
                                <option key={stage} value={stage} className={`font-semibold ${sMeta.text} bg-white`}>
                                  {stage}
                                </option>
                              );
                            })}
                          </select>
                        </td>

                        {/* Last Call Outcome Dropdown */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const ocMeta = getOutcomeColor(lead.lastCallOutcome);
                            const oc = outcomeOptionsFor(lead);
                            return (
                              <select
                                value={oc.value}
                                onChange={(e) => handleOutcomeChange(lead, e.target.value)}
                                className={`w-full text-xs font-semibold rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs ${lead.lastCallOutcome
                                  ? `${ocMeta.bg} ${ocMeta.text} ${ocMeta.border}`
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                              >
                                <option value="" className="bg-white text-slate-500">-- Select Outcome --</option>
                                {oc.options.map((o) => {
                                  const oMeta = getOutcomeColor(o);
                                  return (
                                    <option key={o} value={o} className={`font-semibold ${oMeta.text} bg-white`}>
                                      {o}
                                    </option>
                                  );
                                })}
                              </select>
                            );
                          })()}
                        </td>

                        {/* Next Action (Editable with Missing warning) */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <input
                              key={`action_${lead.id}_${lead.nextAction || ''}`}
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
                        <td className="p-3 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                          <FollowUpDatePicker
                            value={lead.nextFollowUpDate}
                            onChange={(val) => handleFollowUpDateChange(lead, val)}
                            compact
                            isMissing={isMissingFollowUp}
                            isOverdue={isOverdue}
                          />
                        </td>

                        {/* Last Updated */}
                        <td className="p-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDateTime(lead.lastActivityAt || lead.updatedAt)}
                        </td>

                        {/* Notes (Editable) */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            key={`notes_${lead.id}_${lead.notes || ''}`}
                            type="text"
                            defaultValue={lead.notes || ''}
                            onBlur={(e) => handleNotesBlur(lead, e.target.value)}
                            placeholder="Add brief note..."
                            className="w-full text-xs bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>

                        {/* Lead Source (Read-only) */}
                        <td className="p-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                          {lead.leadSource ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 truncate max-w-full"
                              title={lead.leadSource === 'Other' && lead.leadSourceOther ? `Other: ${lead.leadSourceOther}` : lead.leadSource}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                              <span className="truncate">{lead.leadSource}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic text-xs">-</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {lead.phone && (
                              <>
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
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
                                  onClick={() => setActiveCallLead(lead)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  title="Log Call Outcome"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {isTodayMode && (
                              <>
                                <button
                                  onClick={() => setCompletionTarget({ lead, mode: 'CLOSED' })}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                                  title="Follow-up done – close lead"
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setCompletionTarget({ lead, mode: 'NOT_CLOSED' })}
                                  className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                                  title="Not closed – add note & reschedule"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
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
                <option value={150}>150 (Default)</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
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
                  <DateTimePicker
                    label="Date & Time (Cannot be in the past)"
                    required
                    value={promptInputDate}
                    onChange={(val) => setPromptInputDate(val)}
                  />
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
          initialLead={leads.find((l) => l.id === selectedLeadId) || null}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedLeadId(null);
          }}
          onLeadUpdated={(updated) => {
            updateCachedLead(updated);
          }}
        />

        {/* Call Log Modal */}
        {activeCallLead && (
          <CallLogModal
            isOpen={!!activeCallLead}
            onClose={() => setActiveCallLead(null)}
            lead={activeCallLead}
            onSuccess={(updated) => {
              pinRow(updated.id);
              updateCachedLead(updated);
              invalidateCache('/reports');
              setActiveCallLead(null);
            }}
          />
        )}

        {/* Follow-up completion (Closed / Not Closed) */}
        {completionTarget && (
          <FollowUpCompletionModal
            isOpen={!!completionTarget}
            onClose={() => setCompletionTarget(null)}
            lead={completionTarget.lead}
            mode={completionTarget.mode}
            onSuccess={handleCompletionSuccess}
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

        {/* Mobile Filters Modal / Bottom Sheet */}
        <Modal
          isOpen={isMobileFiltersOpen}
          onClose={() => setIsMobileFiltersOpen(false)}
          title="Filter Leads"
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {isTodayMode ? 'Next Follow-up Date (required)' : 'Date Range'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border text-left min-h-[40px] ${datePreset === preset.id
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
                  resetAllFilters();
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
