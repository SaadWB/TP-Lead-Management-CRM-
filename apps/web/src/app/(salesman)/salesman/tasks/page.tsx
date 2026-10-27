'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FollowUpTask } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Clock, Video, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SalesmanTasksPage() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await api.get<FollowUpTask[]>('/tasks');
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
      title="Demos & Executive Pitch Commitments"
      subtitle="Upcoming product walk-throughs, client RFP reviews, and scheduled contract meetings."
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Demo Schedule ({tasks.length})</h2>
          <button
            onClick={fetchTasks}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Video className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No scheduled demos or meetings</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Schedule meetings directly from assigned opportunities.
                </p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-soft-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={task.taskType === 'DEMO' ? 'cyan' : 'amber'} size="sm">
                      {task.taskType}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900">
                      {task.lead?.companyName || 'Opportunity'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-600 font-medium">
                      {task.lead?.contactPerson} ({task.lead?.phone})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">{task.notes || 'Demo agenda'}</p>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Scheduled: {formatDate(task.dueDate)} {task.dueTime || ''}
                  </span>
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
