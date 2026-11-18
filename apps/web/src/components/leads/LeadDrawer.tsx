'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  User as UserIcon,
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
  Compass,
  Building,
  UserCheck,
  MessageSquare,
  Loader2,
  Copy,
} from 'lucide-react';
import { Lead, TELECALLER_KANBAN_COLUMNS, Priority, PRIORITIES, SalesStage, SALES_STAGE_OPTIONS, type User, normalizePipelineStage } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDateTime, formatDate, getPriorityColor, getStageColor, getOutcomeColor, getPriorityLabel } from '@/lib/utils';
import { invalidateCache, updateCachedLead, findLeadInCache } from '@/lib/apiCache';
import { CallLogModal } from './CallLogModal';
import { TaskModal } from './TaskModal';
import { HandoverModal } from '../kanban/HandoverModal';
import { UpdateSalesStageModal } from './UpdateSalesStageModal';
import { ScheduleFollowUpModal } from '../kanban/ScheduleFollowUpModal';
import { useAuth } from '@/lib/authContext';
import { WhatsAppButton } from './WhatsAppButton';

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

  // Full company info edit state (editable for both Admin & Telecaller)
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const copyPhoneToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };
  const [infoForm, setInfoForm] = useState({
    companyName: '',
    contactPerson: '',
    alternateName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    website: '',
    serviceProduct: '',
    city: '',
    state: '',
  });

  const [pipelineOptions, setPipelineOptions] = useState<string[]>([
    'New Lead',
    'Attempting Contact',
    'Connected',
    'Follow-up',
    'Demo',
    'Closed',
  ]);
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

  const [telecallers, setTelecallers] = useState<User[]>([]);
  const [salesmen, setSalesmen] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.get<{
        pipelineStages?: { name: string; isActive: boolean }[];
        stages?: { name: string; isActive: boolean }[];
        callOutcomes?: { name: string; isActive: boolean }[];
        outcomes?: { name: string; isActive: boolean }[];
      }>('/options')
        .then((res) => {
          if (res.success && res.data) {
            const stages = res.data.pipelineStages || res.data.stages;
            const outcomes = res.data.callOutcomes || res.data.outcomes;
            if (stages && stages.length > 0) {
              setPipelineOptions(stages.filter((s) => s.isActive).map((s) => s.name));
            }
            if (outcomes && outcomes.length > 0) {
              setOutcomeOptions(outcomes.filter((o) => o.isActive).map((o) => o.name));
            }
          }
        })
        .catch(() => {});

      api.get<User[]>('/users', { role: 'TELECALLER', isActive: true })
        .then((res) => {
          if (res.success && res.data) setTelecallers(res.data);
        })
        .catch(() => {});

      api.get<User[]>('/users', { role: 'SALESMAN', isActive: true })
        .then((res) => {
          if (res.success && res.data) setSalesmen(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  async function handlePriorityChange(newPriority: Priority) {
    if (!lead) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}/priority`, { priority: newPriority });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update priority');
    }
  }

  async function handleOutcomeChange(newOutcome: string) {
    if (!lead) return;
    const targetOutcome = newOutcome || null;
    const updatedLead: Lead = {
      ...lead,
      lastCallOutcome: targetOutcome || undefined,
    };
    // Instant optimistic update to prevent UI lag or shifting
    setLead(updatedLead);
    onLeadUpdated(updatedLead);
    updateCachedLead(updatedLead);

    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { lastCallOutcome: targetOutcome });
      if (res.success && res.data) {
        const merged = { ...updatedLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update outcome');
      setLead(lead);
      onLeadUpdated(lead);
    }
  }

  async function handleSalesStageChange(newSalesStage: string) {
    if (!lead) return;
    if (!newSalesStage) {
      try {
        const res = await api.patch<Lead>(`/leads/${lead.id}`, { salesStage: null });
        if (res.success && res.data) {
          const merged: Lead = { ...lead, ...res.data, salesStage: undefined };
          setLead(merged);
          onLeadUpdated(merged);
          updateCachedLead(merged);
          invalidateCache('/reports/dashboard');
        }
      } catch (err: any) {
        alert(err.message || 'Failed to update sales stage');
      }
      return;
    }

    const targetStage = newSalesStage as SalesStage;
    const isModalRequired =
      targetStage === 'DEMO_SCHEDULED' ||
      targetStage === 'FOLLOW_UP_REQUIRED' ||
      targetStage === 'CONVERTED' ||
      targetStage === 'LOST';

    if (isModalRequired) {
      setSelectedSalesStage(targetStage);
      setShowSalesStageModal(true);
      return;
    }

    const updatedLead: Lead = {
      ...lead,
      salesStage: targetStage,
    };
    // Instant optimistic update
    setLead(updatedLead);
    onLeadUpdated(updatedLead);
    updateCachedLead(updatedLead);

    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { salesStage: targetStage });
      if (res.success && res.data) {
        const merged = { ...updatedLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      // If direct patch fails, open modal for full details
      setSelectedSalesStage(targetStage);
      setShowSalesStageModal(true);
    }
  }

  async function handleTelecallerChange(newTelecallerId: string) {
    if (!lead) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        assignedTelecallerId: newTelecallerId || null,
      });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update assigned telecaller');
    }
  }

  async function handleSalesmanChange(newSalesmanId: string) {
    if (!lead) return;
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, {
        assignedSalesmanId: newSalesmanId || null,
      });
      if (res.success && res.data) {
        setLead(res.data);
        onLeadUpdated(res.data);
        updateCachedLead(res.data);
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update assigned salesman');
    }
  }

  async function handleSaveContactPerson() {
    if (!lead) return;
    const trimmed = contactInput.trim() || null;
    const updatedLead: Lead = {
      ...lead,
      contactPerson: trimmed || undefined,
    };
    // Instant optimistic update - prevents slow saving and prevents fields from blanking out
    setLead(updatedLead);
    onLeadUpdated(updatedLead);
    updateCachedLead(updatedLead);
    setIsEditingContact(false);

    setSavingContact(true);
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { contactPerson: trimmed });
      if (res.success && res.data) {
        const merged = { ...updatedLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update contact person');
      setLead(lead);
      onLeadUpdated(lead);
    } finally {
      setSavingContact(false);
    }
  }

  // Save all Company Info & Primary Contact inputs (both Admin and Telecaller)
  async function handleSaveCompanyInfo() {
    if (!lead) return;
    const patchPayload: any = {
      companyName: infoForm.companyName.trim() || lead.companyName,
      contactPerson: infoForm.contactPerson.trim() || null,
      alternateName: infoForm.alternateName.trim() || null,
      phone: infoForm.phone.trim() || lead.phone,
      alternatePhone: infoForm.alternatePhone.trim() || null,
      email: infoForm.email.trim() || null,
      website: infoForm.website.trim() || null,
      serviceProduct: infoForm.serviceProduct.trim() || lead.serviceProduct,
      city: infoForm.city.trim() || null,
      state: infoForm.state.trim() || null,
    };

    const updatedLead: Lead = {
      ...lead,
      ...patchPayload,
    };
    // Instant optimistic update: exit edit mode in 0ms with zero lag
    setLead(updatedLead);
    onLeadUpdated(updatedLead);
    updateCachedLead(updatedLead);
    setIsEditingInfo(false);

    setSavingInfo(true);
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, patchPayload);
      if (res.success && res.data) {
        const merged = { ...updatedLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
      }
    } catch (err: any) {
      // Revert if error
      setLead(lead);
      onLeadUpdated(lead);
      updateCachedLead(lead);
      setIsEditingInfo(true);
      alert(err.message || 'Failed to update company information');
    } finally {
      setSavingInfo(false);
    }
  }

  // Populate infoForm whenever lead changes
  useEffect(() => {
    if (lead) {
      setInfoForm({
        companyName: lead.companyName || '',
        contactPerson: lead.contactPerson || '',
        alternateName: lead.alternateName || '',
        phone: lead.phone || '',
        alternatePhone: lead.alternatePhone || '',
        email: lead.email || '',
        website: lead.website || '',
        serviceProduct: lead.serviceProduct || '',
        city: lead.city || '',
        state: lead.state || '',
      });
    }
  }, [lead?.id]);

  useEffect(() => {
    if (!isOpen) {
      // Clear lead on close so next lead opened doesn't show previous lead
      setLead(null);
      setIsEditingContact(false);
      setIsEditingInfo(false);
      return;
    }
    if (leadId) {
      // Check cache first for instant 0ms sidebar display without loading spinner
      const cached = findLeadInCache(leadId);
      if (cached) {
        setLead(cached);
        setLoading(false);
      } else {
        setLead(null);
        setLoading(true);
      }
      setIsEditingContact(false);
      setIsEditingInfo(false);
      loadLead(leadId, !cached);
    }
  }, [leadId, isOpen]);

  async function loadLead(id: string, showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get<Lead>(`/leads/${id}`);
      if (res.success && res.data) {
        const fetchedLead = res.data;
        setLead((prev) => (prev ? { ...prev, ...fetchedLead } : fetchedLead));
        updateCachedLead(fetchedLead);
      }
    } catch (err) {
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!lead || !newNote.trim()) return;
    const noteText = newNote.trim();
    const formattedNote = `[${new Date().toISOString().split('T')[0]} - ${user?.name || 'User'}]: ${noteText}`;
    const updatedNotes = lead.notes
      ? `${lead.notes}\n${formattedNote}`
      : formattedNote;

    // Instant optimistic update (0ms UI lag)
    const optimisticLead: Lead = { ...lead, notes: updatedNotes };
    setLead(optimisticLead);
    onLeadUpdated(optimisticLead);
    updateCachedLead(optimisticLead);
    setNewNote('');

    setSubmittingNote(true);
    try {
      const res = await api.patch<Lead>(`/leads/${lead.id}`, { notes: updatedNotes });
      if (res.success && res.data) {
        const merged = { ...optimisticLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
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

    // Instant optimistic update (0ms UI lag)
    const previousLead = { ...lead };
    const optimisticLead: Lead = { ...lead, pipelineStage: newStage };
    setLead(optimisticLead);
    onLeadUpdated(optimisticLead);
    updateCachedLead(optimisticLead);

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, { pipelineStage: newStage });
      if (res.success && res.data) {
        const merged = { ...optimisticLead, ...res.data };
        setLead(merged);
        onLeadUpdated(merged);
        updateCachedLead(merged);
      }
    } catch (err: any) {
      setLead(previousLead);
      onLeadUpdated(previousLead);
      updateCachedLead(previousLead);
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
  const outcomeStyle = lead ? getOutcomeColor(lead.lastCallOutcome) : { bg: '', text: '', border: '' };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-soft-xl border-l border-slate-200 flex flex-col z-10 animate-fade-in">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {lead?.companyName?.charAt(0) || 'L'}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {lead ? lead.companyName : (loading ? 'Loading lead details...' : 'Lead Details')}
                </h2>
                {lead && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 font-medium">
                      Contact: <strong>{lead.contactPerson || '-'}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">{lead.serviceProduct}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading && !lead && (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading lead details...</p>
            </div>
          )}

          {!loading && !lead && (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-400">
              <p className="text-xs font-medium">No lead selected.</p>
            </div>
          )}

          {lead && (
            <>
              {/* Top Quick Actions Bar */}
              <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-2 shrink-0">
                  {/* Click-to-call */}
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs border border-emerald-200 transition-colors cursor-pointer min-h-[36px]"
                    title="Click-to-call primary number"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call ({lead.phone})
                  </a>

                  {/* WhatsApp button */}
                  <WhatsAppButton
                    phone={lead.phone}
                    leadId={lead.id}
                    size="sm"
                    showText={true}
                    className="px-3 py-1.5 min-h-[36px]"
                  />

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
              </div>

              {/* Top Structured Pipeline & Status Bar: Priority, Pipeline, Last Outcome, Sales Pipeline */}
              <div className="px-5 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 1. Priority */}
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-soft-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Priority</span>
                    <select
                      value={lead.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                      className={`w-full text-xs font-bold rounded px-1.5 py-1 border cursor-pointer ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border} focus:outline-none focus:ring-1 focus:ring-sky-500`}
                    >
                      <option value="LOW" className="bg-white text-blue-700 font-bold">Cold</option>
                      <option value="MEDIUM" className="bg-white text-amber-800 font-bold">Warm</option>
                      <option value="HIGH" className="bg-white text-orange-700 font-bold">Hot</option>
                      <option value="URGENT" className="bg-white text-red-700 font-bold">Urgent (Hot)</option>
                    </select>
                  </div>

                  {/* 2. Pipeline */}
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-soft-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Pipeline</span>
                    <select
                      value={normalizePipelineStage(lead.pipelineStage)}
                      onChange={(e) => handleQuickStageChange(e.target.value)}
                      className={`w-full text-xs font-bold rounded px-1.5 py-1 border cursor-pointer ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border} focus:outline-none focus:ring-1 focus:ring-sky-500`}
                    >
                      {Array.from(new Set([...pipelineOptions, normalizePipelineStage(lead.pipelineStage)].filter(Boolean))).map((opt) => (
                        <option key={opt} value={opt} className="bg-white text-slate-800 font-semibold">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Last Outcome */}
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-soft-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Last Outcome</span>
                    <select
                      value={lead.lastCallOutcome || ''}
                      onChange={(e) => handleOutcomeChange(e.target.value)}
                      className={`w-full text-xs font-bold rounded px-1.5 py-1 border cursor-pointer ${
                        lead.lastCallOutcome
                          ? `${outcomeStyle.bg} ${outcomeStyle.text} ${outcomeStyle.border}`
                          : 'bg-slate-50 text-slate-600 border-slate-200 font-normal'
                      } focus:outline-none focus:ring-1 focus:ring-sky-500`}
                    >
                      <option value="" className="bg-white text-slate-600 font-normal">-- Select Outcome --</option>
                      {outcomeOptions.map((o) => (
                        <option key={o} value={o} className="bg-white text-slate-800 font-semibold">
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Sales Pipeline */}
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-soft-xs">
                    <span className="text-[10px] uppercase font-bold text-teal-700 block mb-0.5">Sales Pipeline</span>
                    <select
                      value={lead.salesStage || ''}
                      onChange={(e) => handleSalesStageChange(e.target.value)}
                      className={`w-full text-xs font-bold rounded px-1.5 py-1 border cursor-pointer ${
                        lead.salesStage
                          ? `${getStageColor(lead.salesStage).bg} ${getStageColor(lead.salesStage).text} ${getStageColor(lead.salesStage).border}`
                          : 'bg-white text-slate-600 border-slate-200 font-normal'
                      } focus:outline-none focus:ring-1 focus:ring-teal-500`}
                    >
                      <option value="" className="bg-white text-slate-500 font-normal">-- Not Handed Over --</option>
                      {SALES_STAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-semibold">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                    {/* Top Operational Assignment & Follow-up Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Assigned Telecaller */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                            Assigned Telecaller
                          </span>
                          {user?.role === 'SUPER_ADMIN' && (
                            <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider">Editable</span>
                          )}
                        </div>
                        {user?.role === 'SUPER_ADMIN' ? (
                          <select
                            value={lead.assignedTelecallerId || ''}
                            onChange={(e) => handleTelecallerChange(e.target.value)}
                            className={`mt-1.5 w-full text-xs font-semibold rounded px-2 py-1.5 border cursor-pointer shadow-soft-xs ${
                              lead.assignedTelecallerId
                                ? 'bg-white text-slate-800 border-slate-200 font-bold'
                                : 'bg-amber-50/70 text-amber-800 border-amber-200 italic'
                            } focus:outline-none focus:ring-1 focus:ring-sky-500`}
                          >
                            <option value="">-- Unassigned --</option>
                            {telecallers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-sky-600" />
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {lead.assignedTelecaller?.name || telecallers.find((t) => t.id === lead.assignedTelecallerId)?.name || 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Assigned Sales Closer / Salesman */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                            Assigned Sales Closer
                          </span>
                          {user?.role === 'SUPER_ADMIN' && (
                            <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider">Editable</span>
                          )}
                        </div>
                        {user?.role === 'SUPER_ADMIN' ? (
                          <select
                            value={lead.assignedSalesmanId || ''}
                            onChange={(e) => handleSalesmanChange(e.target.value)}
                            className="mt-1.5 w-full text-xs font-semibold bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs"
                          >
                            <option value="">-- Not Handed Over --</option>
                            {salesmen.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-teal-600" />
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {lead.assignedSalesman?.name || salesmen.find((s) => s.id === lead.assignedSalesmanId)?.name || 'Not handed over'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Call Attempts & Last Contact */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                          Call Activity
                        </span>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {lead.callAttempts || 0} Attempts
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {lead.lastContactDate ? formatDateTime(lead.lastContactDate) : (lead.lastActivityAt ? formatDateTime(lead.lastActivityAt) : 'Never')}
                          </span>
                        </div>
                      </div>

                      {/* Next Follow-up Commitment */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                          Next Follow-up
                        </span>
                        <div className="mt-1.5">
                          {lead.nextFollowUpDate ? (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate">
                              {formatDateTime(lead.nextFollowUpDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No follow-up set</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Company & Primary Contact Details (Fully Editable for Admin & Telecaller) */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-soft-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-sky-600" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Primary Contact & Company Information
                          </h3>
                        </div>
                        {(user?.role === 'SUPER_ADMIN' || user?.role === 'TELECALLER') && (
                          !isEditingInfo ? (
                            <button
                              type="button"
                              onClick={() => {
                                setInfoForm({
                                  companyName: lead.companyName || '',
                                  contactPerson: lead.contactPerson || '',
                                  alternateName: lead.alternateName || '',
                                  phone: lead.phone || '',
                                  alternatePhone: lead.alternatePhone || '',
                                  email: lead.email || '',
                                  website: lead.website || '',
                                  serviceProduct: lead.serviceProduct || '',
                                  city: lead.city || '',
                                  state: lead.state || '',
                                });
                                setIsEditingInfo(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-md text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" /> Edit Information
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveCompanyInfo}
                                disabled={savingInfo}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {savingInfo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingInfo(false)}
                                disabled={savingInfo}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      {isEditingInfo ? (
                        /* Edit Mode Form: Primary Person, Primary Phone, Alternate Person, Alternate Phone, Company Name, Email, Service/Product, Website, Location */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* 1. Primary Person */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Primary Person (Contact Person)</label>
                            <input
                              type="text"
                              value={infoForm.contactPerson}
                              onChange={(e) => setInfoForm({ ...infoForm, contactPerson: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                              placeholder="e.g. Jane Miller"
                            />
                          </div>

                          {/* 2. Primary Phone */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Primary Phone *</label>
                            <input
                              type="text"
                              value={infoForm.phone}
                              onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                              placeholder="e.g. +91 9876543210"
                            />
                          </div>

                          {/* 3. Alternate Person */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Alternate Person (Secondary Contact)</label>
                            <input
                              type="text"
                              value={infoForm.alternateName}
                              onChange={(e) => setInfoForm({ ...infoForm, alternateName: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                              placeholder="e.g. Secondary Contact Person"
                            />
                          </div>

                          {/* 4. Alternate Phone */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Alternate Phone (Secondary Number)</label>
                            <input
                              type="text"
                              value={infoForm.alternatePhone}
                              onChange={(e) => setInfoForm({ ...infoForm, alternatePhone: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                              placeholder="Alternate contact number"
                            />
                          </div>

                          {/* 5. Company Name */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Company Name *</label>
                            <input
                              type="text"
                              value={infoForm.companyName}
                              onChange={(e) => setInfoForm({ ...infoForm, companyName: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                              placeholder="Enter company name"
                            />
                          </div>

                          {/* 6. Email */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Email Address</label>
                            <input
                              type="email"
                              value={infoForm.email}
                              onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                              placeholder="email@example.com"
                            />
                          </div>

                          {/* 7. Service / Product */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Service / Product *</label>
                            <input
                              type="text"
                              value={infoForm.serviceProduct}
                              onChange={(e) => setInfoForm({ ...infoForm, serviceProduct: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                              placeholder="Service or Product name"
                            />
                          </div>

                          {/* 8. Website */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Website URL</label>
                            <input
                              type="text"
                              value={infoForm.website}
                              onChange={(e) => setInfoForm({ ...infoForm, website: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                              placeholder="https://..."
                            />
                          </div>

                          {/* 9. Location */}
                          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">City</label>
                              <input
                                type="text"
                                value={infoForm.city}
                                onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="City"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">State</label>
                              <input
                                type="text"
                                value={infoForm.state}
                                onChange={(e) => setInfoForm({ ...infoForm, state: e.target.value })}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="State"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* View Mode: Strictly ordered as Primary Person, Primary Phone, Alternate Person, Alternate Phone, Company Name, Email, Service/Product, Website, Location, Lead Source, Created On */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* 1. Primary Person */}
                          <div className="flex items-start gap-2.5">
                            <UserIcon className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Primary Person</span>
                              <span className="text-xs font-bold text-slate-800">
                                {lead.contactPerson || <span className="text-slate-400 font-normal italic">- (Not available)</span>}
                              </span>
                            </div>
                          </div>

                          {/* 2. Primary Phone */}
                          <div className="flex items-start gap-2.5">
                            <Phone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] text-slate-400 block font-medium">Primary Phone</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-sm font-bold text-slate-800 font-mono tracking-wide">{lead.phone}</span>
                                <button
                                  type="button"
                                  onClick={(e) => copyPhoneToClipboard(lead.phone, e)}
                                  className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded cursor-pointer transition-colors"
                                  title="Copy Primary Phone on click"
                                >
                                  {copiedPhone === lead.phone ? (
                                    <span className="text-xs text-emerald-600 font-bold">✓</span>
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="p-1 text-sky-600 hover:bg-sky-50 rounded cursor-pointer"
                                  title="Call Primary Phone"
                                >
                                  <PhoneCall className="h-3.5 w-3.5" />
                                </a>
                                <a
                                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="WhatsApp"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* 3. Alternate Person */}
                          <div className="flex items-start gap-2.5">
                            <UserIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Alternate Person</span>
                              <span className="text-xs font-bold text-slate-800">
                                {lead.alternateName || <span className="text-slate-400 font-normal italic">- (None)</span>}
                              </span>
                            </div>
                          </div>

                          {/* 4. Alternate Phone */}
                          <div className="flex items-start gap-2.5">
                            <Phone className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] text-slate-400 block font-medium">Alternate Phone</span>
                              {lead.alternatePhone ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-sm font-semibold text-slate-800 font-mono tracking-wide">{lead.alternatePhone}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => copyPhoneToClipboard(lead.alternatePhone!, e)}
                                    className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded cursor-pointer transition-colors"
                                    title="Copy Alternate Phone on click"
                                  >
                                    {copiedPhone === lead.alternatePhone ? (
                                      <span className="text-xs text-emerald-600 font-bold">✓</span>
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <a
                                    href={`tel:${lead.alternatePhone}`}
                                    className="p-1 text-sky-600 hover:bg-sky-50 rounded cursor-pointer"
                                    title="Call Alternate"
                                  >
                                    <PhoneCall className="h-3 w-3" />
                                  </a>
                                  <a
                                    href={`https://wa.me/${lead.alternatePhone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="WhatsApp Alternate"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">None provided</span>
                              )}
                            </div>
                          </div>

                          {/* 5. Company Name */}
                          <div className="flex items-start gap-2.5">
                            <Building className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Company Name</span>
                              <span className="text-xs font-bold text-slate-800">{lead.companyName}</span>
                            </div>
                          </div>

                          {/* 6. Email */}
                          <div className="flex items-start gap-2.5">
                            <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Email</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {lead.email || <span className="text-slate-400 font-normal italic">None on file</span>}
                              </span>
                            </div>
                          </div>

                          {/* 7. Service / Product */}
                          <div className="flex items-start gap-2.5">
                            <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Service / Product</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {lead.serviceProduct || 'Unspecified'}
                              </span>
                            </div>
                          </div>

                          {/* 8. Website */}
                          <div className="flex items-start gap-2.5">
                            <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Website</span>
                              {lead.website ? (
                                <a
                                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-sky-600 hover:underline"
                                >
                                  {lead.website}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">None</span>
                              )}
                            </div>
                          </div>

                          {/* 9. Location */}
                          <div className="flex items-start gap-2.5">
                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Location</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {[lead.city, lead.state].filter(Boolean).join(', ') || <span className="text-slate-400 italic">Not specified</span>}
                              </span>
                            </div>
                          </div>

                          {/* 10. Lead Source */}
                          <div className="flex items-start gap-2.5">
                            <Compass className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Lead Source</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {lead.leadSource || 'Unspecified'}
                                {lead.leadSource === 'Other' && lead.leadSourceOther ? ` (${lead.leadSourceOther})` : ''}
                              </span>
                            </div>
                          </div>

                          {/* 11. Created On */}
                          <div className="flex items-start gap-2.5">
                            <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[11px] text-slate-400 block font-medium">Created On</span>
                              <span className="text-xs font-semibold text-slate-800">
                                {formatDateTime(lead.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
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
