'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Lead,
  Priority,
  TELECALLER_KANBAN_COLUMNS,
  TELECALLER_CALL_OUTCOMES,
  SALES_STAGE_OPTIONS,
  User,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatDate, getPriorityColor, getStageColor, getOutcomeColor } from '@/lib/utils';
import { invalidateCache, getMemoryCache, setMemoryCache, getCacheKey } from '@/lib/apiCache';
import {
  Users,
  Filter,
  Phone,
  CheckSquare,
  Square,
  Send,
  Plus,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';

const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});
const CreateLeadModal = dynamic(
  () => import('@/components/leads/CreateLeadModal').then((m) => m.CreateLeadModal),
  { ssr: false }
);

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading leads...</div>}>
      <AdminLeadsContent />
    </Suspense>
  );
}

function AdminLeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentKpi = searchParams ? searchParams.get('kpi') : null;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [salesStageFilter, setSalesStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [telecallerFilter, setTelecallerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>([
    'New Lead',
    'Attempting Contact',
    'Connected',
    'Follow-up',
    'Demo',
    'Closed',
  ]);
  const [callOutcomeOptions, setCallOutcomeOptions] = useState<string[]>([
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

  // Bulk selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [telecallers, setTelecallers] = useState<User[]>([]);
  const [targetTelecallerId, setTargetTelecallerId] = useState('');
  const [bulkPriority, setBulkPriority] = useState<Priority>('HIGH');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkUpdatingPriority, setBulkUpdatingPriority] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Delete Modals State
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const kpiTitles: Record<string, string> = {
    total: 'Total Leads',
    new: 'New Leads',
    unassigned: 'Unassigned Leads',
    assigned_telecaller: 'Assigned to Telecallers',
    in_progress: 'In Progress Leads',
    interested: 'Interested Leads',
    assigned_salesman: 'Assigned to Salesmen',
    demos_scheduled: 'Demos / Meetings Scheduled',
    followups_today: 'Follow-ups Due Today',
    overdue: 'Overdue Follow-ups',
    converted: 'Converted (Won) Leads',
    lost: 'Lost Leads',
  };

  useEffect(() => {
    fetchLeads();
  }, [stageFilter, outcomeFilter, salesStageFilter, priorityFilter, telecallerFilter, sourceFilter, currentKpi]);

  useEffect(() => {
    loadTelecallers();
    loadOptions();
  }, []);

  async function loadOptions() {
    const cached = getMemoryCache<any>('/options');
    if (cached) {
      const cStages = cached.pipelineStages || cached.stages;
      const cOutcomes = cached.callOutcomes || cached.outcomes;
      if (cached.leadSources) setSourceOptions(cached.leadSources.filter((s: any) => s.isActive).map((s: any) => s.name));
      if (cStages?.length > 0) setPipelineOptions(cStages.filter((s: any) => s.isActive).map((s: any) => s.name));
      if (cOutcomes?.length > 0) setCallOutcomeOptions(cOutcomes.filter((o: any) => o.isActive).map((o: any) => o.name));
      return;
    }
    try {
      const res = await api.get<{
        leadSources?: { name: string; isActive: boolean }[];
        pipelineStages?: { name: string; isActive: boolean }[];
        stages?: { name: string; isActive: boolean }[];
        callOutcomes?: { name: string; isActive: boolean }[];
        outcomes?: { name: string; isActive: boolean }[];
      }>('/options');
      if (res.success && res.data) {
        setMemoryCache('/options', res.data);
        const stages = res.data.pipelineStages || res.data.stages;
        const outcomes = res.data.callOutcomes || res.data.outcomes;
        if (res.data.leadSources) {
          setSourceOptions(res.data.leadSources.filter((s) => s.isActive).map((s) => s.name));
        }
        if (stages && stages.length > 0) {
          setPipelineOptions(stages.filter((s) => s.isActive).map((s) => s.name));
        }
        if (outcomes && outcomes.length > 0) {
          setCallOutcomeOptions(outcomes.filter((o) => o.isActive).map((o) => o.name));
        }
      }
    } catch {
      // ignore
    }
  }

  async function fetchLeads() {
    const params: any = { limit: 1000 };
    if (currentKpi) params.kpi = currentKpi;
    if (stageFilter) params.pipelineStage = stageFilter;
    if (outcomeFilter) params.lastCallOutcome = outcomeFilter;
    if (salesStageFilter) params.salesStage = salesStageFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (telecallerFilter) params.assignedTelecallerId = telecallerFilter;
    if (sourceFilter) params.leadSource = sourceFilter;

    // Fast 0ms cache display: If cached leads exist, render table immediately without waiting
    const cacheKey = getCacheKey('/leads', params);
    const cached = getMemoryCache<Lead[]>(cacheKey);
    if (cached && cached.length > 0) {
      setLeads(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get<Lead[]>('/leads', params);
      if (res.success && res.data) {
        setMemoryCache(cacheKey, res.data);
        setLeads(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTelecallers() {
    const cacheKey = '/users?role=TELECALLER&isActive=true';
    const cached = getMemoryCache<User[]>(cacheKey);
    if (cached) {
      setTelecallers(cached);
      return;
    }
    try {
      const res = await api.get<User[]>('/users', { role: 'TELECALLER', isActive: true });
      if (res.success && res.data) {
        setMemoryCache(cacheKey, res.data);
        setTelecallers(res.data);
      }
    } catch {
      // ignore
    }
  }

  // Row-level priority update
  async function handleSinglePriorityUpdate(leadId: string, priority: Priority) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}/priority`, { priority });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.data! : l)));
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  // Row-level telecaller update (Super Admin inline assign)
  async function handleSingleTelecallerUpdate(leadId: string, assignedTelecallerId: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, {
        assignedTelecallerId: assignedTelecallerId || null,
      });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.data! : l)));
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update assigned telecaller');
    }
  }

  // Row-level pipeline stage update
  async function handleSinglePipelineUpdate(leadId: string, pipelineStage: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, { pipelineStage });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.data! : l)));
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update pipeline stage');
    }
  }

  // Row-level call outcome update
  async function handleSingleOutcomeUpdate(leadId: string, lastCallOutcome: string) {
    try {
      const res = await api.patch<Lead>(`/leads/${leadId}`, { lastCallOutcome: lastCallOutcome || null });
      if (res.success && res.data) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.data! : l)));
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update call outcome');
    }
  }

  // Bulk priority update
  async function handleBulkPriority() {
    if (selectedLeadIds.length === 0) return;
    setBulkUpdatingPriority(true);
    try {
      const res = await api.post<{ updatedCount: number }>('/leads/bulk-priority', {
        leadIds: selectedLeadIds,
        priority: bulkPriority,
      });
      if (res.success) {
        setSelectedLeadIds([]);
        fetchLeads();
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priorities');
    } finally {
      setBulkUpdatingPriority(false);
    }
  }

  // Bulk assignment
  async function handleBulkAssign() {
    if (selectedLeadIds.length === 0 || !targetTelecallerId) return;
    setBulkAssigning(true);
    try {
      const res = await api.post('/assignments/bulk', {
        leadIds: selectedLeadIds,
        assignedUserId: targetTelecallerId,
        roleType: 'TELECALLER',
      });
      if (res.success) {
        setSelectedLeadIds([]);
        fetchLeads();
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Bulk assignment failed');
    } finally {
      setBulkAssigning(false);
    }
  }

  // Single Delete
  async function confirmSingleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/leads/${deleteTarget.id}`);
      if (res.success) {
        setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
        setSelectedLeadIds((prev) => prev.filter((id) => id !== deleteTarget.id));
        setDeleteTarget(null);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  }

  // Bulk Delete
  async function confirmBulkDelete() {
    if (selectedLeadIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await api.post<{ deletedCount: number }>('/leads/bulk-delete', {
        leadIds: selectedLeadIds,
      });
      if (res.success) {
        setLeads((prev) => prev.filter((l) => !selectedLeadIds.includes(l.id)));
        setSelectedLeadIds([]);
        setShowBulkDeleteConfirm(false);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected leads');
    } finally {
      setBulkDeleting(false);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (!lead) return false;
    if (outcomeFilter && lead.lastCallOutcome !== outcomeFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (lead.companyName || '').toLowerCase().includes(q) ||
      (lead.contactPerson && lead.contactPerson.toLowerCase().includes(q)) ||
      (lead.phone || '').toLowerCase().includes(q) ||
      (lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q))
    );
  });

  function toggleSelectAll() {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  }

  function toggleSelectLead(id: string) {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedLeadIds((prev) => [...prev, id]);
    }
  }

  return (
    <AppLayout
      title="Global Leads Registry"
      subtitle="Complete database view across all pipelines, telecallers, and sales reps with bulk management tools."
      onOpenCreateLead={() => setIsCreateOpen(true)}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter company, contact person, phone..."
    >
      <div className="space-y-4 max-w-7xl mx-auto min-w-0 max-w-full">
        {/* Active KPI Filter Banner */}
        {currentKpi && (
          <div className="flex items-center justify-between bg-sky-50 border border-sky-200 px-4 py-2.5 rounded-xl shadow-soft-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-sky-800">Filtered by KPI:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-sky-600 text-white shadow-soft-xs">
                <Filter className="h-3 w-3" />
                {kpiTitles[currentKpi] || currentKpi}
                <span className="bg-sky-700/80 px-1.5 py-0.2 rounded text-[11px]">
                  {filteredLeads.length}
                </span>
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/leads')}
              className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Clear filter
            </button>
          </div>
        )}

        {/* Filter and Bulk Action Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-soft-xs">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Stages</option>
              {TELECALLER_KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
              <option value="CONVERTED">Won / Converted</option>
              <option value="LOST">Lost</option>
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Call Outcomes</option>
              {TELECALLER_CALL_OUTCOMES.map((oc) => (
                <option key={oc} value={oc}>
                  {oc}
                </option>
              ))}
            </select>

            <select
              value={salesStageFilter}
              onChange={(e) => setSalesStageFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Sales Stages</option>
              {SALES_STAGE_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={telecallerFilter}
              onChange={(e) => setTelecallerFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Telecallers</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Lead Sources</option>
              {sourceOptions.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>

            {(stageFilter || outcomeFilter || salesStageFilter || priorityFilter || telecallerFilter || sourceFilter) && (
              <button
                onClick={() => {
                  setStageFilter('');
                  setOutcomeFilter('');
                  setSalesStageFilter('');
                  setPriorityFilter('');
                  setTelecallerFilter('');
                  setSourceFilter('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Bulk Selection Actions */}
          {selectedLeadIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl shadow-soft-sm animate-fade-in">
              <span className="text-xs font-bold text-sky-300">
                {selectedLeadIds.length} selected
              </span>

              {/* Bulk Priority */}
              <div className="flex items-center gap-1">
                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value as Priority)}
                  className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent Priority</option>
                </select>
                <button
                  onClick={handleBulkPriority}
                  disabled={bulkUpdatingPriority}
                  className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  {bulkUpdatingPriority ? '...' : 'Set Priority'}
                </button>
              </div>

              {/* Bulk Telecaller Assign */}
              <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                <select
                  value={targetTelecallerId}
                  onChange={(e) => setTargetTelecallerId(e.target.value)}
                  className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">-- Assign Telecaller --</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={!targetTelecallerId || bulkAssigning}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {bulkAssigning ? '...' : 'Assign'}
                </button>
              </div>

              {/* Bulk Delete */}
              <div className="border-l border-slate-700 pl-2">
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leads Count & Table */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span>Showing {filteredLeads.length} leads</span>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No leads found matching current query.
            </div>
          ) : (
            filteredLeads.map((lead, index) => {
              const priority = getPriorityColor(lead.priority);
              const stage = getStageColor(lead.pipelineStage);
              const outcome = getOutcomeColor(lead.lastCallOutcome);
              const isSelected = selectedLeadIds.includes(lead.id);

              return (
                <div
                  key={lead.id}
                  className={`bg-white rounded-xl border shadow-soft-sm p-4 space-y-3 transition-colors ${
                    isSelected ? 'border-sky-400 ring-2 ring-sky-200 bg-sky-50/20' : 'border-slate-200'
                  }`}
                >
                  {/* Top row: Checkbox, # Serial, Company Name, Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectLead(lead.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-sky-600 shrink-0 mt-0.5"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-sky-600" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-300" />
                        )}
                      </button>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-xs shrink-0">
                        #{index + 1}
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

                    {/* Priority Dropdown */}
                    <select
                      value={lead.priority}
                      onChange={(e) => handleSinglePriorityUpdate(lead.id, e.target.value as Priority)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border shrink-0 cursor-pointer ${priority.bg} ${priority.text} ${priority.border}`}
                    >
                      <option value="LOW" className="bg-blue-50 text-blue-700 font-bold">LOW</option>
                      <option value="MEDIUM" className="bg-amber-50 text-amber-800 font-bold">MEDIUM</option>
                      <option value="HIGH" className="bg-orange-50 text-orange-700 font-bold">HIGH</option>
                      <option value="URGENT" className="bg-red-50 text-red-700 font-bold">URGENT</option>
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

                  {/* Pipeline Stage & Last Outcome Edit Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-50/80 rounded-lg border border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Pipeline Stage:</span>
                      <select
                        value={lead.pipelineStage}
                        onChange={(e) => handleSinglePipelineUpdate(lead.id, e.target.value)}
                        className={`w-full text-[11px] font-bold rounded-md px-2 py-1 border cursor-pointer ${stage.bg} ${stage.text} ${stage.border}`}
                      >
                        {pipelineOptions.map((opt) => {
                          const optStage = getStageColor(opt);
                          return (
                            <option key={opt} value={opt} className={`${optStage.bg} ${optStage.text} font-bold`}>
                              {opt}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Last Call Outcome:</span>
                      <select
                        value={lead.lastCallOutcome || ''}
                        onChange={(e) => handleSingleOutcomeUpdate(lead.id, e.target.value)}
                        className={`w-full text-[11px] font-bold rounded-md px-2 py-1 border cursor-pointer ${outcome.bg} ${outcome.text} ${outcome.border}`}
                      >
                        <option value="" className="bg-slate-50 text-slate-700 font-normal">-- No Outcome --</option>
                        {callOutcomeOptions.map((opt) => {
                          const optOutcome = getOutcomeColor(opt);
                          return (
                            <option key={opt} value={opt} className={`${optOutcome.bg} ${optOutcome.text} font-bold`}>
                              {opt}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Assigned Telecaller Selector on Mobile */}
                  <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Assigned Telecaller:</span>
                    <select
                      value={lead.assignedTelecallerId || ''}
                      onChange={(e) => handleSingleTelecallerUpdate(lead.id, e.target.value)}
                      className={`w-full text-[11px] font-semibold rounded-md px-2 py-1 border cursor-pointer ${
                        lead.assignedTelecallerId
                          ? 'bg-white text-slate-800 border-slate-200 font-bold'
                          : 'bg-amber-50/70 text-amber-800 border-amber-200 italic'
                      }`}
                    >
                      <option value="">-- Unassigned --</option>
                      {telecallers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lead Source in Mobile Card */}
                  {lead.leadSource && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <span className="text-slate-400 font-medium">Source:</span>
                      <span className="font-semibold text-slate-800 truncate">{lead.leadSource}</span>
                      {lead.leadSource === 'Other' && lead.leadSourceOther && (
                        <span className="text-slate-500 text-[11px] truncate">({lead.leadSourceOther})</span>
                      )}
                    </div>
                  )}

                  {/* Footer Row: Details & Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setDeleteTarget(lead)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 min-h-[36px]"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      <span className="text-rose-600">Delete</span>
                    </button>
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

        {/* Desktop Table Container */}
        <Card className="hidden md:block border border-slate-200/90 shadow-soft-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Horizontal and vertical scroll container strictly bounded within card */}
            <div className="w-full max-w-full overflow-x-auto max-h-[72vh] relative scrollbar-thin">
              <table className="w-full table-fixed text-left text-xs border-collapse" style={{ minWidth: 1824 }}>
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '56px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none sticky top-0 z-20 shadow-soft-xs">
                  <tr>
                    {/* Sticky Checkbox Column */}
                    <th
                      style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                      className="sticky left-0 top-0 z-30 bg-slate-50 border-r border-b border-slate-200/80 p-3 text-center overflow-hidden whitespace-nowrap min-w-0"
                    >
                      <button onClick={toggleSelectAll} className="cursor-pointer inline-flex items-center justify-center" title="Select all leads">
                        {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-sky-600 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 mx-auto" />
                        )}
                      </button>
                    </th>

                    {/* Sticky Serial Number Column */}
                    <th
                      style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                      className="sticky left-[48px] top-0 z-30 bg-slate-50 border-r border-b border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] p-3 text-center text-slate-500 font-bold overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Serial Number"
                    >
                      #
                    </th>

                    {/* 1. Company */}
                    <th
                      style={{ width: 220, minWidth: 220, maxWidth: 220 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Company & Service Required"
                    >
                      Company
                    </th>

                    {/* 2. Contact */}
                    <th
                      style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Contact Person"
                    >
                      Contact
                    </th>

                    {/* 3. Phone */}
                    <th
                      style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Phone & Click-to-Call / WhatsApp"
                    >
                      Phone
                    </th>

                    {/* 4. Priority */}
                    <th
                      style={{ width: 110, minWidth: 110, maxWidth: 110 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Priority (Admin Inline Edit)"
                    >
                      Priority
                    </th>

                    {/* 5. Outcome */}
                    <th
                      style={{ width: 180, minWidth: 180, maxWidth: 180 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Last Call Outcome"
                    >
                      Outcome
                    </th>

                    {/* 6. Next Follow-up */}
                    <th
                      style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Next Scheduled Follow-up Date"
                    >
                      Next Follow-up
                    </th>

                    {/* 7. Telecaller */}
                    <th
                      style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Assigned Telecaller"
                    >
                      Telecaller
                    </th>

                    {/* 8. Sales Closer */}
                    <th
                      style={{ width: 150, minWidth: 150, maxWidth: 150 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Assigned Sales Closer"
                    >
                      Sales Closer
                    </th>

                    {/* 9. Lead Source */}
                    <th
                      style={{ width: 150, minWidth: 150, maxWidth: 150 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Lead Acquisition Source"
                    >
                      Lead Source
                    </th>

                    {/* 10. Last Updated */}
                    <th
                      style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                      className="p-3 text-left font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Last Updated Timestamp"
                    >
                      Last Updated
                    </th>

                    {/* 11. Action */}
                    <th
                      style={{ width: 110, minWidth: 110, maxWidth: 110 }}
                      className="p-3 text-center font-bold text-slate-700 border-b border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                      title="Quick Actions"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && filteredLeads.length === 0 ? (
                    [1, 2, 3, 4, 5, 6].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td style={{ width: 48 }} className="sticky left-0 z-10 bg-white p-3 text-center border-r border-slate-200/60">
                          <div className="w-4 h-4 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td style={{ width: 56 }} className="sticky left-[48px] z-10 bg-white p-3 text-center border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                          <div className="w-6 h-3 bg-slate-200 rounded mx-auto" />
                        </td>
                        <td style={{ width: 220 }} className="p-3">
                          <div className="w-3/4 h-3 bg-slate-200 rounded mb-1.5" />
                          <div className="w-1/2 h-2.5 bg-slate-200 rounded" />
                        </td>
                        <td style={{ width: 160 }} className="p-3"><div className="w-2/3 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 160 }} className="p-3"><div className="w-24 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 110 }} className="p-3"><div className="w-16 h-5 bg-slate-200 rounded" /></td>
                        <td style={{ width: 180 }} className="p-3"><div className="w-24 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 160 }} className="p-3"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 160 }} className="p-3"><div className="w-24 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 150 }} className="p-3"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 150 }} className="p-3"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 160 }} className="p-3"><div className="w-24 h-3 bg-slate-200 rounded" /></td>
                        <td style={{ width: 110 }} className="p-3"><div className="w-16 h-6 bg-slate-200 rounded mx-auto" /></td>
                      </tr>
                    ))
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-400">
                        No leads found matching current query.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead, index) => {
                      const priority = getPriorityColor(lead.priority);
                      const stage = getStageColor(lead.pipelineStage);
                      const outcome = getOutcomeColor(lead.lastCallOutcome);
                      const isSelected = selectedLeadIds.includes(lead.id);

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setIsDrawerOpen(true);
                          }}
                          className={`group hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isSelected ? 'bg-sky-50/40' : ''
                          }`}
                        >
                          {/* Sticky Checkbox Cell */}
                          <td
                            style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                            className={`sticky left-0 z-10 border-r border-slate-200/60 p-3 text-center overflow-hidden whitespace-nowrap min-w-0 ${
                              isSelected ? 'bg-sky-50' : 'bg-white group-hover:bg-slate-50'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectLead(lead.id);
                            }}
                          >
                            <button type="button" className="inline-flex items-center justify-center cursor-pointer" title={isSelected ? 'Deselect lead' : 'Select lead'}>
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-sky-600 mx-auto" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-300 mx-auto" />
                              )}
                            </button>
                          </td>

                          {/* Sticky Serial Number Cell */}
                          <td
                            style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                            className={`sticky left-[48px] z-10 border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] p-3 text-center text-slate-500 font-semibold overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${
                              isSelected ? 'bg-sky-50' : 'bg-white group-hover:bg-slate-50'
                            }`}
                            title={`Lead #${index + 1}`}
                          >
                            {index + 1}
                          </td>

                          {/* 1. Company */}
                          <td
                            style={{ width: 220, minWidth: 220, maxWidth: 220 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            title={`${lead.companyName} (${lead.serviceProduct})`}
                          >
                            <span
                              className="font-bold text-slate-900 block truncate"
                              title={lead.companyName}
                            >
                              {lead.companyName}
                            </span>
                            <span
                              className="text-[11px] text-slate-500 block truncate"
                              title={lead.serviceProduct}
                            >
                              {lead.serviceProduct}
                            </span>
                          </td>

                          {/* 2. Contact */}
                          <td
                            style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                            className="p-3 font-semibold text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            title={lead.contactPerson || 'Not available'}
                          >
                            <span className="block truncate">
                              {lead.contactPerson || (
                                <span className="text-slate-400 font-normal italic">—</span>
                              )}
                            </span>
                          </td>

                          {/* 3. Phone */}
                          <td
                            style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            onClick={(e) => e.stopPropagation()}
                            title={`Phone: ${lead.phone}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-emerald-700 font-semibold hover:underline flex items-center gap-1 min-w-0 truncate"
                                title={`Call ${lead.phone}`}
                              >
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{lead.phone}</span>
                              </a>
                              <WhatsAppButton
                                phone={lead.phone}
                                leadId={lead.id}
                                leadName={lead.contactPerson || lead.companyName}
                                size="sm"
                                showText={false}
                                className="shrink-0"
                              />
                            </div>
                          </td>

                          {/* 4. Priority */}
                          <td
                            style={{ width: 110, minWidth: 110, maxWidth: 110 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            onClick={(e) => e.stopPropagation()}
                            title={`Priority: ${lead.priority}`}
                          >
                            <select
                              value={lead.priority}
                              onChange={(e) => handleSinglePriorityUpdate(lead.id, e.target.value as Priority)}
                              className={`w-full max-w-full truncate text-[11px] font-bold rounded px-1.5 py-1 border cursor-pointer ${priority.bg} ${priority.text} ${priority.border} focus:outline-none focus:ring-1 focus:ring-sky-500`}
                              title={`Priority: ${lead.priority}`}
                            >
                              <option value="LOW" className="bg-blue-50 text-blue-700 font-bold">LOW</option>
                              <option value="MEDIUM" className="bg-amber-50 text-amber-800 font-bold">MEDIUM</option>
                              <option value="HIGH" className="bg-orange-50 text-orange-700 font-bold">HIGH</option>
                              <option value="URGENT" className="bg-red-50 text-red-700 font-bold">URGENT</option>
                            </select>
                          </td>

                          {/* 5. Outcome */}
                          <td
                            style={{ width: 180, minWidth: 180, maxWidth: 180 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            onClick={(e) => e.stopPropagation()}
                            title={lead.lastCallOutcome ? `Last Call Outcome: ${lead.lastCallOutcome}` : 'No call outcome recorded'}
                          >
                            <select
                              value={lead.lastCallOutcome || ''}
                              onChange={(e) => handleSingleOutcomeUpdate(lead.id, e.target.value)}
                              className={`w-full max-w-full truncate text-[11px] font-bold rounded px-1.5 py-1 border cursor-pointer ${outcome.bg} ${outcome.text} ${outcome.border} focus:outline-none focus:ring-1 focus:ring-sky-500`}
                            >
                              <option value="" className="bg-slate-50 text-slate-700 font-normal">-- No Outcome --</option>
                              {callOutcomeOptions.map((opt) => {
                                const optOutcome = getOutcomeColor(opt);
                                return (
                                  <option key={opt} value={opt} className={`${optOutcome.bg} ${optOutcome.text} font-bold`}>
                                    {opt}
                                  </option>
                                );
                              })}
                            </select>
                          </td>

                          {/* 6. Next Follow-up */}
                          <td
                            style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 text-slate-700 font-mono text-[11px]"
                            title={lead.nextFollowUpDate && formatDate(lead.nextFollowUpDate) !== '—' ? `Next Follow-up: ${formatDate(lead.nextFollowUpDate)}` : 'No follow-up scheduled'}
                          >
                            {lead.nextFollowUpDate && formatDate(lead.nextFollowUpDate) !== '—' ? (
                              <span className="inline-block max-w-full truncate px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 border border-slate-200">
                                {formatDate(lead.nextFollowUpDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic text-xs font-sans">—</span>
                            )}
                          </td>

                          {/* 7. Telecaller */}
                          <td
                            style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            onClick={(e) => e.stopPropagation()}
                            title={lead.assignedTelecaller?.name ? `Telecaller: ${lead.assignedTelecaller.name}` : 'Unassigned'}
                          >
                            <select
                              value={lead.assignedTelecallerId || ''}
                              onChange={(e) => handleSingleTelecallerUpdate(lead.id, e.target.value)}
                              className={`w-full max-w-full truncate text-[11px] font-semibold rounded px-1.5 py-1 border cursor-pointer ${
                                lead.assignedTelecallerId
                                  ? 'bg-slate-50 text-slate-800 border-slate-200 font-bold'
                                  : 'bg-amber-50/70 text-amber-800 border-amber-200 italic'
                              } focus:outline-none focus:ring-1 focus:ring-sky-500`}
                            >
                              <option value="">-- Unassigned --</option>
                              {telecallers.map((t) => (
                                <option key={t.id} value={t.id} className="font-semibold text-slate-800">
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 8. Sales Closer */}
                          <td
                            style={{ width: 150, minWidth: 150, maxWidth: 150 }}
                            className="p-3 text-slate-700 font-medium overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            title={lead.assignedSalesman?.name ? `Sales Closer: ${lead.assignedSalesman.name}` : 'None'}
                          >
                            <span className="block truncate">
                              {lead.assignedSalesman?.name || (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </span>
                          </td>

                          {/* 9. Lead Source */}
                          <td
                            style={{ width: 150, minWidth: 150, maxWidth: 150 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            title={
                              lead.leadSource === 'Other' && lead.leadSourceOther
                                ? `Lead Source: Other (${lead.leadSourceOther})`
                                : lead.leadSource
                                ? `Lead Source: ${lead.leadSource}`
                                : 'No lead source'
                            }
                          >
                            {lead.leadSource ? (
                              <span
                                className="inline-flex items-center gap-1.5 max-w-full truncate px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700"
                                title={lead.leadSource === 'Other' && lead.leadSourceOther ? `Other: ${lead.leadSourceOther}` : lead.leadSource}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                <span className="truncate">{lead.leadSource}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic text-xs">—</span>
                            )}
                          </td>

                          {/* 10. Last Updated */}
                          <td
                            style={{ width: 160, minWidth: 160, maxWidth: 160 }}
                            className="p-3 text-slate-500 font-mono text-[11px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                            title={`Last updated: ${formatDate(lead.updatedAt || lead.createdAt)}`}
                          >
                            <span className="block truncate">
                              {formatDate(lead.updatedAt || lead.createdAt)}
                            </span>
                          </td>

                          {/* 11. Action */}
                          <td
                            style={{ width: 110, minWidth: 110, maxWidth: 110 }}
                            className="p-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 text-center"
                            onClick={(e) => e.stopPropagation()}
                            title="Actions"
                          >
                            <div className="flex items-center justify-center gap-1 min-w-0">
                              <button
                                onClick={() => {
                                  setSelectedLeadId(lead.id);
                                  setIsDrawerOpen(true);
                                }}
                                className="px-2.5 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                                title="View Lead Details"
                              >
                                View
                              </button>
                              <button
                                onClick={() => setDeleteTarget(lead)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
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
          </CardContent>
        </Card>

        {/* Sticky Mobile Bulk Action Bar */}
        {selectedLeadIds.length > 0 && (
          <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 p-3 z-40 shadow-soft-2xl animate-slide-up flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300">
                {selectedLeadIds.length} {selectedLeadIds.length === 1 ? 'lead' : 'leads'} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedLeadIds([])}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value as Priority)}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-white min-h-[40px] focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkPriority}
                  disabled={bulkUpdatingPriority}
                  className="px-2.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg min-h-[40px] shrink-0"
                >
                  Set
                </button>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={targetTelecallerId}
                  onChange={(e) => setTargetTelecallerId(e.target.value)}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-white min-h-[40px] focus:outline-none"
                >
                  <option value="">Telecaller</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkAssign}
                  disabled={!targetTelecallerId || bulkAssigning}
                  className="px-2.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 min-h-[40px] shrink-0"
                >
                  Assign
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected ({selectedLeadIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Single Lead Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Lead"
          description="Confirm lead removal from system"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete this lead?</p>
                <p className="mt-1 text-slate-600">
                  Company: <strong>{deleteTarget.companyName}</strong>
                </p>
                <p className="mt-1 text-rose-700 text-[11px]">
                  This action will archive the record and remove it from active telecalling queues.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmSingleDelete}
                loading={deleting}
              >
                Delete Lead
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowBulkDeleteConfirm(false)}
          title="Delete Selected Leads"
          description="Confirm batch removal of multiple leads"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">
                  Delete {selectedLeadIds.length} selected leads?
                </p>
                <p className="mt-1 text-rose-700 text-[11px]">
                  All {selectedLeadIds.length} selected records will be archived and removed from queues. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmBulkDelete}
                loading={bulkDeleting}
              >
                Yes, Delete {selectedLeadIds.length} Leads
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <LeadDrawer
        leadId={selectedLeadId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadId(null);
        }}
        onLeadUpdated={(updated) => {
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        }}
      />

      <CreateLeadModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newLead) => {
          setLeads((prev) => [newLead, ...prev]);
        }}
      />
    </AppLayout>
  );
}
