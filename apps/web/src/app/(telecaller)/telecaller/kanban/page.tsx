'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import { CallLogModal } from '@/components/leads/CallLogModal';
import { ScheduleFollowUpModal } from '@/components/kanban/ScheduleFollowUpModal';
import { HandoverModal } from '@/components/kanban/HandoverModal';
import { AddCustomOptionModal } from '@/components/leads/AddCustomOptionModal';
import { Lead, normalizeCallOutcome, Priority } from '@crm/shared';
import { api } from '@/lib/apiClient';
import {
  Clock,
  RefreshCw,
  Kanban,
  List,
  Phone,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  Undo2,
} from 'lucide-react';
import { formatDate, formatDateTime, getPriorityColor, getStageColor } from '@/lib/utils';

const DEFAULT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const DEFAULT_OUTCOMES = [
  'New Lead',
  'No Answer / Ringing',
  'Busy / Declined',
  'Callback Requested',
  'Not Interested',
  'Details on WhatsApp',
  'Demo Requested',
  'Interested',
  'Discussing',
  'Invalid / Wrong Number',
  'Do Not Contact',
  'Closed',
  'Assign to Salesman',
];

export default function TelecallerCallingDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);

  // Requirement 2: View toggle now has only two options: Lead List (default) and Kanban
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Requirement 3.2: Default list shows New Leads first
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('New Lead');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  // Requirement 3.3: Undo toast state
  const [undoToast, setUndoToast] = useState<{
    leadId: string;
    leadName: string;
    previousStage: string;
    previousFollowUpDate?: string | null;
    newStage: string;
  } | null>(null);
  const undoTimerRef = React.useRef<NodeJS.Timeout | null>(null);

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

  // Modal targets for inline updates in Lead List view
  const [scheduleTarget, setScheduleTarget] = useState<{ lead: Lead; targetStage: string } | null>(null);
  const [handoverTarget, setHandoverTarget] = useState<{ lead: Lead; targetStage: string } | null>(null);

  useEffect(() => {
    fetchLeads();
    fetchCustomOptions();
    const savedView = localStorage.getItem('calling_dashboard_view');
    if (savedView === 'list' || savedView === 'kanban') {
      setViewMode(savedView);
    } else {
      setViewMode('list'); // Default
    }
  }, []);

  function handleViewToggle(mode: 'list' | 'kanban') {
    setViewMode(mode);
    localStorage.setItem('calling_dashboard_view', mode);
  }

  function triggerUndoToast(lead: Lead, previousStage: string, newStage: string) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoToast({
      leadId: lead.id,
      leadName: lead.companyName,
      previousStage,
      previousFollowUpDate: lead.nextFollowUpDate,
      newStage,
    });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 7000);
  }

  async function handleUndo() {
    if (!undoToast) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    try {
      const res = await api.post<Lead>(`/leads/${undoToast.leadId}/stage`, {
        pipelineStage: undoToast.previousStage,
        nextFollowUpDate: undoToast.previousFollowUpDate || null,
      });
      if (res.success && res.data) {
        handleLeadUpdated(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to undo status update');
    } finally {
      setUndoToast(null);
    }
  }

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await api.get<Lead[]>('/leads', { limit: 100 });
      if (res.success && res.data) {
        setLeads(res.data);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  }

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

  function handleCardClick(leadId: string) {
    setSelectedLeadId(leadId);
    setIsDrawerOpen(true);
  }

  function handleLeadUpdated(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  // Handle inline outcome change from Lead List cards
  async function handleInlineOutcomeChange(lead: Lead, newOutcome: string) {
    if (newOutcome === '__ADD_NEW__') {
      setAddOptionModal({ isOpen: true, type: 'CALL_OUTCOME' });
      return;
    }

    if (!newOutcome || newOutcome === lead.pipelineStage) return;

    const previousStage = lead.pipelineStage;

    // Rules from earlier rounds:
    if (newOutcome === 'Callback Requested' || newOutcome === 'Demo Requested') {
      setScheduleTarget({ lead, targetStage: newOutcome });
      return;
    }

    if (newOutcome === 'Assign to Salesman' || newOutcome === 'ASSIGNED_TO_SALESMAN') {
      setHandoverTarget({ lead, targetStage: 'Assign to Salesman' });
      return;
    }

    // Direct update via API
    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: newOutcome,
      });
      if (res.success && res.data) {
        handleLeadUpdated(res.data);
        triggerUndoToast(lead, previousStage, newOutcome);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update call outcome');
    }
  }

  // Handle inline priority change
  async function handleInlinePriorityChange(lead: Lead, newPriority: string) {
    if (newPriority === '__ADD_NEW__') {
      setAddOptionModal({ isOpen: true, type: 'PRIORITY' });
      return;
    }
    if (!newPriority || newPriority === lead.priority) return;

    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        priority: newPriority,
      });
      if (res.success && res.data) {
        handleLeadUpdated(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  // Combined options
  const allPriorities = [
    ...DEFAULT_PRIORITIES,
    ...customPriorities.filter((p) => !DEFAULT_PRIORITIES.includes(p)),
  ];

  const allOutcomes = [
    ...DEFAULT_OUTCOMES,
    ...customOutcomes.filter((o) => !DEFAULT_OUTCOMES.includes(o) && o.trim().toLowerCase() !== 'special inquiry'),
  ].filter((o) => o.trim().toLowerCase() !== 'special inquiry');

  // Filter leads
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredLeads = leads.filter((lead) => {
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        lead.companyName.toLowerCase().includes(q) ||
        (lead.contactPerson && lead.contactPerson.toLowerCase().includes(q)) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Priority Dropdown Filter
    if (priorityFilter && lead.priority !== priorityFilter) {
      return false;
    }

    // Requirement 3.2: Last Call Outcome Dropdown Filter (default 'New Lead' includes Retry leads)
    if (outcomeFilter) {
      if (outcomeFilter === 'New Lead') {
        const stageStr: string = normalizeCallOutcome(lead.pipelineStage);
        const isNewOrRetry =
          stageStr === 'New Lead' ||
          lead.pipelineStage === 'NEW' ||
          (!lead.lastContactDate && !lead.callAttempts);
        if (!isNewOrRetry) return false;
      } else {
        if (normalizeCallOutcome(lead.pipelineStage) !== outcomeFilter) {
          return false;
        }
      }
    }

    // Overdue
    if (onlyOverdue) {
      if (!lead.nextFollowUpDate) return false;
      const isPast = lead.nextFollowUpDate.split('T')[0] < todayStr;
      if (!isPast) return false;
    }

    return true;
  });

  // Calculate top bar metrics
  const totalQueue = leads.length;
  const overdueCount = leads.filter(
    (l) => l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] < todayStr
  ).length;
  const dueTodayCount = leads.filter(
    (l) => l.nextFollowUpDate && l.nextFollowUpDate.split('T')[0] === todayStr
  ).length;
  const callbackDue = leads.filter(
    (l) => normalizeCallOutcome(l.pipelineStage) === 'Callback Requested'
  ).length;

  return (
    <AppLayout
      title="Calling Dashboard"
      subtitle="Interactive telecalling workspace with Lead List and Kanban board."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter assigned queue by company, phone, contact..."
    >
      <div className="h-full flex flex-col space-y-4">
        {/* Workspace Quick Metrics & Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-soft-sm">
          {/* Left metrics pills */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider pr-1">
              My Queue:
            </span>
            <span className="bg-slate-100 text-slate-800 font-bold px-2.5 py-1 rounded-md border border-slate-200">
              {totalQueue} Leads
            </span>
            <span className="bg-purple-50 text-purple-800 font-bold px-2.5 py-1 rounded-md border border-purple-200">
              {callbackDue} Callbacks
            </span>
            <span className="bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-md border border-amber-200">
              {dueTodayCount} Due Today
            </span>
            {overdueCount > 0 && (
              <span className="bg-rose-50 text-rose-700 font-bold px-2.5 py-1 rounded-md border border-rose-200 animate-pulse">
                {overdueCount} Overdue Follow-ups
              </span>
            )}
          </div>

          {/* Right filters & View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Requirement 2: View Toggle has only two options: Lead List (default) and Kanban */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs mr-1">
              <button
                onClick={() => handleViewToggle('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-soft-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Lead List (Default)</span>
              </button>
              <button
                onClick={() => handleViewToggle('kanban')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 shadow-soft-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
            </div>

            {/* Priority Filter Dropdown with '+ Add new option' */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') {
                  setAddOptionModal({ isOpen: true, type: 'PRIORITY' });
                } else {
                  setPriorityFilter(e.target.value);
                }
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer shadow-soft-xs"
            >
              <option value="">All Priorities</option>
              {allPriorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="__ADD_NEW__" className="text-primary-600 font-bold">
                + Add new option
              </option>
            </select>

            {/* Last Call Outcome Filter Dropdown with '+ Add new option' */}
            <select
              value={outcomeFilter}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW__') {
                  setAddOptionModal({ isOpen: true, type: 'CALL_OUTCOME' });
                } else {
                  setOutcomeFilter(e.target.value);
                }
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer shadow-soft-xs"
            >
              <option value="">All Call Outcomes</option>
              {allOutcomes.map((out) => (
                <option key={out} value={out}>
                  {out}
                </option>
              ))}
              <option value="__ADD_NEW__" className="text-primary-600 font-bold">
                + Add new option
              </option>
            </select>

            <button
              onClick={() => setOnlyOverdue(!onlyOverdue)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                onlyOverdue
                  ? 'bg-rose-600 text-white border-rose-600 shadow-soft-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Overdue Only
            </button>

            <button
              onClick={fetchLeads}
              title="Refresh queue"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Mode Content: Only Lead List or Kanban */}
        {viewMode === 'list' ? (
          /* Requirement 3: Lead List View (Default) */
          <div className="flex-1 overflow-y-auto space-y-3 pb-8">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
              <span>Showing {filteredLeads.length} leads in single-column scrollable list</span>
              <span className="text-slate-400">Update outcome directly from the card dropdown</span>
            </div>

            {loading && filteredLeads.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200/90 p-4 animate-pulse">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-6 bg-slate-200 rounded shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-slate-200 rounded w-1/3" />
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-28 h-8 bg-slate-200 rounded" />
                        <div className="w-20 h-8 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                No leads found matching current filters.
              </div>
            ) : (
              filteredLeads.map((lead, index) => {
                const priority = getPriorityColor(lead.priority);
                const stageColor = getStageColor(lead.pipelineStage);
                const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] < todayStr;
                const isDueToday = lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] === todayStr;
                const isRetry = lead.isRetry || (lead.callAttempts && lead.callAttempts > 0);

                return (
                  <div
                    key={lead.id}
                    onClick={() => handleCardClick(lead.id)}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-soft-xs hover:shadow-soft hover:border-slate-300 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Index number & Lead Identity */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Requirement 3.4: Serial number (1, 2, 3...) */}
                        <span className="bg-slate-100 text-slate-700 font-extrabold text-xs px-2.5 py-1 rounded-md border border-slate-200 shrink-0 mt-0.5">
                          #{index + 1}
                        </span>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors text-sm truncate max-w-sm">
                              {lead.companyName}
                            </h3>
                            <span className="text-xs text-slate-500 truncate">
                              — {lead.serviceProduct}
                            </span>

                            {/* Retry badge */}
                            {isRetry && lead.pipelineStage === 'New Lead' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                Retry
                              </span>
                            )}

                            {/* Overdue / Due Today Badge */}
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse">
                                <AlertTriangle className="h-3 w-3" /> Overdue
                              </span>
                            )}
                            {isDueToday && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Due Today
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                            <span>
                              Contact: <strong className="text-slate-800">{lead.contactPerson || '-'}</strong>
                            </span>
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" /> {lead.phone}
                            </a>
                            {lead.nextFollowUpDate && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                Follow-up: <strong>{formatDate(lead.nextFollowUpDate)}</strong>
                              </span>
                            )}
                            {lead.assignedSalesman && (
                              <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-semibold">
                                Closer: {lead.assignedSalesman.name} {lead.salesStage ? `(${lead.salesStage.replace(/_/g, ' ')})` : ''}
                              </span>
                            )}

                            {/* Requirement 3.4: Last Status Updated date and time */}
                            <span className="text-[11px] text-slate-500">
                              Last Status Updated:{' '}
                              <strong className="text-slate-700 font-medium">
                                {lead.lastStatusUpdatedAt ? formatDateTime(lead.lastStatusUpdatedAt) : '-'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Direct Inline Dropdowns & Actions (NO Log Call button) */}
                      <div
                        className="flex flex-wrap items-center gap-3 self-end lg:self-center shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Inline Priority Dropdown */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Priority:</span>
                          <select
                            value={lead.priority}
                            onChange={(e) => handleInlinePriorityChange(lead, e.target.value)}
                            className={`text-xs font-bold rounded-lg border px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${priority.bg} ${priority.text} ${priority.border}`}
                          >
                            {allPriorities.map((p) => (
                              <option key={p} value={p} className="bg-white text-slate-800 font-normal">
                                {p}
                              </option>
                            ))}
                            <option value="__ADD_NEW__" className="bg-white text-primary-600 font-bold">
                              + Add new option
                            </option>
                          </select>
                        </div>

                        {/* Inline Last Call Outcome Dropdown */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Outcome / Status:</span>
                          <select
                            value={lead.pipelineStage}
                            onChange={(e) => handleInlineOutcomeChange(lead, e.target.value)}
                            className={`text-xs font-bold rounded-lg border px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                          >
                            {allOutcomes.map((out) => (
                              <option key={out} value={out} className="bg-white text-slate-800 font-normal">
                                {out}
                              </option>
                            ))}
                            <option value="__ADD_NEW__" className="bg-white text-primary-600 font-bold">
                              + Add new option
                            </option>
                          </select>
                        </div>

                        <button
                          onClick={() => handleCardClick(lead.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Open Details Drawer"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Kanban Board View */
          <div className="flex-1 min-h-0">
            <KanbanBoard
              leads={filteredLeads}
              onLeadsChange={setLeads}
              onCardClick={handleCardClick}
              customColumns={customOutcomes
                .filter((o) => !DEFAULT_OUTCOMES.includes(o) && o.trim().toLowerCase() !== 'special inquiry')
                .map((name) => ({
                  id: name,
                  title: name,
                  color: 'indigo',
                  description: `Custom outcome: ${name}`,
                }))}
            />
          </div>
        )}
      </div>

      {/* Date & Time follow-up modal for Callback Requested or Demo Requested (from Lead List inline update) */}
      {scheduleTarget && (
        <ScheduleFollowUpModal
          isOpen={!!scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          lead={scheduleTarget.lead}
          targetStage={scheduleTarget.targetStage}
          onSuccess={(updated) => {
            const prevStage = scheduleTarget.lead.pipelineStage || 'New Lead';
            handleLeadUpdated(updated);
            triggerUndoToast(scheduleTarget.lead, prevStage, scheduleTarget.targetStage);
            setScheduleTarget(null);
          }}
        />
      )}

      {/* Handover modal for Assign to Salesman (from Lead List inline update) */}
      {handoverTarget && (
        <HandoverModal
          isOpen={!!handoverTarget}
          onClose={() => setHandoverTarget(null)}
          lead={handoverTarget.lead}
          targetStage={handoverTarget.targetStage}
          onSuccess={(updated) => {
            const prevStage = handoverTarget.lead.pipelineStage || 'New Lead';
            handleLeadUpdated(updated);
            triggerUndoToast(handoverTarget.lead, prevStage, handoverTarget.targetStage);
            setHandoverTarget(null);
          }}
        />
      )}

      {/* Add New Option Modal (+ Add new option) */}
      <AddCustomOptionModal
        isOpen={addOptionModal.isOpen}
        onClose={() => setAddOptionModal({ isOpen: false, type: 'CALL_OUTCOME' })}
        type={addOptionModal.type}
        existingOptions={addOptionModal.type === 'PRIORITY' ? allPriorities : allOutcomes}
        onSuccess={(newOption) => {
          if (addOptionModal.type === 'PRIORITY') {
            setCustomPriorities((prev) => [...prev, newOption]);
            setPriorityFilter(newOption);
          } else {
            setCustomOutcomes((prev) => [...prev, newOption]);
            setOutcomeFilter(newOption);
          }
        }}
      />

      {/* Sliding Lead Details Drawer */}
      <LeadDrawer
        leadId={selectedLeadId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadId(null);
        }}
        onLeadUpdated={handleLeadUpdated}
      />

      {/* Quick Call / Log Call Modal */}
      {activeCallLead && (
        <CallLogModal
          isOpen={!!activeCallLead}
          onClose={() => setActiveCallLead(null)}
          lead={activeCallLead}
          onSuccess={(updated) => {
            handleLeadUpdated(updated);
            setActiveCallLead(null);
          }}
        />
      )}

      {/* Requirement 3.3: Undo Toast Notification */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-white">Status updated: </span>
            <span className="text-slate-300 font-medium">{undoToast.leadName}</span> moved to{' '}
            <span className="font-bold text-sky-400">{undoToast.newStage}</span>
          </div>
          <button
            onClick={handleUndo}
            className="ml-2 flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <Undo2 className="h-3.5 w-3.5 text-slate-800" />
            <span>Undo</span>
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors ml-1"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </AppLayout>
  );
}
