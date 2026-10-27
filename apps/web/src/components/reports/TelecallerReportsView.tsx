'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  PhoneCall,
  Users,
  ThumbsUp,
  CalendarCheck,
  PhoneOff,
  UserX,
  Clock,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Calendar,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export interface TelecallerReportData {
  range: string;
  startDate: string;
  endDate: string;
  isMultiDay: boolean;
  targetTelecallerId: string;
  cards: {
    totalCallsMade: number;
    peopleConnected: number;
    interested: number;
    demoScheduled: number;
    demoCompleted: number;
    totalDemos: number;
    notReached: number;
    notInterested: number;
    wrongNumber: number;
    followUpsDue: number;
    followUpsDone: number;
    followUpsPending: number;
  };
  breakdown: { outcome: string; count: number; percentage: number }[];
  dailyTrend: { date: string; label: string; calls: number; connected: number }[];
  funnel: {
    calls: { count: number; rate: number };
    connected: { count: number; rate: number };
    interested: { count: number; rate: number };
    demo: { count: number; rate: number };
  };
  telecallers: { id: string; name: string; email: string }[];
}

interface TelecallerReportsViewProps {
  isAdmin?: boolean;
}

export function TelecallerReportsView({ isAdmin = false }: TelecallerReportsViewProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [rangePreset, setRangePreset] = useState<string>('TODAY');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedTelecaller, setSelectedTelecaller] = useState<string>('ALL');
  const [report, setReport] = useState<TelecallerReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('range', rangePreset);
      if (rangePreset === 'CUSTOM') {
        if (customFrom) params.set('fromDate', customFrom);
        if (customTo) params.set('toDate', customTo);
      }
      if (isAdmin && selectedTelecaller) {
        params.set('telecallerId', selectedTelecaller);
      }

      const res = await api.get<TelecallerReportData>(`/reports/telecaller-report?${params.toString()}`);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        throw new Error(res.message || 'Failed to fetch report');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [rangePreset, selectedTelecaller]);

  // Navigate to My Leads with pre-applied filter
  const handleCardClick = (filterType: string, value?: string) => {
    const basePath = isAdmin ? '/admin/leads' : '/telecaller/leads';
    const params = new URLSearchParams();

    if (filterType === 'outcome' && value) {
      params.set('lastCallOutcome', value);
    } else if (filterType === 'pipeline' && value) {
      params.set('pipelineStage', value);
    } else if (filterType === 'today') {
      router.push('/telecaller/today');
      return;
    }

    if (rangePreset !== 'ALL') {
      params.set('range', rangePreset);
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const cards = report?.cards;
  const funnel = report?.funnel;

  return (
    <div className="space-y-6">
      {/* Top Filter Controls: Date Range Selector + Admin Telecaller Picker */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'YESTERDAY', label: 'Yesterday' },
            { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'LAST_MONTH', label: 'Last Month' },
            { id: 'CUSTOM', label: 'Custom' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setRangePreset(preset.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[40px] shrink-0 ${
                rangePreset === preset.id
                  ? 'bg-slate-900 text-white shadow-soft-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Right side: Admin Telecaller picker + Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && report?.telecallers && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Telecaller:</span>
              <select
                value={selectedTelecaller}
                onChange={(e) => setSelectedTelecaller(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[40px] cursor-pointer"
              >
                <option value="ALL">All Telecallers Combined</option>
                {report.telecallers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={fetchReport}
            loading={loading}
            icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="min-h-[40px]"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Custom Date Inputs if CUSTOM is active */}
      {rangePreset === 'CUSTOM' && (
        <div className="bg-sky-50/60 border border-sky-200 p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-sky-900 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-white border border-sky-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 w-full sm:w-auto"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-sky-900 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-white border border-sky-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 w-full sm:w-auto"
            />
          </div>
          <Button
            size="sm"
            onClick={fetchReport}
            disabled={!customFrom}
            className="w-full sm:w-auto min-h-[38px]"
          >
            Apply Range
          </Button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Calls Made */}
        <div
          onClick={() => handleCardClick('outcome')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-sky-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-sky-600 transition-colors">
              Total Calls Made
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {cards?.totalCallsMade ?? 0}
            </span>
            <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View Leads <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Logged call attempts in range</p>
        </div>

        {/* 2. People Connected */}
        <div
          onClick={() => handleCardClick('outcome', 'Connected – Discussed')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-teal-600 transition-colors">
              People Connected
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-teal-600 tracking-tight">
              {cards?.peopleConnected ?? 0}
            </span>
            <span className="text-[11px] font-bold text-teal-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Filter Leads <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Spoke & discussed with prospect</p>
        </div>

        {/* 3. Interested */}
        <div
          onClick={() => handleCardClick('pipeline', 'Follow-up')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
              Interested Prospects
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ThumbsUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600 tracking-tight">
              {cards?.interested ?? 0}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Filter Leads <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Demo interested or details requested</p>
        </div>

        {/* 4. Demos (Scheduled & Completed separate) */}
        <div
          onClick={() => handleCardClick('outcome', 'Demo Scheduled')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-purple-600 transition-colors">
              Demos Overview
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-black text-purple-700 tracking-tight block">
                {cards?.demoScheduled ?? 0}
              </span>
              <span className="text-[10px] font-bold text-purple-600 uppercase">Scheduled</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-2xl font-black text-indigo-700 tracking-tight block">
                {cards?.demoCompleted ?? 0}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Completed</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Direct sales opportunities</p>
        </div>

        {/* 5. Not Reached (No Answer, Busy, Call Cut) */}
        <div
          onClick={() => handleCardClick('outcome', 'No Answer')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
              Not Reached
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PhoneOff className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600 tracking-tight">
              {cards?.notReached ?? 0}
            </span>
            <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Filter Leads <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">No Answer, Busy, or Call Cut</p>
        </div>

        {/* 6. Not Interested / Wrong Number */}
        <div
          onClick={() => handleCardClick('pipeline', 'Closed')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-rose-600 transition-colors">
              Disqualified / Closed
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-black text-rose-600 tracking-tight block">
                {cards?.notInterested ?? 0}
              </span>
              <span className="text-[10px] font-bold text-rose-500 uppercase">Not Interested</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-2xl font-black text-slate-600 tracking-tight block">
                {cards?.wrongNumber ?? 0}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Wrong Number</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Lead disqualified or closed</p>
        </div>

        {/* 7. Follow-ups Due vs Done */}
        <div
          onClick={() => handleCardClick('today')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm hover:shadow-soft-md hover:border-sky-300 transition-all cursor-pointer group sm:col-span-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-sky-600 transition-colors">
              Follow-ups Activity
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-6">
              <div>
                <span className="text-3xl font-black text-emerald-600 tracking-tight block">
                  {cards?.followUpsDone ?? 0}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-3xl font-black text-amber-600 tracking-tight block">
                  {cards?.followUpsPending ?? 0}
                </span>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Due</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 block">Total Due in Range</span>
              <span className="text-lg font-black text-slate-900">{cards?.followUpsDue ?? 0}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Open Today&apos;s Work queue →</p>
        </div>
      </div>

      {/* Conversion Funnel Line */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" /> Calling Pipeline Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Efficiency rate across Calls → People Connected → Interested Prospects → Scheduled Demos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* Step 1: Calls */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-600">1. Calls Attempted</span>
              <span className="text-xs font-black text-slate-900">{funnel?.calls.count ?? 0}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-sky-500 h-full rounded-full" style={{ width: '100%' }} />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-1.5">100% Base</span>
          </div>

          {/* Step 2: Connected */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-teal-700">2. Connected</span>
              <span className="text-xs font-black text-teal-900">{funnel?.connected.count ?? 0}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full"
                style={{ width: `${Math.min(100, funnel?.connected.rate ?? 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-teal-700 font-bold block mt-1.5">
              {funnel?.connected.rate ?? 0}% of Calls
            </span>
          </div>

          {/* Step 3: Interested */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-emerald-700">3. Interested</span>
              <span className="text-xs font-black text-emerald-900">{funnel?.interested.count ?? 0}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${Math.min(100, funnel?.interested.rate ?? 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block mt-1.5">
              {funnel?.interested.rate ?? 0}% of Connected
            </span>
          </div>

          {/* Step 4: Demo */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-purple-700">4. Demo Reached</span>
              <span className="text-xs font-black text-purple-900">{funnel?.demo.count ?? 0}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full"
                style={{ width: `${Math.min(100, funnel?.demo.rate ?? 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-purple-700 font-bold block mt-1.5">
              {funnel?.demo.rate ?? 0}% of Interested
            </span>
          </div>
        </div>
      </Card>

      {/* Outcome Breakdown & Daily Trend (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outcome Breakdown Bars */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-extrabold text-slate-900 flex items-center justify-between">
              <span>Last Call Outcome Breakdown</span>
              <span className="text-xs font-normal text-slate-400">
                {report?.breakdown.reduce((sum, b) => sum + b.count, 0) || 0} Total Outcomes
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report?.breakdown && report.breakdown.length > 0 ? (
              report.breakdown.map((item) => (
                <div
                  key={item.outcome}
                  onClick={() => handleCardClick('outcome', item.outcome)}
                  className="space-y-1 hover:bg-slate-50/80 p-2 rounded-lg transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
                      {item.outcome}
                    </span>
                    <span className="text-slate-500 font-semibold text-[11px]">
                      <strong className="text-slate-900">{item.count}</strong> leads ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-600 h-full rounded-full group-hover:bg-sky-500 transition-colors"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No outcome activities in this range</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Trend (when multi-day) or Quick Work Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-extrabold text-slate-900 flex items-center justify-between">
              <span>{report?.isMultiDay ? 'Daily Calling Trajectory' : 'Workday Performance Status'}</span>
              <span className="text-xs font-normal text-slate-400">
                {report?.isMultiDay ? 'Volume by Day' : 'Current Range'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.isMultiDay && report.dailyTrend.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                  <span>Date</span>
                  <div className="flex items-center gap-6">
                    <span>Calls</span>
                    <span>Connected</span>
                  </div>
                </div>
                {report.dailyTrend.map((day) => {
                  const maxCalls = Math.max(...report.dailyTrend.map((d) => d.calls), 1);
                  return (
                    <div key={day.date} className="flex items-center justify-between gap-4 py-1 text-xs">
                      <span className="font-semibold text-slate-700 w-16 shrink-0">{day.label}</span>
                      <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden flex items-center">
                        <div
                          className="bg-sky-500 h-full"
                          style={{ width: `${Math.min(100, (day.calls / maxCalls) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-6 text-xs font-bold shrink-0">
                        <span className="text-slate-800 w-8 text-right">{day.calls}</span>
                        <span className="text-teal-600 w-10 text-right">{day.connected}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">
                    Daily Insights & Range Selection
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Select <strong>Last 7 Days</strong>, <strong>This Month</strong>, or a <strong>Custom Range</strong> above to view day-by-day calling trends and performance trajectory charts.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-xs text-emerald-800 font-bold block">Connected Rate</span>
                    <span className="text-2xl font-black text-emerald-600 mt-1 block">
                      {funnel?.connected.rate ?? 0}%
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-xs text-purple-800 font-bold block">Demo Yield</span>
                    <span className="text-2xl font-black text-purple-600 mt-1 block">
                      {funnel?.demo.rate ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
