'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { Lead, SalesStage, SALES_STAGE_OPTIONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData } from '@/lib/apiCache';
import { Award, RefreshCw, Edit3, Phone } from 'lucide-react';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';
import { formatDate, getPriorityColor, getStageColor } from '@/lib/utils';

const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});
const UpdateSalesStageModal = dynamic(
  () => import('@/components/leads/UpdateSalesStageModal').then((m) => m.UpdateSalesStageModal),
  { ssr: false }
);

export default function SalesmanLeadsPage() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [stageModalTarget, setStageModalTarget] = useState<{ lead: Lead; targetStage?: SalesStage } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const params: any = { limit: 100 };
  if (stageFilter) params.salesStage = stageFilter;

  const { data: leadsData, loading, mutate: fetchLeads } = useSWRData<Lead[]>(
    '/leads',
    params
  );

  const leads = leadsData || [];

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
            onClick={() => fetchLeads()}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Refresh leads"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Mobile Cards View (< md) */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No assigned leads in this filter
            </div>
          ) : (
            filtered.map((lead) => {
              const priority = getPriorityColor(lead.priority);
              const currentSalesStage = (lead.salesStage as SalesStage) || 'ASSIGNED';
              const stageColor = getStageColor(currentSalesStage);

              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-soft-sm p-4 space-y-3"
                >
                  {/* Top row: Company & Priority */}
                  <div className="flex items-start justify-between gap-2">
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
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${priority.bg} ${priority.text} ${priority.border}`}
                    >
                      {lead.priority}
                    </span>
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

                  {/* Sales Stage Dropdown */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Sales Stage
                    </label>
                    <select
                      value={currentSalesStage}
                      onChange={(e) => {
                        const newStage = e.target.value as SalesStage;
                        setStageModalTarget({ lead, targetStage: newStage });
                      }}
                      className={`w-full text-xs font-bold rounded-lg border p-2.5 cursor-pointer min-h-[44px] ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                    >
                      {SALES_STAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-normal">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Follow-up date & Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                    {lead.nextFollowUpDate ? (
                      <span className="text-[11px] font-bold text-cyan-700">
                        Due: {formatDate(lead.nextFollowUpDate)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Last contact: {formatDate(lead.lastContactDate)}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStageModalTarget({ lead, targetStage: currentSalesStage })}
                        className="text-xs min-h-[38px] px-2.5"
                        icon={<Edit3 className="h-3.5 w-3.5" />}
                      >
                        Update
                      </Button>
                      {currentSalesStage !== 'CONVERTED' && (
                        <Button
                          size="sm"
                          onClick={() => setStageModalTarget({ lead, targetStage: 'CONVERTED' })}
                          className="text-xs min-h-[38px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          icon={<Award className="h-3.5 w-3.5" />}
                        >
                          Won
                        </Button>
                      )}
                      {currentSalesStage !== 'LOST' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStageModalTarget({ lead, targetStage: 'LOST' })}
                          className="text-xs min-h-[38px] px-2.5 text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          Lost
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <Card className="hidden md:block border border-slate-200/90 shadow-soft-sm overflow-hidden">
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
                          <td className="p-3.5 font-semibold text-emerald-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                                title={`Call ${lead.phone}`}
                              >
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{lead.phone}</span>
                              </a>
                              <WhatsAppButton
                                phone={lead.phone}
                                leadId={lead.id}
                                leadName={lead.contactPerson || lead.companyName}
                                size="sm"
                                showText={false}
                              />
                            </div>
                          </td>
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
          fetchLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
        }}
      />

      {stageModalTarget && (
        <UpdateSalesStageModal
          isOpen={!!stageModalTarget}
          onClose={() => setStageModalTarget(null)}
          lead={stageModalTarget.lead}
          initialStage={stageModalTarget.targetStage}
          onSuccess={(updated) => {
            fetchLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
            setStageModalTarget(null);
          }}
        />
      )}
    </AppLayout>
  );
}
