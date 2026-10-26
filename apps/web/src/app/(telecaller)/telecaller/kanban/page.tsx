'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import {
  Lead,
  normalizeCallOutcome,
  TELECALLER_CALL_OUTCOMES,
  Priority,
} from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData } from '@/lib/apiCache';
import { RefreshCw, Filter, Phone, CheckCircle2 } from 'lucide-react';

const LeadDrawer = dynamic(() => import('@/components/leads/LeadDrawer').then((m) => m.LeadDrawer), {
  ssr: false,
});
const CallLogModal = dynamic(() => import('@/components/leads/CallLogModal').then((m) => m.CallLogModal), {
  ssr: false,
});

const DEFAULT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TelecallerCallingDashboardPage() {
  const { data: cachedLeads, loading: swrLoading, mutate: mutateLeads, refresh: refreshLeads } =
    useSWRData<Lead[]>('/leads', { limit: 100 });

  const [leads, setLeads] = useState<Lead[]>(cachedLeads || []);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Keep local leads in sync with SWR cachedLeads
  useEffect(() => {
    if (cachedLeads) {
      setLeads(cachedLeads);
    }
  }, [cachedLeads]);

  // Filter leads for the Kanban Board
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (outcomeFilter && lead.lastCallOutcome !== outcomeFilter) {
        return false;
      }
      if (priorityFilter && lead.priority !== priorityFilter) {
        return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCompany = lead.companyName.toLowerCase().includes(q);
        const matchesContact = !!(lead.contactPerson && lead.contactPerson.toLowerCase().includes(q));
        const matchesPhone = lead.phone.toLowerCase().includes(q);
        const matchesEmail = !!(lead.email && lead.email.toLowerCase().includes(q));
        if (!matchesCompany && !matchesContact && !matchesPhone && !matchesEmail) {
          return false;
        }
      }
      return true;
    });
  }, [leads, outcomeFilter, priorityFilter, searchTerm]);

  return (
    <AppLayout
      title="Calling Dashboard"
      subtitle="Visual drag-and-drop Kanban workspace across all 6 pipeline stages."
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search company, contact person, phone..."
    >
      <div className="h-full flex flex-col space-y-3">
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-soft-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Showing {filteredLeads.length} of {leads.length} leads
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">All Priorities</option>
              {DEFAULT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Outcome Filter */}
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

            {/* Reset */}
            {(priorityFilter || outcomeFilter || searchTerm) && (
              <button
                onClick={() => {
                  setPriorityFilter('');
                  setOutcomeFilter('');
                  setSearchTerm('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 underline cursor-pointer"
              >
                Reset
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => refreshLeads()}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer transition-colors"
              title="Refresh leads"
            >
              <RefreshCw className={`h-4 w-4 ${swrLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dedicated Kanban Board */}
        <div className="flex-1 min-h-[600px] overflow-hidden">
          <KanbanBoard
            leads={filteredLeads}
            onLeadsChange={(updatedLeads) => {
              setLeads(updatedLeads);
              mutateLeads(updatedLeads);
            }}
            onCardClick={(leadId) => {
              setSelectedLeadId(leadId);
              setIsDrawerOpen(true);
            }}
          />
        </div>

        {/* Lead Drawer */}
        <LeadDrawer
          leadId={selectedLeadId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedLeadId(null);
          }}
          onLeadUpdated={(updated) => {
            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
          }}
        />

        {/* Call Log Modal */}
        {activeCallLead && (
          <CallLogModal
            isOpen={!!activeCallLead}
            onClose={() => setActiveCallLead(null)}
            lead={activeCallLead}
            onSuccess={(updated) => {
              setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
              mutateLeads((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : [updated]));
              setActiveCallLead(null);
            }}
          />
        )}

        {/* End Modals */}
      </div>
    </AppLayout>
  );
}
