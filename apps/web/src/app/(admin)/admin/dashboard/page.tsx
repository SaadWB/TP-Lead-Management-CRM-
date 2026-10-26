'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardMetrics } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import {
  Users,
  Layers,
  PhoneCall,
  Calendar,
  AlertTriangle,
  Award,
  TrendingDown,
  ArrowRight,
  FileSpreadsheet,
  Clock,
  Briefcase,
  ThumbsUp,
  RefreshCw,
} from 'lucide-react';

import { useSWRData } from '@/lib/apiCache';

export default function AdminDashboardPage() {
  const { data: metrics, loading, refresh: fetchMetrics } = useSWRData<DashboardMetrics>(
    '/reports/dashboard'
  );

  const metricCards = [
    { title: 'Total Leads', value: metrics?.totalLeads || 0, icon: Layers, color: 'text-slate-900', bg: 'bg-slate-100', href: '/admin/leads?kpi=total' },
    { title: 'New Leads', value: metrics?.newLeads || 0, icon: SparkleIcon, color: 'text-blue-600', bg: 'bg-blue-50', href: '/admin/leads?kpi=new' },
    { title: 'Unassigned Leads', value: metrics?.unassignedLeads || 0, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', href: '/admin/leads?kpi=unassigned' },
    { title: 'Assigned Telecaller', value: metrics?.leadsAssignedToTelecallers || 0, icon: PhoneCall, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/admin/leads?kpi=assigned_telecaller' },
    { title: 'In Progress', value: metrics?.leadsInProgress || 0, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', href: '/admin/leads?kpi=in_progress' },
    { title: 'Interested Leads', value: metrics?.interestedLeads || 0, icon: ThumbsUp, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/admin/leads?kpi=interested' },
    { title: 'Assigned Salesmen', value: metrics?.leadsAssignedToSalesmen || 0, icon: Briefcase, color: 'text-teal-600', bg: 'bg-teal-50', href: '/admin/leads?kpi=assigned_salesman' },
    { title: 'Demos Scheduled', value: metrics?.demosMeetingsScheduled || 0, icon: Calendar, color: 'text-cyan-600', bg: 'bg-cyan-50', href: '/admin/leads?kpi=demos_scheduled' },
    { title: 'Follow-ups Today', value: metrics?.followUpsDueToday || 0, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', href: '/admin/leads?kpi=followups_today' },
    { title: 'Overdue Follow-ups', value: metrics?.overdueFollowUps || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', href: '/admin/leads?kpi=overdue' },
    { title: 'Converted (Won)', value: metrics?.convertedLeads || 0, icon: Award, color: 'text-emerald-700', bg: 'bg-emerald-100/60', href: '/admin/leads?kpi=converted' },
    { title: 'Lost Leads', value: metrics?.lostLeads || 0, icon: TrendingDown, color: 'text-rose-700', bg: 'bg-rose-100/60', href: '/admin/leads?kpi=lost' },
  ];

  function SparkleIcon(props: any) {
    return <Layers {...props} />;
  }

  return (
    <AppLayout
      title="Super Admin Command Center"
      subtitle="Centralized oversight of all company leads, team quotas, conversion metrics, and calling performance."
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Operational Key Performance Indicators</h2>
            <p className="text-xs text-slate-500">Live database aggregates across all team workspaces</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/import">
              <Button size="sm" icon={<FileSpreadsheet className="h-4 w-4" />}>
                Import Leads
              </Button>
            </Link>
            <button
              onClick={() => fetchMetrics()}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer shadow-soft-sm"
              title="Refresh metrics"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 12 Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metricCards.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.title} href={m.href} className="group">
                <Card hoverEffect className="h-full">
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
                        {m.title}
                      </span>
                      <div className={`p-1.5 rounded-lg ${m.bg} ${m.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-slate-900 tracking-tight">
                        {m.value}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-600 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Conversion Rate Highlight & Stage Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Gauge Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Lead Conversion Ratio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <span className="text-5xl font-black text-slate-900 tracking-tight">
                  {metrics?.conversionRate || 0}%
                </span>
                <span className="text-xs font-semibold text-slate-500 block mt-1">
                  Closed Won vs Lost Lead Decisions
                </span>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Converted Wins:</span>
                  <strong className="text-emerald-700">{metrics?.convertedLeads || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Lost Opportunities:</span>
                  <strong className="text-rose-700">{metrics?.lostLeads || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Active In-Flight:</span>
                  <strong className="text-sky-700">{metrics?.leadsInProgress || 0}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage Distribution Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pipeline Distribution Across Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {metrics?.stageDistribution.map((stage) => {
                  const percentage =
                    metrics.totalLeads > 0
                      ? Math.round((stage.count / metrics.totalLeads) * 100)
                      : 0;
                  return (
                    <div key={stage.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{stage.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">{percentage}%</span>
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Telecallers Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Telecaller Calling & Conversion Quotas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Telecaller</th>
                      <th className="p-3 text-center">Assigned</th>
                      <th className="p-3 text-center">Calls Logged</th>
                      <th className="p-3 text-center">Connected</th>
                      <th className="p-3 text-center">Sales Handovers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics?.telecallerPerformance?.map((t) => (
                      <tr key={t.userId} className="hover:bg-slate-50/60">
                        <td className="p-3 font-bold text-slate-900">{t.name}</td>
                        <td className="p-3 text-center font-semibold text-slate-700">{t.assignedCount}</td>
                        <td className="p-3 text-center font-semibold text-indigo-700">{t.callsLogged}</td>
                        <td className="p-3 text-center font-semibold text-emerald-700">{t.connectedCount}</td>
                        <td className="p-3 text-center font-bold text-sky-700">+{t.demosHandedOver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Salesmen Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Salesman Demo & Revenue Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Salesman</th>
                      <th className="p-3 text-center">Assigned</th>
                      <th className="p-3 text-center">Demos Done</th>
                      <th className="p-3 text-center">Won</th>
                      <th className="p-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics?.salesmanPerformance?.map((s) => (
                      <tr key={s.userId} className="hover:bg-slate-50/60">
                        <td className="p-3 font-bold text-slate-900">{s.name}</td>
                        <td className="p-3 text-center font-semibold text-slate-700">{s.assignedCount}</td>
                        <td className="p-3 text-center font-semibold text-cyan-700">{s.demosCompleted}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{s.convertedCount}</td>
                        <td className="p-3 text-right font-black text-slate-900">
                          {formatCurrency(s.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Recent Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Company-Wide Real-Time Activity Stream</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
              metrics.recentActivities.map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user?.name || 'System'}:</span>
                    <span className="text-slate-600">{act.description}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {formatDateTime(act.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activities recorded</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
