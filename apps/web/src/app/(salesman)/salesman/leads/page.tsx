'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { Lead, SalesStage, SALES_STAGE_OPTIONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData, updateCachedLead } from '@/lib/apiCache';
import { Award, RefreshCw, Edit3, Phone, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { WhatsAppButton } from '@/components/leads/WhatsAppButton';
import { formatDate, formatDateTime, getPriorityColor, getPriorityLabel, getStageColor, getOutcomeColor } from '@/lib/utils';

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

  // Pagination & Copy states (Default 150+ rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(150);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const queryParams = React.useMemo(() => ({ limit: 1000 }), []);

  const { data: leadsData, loading, mutate: fetchLeads } = useSWRData<Lead[]>(
    '/leads',
    queryParams
  );

  const leads = leadsData || [];

  const filtered = leads.filter((l) => {
    if (stageFilter && l.salesStage !== stageFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      (l.contactPerson && l.contactPerson.toLowerCase().includes(q)) ||
      (l.alternateName && l.alternateName.toLowerCase().includes(q)) ||
      l.phone.toLowerCase().includes(q) ||
      (l.alternatePhone && l.alternatePhone.toLowerCase().includes(q)) ||
      (l.serviceProduct && l.serviceProduct.toLowerCase().includes(q))
    );
  });

  // Sort leads ascending according to date per Requirement 1 & 4
  const sortedLeads = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.nextFollowUpDate || a.createdAt).getTime();
      const dateB = new Date(b.nextFollowUpDate || b.createdAt).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [filtered]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stageFilter, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const paginatedLeads = React.useMemo(() => {
    if (pageSize === 'all') return sortedLeads;
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

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
              Showing {sortedLeads.length} {sortedLeads.length === 1 ? 'lead' : 'leads'}
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
          {loading && leads.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`m-skel-${i}`} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-40" />
                <div className="h-3 bg-slate-100 rounded w-24" />
                <div className="h-8 bg-slate-50 rounded" />
              </div>
            ))
          ) : sortedLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              No assigned leads in this filter
            </div>
          ) : (
            sortedLeads.map((lead) => {
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      {lead.lastCallOutcome && (() => {
                        const ocMeta = getOutcomeColor(lead.lastCallOutcome);
                        return (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${ocMeta.bg} ${ocMeta.text} ${ocMeta.border}`}>
                            {lead.lastCallOutcome}
                          </span>
                        );
                      })()}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${priority.bg} ${priority.text} ${priority.border}`}
                      >
                        {lead.priority}
                      </span>
                    </div>
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

                  {/* Lead Source */}
                  {lead.leadSource && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 font-semibold text-[11px]">Source:</span>
                      <span className="font-bold text-slate-800 truncate">{lead.leadSource}</span>
                      {lead.leadSource === 'Other' && lead.leadSourceOther && (
                        <span className="text-slate-500 text-[11px] truncate">({lead.leadSourceOther})</span>
                      )}
                    </div>
                  )}

                  {/* Follow-up date & Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                    {lead.nextFollowUpDate ? (
                      <span className="text-[11px] font-bold text-cyan-700">
                        Due: {formatDateTime(lead.nextFollowUpDate)}
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
                    <th className="py-2 px-2.5">Company Name</th>
                    <th className="py-2 px-2.5">Contact Person</th>
                    <th className="py-2 px-2.5">Phone</th>
                    <th className="py-2 px-2.5">Priority</th>
                    <th className="py-2 px-2.5">Call Outcome</th>
                    <th className="py-2 px-2.5">Sales Stage</th>
                    <th className="py-2 px-2.5 hidden lg:table-cell">Lead Source</th>
                    <th className="py-2 px-2.5">Follow-up / Last Contact</th>
                    <th className="py-2 px-2.5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && leads.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skel-${i}`} className="animate-pulse">
                        <td className="py-2 px-2.5"><div className="h-4 bg-slate-200 rounded w-32 mb-1" /><div className="h-3 bg-slate-100 rounded w-20" /></td>
                        <td className="py-2 px-2.5"><div className="h-3.5 bg-slate-200 rounded w-24" /></td>
                        <td className="py-2 px-2.5"><div className="h-3.5 bg-slate-200 rounded w-28" /></td>
                        <td className="py-2 px-2.5"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                        <td className="py-2 px-2.5"><div className="h-5 bg-slate-200 rounded w-24" /></td>
                        <td className="py-2 px-2.5"><div className="h-5 bg-slate-200 rounded w-24" /></td>
                        <td className="py-2 px-2.5 hidden lg:table-cell"><div className="h-3.5 bg-slate-200 rounded w-20" /></td>
                        <td className="py-2 px-2.5"><div className="h-3.5 bg-slate-200 rounded w-24" /></td>
                        <td className="py-2 px-2.5 text-right"><div className="h-7 bg-slate-200 rounded w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : paginatedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No assigned leads in this filter
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((lead) => {
                      const priority = getPriorityColor(lead.priority);
                      const currentSalesStage = (lead.salesStage as SalesStage) || 'ASSIGNED';
                      const stageColor = getStageColor(currentSalesStage);
                      const ocMeta = getOutcomeColor(lead.lastCallOutcome);

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setIsDrawerOpen(true);
                          }}
                          className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                        >
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-slate-900 block">{lead.companyName}</span>
                            <span className="text-[11px] text-slate-500 block">{lead.serviceProduct}</span>
                          </td>
                          <td className="py-2 px-2.5 font-semibold text-slate-800">
                            <div>
                              <span>{lead.contactPerson || '-'}</span>
                              {lead.alternateName && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  Alt: {lead.alternateName}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Phone column with stacked numbers and copy button */}
                          <td className="py-2 px-2.5 font-semibold text-emerald-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-1 group/p1">
                                <a
                                  href={lead.phone ? `tel:${lead.phone}` : undefined}
                                  className="text-emerald-700 font-semibold hover:underline flex items-center gap-1.5 text-xs font-mono truncate"
                                  title={`Call ${lead.phone}`}
                                >
                                  <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">{lead.phone || 'No Phone'}</span>
                                </a>
                                {lead.phone && (
                                  <button
                                    onClick={(e) => copyToClipboard(lead.phone, e)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                    title="Copy phone"
                                  >
                                    {copiedPhone === lead.phone ? (
                                      <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              {lead.alternatePhone && (
                                <div className="flex items-center justify-between gap-1 group/p2 pt-0.5 border-t border-slate-100">
                                  <a
                                    href={`tel:${lead.alternatePhone}`}
                                    className="text-slate-600 font-medium hover:underline flex items-center gap-1.5 text-[11px] font-mono truncate"
                                    title={`Alt: ${lead.alternatePhone}`}
                                  >
                                    <Phone className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{lead.alternatePhone}</span>
                                  </a>
                                  <button
                                    onClick={(e) => copyToClipboard(lead.alternatePhone!, e)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                                    title="Copy alternate phone"
                                  >
                                    {copiedPhone === lead.alternatePhone ? (
                                      <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${priority.bg} ${priority.text} ${priority.border}`}
                            >
                              {getPriorityLabel(lead.priority)}
                            </span>
                          </td>
                          <td className="py-2 px-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${lead.lastCallOutcome
                                  ? `${ocMeta.bg} ${ocMeta.text} ${ocMeta.border}`
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                            >
                              {lead.lastCallOutcome || lead.pipelineStage}
                            </span>
                          </td>
                          {/* C2: Sales Stage dropdown in each row */}
                          <td className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={currentSalesStage}
                              onChange={(e) => {
                                const newStage = e.target.value as SalesStage;
                                setStageModalTarget({ lead, targetStage: newStage });
                              }}
                              className={`text-xs font-bold rounded-lg border px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}
                            >
                              {SALES_STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-normal">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* Lead Source */}
                          <td className="py-2 px-2.5 hidden lg:table-cell min-w-0" onClick={(e) => e.stopPropagation()}>
                            {lead.leadSource ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 truncate max-w-full"
                                title={lead.leadSource === 'Other' && lead.leadSourceOther ? `Other: ${lead.leadSourceOther}` : lead.leadSource}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                <span className="truncate">{lead.leadSource}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-slate-500 font-mono text-[11px]">
                            {lead.nextFollowUpDate ? (
                              <span className="text-cyan-700 font-bold block">
                                Due: {formatDateTime(lead.nextFollowUpDate)}
                              </span>
                            ) : null}
                            <span>{formatDate(lead.lastContactDate)}</span>
                          </td>
                          <td className="py-2 px-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Button shifted to Actions column */}
                              <WhatsAppButton
                                phone={lead.phone}
                                leadId={lead.id}
                                leadName={lead.contactPerson || lead.companyName}
                                size="sm"
                                showText={false}
                              />
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

            {/* Table Pagination Footer (Default 150+ Rows Per Page) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <span>Rows per page:</span>
                <select
                  value={pageSize === 'all' ? 'all' : pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                >
                  <option value={150}>150 (Default)</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value="all">All ({sortedLeads.length})</option>
                </select>
                <span className="text-slate-400">|</span>
                <span>
                  Showing {sortedLeads.length === 0 ? 0 : pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1} -{' '}
                  {pageSize === 'all' ? sortedLeads.length : Math.min(currentPage * pageSize, sortedLeads.length)} of{' '}
                  <span className="font-bold text-slate-700">{sortedLeads.length}</span> opportunities
                </span>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        initialLead={leads.find((l) => l.id === selectedLeadId) || null}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLeadId(null);
        }}
        onLeadUpdated={(updated) => {
          updateCachedLead(updated);
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
            updateCachedLead(updated);
            fetchLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
            setStageModalTarget(null);
          }}
        />
      )}
    </AppLayout>
  );
}
