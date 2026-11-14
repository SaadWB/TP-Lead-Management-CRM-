'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Lead,
  User,
  normalizeCallOutcome,
  PIPELINE_STAGE_LIST,
  Priority,
  USER_ROLES,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData, invalidateCache } from '@/lib/apiCache';
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
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor, getOutcomeColor, getStageColor } from '@/lib/utils';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';
import { Button } from '@/components/ui/Button';

// Dynamic import for LeadDrawer
const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});

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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedLeadIdForDrawer, setSelectedLeadIdForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Bulk action state
  const [bulkTelecallerId, setBulkTelecallerId] = useState<string>('');
  const [isBulkAssigning, setIsBulkAssigning] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Filter leads client-side
  const filteredLeads = useMemo(() => {
    if (!websiteLeads) return [];
    return websiteLeads.filter((lead) => {
      // 1. Unassigned check
      if (unassignedOnly && lead.assignedTelecallerId) return false;

      // 2. Pipeline filter
      if (pipelineFilter !== 'ALL') {
        const norm = normalizeCallOutcome(lead.pipelineStage);
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
        const matchesPhone = !!(lead.phone && lead.phone.toLowerCase().includes(q));
        const matchesEmail = !!(lead.email && lead.email.toLowerCase().includes(q));
        const matchesProduct = !!(lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q));
        const matchesNotes = !!(lead.notes && lead.notes.toLowerCase().includes(q));
        if (!matchesComp && !matchesCont && !matchesPhone && !matchesEmail && !matchesProduct && !matchesNotes) {
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
        invalidateCache('/leads');
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
      setSortOrder('desc');
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
      <AppLayout>
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
    <AppLayout>
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
                  sortedLeads.map((lead, idx) => {
                    const isSelected = selectedLeadIds.has(lead.id);
                    const priorityMeta = getPriorityColor(lead.priority);
                    const stageNorm = normalizeCallOutcome(lead.pipelineStage) || lead.pipelineStage || 'New Lead';
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
                          className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 p-3 text-center border-r border-slate-100"
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
                        <td className="sticky left-[44px] z-10 bg-white group-hover:bg-slate-50/90 p-3 border-r border-slate-100">
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
                        <td className="p-3">
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

                        {/* Phone */}
                        <td className="p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${lead.phone}`}
                              className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5 text-xs"
                              title={`Dial ${lead.phone}`}
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{lead.phone || 'No Phone'}</span>
                            </a>
                            {lead.phone && (
                              <WhatsAppButton
                                phone={lead.phone}
                                leadId={lead.id}
                                leadName={lead.contactPerson || lead.companyName}
                                size="sm"
                                showText={false}
                              />
                            )}
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border} border`}
                          >
                            {lead.priority || 'MEDIUM'}
                          </span>
                        </td>

                        {/* Pipeline Stage */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${stageMeta.bg} ${stageMeta.text}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {stageNorm}
                          </span>
                        </td>

                        {/* Outcome */}
                        <td className="p-3">
                          {lead.lastCallOutcome ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${outcomeMeta.bg} ${outcomeMeta.text} ${outcomeMeta.border} truncate max-w-full`}
                              title={lead.lastCallOutcome}
                            >
                              {lead.lastCallOutcome}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Awaiting Call</span>
                          )}
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

                        {/* Action Buttons */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedLeadIdForDrawer(lead.id);
                                setIsDrawerOpen(true);
                              }}
                              className="px-2 py-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition-colors"
                              title="Inspect Lead"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id, lead.companyName)}
                              className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
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

          {/* Table Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{sortedLeads.length}</strong> of{' '}
              <strong className="text-slate-800">{websiteLeads?.length || 0}</strong> website leads
            </span>
            <span className="text-slate-400 text-[11px]">
              Module isolated to Admin Panel • TenderProcure Leads CRM
            </span>
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
            onLeadUpdated={() => {
              refreshLeads();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

