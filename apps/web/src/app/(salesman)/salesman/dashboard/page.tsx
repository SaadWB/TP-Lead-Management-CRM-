'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import { SalesOutcomeModal } from '@/components/leads/SalesOutcomeModal';
import { TaskModal } from '@/components/leads/TaskModal';
import { Lead, DashboardMetrics } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import {
  Calendar,
  Award,
  RefreshCw,
} from 'lucide-react';

export default function SalesmanDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [assignedLeads, setAssignedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState<{ lead: Lead; mode: 'WON' | 'LOST' } | null>(null);
  const [taskLead, setTaskLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [mRes, lRes] = await Promise.all([
        api.get<DashboardMetrics>('/reports/dashboard'),
        api.get<Lead[]>('/leads', { limit: 50 }),
      ]);
      if (mRes.success && mRes.data) setMetrics(mRes.data);
      if (lRes.success && lRes.data) setAssignedLeads(lRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const newAssignments = assignedLeads.filter(
    (l) => l.salesStage === 'ASSIGNED' || l.pipelineStage === 'Assign to Salesman' || l.pipelineStage === 'ASSIGNED_TO_SALESMAN' || l.pipelineStage === 'ASSIGNED'
  ).length;
  const demosScheduled = assignedLeads.filter(
    (l) => l.salesStage === 'DEMO_SCHEDULED' || l.pipelineStage === 'DEMO_SCHEDULED'
  ).length;
  const negotiationCount = assignedLeads.filter(
    (l) => l.salesStage === 'NEGOTIATION' || l.pipelineStage === 'NEGOTIATION'
  ).length;
  const convertedCount = assignedLeads.filter(
    (l) => l.salesStage === 'CONVERTED' || l.pipelineStage === 'CONVERTED'
  ).length;
  const lostCount = assignedLeads.filter(
    (l) => l.salesStage === 'LOST' || l.pipelineStage === 'LOST'
  ).length;

  return (
    <AppLayout
      title="Sales Closer Command Center"
      subtitle="Manage assigned enterprise opportunities, schedule live demos, log outcomes, and convert deals."
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Sales Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Assigned Deals
              </span>
              <span className="text-xl font-black text-slate-900 block">{assignedLeads.length}</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-sky-600 block tracking-wider">
                New Handover Queue
              </span>
              <span className="text-xl font-black text-sky-700 block">{newAssignments}</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-purple-600 block tracking-wider">
                Demos Scheduled
              </span>
              <span className="text-xl font-black text-purple-700 block">{demosScheduled}</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
                In Negotiation
              </span>
              <span className="text-xl font-black text-amber-700 block">{negotiationCount}</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5 space-y-1 bg-emerald-50/50 border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                Won / Converted
              </span>
              <span className="text-xl font-black text-emerald-800 block">{convertedCount}</span>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider">
                Lost Deals
              </span>
              <span className="text-xl font-black text-rose-700 block">{lostCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Sales Pipeline Opportunity Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle>My Active Opportunities Pipeline</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review telecaller notes, schedule demos, update sales stages, or mark converted/lost.
                </p>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Company & Product</th>
                    <th className="p-3.5">Decision Maker</th>
                    <th className="p-3.5">Current Stage</th>
                    <th className="p-3.5">Next Action / Follow-up</th>
                    <th className="p-3.5">Handover Notes</th>
                    <th className="p-3.5 text-right">Quick Closer Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No opportunities assigned yet. Telecallers will transfer qualified leads here.
                      </td>
                    </tr>
                  ) : (
                    assignedLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => {
                          setSelectedLeadId(lead.id);
                          setIsDrawerOpen(true);
                        }}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block truncate max-w-[200px]">
                            {lead.companyName}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                            {lead.serviceProduct}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 block">{lead.contactPerson}</span>
                          <span className="text-[11px] text-emerald-700 font-medium">{lead.phone}</span>
                        </td>
                        <td className="p-3.5">
                          <Badge variant="teal" size="sm">
                            {lead.salesStage ? lead.salesStage.replace(/_/g, ' ') : lead.pipelineStage}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <span className="text-slate-800 font-medium block truncate max-w-[180px]">
                            {lead.nextAction || 'None'}
                          </span>
                          {lead.nextFollowUpDate && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Due: {formatDate(lead.nextFollowUpDate)}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 max-w-[220px]">
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {lead.notes || 'No handover summary entered.'}
                          </p>
                        </td>
                        <td
                          className="p-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setTaskLead(lead)}
                              className="text-[11px] py-1 px-2"
                              icon={<Calendar className="h-3 w-3 text-sky-600" />}
                            >
                              Demo
                            </Button>
                            {lead.pipelineStage !== 'CONVERTED' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setOutcomeTarget({ lead, mode: 'WON' })}
                                className="text-[11px] py-1 px-2 bg-emerald-600 hover:bg-emerald-700"
                                icon={<Award className="h-3 w-3" />}
                              >
                                Won
                              </Button>
                            )}
                            {lead.pipelineStage !== 'LOST' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setOutcomeTarget({ lead, mode: 'LOST' })}
                                className="text-[11px] py-1 px-2 text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                Lost
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadId(null);
        }}
        onLeadUpdated={(updated) => {
          setAssignedLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        }}
      />

      {outcomeTarget && (
        <SalesOutcomeModal
          isOpen={!!outcomeTarget}
          onClose={() => setOutcomeTarget(null)}
          lead={outcomeTarget.lead}
          mode={outcomeTarget.mode}
          onSuccess={(updated) => {
            setAssignedLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            fetchData();
          }}
        />
      )}

      {taskLead && (
        <TaskModal
          isOpen={!!taskLead}
          onClose={() => setTaskLead(null)}
          lead={taskLead}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </AppLayout>
  );
}
