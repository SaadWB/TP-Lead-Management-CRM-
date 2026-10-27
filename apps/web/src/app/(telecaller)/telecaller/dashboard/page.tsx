'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { DashboardMetrics } from '@crm/shared';
import { PhoneCall, CalendarCheck, ThumbsUp, Send, ArrowRight, BarChart3, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useSWRData } from '@/lib/apiCache';
import { TelecallerReportsView } from '@/components/reports/TelecallerReportsView';

export default function TelecallerDashboardPage() {
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'OVERVIEW'>('REPORTS');
  const { data: metrics } = useSWRData<DashboardMetrics>('/reports/dashboard');

  return (
    <AppLayout
      title="My Performance & Reports"
      subtitle="Comprehensive daily calling reports, conversion trajectory, and pipeline milestones."
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'REPORTS'
                ? 'bg-sky-600 text-white shadow-soft-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Daily Work Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
              activeTab === 'OVERVIEW'
                ? 'bg-sky-600 text-white shadow-soft-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Queue Overview</span>
          </button>
        </div>

        {/* Tab 1: Detailed Daily Work Reports */}
        {activeTab === 'REPORTS' && <TelecallerReportsView isAdmin={false} />}

        {/* Tab 2: Overall Queue Metrics & Activities */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 animate-fade-in">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Assigned Leads
                    </span>
                    <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                      {metrics?.totalLeads || 0}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Interested Prospects
                    </span>
                    <span className="text-2xl font-black text-emerald-600 mt-0.5 block">
                      {metrics?.interestedLeads || 0}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ThumbsUp className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Follow-ups Today
                    </span>
                    <span className="text-2xl font-black text-amber-600 mt-0.5 block">
                      {metrics?.followUpsDueToday || 0}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Sales Handovers
                    </span>
                    <span className="text-2xl font-black text-teal-600 mt-0.5 block">
                      {metrics?.leadsAssignedToSalesmen || 0}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Send className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Launch to Kanban Workspace */}
            <div className="bg-gradient-to-r from-sky-700 to-indigo-700 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-soft-lg">
              <div>
                <h3 className="text-base font-bold">Manage Your Pipeline in Drag-and-Drop Kanban</h3>
                <p className="text-xs text-sky-100 mt-1 max-w-xl leading-relaxed">
                  Log phone outcomes, drag leads across stages, schedule follow-ups, and transfer hot opportunities to Sales Closers.
                </p>
              </div>
              <Link
                href="/telecaller/kanban"
                className="inline-flex items-center justify-center font-bold rounded-xl text-sm px-4 py-2.5 gap-1.5 bg-white text-slate-900 hover:bg-slate-100 shadow-soft transition-colors duration-150 cursor-pointer shrink-0 min-h-[44px]"
              >
                Open Kanban Workspace <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </div>

            {/* Recent Activities Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-800">Recent Calling & Lead Milestones</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-100">
                {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
                  metrics.recentActivities.slice(0, 8).map((act) => (
                    <div key={act.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{act.user?.name || 'System'}: </span>
                        <span className="text-slate-600">{act.description}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No recent activity logged</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
