'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FollowUpTask, TaskStatus } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Clock, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function TelecallerTasksPage() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'OVERDUE' | 'UPCOMING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('PENDING');

  useEffect(() => {
    fetchTasks();
  }, [timeFilter, statusFilter]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const params: any = {};
      if (timeFilter !== 'ALL') params.timeFilter = timeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get<FollowUpTask[]>('/tasks', params);
      if (res.success && res.data) {
        setTasks(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkComplete(taskId: string) {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'COMPLETED' });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <AppLayout
      title="Follow-ups & Calling Tasks"
      subtitle="Scheduled commitments, call backs, and live demo reminders."
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Filter bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-soft-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 px-1 uppercase">Timeline:</span>
            {(['ALL', 'TODAY', 'OVERDUE', 'UPCOMING'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                  timeFilter === filter
                    ? 'bg-slate-900 text-white shadow-soft-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter === 'TODAY' ? "Today's Queue" : filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold"
            >
              <option value="PENDING">Pending Only</option>
              <option value="COMPLETED">Completed</option>
              <option value="ALL">All Statuses</option>
            </select>

            <button
              onClick={fetchTasks}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {loading && tasks.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white shadow-soft-sm flex items-center justify-between gap-4 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="flex gap-2">
                      <div className="w-16 h-4 bg-slate-200 rounded" />
                      <div className="w-24 h-4 bg-slate-200 rounded" />
                    </div>
                    <div className="w-1/2 h-3 bg-slate-200 rounded" />
                    <div className="w-1/4 h-3 bg-slate-200 rounded" />
                  </div>
                  <div className="w-24 h-8 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No tasks matching current filter</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Schedule follow-ups directly on lead cards or from the Kanban board.
                </p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-xl border bg-white shadow-soft-sm flex items-center justify-between gap-4 transition-all hover:border-slate-300 ${
                  task.isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={task.taskType === 'DEMO' ? 'cyan' : 'amber'} size="sm">
                      {task.taskType}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {task.lead?.companyName || 'Lead'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-600 font-medium">
                      Contact: {task.lead?.contactPerson} ({task.lead?.phone})
                    </span>
                    {task.isOverdue && (
                      <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertCircle className="h-3 w-3" /> OVERDUE
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 font-normal leading-relaxed">
                    {task.notes || 'No description entered'}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Due: {formatDate(task.dueDate)} {task.dueTime || ''}
                    </span>
                  </div>
                </div>

                {task.status === 'PENDING' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleMarkComplete(task.id)}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Mark Done
                  </Button>
                ) : (
                  <Badge variant="emerald" size="md">
                    Completed
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
