'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardMetrics } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Download, AlertTriangle, Users } from 'lucide-react';
import { TelecallerReportsView } from '@/components/reports/TelecallerReportsView';

export default function AdminReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const res = await api.get<DashboardMetrics>('/reports/dashboard');
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCsv() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') : '';
    window.open(`${apiBase}/api/v1/reports/export`, '_blank');
  }

  return (
    <AppLayout
      title="Reports & Analytics Intelligence"
      subtitle="Comprehensive breakdown of pipeline conversion rates, acquisition sources, lost reasons, and inactive records."
    >
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Telecaller Performance Intelligence Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" /> Telecaller Team Work Reports
              </h2>
              <p className="text-xs text-slate-500">
                Audit call output, connected discussions, and demo schedules per telecaller or for the entire team.
              </p>
            </div>
          </div>
          <TelecallerReportsView isAdmin={true} />
        </div>

        <div className="border-t border-slate-200 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Executive Performance Intelligence</h2>
              <p className="text-xs text-slate-500">Export audited CRM datasets for external BI analysis</p>
            </div>
            <Button
              size="sm"
              onClick={handleExportCsv}
              icon={<Download className="h-4 w-4" />}
            >
              Export All Leads to CSV
            </Button>
          </div>

        {/* Lead Source Breakdown & Lost Reasons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Attribution */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Inbound / Source Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.sourceDistribution?.map((item) => (
                  <div key={item.source} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{item.source}</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {item.count} leads
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (item.count / (metrics?.totalLeads || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ageing & Inactivity Card */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Ageing & Pipeline Velocity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                    Inactive Leads (&gt; 7 Days No Touch)
                  </span>
                  <span className="text-2xl font-black text-amber-900 mt-1 block">
                    {metrics?.inactiveLeadsCount || 0}
                  </span>
                  <span className="text-xs text-amber-700 mt-0.5 block">
                    Leads requiring immediate telecaller outreach revival
                  </span>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between text-slate-600">
                  <span>Total Leads In Pipeline:</span>
                  <strong className="text-slate-900">{metrics?.totalLeads || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Overdue Tasks:</span>
                  <strong className="text-rose-600">{metrics?.overdueFollowUps || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Converted Deals:</span>
                  <strong className="text-emerald-700">{metrics?.convertedLeads || 0}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Telecaller Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audited Telecaller Conversion Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Telecaller Name</th>
                    <th className="p-3 text-center">Assigned Leads</th>
                    <th className="p-3 text-center">Total Calls Placed</th>
                    <th className="p-3 text-center">Connected Calls</th>
                    <th className="p-3 text-center">Connection Rate</th>
                    <th className="p-3 text-right">Qualified Handovers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics?.telecallerPerformance?.map((t) => {
                    const connRate =
                      t.callsLogged > 0 ? Math.round((t.connectedCount / t.callsLogged) * 100) : 0;
                    return (
                      <tr key={t.userId} className="hover:bg-slate-50/60">
                        <td className="p-3 font-bold text-slate-900">{t.name}</td>
                        <td className="p-3 text-center font-semibold text-slate-700">{t.assignedCount}</td>
                        <td className="p-3 text-center font-semibold text-slate-700">{t.callsLogged}</td>
                        <td className="p-3 text-center font-semibold text-emerald-700">{t.connectedCount}</td>
                        <td className="p-3 text-center font-bold text-indigo-700">{connRate}%</td>
                        <td className="p-3 text-right font-black text-sky-700">+{t.demosHandedOver}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
