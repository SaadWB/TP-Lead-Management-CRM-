'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  FileText,
  Activity,
  History,
  Send,
  Plus,
  PhoneCall,
  CalendarPlus,
  Pencil,
  Check,
} from 'lucide-react';
import { Lead, TELECALLER_KANBAN_COLUMNS, Priority, PRIORITIES, SalesStage, SALES_STAGE_OPTIONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDateTime, formatDate, getPriorityColor, getStageColor } from '@/lib/utils';
import { CallLogModal } from './CallLogModal';
import { TaskModal } from './TaskModal';
import { HandoverModal } from '../kanban/HandoverModal';
import { UpdateSalesStageModal } from './UpdateSalesStageModal';
import { ScheduleFollowUpModal } from '../kanban/ScheduleFollowUpModal';
import { useAuth } from '@/lib/authContext';

interface LeadDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: (lead: Lead) => void;
}

export function LeadDrawer({
  leadId,
  isOpen,
  onClose,
  onLeadUpdated,
}: LeadDrawerProps) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'calling' | 'tasks' | 'notes' | 'timeline'>('overview');

  // Modals state
  const [showCallModal, setShowCallModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showSalesStageModal, setShowSalesStageModal] = useState(false);
  const [selectedSalesStage, setSelectedSalesStage] = useState<SalesStage | undefined>(undefined);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTargetStage, setScheduleTargetStage] = useState('');

  // Quick note state
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Editable contact person & priority state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  async function handlePriorityChange(newPriority: Priority) {
    if (!lead) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}/priority`, { priority: newPriority });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  async function handleSaveContactPerson() {
    if (!lead) return;
    setSavingContact(true);
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { contactPerson: contactInput.trim() || null });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
        setIsEditingContact(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update contact person');
    } finally {
      setSavingContact(false);
    }
  }

  useEffect(() => {
    if (leadId && isOpen) {
      loadLead(leadId);
      setIsEditingContact(false);
    }
  }, [leadId, isOpen]);

  async function loadLead(id: string) {
    setLoading(true);
    try {
      const res = await api.get<Lead>(`/leads/${id}`);
      if (res.success && res.data) {
        setLead(res.data);
      }
    } catch (err) {
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!lead || !newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const updatedNotes = lead.notes
        ? `${lead.notes}\n[${new Date().toISOString().split('T')[0]} - ${user?.name}]: ${newNote.trim()}`
        : `[${new Date().toISOString().split('T')[0]} - ${user?.name}]: ${newNote.trim()}`;

      const res = await api.patch<Lead>(`/leads/${lead.id}`, { notes: updatedNotes });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
        setNewNote('');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSubmittingNote(false);
    }
  }

  async function handleQuickStageChange(newStage: string) {
    if (!lead) return;
    if (newStage === 'Assign to Salesman' || newStage === 'ASSIGNED_TO_SALESMAN') {
      setShowHandoverModal(true);
      return;
    }
    if (newStage === 'Callback Requested' || newStage === 'Demo Requested') {
      setScheduleTargetStage(newStage);
      setShowScheduleModal(true);
      return;
    }
    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, { pipelineStage: newStage });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Stage transition failed');
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'COMPLETED' });
      if (lead) loadLead(lead.id);
    } catch (err) {
      console.error(err);
    }
  }

  if (!isOpen) return null;

  const priorityStyle = lead ? getPriorityColor(lead.priority) : { bg: '', text: '', border: '' };
  const stageStyle = lead ? getStageColor(lead.pipelineStage) : { bg: '', text: '', border: '' };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-soft-xl border-l border-slate-200 flex flex-col z-10 animate-fade-in">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {lead?.companyName?.charAt(0) || 'L'}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {lead?.companyName || 'Loading...'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 font-medium">
                    Contact: <strong>{lead?.contactPerson}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500">{lead?.serviceProduct}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {lead && (
            <>
              {/* Quick Action Bar */}
              <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-2 shrink-0">
                  {/* Click-to-call */}
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs border border-emerald-200 transition-colors cursor-pointer"
                    title="Click-to-call using system dialer"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call ({lead.phone})
                  </a>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowCallModal(true)}
                    icon={<PhoneCall className="h-3.5 w-3.5" />}
                  >
                    Log Call
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTaskModal(true)}
                    icon={<CalendarPlus className="h-3.5 w-3.5" />}
                  >
                    Schedule Task
                  </Button>

                  {user?.role !== 'SALESMAN' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowHandoverModal(true)}
                      icon={<Send className="h-3.5 w-3.5 text-sky-600" />}
                    >
                      Handover to Sales
                    </Button>
                  )}
                </div>

                {/* Stage Selector depending on role */}
                {user?.role === 'SALESMAN' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Sales Stage:
                    </span>
                    <select
                      value={lead.salesStage || 'ASSIGNED'}
                      onChange={(e) => {
                        setSelectedSalesStage(e.target.value as SalesStage);
                        setShowSalesStageModal(true);
                      }}
                      className="text-xs font-bold px-2.5 py-1 bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs"
                    >
                      {SALES_STAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSalesStage((lead.salesStage as SalesStage) || 'ASSIGNED');
                        setShowSalesStageModal(true);
                      }}
                      className="text-[11px] py-1 px-2.5 text-slate-700"
                    >
                      Update
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Pipeline:
                    </span>
                    <select
                      value={lead.pipelineStage}
                      onChange={(e) => handleQuickStageChange(e.target.value)}
                      className="text-xs font-semibold px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                    >
                      {TELECALLER_KANBAN_COLUMNS.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.title}
                        </option>
                      ))}
                    </select>

                    {lead.lastCallOutcome && (
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Outcome:</span>
                        <span className="text-xs font-bold text-slate-800">{lead.lastCallOutcome}</span>
                      </div>
                    )}

                    {lead.salesStage && (
                      <div className="flex items-center gap-1.5 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                        <span className="text-[10px] uppercase font-bold text-teal-700">Sales Stage:</span>
                        <span className="text-xs font-bold text-teal-900">{lead.salesStage.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
                {[
                  { id: 'overview', label: 'Company Info', icon: FileText },
                  { id: 'calling', label: `Calls (${lead.callAttempts})`, icon: PhoneCall },
                  { id: 'tasks', label: `Tasks (${lead.followUpTasks?.length || 0})`, icon: Calendar },
                  { id: 'notes', label: 'Notes & Objections', icon: History },
                  { id: 'timeline', label: 'Activity Timeline', icon: Activity },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-sky-600 text-sky-600 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Status badges summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Priority
                          </span>
                          {user?.role === 'SUPER_ADMIN' && (
                            <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider">Editable</span>
                          )}
                        </div>
                        {user?.role === 'SUPER_ADMIN' ? (
                          <select
                            value={lead.priority}
                            onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                            className="mt-1 w-full text-xs font-bold bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}
                          >
                            {lead.priority}
                          </span>
                        )}
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Call Outcome
                        </span>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}
                        >
                          {lead.pipelineStage}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Sales Stage
                          </span>
                          {user?.role === 'SALESMAN' && (
                            <button
                              onClick={() => {
                                setSelectedSalesStage((lead.salesStage as SalesStage) || 'ASSIGNED');
                                setShowSalesStageModal(true);
                              }}
                              className="text-[9px] text-sky-600 hover:text-sky-800 font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Update
                            </button>
                          )}
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold border ${
                            lead.salesStage
                              ? `${getStageColor(lead.salesStage).bg} ${getStageColor(lead.salesStage).text} ${getStageColor(lead.salesStage).border}`
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {lead.salesStage ? lead.salesStage.replace(/_/g, ' ') : 'Not Assigned'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Assigned Telecaller
                        </span>
                        <span className="text-xs font-semibold text-slate-800 block mt-1">
                          {lead.assignedTelecaller?.name || 'Unassigned'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Assigned Salesman
                        </span>
                        <span className="text-xs font-semibold text-slate-800 block mt-1">
                          {lead.assignedSalesman?.name || 'Not handed over'}
                        </span>
                      </div>
                    </div>

                    {/* Company & Contact Details */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Primary Contact & Company Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="flex items-start gap-2.5">
                          <User className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-400 block">Contact Person</span>
                              {!isEditingContact && (
                                <button
                                  onClick={() => {
                                    setContactInput(lead.contactPerson || '');
                                    setIsEditingContact(true);
                                  }}
                                  className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Pencil className="h-2.5 w-2.5" /> Edit
                                </button>
                              )}
                            </div>
                            {isEditingContact ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="text"
                                  value={contactInput}
                                  onChange={(e) => setContactInput(e.target.value)}
                                  placeholder="Name (optional)"
                                  className="text-xs px-2 py-1 border border-slate-300 rounded bg-white w-full max-w-[170px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                                <button
                                  onClick={handleSaveContactPerson}
                                  disabled={savingContact}
                                  className="p-1 bg-sky-600 text-white rounded hover:bg-sky-700 cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setIsEditingContact(false)}
                                  className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-800 block">
                                {lead.contactPerson || (
                                  <span className="text-slate-400 font-normal italic">- (Not available)</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[11px] text-slate-400 block">Phone</span>
                            <span className="text-xs font-bold text-slate-800">{lead.phone}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[11px] text-slate-400 block">Email Address</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {lead.email || 'None on file'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Globe className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[11px] text-slate-400 block">Website</span>
                            {lead.website ? (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-sky-600 hover:underline"
                              >
                                {lead.website}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">None</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[11px] text-slate-400 block">Location</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {lead.city || lead.state ? `${lead.city || ''}, ${lead.state || ''}` : 'Not specified'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-[11px] text-slate-400 block">Created On</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {formatDateTime(lead.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Next Action & Follow-up box */}
                    <div className="bg-sky-50/60 rounded-xl border border-sky-100 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-sky-600" /> Next Follow-up Commitment
                        </span>
                        {lead.nextFollowUpDate && (
                          <Badge variant="blue" size="sm">
                            Due: {formatDateTime(lead.nextFollowUpDate)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium">
                        {lead.nextAction || 'No upcoming action scheduled.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. CALLING TAB */}
                {activeTab === 'calling' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Call History & Attempts ({lead.callAttempts})
                        </h3>
                        <p className="text-xs text-slate-500">
                          Last Outcome: <strong>{lead.lastCallOutcome || 'Never contacted'}</strong>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowCallModal(true)}
                        icon={<PhoneCall className="h-3.5 w-3.5" />}
                      >
                        Log New Call
                      </Button>
                    </div>

                    {lead.callLogs && lead.callLogs.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                        {lead.callLogs.map((log) => (
                          <div key={log.id} className="p-4 space-y-1.5 hover:bg-slate-50/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="blue" size="sm">
                                  {log.outcome}
                                </Badge>
                                <span className="text-xs font-bold text-slate-800">
                                  Caller: {log.user?.name || 'Telecaller'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {formatDateTime(log.contactDate)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed font-normal">
                              {log.notes || 'No call notes entered.'}
                            </p>
                            {log.durationSeconds ? (
                              <p className="text-[10px] text-slate-400">
                                Duration: {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <PhoneCall className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">No calls recorded yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Click Log Call above to record outcome and conversation notes.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. TASKS TAB */}
                {activeTab === 'tasks' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Follow-ups & Scheduled Tasks
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => setShowTaskModal(true)}
                        icon={<Plus className="h-3.5 w-3.5" />}
                      >
                        Schedule Task
                      </Button>
                    </div>

                    {lead.followUpTasks && lead.followUpTasks.length > 0 ? (
                      <div className="space-y-2.5">
                        {lead.followUpTasks.map((t) => (
                          <div
                            key={t.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                              t.status === 'COMPLETED'
                                ? 'bg-slate-50 border-slate-200 opacity-70'
                                : t.isOverdue
                                ? 'bg-rose-50/50 border-rose-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={t.taskType === 'DEMO' ? 'cyan' : 'amber'} size="sm">
                                  {t.taskType}
                                </Badge>
                                <span className="text-xs font-bold text-slate-800">
                                  Due: {formatDate(t.dueDate)} {t.dueTime || ''}
                                </span>
                                {t.isOverdue && (
                                  <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 font-medium">
                                {t.notes || 'No description provided'}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                Assigned to: {t.assignedUser?.name || 'Owner'}
                              </span>
                            </div>

                            {t.status === 'PENDING' && (
                              <button
                                onClick={() => handleCompleteTask(t.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-soft-sm cursor-pointer transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Done
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Calendar className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">No tasks currently scheduled</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. NOTES & OBJECTIONS TAB */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">Add New Note or Objection</label>
                      <textarea
                        rows={3}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Log customer objection, feedback, pricing friction, procurement timeline..."
                        className="w-full bg-white border border-slate-300 rounded-lg text-xs text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                      />
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          onClick={handleAddNote}
                          loading={submittingNote}
                          disabled={!newNote.trim()}
                        >
                          Append Note
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Historical Notes Archive
                      </h4>
                      <div className="p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {lead.notes || 'No recorded notes.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. TIMELINE TAB */}
                {activeTab === 'timeline' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      End-to-End Activity Timeline
                    </h3>
                    {lead.activities && lead.activities.length > 0 ? (
                      <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-2">
                        {lead.activities.map((act) => (
                          <div key={act.id} className="relative">
                            {/* Circle bullet */}
                            <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-600 ring-2 ring-slate-100" />
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-soft-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  {act.user?.name || 'System'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatDateTime(act.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">{act.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No activity logged.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-modals */}
      <CallLogModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        lead={lead}
        onSuccess={(updated) => {
          setLead(updated);
          onLeadUpdated(updated);
        }}
      />

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        lead={lead}
        onSuccess={() => {
          if (lead) loadLead(lead.id);
        }}
      />

      <HandoverModal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        lead={lead}
        targetStage="ASSIGNED_TO_SALESMAN"
        onSuccess={(updated) => {
          setLead(updated);
          onLeadUpdated(updated);
        }}
      />

      <UpdateSalesStageModal
        isOpen={showSalesStageModal}
        onClose={() => setShowSalesStageModal(false)}
        lead={lead}
        initialStage={selectedSalesStage}
        onSuccess={(updated) => {
          setLead(updated);
          onLeadUpdated(updated);
          setShowSalesStageModal(false);
        }}
      />

      <ScheduleFollowUpModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        lead={lead}
        targetStage={scheduleTargetStage}
        onSuccess={(updated) => {
          setLead(updated);
          onLeadUpdated(updated);
          setShowScheduleModal(false);
        }}
      />
    </div>
  );
}
