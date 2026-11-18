'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Lead,
  User,
  normalizeCallOutcome,
  normalizePipelineStage,
  PIPELINE_STAGE_LIST,
  Priority,
  USER_ROLES,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData, invalidateCache, updateCachedLead } from '@/lib/apiCache';
import { useAuth } from '@/lib/authContext';
import {
  Globe,
  RefreshCw,
  Search,
  Filter,
  Phone,
  Mail,
  UserCheck,
  UserX,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  Clock,
  CheckCircle2,
  Calendar,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor, getOutcomeColor, getStageColor, getPriorityLabel } from '@/lib/utils';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';
import { Button } from '@/components/ui/Button';

// Dynamic import for LeadDrawer
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});
const CreateLeadModal = dynamic(
  () => import('@/components/leads/CreateLeadModal').then((m) => m.CreateLeadModal),
  { ssr: false }
);

export default function AdminWebsiteLeadsPage() {
  const { user } = useAuth();

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pipelineFilter, setPipelineFilter] = useState<string>('ALL');
  const [telecallerFilter, setTelecallerFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'companyName' | 'priority'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination (Default 150+ rows per page per Requirement 4)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(150);

  // Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>(PIPELINE_STAGE_LIST);
  const [outcomeOptions, setOutcomeOptions] = useState<string[]>([
    'No Answer',
    'Busy',
    'Call Cut',
    'Call Back Later',
    'Connected – Discussed',
    'Details Requested',
    'Demo Interested',
    'Demo Scheduled',
    'Demo Completed',
    'Decision Pending',
    'Not Interested',
    'Wrong Number',
  ]);

  // Bulk action state
  const [bulkTelecallerId, setBulkTelecallerId] = useState<string>('');
  const [isBulkAssigning, setIsBulkAssigning] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const copyPhoneToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // SWR Hooks
  const queryParams = useMemo(() => ({ leadSource: 'Website', limit: 1000 }), []);
  const { data: websiteLeads, loading: leadsLoading, mutate: mutateLeads, refresh: refreshLeads } =
    useSWRData<Lead[]>('/leads', queryParams);

  const { data: allUsers } = useSWRData<User[]>('/users');

  // Filter telecallers
  const telecallers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((u) => u.role === USER_ROLES.TELECALLER && u.isActive);
  }, [allUsers]);

  // Flash toast notice
  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Load pipeline & outcome options
  React.useEffect(() => {
    function loadOptions() {
      api.get<{
        pipelineStages?: { name: string; isActive: boolean }[];
        stages?: { name: string; isActive: boolean }[];
        callOutcomes?: { name: string; isActive: boolean }[];
        outcomes?: { name: string; isActive: boolean }[];
      }>('/options').then((res) => {
        if (res.success && res.data) {
          const stages = res.data.pipelineStages || res.data.stages;
          const outcomes = res.data.callOutcomes || res.data.outcomes;
          if (stages && stages.length > 0) {
            const activeStages = stages.filter((s) => s.isActive).map((s) => s.name);
            setPipelineOptions(Array.from(new Set([...PIPELINE_STAGE_LIST, ...activeStages])));
          }
          if (outcomes && outcomes.length > 0) {
            const activeOutcomes = outcomes.filter((o) => o.isActive).map((o) => o.name);
            setOutcomeOptions(activeOutcomes);
          }
        }
      }).catch(() => {});
    }
    loadOptions();

    const handleInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ prefix?: string }>;
      const prefix = customEvent.detail?.prefix;
      if (!prefix || prefix.startsWith('/options')) {
        loadOptions();
      }
    };
    window.addEventListener('crm:cache-invalidated', handleInvalidation);
    return () => {
      window.removeEventListener('crm:cache-invalidated', handleInvalidation);
    };
  }, []);

  // Inline Pipeline Update
  async function handlePipelineUpdate(leadId: string, newStage: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, { pipelineStage: newStage });
      if (res.success && res.data) {
        mutateLeads((prev) => (prev ? prev.map((l) => (l.id === leadId ? { ...l, ...res.data! } : l)) : [res.data!]));
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
        triggerToast(`Pipeline updated to "${newStage}"`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update pipeline stage');
    }
  }

  // Inline Priority Update
  async function handlePriorityUpdate(leadId: string, priority: Priority) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}/priority`, { priority });
      if (res.success && res.data) {
        mutateLeads((prev) => (prev ? prev.map((l) => (l.id === leadId ? { ...l, ...res.data! } : l)) : [res.data!]));
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
        triggerToast(`Priority updated to "${priority}"`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  // Inline Outcome Update
  async function handleOutcomeUpdate(leadId: string, lastCallOutcome: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, { lastCallOutcome: lastCallOutcome || null });
      if (res.success && res.data) {
        mutateLeads((prev) => (prev ? prev.map((l) => (l.id === leadId ? { ...l, ...res.data! } : l)) : [res.data!]));
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
        triggerToast(`Outcome updated to "${lastCallOutcome || 'None'}"`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update call outcome');
    }
  }

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

  // Filter leads client-side
  const filteredLeads = useMemo(() => {
    if (!websiteLeads) return [];
    return websiteLeads.filter((lead) => {
      // 1. Unassigned check
      if (unassignedOnly && lead.assignedTelecallerId) return false;

      // 2. Pipeline filter
      if (pipelineFilter !== 'ALL') {
        const norm = normalizePipelineStage(lead.pipelineStage);
        if (norm !== pipelineFilter && lead.pipelineStage !== pipelineFilter) return false;
      }

      // 3. Telecaller filter
      if (telecallerFilter !== 'ALL') {
        if (telecallerFilter === 'UNASSIGNED') {
          if (lead.assignedTelecallerId) return false;
        } else if (lead.assignedTelecallerId !== telecallerFilter) {
          return false;
        }
      }

      // 4. Priority filter
      if (priorityFilter !== 'ALL') {
        if ((lead.priority || '').toUpperCase() !== priorityFilter.toUpperCase()) return false;
      }

      // 5. Search query
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesComp = !!(lead.companyName && lead.companyName.toLowerCase().includes(q));
        const matchesCont = !!(lead.contactPerson && lead.contactPerson.toLowerCase().includes(q));
        const matchesAltCont = !!(lead.alternateName && lead.alternateName.toLowerCase().includes(q));
        const matchesPhone = !!(lead.phone && lead.phone.toLowerCase().includes(q));
        const matchesAltPhone = !!(lead.alternatePhone && lead.alternatePhone.toLowerCase().includes(q));
        const matchesEmail = !!(lead.email && lead.email.toLowerCase().includes(q));
        const matchesProduct = !!(lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q));
        const matchesNotes = !!(lead.notes && lead.notes.toLowerCase().includes(q));
        if (!matchesComp && !matchesCont && !matchesAltCont && !matchesPhone && !matchesAltPhone && !matchesEmail && !matchesProduct && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [websiteLeads, unassignedOnly, pipelineFilter, telecallerFilter, priorityFilter, searchTerm]);

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
      } else if (sortBy === 'companyName') {
        valA = (a.companyName || '').toLowerCase();
        valB = (b.companyName || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredLeads, sortBy, sortOrder]);

  // Paginated leads (Default 150+ rows per page per Requirement 4)
  const paginatedLeads = useMemo(() => {
    if (pageSize === 0) return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedLeads.length / (pageSize || 1));

  // KPIs calculation
  const kpis = useMemo(() => {
    const all = websiteLeads || [];
    const total = all.length;
    const unassigned = all.filter((l) => !l.assignedTelecallerId).length;
    const inContact = all.filter((l) =>
      ['Attempting Contact', 'Connected', 'Follow-up', 'Demo'].includes(normalizeCallOutcome(l.pipelineStage))
    ).length;
    const converted = all.filter((l) =>
      normalizeCallOutcome(l.pipelineStage) === 'Closed' && l.lastCallOutcome !== 'Not Interested' && l.lastCallOutcome !== 'Wrong Number'
    ).length;

    return { total, unassigned, inContact, converted };
  }, [websiteLeads]);

  // Inline assignment change
  async function handleAssignTelecaller(leadId: string, telecallerId: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, {
        assignedTelecallerId: telecallerId || null,
      });
      if (res.success && res.data) {
        mutateLeads((prev) => (prev ? prev.map((l) => (l.id === leadId ? res.data! : l)) : [res.data!]));
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
        triggerToast('Assigned telecaller successfully');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to assign telecaller');
    }
  }

  // Bulk assignment
  async function handleBulkAssign() {
    if (!bulkTelecallerId || selectedLeadIds.size === 0) return;
    setIsBulkAssigning(true);
    try {
      const ids = Array.from(selectedLeadIds);
      for (const id of ids) {
        await api.patch(`/leads/${id}`, { assignedTelecallerId: bulkTelecallerId });
      }
      invalidateCache('/leads');
      invalidateCache('/reports/dashboard');
      refreshLeads();
      setSelectedLeadIds(new Set());
      setBulkTelecallerId('');
      triggerToast(`Successfully assigned ${ids.length} leads to telecaller`);
    } catch (err: any) {
      alert(err.message || 'Bulk assignment failed');
    } finally {
      setIsBulkAssigning(false);
    }
  }

  // Single Delete
  async function handleDeleteLead(leadId: string, companyName: string) {
    if (!confirm(`Are you sure you want to delete website inquiry for "${companyName}"?`)) return;
    try {
      const res = await api.delete(`/leads/${leadId}`);
      if (res.success) {
        mutateLeads((prev) => (prev ? prev.filter((l) => l.id !== leadId) : []));
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
        triggerToast(`Lead "${companyName}" deleted`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead');
    }
  }

  // Header Sort Toggle
  function handleHeaderSort(field: 'createdAt' | 'updatedAt' | 'companyName' | 'priority') {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc'); // Default ascending order per Requirement 1
    }
  }

  // Toggle Selection
  function toggleSelectAll() {
    if (selectedLeadIds.size === sortedLeads.length && sortedLeads.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(sortedLeads.map((l) => l.id)));
    }
  }

  function toggleSelectLead(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (user?.role !== USER_ROLES.SUPER_ADMIN) {
    return (
      <AppLayout
        title="Website Leads"
        subtitle="Restricted to Super Administrators"
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 max-w-md">
            The Website Leads module is exclusively accessible to Super Administrators.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Website Leads"
      subtitle="Direct inquiries, RFP requests, and consultation forms generated from website landing pages."
      onOpenCreateLead={() => setIsCreateOpen(true)}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter website inquiries by name, company, email, phone..."
    >
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl text-white shadow-soft-sm">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Website Leads
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    Admin Exclusive
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct inquiries, RFP requests, and consultation forms generated from website landing pages
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-soft-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Lead</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLeads()}
              disabled={leadsLoading}
              className="flex items-center gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 shadow-soft-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${leadsLoading ? 'animate-spin text-sky-600' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-soft-lg animate-fade-in border border-slate-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inquiries</span>
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{kpis.total}</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Direct from web portal</span>
          </div>

          <div
            onClick={() => setUnassignedOnly(!unassignedOnly)}
            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-soft-xs ${
              unassignedOnly
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400'
                : 'bg-white border-slate-200 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Unassigned</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                <UserX className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-900 mt-2">{kpis.unassigned}</p>
            <span className="text-[11px] text-amber-600 mt-0.5 block">
              {unassignedOnly ? 'Filter Active (Click to reset)' : 'Click to filter unassigned'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Contact / Active</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{kpis.inContact}</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Connected or demo stage</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Converted / Won</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-900 mt-2">{kpis.converted}</p>
            <span className="text-[11px] text-emerald-600 mt-0.5 block">Closed deals & clients</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft-xs p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search company, contact, phone, email, requirement..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Pipeline Stage */}
            <div>
              <select
                value={pipelineFilter}
                onChange={(e) => setPipelineFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="ALL">All Stages</option>
                {PIPELINE_STAGE_LIST.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Telecaller Filter */}
            <div>
              <select
                value={telecallerFilter}
                onChange={(e) => setTelecallerFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="ALL">All Telecallers</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {telecallers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(searchTerm || pipelineFilter !== 'ALL' || telecallerFilter !== 'ALL' || priorityFilter !== 'ALL' || unassignedOnly) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-semibold text-[11px]">Active Filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-rose-600">×</button>
                </span>
              )}
              {pipelineFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                  Stage: {pipelineFilter}
                  <button onClick={() => setPipelineFilter('ALL')} className="hover:text-rose-600">×</button>
                </span>
              )}
              {telecallerFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                  Telecaller: {telecallerFilter === 'UNASSIGNED' ? 'Unassigned' : telecallers.find((t) => t.id === telecallerFilter)?.name}
                  <button onClick={() => setTelecallerFilter('ALL')} className="hover:text-rose-600">×</button>
                </span>
              )}
              {priorityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                  Priority: {priorityFilter}
                  <button onClick={() => setPriorityFilter('ALL')} className="hover:text-rose-600">×</button>
                </span>
              )}
              {unassignedOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">
                  Unassigned Only
                  <button onClick={() => setUnassignedOnly(false)} className="hover:text-rose-600">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPipelineFilter('ALL');
                  setTelecallerFilter('ALL');
                  setPriorityFilter('ALL');
                  setUnassignedOnly(false);
                }}
                className="text-sky-600 font-bold hover:underline ml-auto text-[11px]"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedLeadIds.size > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-soft-md animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-sky-500 font-extrabold text-xs">
                {selectedLeadIds.size} selected
              </span>
              <span className="text-xs text-slate-300">
                Bulk assign telecaller to selected website inquiries
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={bulkTelecallerId}
                onChange={(e) => setBulkTelecallerId(e.target.value)}
                className="text-xs bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">-- Choose Telecaller --</option>
                {telecallers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <Button
                variant="primary"
                size="sm"
                disabled={!bulkTelecallerId || isBulkAssigning}
                onClick={handleBulkAssign}
                className="bg-sky-600 hover:bg-sky-500 text-xs shrink-0"
              >
                {isBulkAssigning ? 'Assigning...' : 'Assign Selected'}
              </Button>

              <button
                onClick={() => setSelectedLeadIds(new Set())}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* Structured Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[72vh] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse table-fixed" style={{ minWidth: 1840 }}>
              {/* Exact Colgroup Widths for Pixel-Perfect Ordering */}
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 110 }} />
              </colgroup>

              {/* Table Header */}
              <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-20 shadow-soft-xs">
                <tr>
                  {/* Select All */}
                  <th className="sticky left-0 z-30 bg-slate-900 p-3 text-center border-r border-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.size > 0 && selectedLeadIds.size === sortedLeads.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  </th>

                  {/* Company */}
                  <th
                    onClick={() => handleHeaderSort('companyName')}
                    className="sticky left-[44px] z-30 bg-slate-900 p-3 border-r border-slate-800 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Company & Requirement</span>
                      {sortBy === 'companyName' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-400" /> : <ArrowDown className="h-3 w-3 text-sky-400" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Contact */}
                  <th className="p-3">Contact Person</th>

                  {/* Phone */}
                  <th className="p-3">Phone</th>

                  {/* Priority */}
                  <th
                    onClick={() => handleHeaderSort('priority')}
                    className="p-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Priority</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Pipeline Stage */}
                  <th className="p-3">Pipeline Stage</th>

                  {/* Last Outcome */}
                  <th className="p-3">Outcome</th>

                  {/* Telecaller */}
                  <th className="p-3">Telecaller</th>

                  {/* Sales Closer */}
                  <th className="p-3">Sales Closer</th>

                  {/* Lead Source */}
                  <th className="p-3">Source Channel</th>

                  {/* Next Follow-up */}
                  <th className="p-3">Next Follow-up</th>

                  {/* Date Submitted / Updated */}
                  <th
                    onClick={() => handleHeaderSort('createdAt')}
                    className="p-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center justify-between">
                      <span>Date Submitted</span>
                      {sortBy === 'createdAt' ? (
                        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-400" /> : <ArrowDown className="h-3 w-3 text-sky-400" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {leadsLoading ? (
                  <tr>
                    <td colSpan={13} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 text-sky-500 animate-spin" />
                        <span className="text-xs font-semibold text-slate-600">Loading website inquiries...</span>
                      </div>
                    </td>
                  </tr>
                ) : sortedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Globe className="h-10 w-10 text-slate-300" />
                        <span className="font-bold text-sm text-slate-700">No website leads found</span>
                        <span className="text-xs text-slate-400 max-w-sm">
                          {searchTerm || pipelineFilter !== 'ALL' || telecallerFilter !== 'ALL'
                            ? 'No inquiries match current search criteria. Try clearing filters.'
                            : 'Inquiries submitted through the website forms will automatically appear here.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead, idx) => {
                    const isSelected = selectedLeadIds.has(lead.id);
                    const priorityMeta = getPriorityColor(lead.priority);
                    const stageNorm = normalizePipelineStage(lead.pipelineStage);
                    const stageMeta = getStageColor(stageNorm);
                    const outcomeMeta = getOutcomeColor(lead.lastCallOutcome);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-slate-50/80 transition-colors group cursor-default ${
                          isSelected ? 'bg-sky-50/40' : ''
                        }`}
                        onClick={() => {
                          setSelectedLeadIdForDrawer(lead.id);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {/* Checkbox */}
                        <td
                          className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 py-2 px-2.5 text-center border-r border-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectLead(lead.id)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>

                        {/* Company & Service */}
                        <td className="sticky left-[44px] z-10 bg-white group-hover:bg-slate-50/90 py-2 px-2.5 border-r border-slate-100">
                          <div className="flex flex-col min-w-0">
                            <span
                              className="font-bold text-slate-900 truncate hover:text-sky-600 transition-colors cursor-pointer"
                              title={lead.companyName}
                            >
                              {lead.companyName || 'Unnamed Prospect'}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                              <span className="text-slate-400 font-medium truncate" title={lead.serviceProduct}>
                                {lead.serviceProduct || 'Website Inquiry'}
                              </span>
                            </div>
                            {lead.website && (
                              <a
                                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline mt-0.5 truncate"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Contact Person & Email */}
                        <td className="py-2 px-2.5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-800 truncate">
                              {lead.contactPerson || 'Not Provided'}
                            </span>
                            {lead.email && (
                              <a
                                href={`mailto:${lead.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-slate-500 hover:text-sky-600 truncate flex items-center gap-1 mt-0.5"
                                title={lead.email}
                              >
                                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="truncate">{lead.email}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Phone (Stacked primary & alternate + click-to-copy, WhatsApp shifted to Action) */}
                        <td className="py-2 px-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={lead.phone ? `tel:${lead.phone}` : undefined}
                                className="text-emerald-700 font-bold hover:underline flex items-center gap-1 text-[13px] tracking-wide font-mono"
                                title={`Dial ${lead.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>{lead.phone || 'No Phone'}</span>
                              </a>
                              {lead.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => copyPhoneToClipboard(lead.phone, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                  title="Copy phone number"
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
                              <div className="flex items-center gap-1.5 border-t border-slate-100 pt-0.5">
                                <a
                                  href={`tel:${lead.alternatePhone}`}
                                  className="text-purple-700 font-semibold hover:underline flex items-center gap-1 text-xs font-mono"
                                  title={`Dial alternate: ${lead.alternatePhone}`}
                                >
                                  <Phone className="h-3 w-3 text-purple-600 shrink-0" />
                                  <span>{lead.alternatePhone}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => copyPhoneToClipboard(lead.alternatePhone!, e)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
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

                        {/* Priority Dropdown (Cold, Warm, Hot, Urgent) */}
                        <td className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.priority || 'MEDIUM'}
                            onChange={(e) => handlePriorityUpdate(lead.id, e.target.value as Priority)}
                            className={`w-full text-xs font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            <option value="LOW" className="bg-white text-blue-700 font-bold">Cold</option>
                            <option value="MEDIUM" className="bg-white text-amber-800 font-bold">Warm</option>
                            <option value="HIGH" className="bg-white text-orange-700 font-bold">Hot</option>
                            <option value="URGENT" className="bg-white text-red-700 font-bold">Urgent</option>
                          </select>
                        </td>

                        {/* Pipeline Stage Dropdown */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={stageNorm}
                            onChange={(e) => handlePipelineUpdate(lead.id, e.target.value)}
                            className={`w-full text-xs font-bold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs transition-colors ${getPipelineBadgeColor(
                              stageNorm
                            )}`}
                          >
                            {pipelineOptions.map((st) => (
                              <option key={st} value={st} className="font-semibold text-slate-800 bg-white">
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Outcome Dropdown */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.lastCallOutcome || ''}
                            onChange={(e) => handleOutcomeUpdate(lead.id, e.target.value)}
                            className={`w-full text-xs font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-soft-xs ${
                              lead.lastCallOutcome
                                ? `${outcomeMeta.bg} ${outcomeMeta.text} ${outcomeMeta.border}`
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="" className="bg-white text-slate-600 font-normal">-- Select Outcome --</option>
                            {outcomeOptions.map((o) => (
                              <option key={o} value={o} className="bg-white text-slate-800 font-semibold">
                                {o}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Telecaller (Inline Dropdown) */}
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.assignedTelecallerId || ''}
                            onChange={(e) => handleAssignTelecaller(lead.id, e.target.value)}
                            className={`w-full text-xs font-semibold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                              lead.assignedTelecallerId
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                                : 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                            }`}
                          >
                            <option value="">-- Unassigned --</option>
                            {telecallers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Sales Closer */}
                        <td className="p-3">
                          <span className="text-xs font-medium text-slate-700">
                            {lead.assignedSalesman?.name || '-'}
                          </span>
                        </td>

                        {/* Lead Source */}
                        <td className="p-3 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                              <Globe className="h-3 w-3 text-sky-500 shrink-0" />
                              <span className="truncate">{lead.leadSource || 'Website'}</span>
                            </span>
                            {lead.leadSourceOther && (
                              <span className="text-[10px] text-slate-400 truncate mt-0.5" title={lead.leadSourceOther}>
                                {lead.leadSourceOther}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Next Follow-up */}
                        <td className="p-3 text-slate-600 text-xs whitespace-nowrap">
                          {lead.nextFollowUpDate ? (
                            <span className="flex items-center gap-1 font-medium text-sky-700">
                              <Calendar className="h-3 w-3" />
                              {formatDate(lead.nextFollowUpDate)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Not Scheduled</span>
                          )}
                        </td>

                        {/* Date Submitted / Updated */}
                        <td className="p-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {formatDateTime(lead.createdAt)}
                        </td>

                        {/* Action Buttons (View, WhatsApp icon shifted here, Delete) */}
                        <td className="py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedLeadIdForDrawer(lead.id);
                                setIsDrawerOpen(true);
                              }}
                              className="px-2 py-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition-colors cursor-pointer"
                              title="Inspect Lead"
                            >
                              View
                            </button>
                            {/* WhatsApp Button shifted from phone column per Requirement 6 */}
                            <WhatsAppButton
                              phone={lead.phone}
                              leadId={lead.id}
                              leadName={lead.contactPerson || lead.companyName}
                              size="sm"
                              showText={false}
                            />
                            <button
                              onClick={() => handleDeleteLead(lead.id, lead.companyName)}
                              className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* Table Footer with Pagination (Default 150+ rows per page per Requirement 4) */}
          <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 gap-3">
            <div className="flex items-center gap-2">
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
              <span>
                {sortedLeads.length === 0
                  ? '0 leads'
                  : pageSize === 0
                  ? `Showing all ${sortedLeads.length} website leads`
                  : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(
                      currentPage * pageSize,
                      sortedLeads.length
                    )} of ${sortedLeads.length}`}
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

        {/* Lead Drawer for Full Inspection */}
        {isDrawerOpen && selectedLeadIdForDrawer && (
          <LeadDrawer
            leadId={selectedLeadIdForDrawer}
            isOpen={isDrawerOpen}
            onClose={() => {
              setIsDrawerOpen(false);
              setSelectedLeadIdForDrawer(null);
            }}
            onLeadUpdated={(updated) => {
              mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) : [{ ...updated }]));
              updateCachedLead(updated);
            }}
          />
        )}

        {/* Create Lead Modal */}
        <CreateLeadModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          defaultLeadSource="Website"
          onSuccess={(newLead) => {
            mutateLeads((prev) => (prev ? [newLead, ...prev.filter((l) => l.id !== newLead.id)] : [newLead]));
            invalidateCache('/leads');
            refreshLeads();
            setToastMessage(`Website lead "${newLead.companyName}" added successfully`);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      </div>
    </AppLayout>
  );
}

