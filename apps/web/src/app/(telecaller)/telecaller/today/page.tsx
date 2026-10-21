'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CallLogModal } from '@/components/leads/CallLogModal';
import { FollowUpCompletionModal } from '@/components/leads/FollowUpCompletionModal';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import { Lead } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { formatDate, getPriorityColor } from '@/lib/utils';
import {
  PhoneCall,
  Clock,
  CheckCircle2,
  Sparkles,
  Phone,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export default function TelecallerTodayPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<Lead | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Follow-up completion modal state (Closed / Not Closed flow)
  const [completionTarget, setCompletionTarget] = useState<{ lead: Lead; mode: 'CLOSED' | 'NOT_CLOSED' } | null>(null);

  // Calls logged today counter
  const [callsDoneToday, setCallsDoneToday] = useState(0);

  useEffect(() => {
    fetchTodayWork();
  }, []);

  async function fetchTodayWork() {
    setLoading(true);
    try {
      const res = await api.get<Lead[]>('/leads', { limit: 100 });
      if (res.success && res.data) {
        setLeads(res.data);

        // Count calls made today across leads
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCallsCount = 0;
        res.data.forEach((lead) => {
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
    } catch (err) {
      console.error('Failed to load today work:', err);
    } finally {
      setLoading(false);
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. New Fresh Leads:
  // Leads with pipelineStage 'New Lead' (either never called, or returned automatically on 3rd day after No Answer / Busy)
  const rawFreshLeads = leads.filter(
    (lead) =>
      lead.pipelineStage === 'New Lead' ||
      (!lead.lastCallOutcome && lead.callAttempts === 0 && lead.pipelineStage !== 'Closed' && lead.pipelineStage !== 'Do Not Contact')
  );

  // 2. Today's Follow-ups:
  // Leads with scheduled follow-up due on or before today, excluding Closed or DNC
  const rawFollowUpLeads = leads
    .filter((lead) => {
      if (lead.pipelineStage === 'Closed' || lead.pipelineStage === 'Do Not Contact') return false;
      if (!lead.nextFollowUpDate) {
        return lead.followUpTasks?.some(
          (t) => t.status === 'PENDING' && t.dueDate.split('T')[0] <= todayStr
        );
      }
      return lead.nextFollowUpDate.split('T')[0] <= todayStr;
    })
    .sort((a, b) => {
      // Overdue items sorted at the top!
      const dateA = a.nextFollowUpDate ? a.nextFollowUpDate.split('T')[0] : '9999-99-99';
      const dateB = b.nextFollowUpDate ? b.nextFollowUpDate.split('T')[0] : '9999-99-99';
      return dateA.localeCompare(dateB);
    });

  // Filter with search term
  const filterQuery = (list: Lead[]) => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (lead) =>
        lead.companyName.toLowerCase().includes(q) ||
        (lead.contactPerson && lead.contactPerson.toLowerCase().includes(q)) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.serviceProduct && lead.serviceProduct.toLowerCase().includes(q))
    );
  };

  const freshLeads = filterQuery(rawFreshLeads);
  const followUpLeads = filterQuery(rawFollowUpLeads);

  // Progress metrics
  const remainingWork = rawFreshLeads.length + rawFollowUpLeads.length;
  const totalDailyTarget = callsDoneToday + remainingWork;
  const progressPercent =
    totalDailyTarget > 0 ? Math.min(100, Math.round((callsDoneToday / totalDailyTarget) * 100)) : 100;

  function handleCallClick(lead: Lead) {
    setSelectedLeadForCall(lead);
    setIsCallModalOpen(true);
  }

  function handleLeadUpdated(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setCallsDoneToday((prev) => prev + 1);
    fetchTodayWork();
  }

  return (
    <AppLayout
      title="Today's Work"
      subtitle="Your active daily calling queue: fresh leads and prioritized follow-ups in one view."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter today's work..."
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Progress & Target Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-soft-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Daily Calling Progress
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  {progressPercent}% Complete
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target: Complete all fresh leads and scheduled follow-ups for today
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Today&apos;s Score</span>
                <span className="text-lg font-black text-slate-900">
                  {callsDoneToday}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {totalDailyTarget} calls</span>
                </span>
              </div>
              <button
                onClick={fetchTodayWork}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                title="Refresh queue"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-linear-to-r from-sky-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Side-by-Side Layout: New Fresh Leads (Left) and Today's Follow-ups (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* COLUMN 1 (LEFT): New Fresh Leads */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft-xs flex flex-col h-[calc(100vh-270px)] min-h-[520px] overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span>New Fresh Leads</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                  ({rawFreshLeads.length})
                </span>
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Fresh opportunities ready for initial call
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 kanban-scroll">
            {loading && freshLeads.length === 0 ? (
              <div className="space-y-2.5 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 animate-pulse">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2.5 flex-1">
                        <div className="flex gap-2">
                          <div className="h-4 bg-slate-200 rounded w-16" />
                          <div className="h-4 bg-slate-200 rounded w-12" />
                        </div>
                        <div className="h-4 bg-slate-200 rounded w-3/5" />
                        <div className="h-3 bg-slate-200 rounded w-2/5" />
                      </div>
                      <div className="w-full sm:w-28 space-y-1.5 shrink-0">
                        <div className="h-7 bg-slate-200 rounded" />
                        <div className="h-5 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : freshLeads.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">
                    No new fresh leads pending in your queue!
                  </p>
                </CardContent>
              </Card>
            ) : (
              freshLeads.map((lead) => {
                const priority = getPriorityColor(lead.priority);
                const isRetry = lead.isRetry || (lead.callAttempts && lead.callAttempts > 0);

                return (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setDrawerLeadId(lead.id);
                      setIsDrawerOpen(true);
                    }}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 transition-all shadow-soft-xs hover:shadow-soft hover:border-slate-300 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    {/* LEFT SIDE: Lead Status & Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800">
                          Fresh Lead
                        </span>

                        {/* Rule 5 Retry Badge */}
                        {isRetry && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            Retry (Called before)
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priority.bg} ${priority.text} ${priority.border}`}
                        >
                          {lead.priority}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          Stage: {lead.pipelineStage}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={lead.companyName}>
                          {lead.companyName}
                        </h3>
                        <p className="text-xs text-slate-500 truncate" title={lead.serviceProduct}>
                          {lead.serviceProduct}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                        <span className="font-semibold text-slate-700 truncate max-w-[180px]" title={lead.contactPerson || 'Not available'}>
                          Contact: <strong>{lead.contactPerson || '-'}</strong>
                        </span>

                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline whitespace-nowrap"
                          title={`Call ${lead.phone}`}
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{lead.phone}</span>
                        </a>

                        {lead.callAttempts > 0 && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Attempts: {lead.callAttempts}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RIGHT SIDE: Action Buttons in One Vertical Column, equal in width */}
                    <div
                      className="flex flex-col gap-1.5 w-full sm:w-28 shrink-0 sm:self-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        onClick={() => handleCallClick(lead)}
                        icon={<PhoneCall className="h-3 w-3" />}
                        className="w-full justify-center text-xs py-1.5 shadow-soft-xs"
                      >
                        Call
                      </Button>
                      <button
                        onClick={() => {
                          setDrawerLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                        className="w-full py-1 text-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200 flex items-center justify-center gap-1"
                        title="View Details"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>

          {/* COLUMN 2 (RIGHT): Today's Follow-ups */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-soft-xs flex flex-col h-[calc(100vh-270px)] min-h-[520px] overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span>Today’s Follow-ups</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                  ({rawFollowUpLeads.length})
                </span>
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                Overdue follow-ups highlighted and sorted at top
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 kanban-scroll">
            {loading && followUpLeads.length === 0 ? (
              <div className="space-y-2.5 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 animate-pulse">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2.5 flex-1">
                        <div className="flex gap-2">
                          <div className="h-4 bg-slate-200 rounded w-20" />
                          <div className="h-4 bg-slate-200 rounded w-12" />
                        </div>
                        <div className="h-4 bg-slate-200 rounded w-3/5" />
                        <div className="h-3 bg-slate-200 rounded w-2/5" />
                      </div>
                      <div className="w-full sm:w-28 space-y-1.5 shrink-0">
                        <div className="h-7 bg-slate-200 rounded" />
                        <div className="h-7 bg-slate-200 rounded" />
                        <div className="h-7 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : followUpLeads.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">
                    All scheduled follow-ups are completed for today!
                  </p>
                </CardContent>
              </Card>
            ) : (
              followUpLeads.map((lead) => {
                const priority = getPriorityColor(lead.priority);
                const isOverdue =
                  lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] < todayStr;
                const isDueToday =
                  lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] === todayStr;

                return (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setDrawerLeadId(lead.id);
                      setIsDrawerOpen(true);
                    }}
                    className={`rounded-xl border p-4 transition-all shadow-soft-xs hover:shadow-soft cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      isOverdue
                        ? 'border-rose-300 bg-rose-50/30'
                        : isDueToday
                        ? 'border-indigo-200 bg-indigo-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* LEFT SIDE: Status & Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800">
                          Follow-up
                        </span>

                        {/* Overdue / Due Badge */}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> Overdue (Due: {formatDate(lead.nextFollowUpDate)})
                          </span>
                        )}
                        {isDueToday && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Due Today
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priority.bg} ${priority.text} ${priority.border}`}
                        >
                          {lead.priority}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          Stage: {lead.pipelineStage}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={lead.companyName}>
                          {lead.companyName}
                        </h3>
                        <p className="text-xs text-slate-500 truncate" title={lead.serviceProduct}>
                          {lead.serviceProduct}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                        <span className="font-semibold text-slate-700 truncate max-w-[180px]" title={lead.contactPerson || 'Not available'}>
                          Contact: <strong>{lead.contactPerson || '-'}</strong>
                        </span>

                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline whitespace-nowrap"
                          title={`Call ${lead.phone}`}
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{lead.phone}</span>
                        </a>

                        {lead.nextFollowUpDate && (
                          <span className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Scheduled: <strong>{formatDate(lead.nextFollowUpDate)}</strong>
                          </span>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="text-[11px] text-slate-500 italic line-clamp-1 leading-relaxed max-w-md pt-0.5">
                          &quot;{lead.notes.split('\n').pop()}&quot;
                        </p>
                      )}
                    </div>

                    {/* RIGHT SIDE: Action Buttons in One Vertical Column, equal in width */}
                    <div
                      className="flex flex-col gap-1.5 w-full sm:w-28 shrink-0 sm:self-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        onClick={() => handleCallClick(lead)}
                        icon={<PhoneCall className="h-3 w-3" />}
                        className="w-full justify-center text-xs py-1.5 shadow-soft-xs"
                      >
                        Call
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCompletionTarget({ lead, mode: 'CLOSED' })}
                        className="w-full justify-center text-xs py-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        icon={<CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                      >
                        Closed
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCompletionTarget({ lead, mode: 'NOT_CLOSED' })}
                        className="w-full justify-center text-xs py-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                        icon={<XCircle className="h-3 w-3 text-amber-600" />}
                      >
                        Not Closed
                      </Button>

                      <button
                        onClick={() => {
                          setDrawerLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                        className="w-full py-1 text-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200 flex items-center justify-center gap-1"
                        title="View Details"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Calling Outcome Modal */}
      <CallLogModal
        isOpen={isCallModalOpen}
        onClose={() => {
          setIsCallModalOpen(false);
          setSelectedLeadForCall(null);
        }}
        lead={selectedLeadForCall}
        onSuccess={handleLeadUpdated}
      />

      {/* Follow-up Completion Flow Modal (Closed & Not Closed) */}
      {completionTarget && (
        <FollowUpCompletionModal
          isOpen={!!completionTarget}
          onClose={() => setCompletionTarget(null)}
          lead={completionTarget.lead}
          mode={completionTarget.mode}
          onSuccess={(updated) => {
            handleLeadUpdated(updated);
            setCompletionTarget(null);
          }}
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
        onLeadUpdated={handleLeadUpdated}
      />
    </AppLayout>
  );
}
