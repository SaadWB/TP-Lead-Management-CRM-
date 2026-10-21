'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LeadDrawer } from '@/components/leads/LeadDrawer';
import { UpdateSalesStageModal } from '@/components/leads/UpdateSalesStageModal';
import { Lead, SalesStage, SALES_STAGE_OPTIONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatDate, getPriorityColor, getStageColor } from '@/lib/utils';
import { Award, RefreshCw, Edit3 } from 'lucide-react';

export default function SalesmanLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [stageModalTarget, setStageModalTarget] = useState<{ lead: Lead; targetStage?: SalesStage } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  useEffect(() => {
    fetchLeads();
  }, [stageFilter]);

  async function fetchLeads() {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (stageFilter) params.salesStage = stageFilter;

      const res = await api.get<Lead[]>('/leads', params);
      if (res.success && res.data) {
        setLeads(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = leads.filter((l) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
      l.phone.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout
      title="My Sales Pipeline Opportunities"
      subtitle="Detailed pipeline deals, client objections, demo notes, and revenue conversions."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search assigned opportunities..."
    >
      <div className="space-y-4 max-w-7xl mx-auto">
        {/* Filter bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-soft-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Sales Stages</option>
                {SALES_STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Showing {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>

          <button
            onClick={fetchLeads}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Refresh leads"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Company Name</th>
                    <th className="p-3.5">Contact Person</th>
                    <th className="p-3.5">Phone</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Call Outcome</th>
                    <th className="p-3.5">Sales Stage</th>
                    <th className="p-3.5">Follow-up / Last Contact</th>
                    <th className="p-3.5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No assigned leads in this filter
                      </td>
                    </tr>
                  ) : (
                    filtered.map((lead) => {
                      const priority = getPriorityColor(lead.priority);
                      const currentSalesStage = (lead.salesStage as SalesStage) || 'ASSIGNED';
                      const stageColor = getStageColor(currentSalesStage);

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setIsDrawerOpen(true);
                          }}
                          className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                        >
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block">{lead.companyName}</span>
                            <span className="text-[11px] text-slate-500 block">{lead.serviceProduct}</span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">{lead.contactPerson || '-'}</td>
                          <td className="p-3.5 font-semibold text-emerald-700">{lead.phone}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${priority.bg} ${priority.text} ${priority.border}`}
                            >
                              {lead.priority}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {lead.pipelineStage}
                            </span>
                          </td>
                          {/* C2: Sales Stage dropdown in each row */}
                          <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={currentSalesStage}
                              onChange={(e) => {
                                const newStage = e.target.value as SalesStage;
                                setStageModalTarget({ lead, targetStage: newStage });
                              }}
                              className={`text-xs font-bold rounded-lg border px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                            >
                              {SALES_STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-normal">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                            {lead.nextFollowUpDate ? (
                              <span className="text-cyan-700 font-bold block">
                                Due: {formatDate(lead.nextFollowUpDate)}
                              </span>
                            ) : null}
                            <span>{formatDate(lead.lastContactDate)}</span>
                          </td>
                          <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setStageModalTarget({ lead, targetStage: currentSalesStage })}
                                className="text-[11px] py-1 text-slate-700 border-slate-200 hover:bg-slate-50"
                                icon={<Edit3 className="h-3 w-3" />}
                              >
                                Update
                              </Button>
                              {currentSalesStage !== 'CONVERTED' && (
                                <Button
                                  size="sm"
                                  onClick={() => setStageModalTarget({ lead, targetStage: 'CONVERTED' })}
                                  className="text-[11px] py-1 bg-emerald-600 hover:bg-emerald-700"
                                  icon={<Award className="h-3 w-3" />}
                                >
                                  Won
                                </Button>
                              )}
                              {currentSalesStage !== 'LOST' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setStageModalTarget({ lead, targetStage: 'LOST' })}
                                  className="text-[11px] py-1 text-rose-700 border-rose-200 hover:bg-rose-50"
                                >
                                  Lost
                                </Button>
                              )}
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
      </div>

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

      {stageModalTarget && (
        <UpdateSalesStageModal
          isOpen={!!stageModalTarget}
          onClose={() => setStageModalTarget(null)}
          lead={stageModalTarget.lead}
          initialStage={stageModalTarget.targetStage}
          onSuccess={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setStageModalTarget(null);
            fetchLeads();
          }}
        />
      )}
    </AppLayout>
  );
}
