'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { TaskType, Lead } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { CalendarPlus } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSuccess: () => void;
}

export function TaskModal({ isOpen, onClose, lead, onSuccess }: TaskModalProps) {
  const [taskType, setTaskType] = useState<TaskType>('FOLLOW_UP');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!lead) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    if (!dueDate) {
      setError('Please select a due date');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/tasks', {
        leadId: lead.id,
        taskType,
        dueDate,
        dueTime,
        notes,
      });

      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Schedule Task: ${lead.companyName}`}
      description="Create a timed reminder or calendar commitment."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <Select
          label="Task Type"
          required
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          options={[
            { value: 'CALL', label: 'Follow-up Call' },
            { value: 'FOLLOW_UP', label: 'General Follow-up' },
            { value: 'DEMO', label: 'Product Demonstration' },
            { value: 'MEETING', label: 'Procurement Meeting' },
            { value: 'OTHER', label: 'Other Activity' },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Due Date"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Input
            label="Due Time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Task Notes & Agenda</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agenda items, documents to prepare, discussion focus..."
            className="w-full bg-white border border-slate-300 rounded-lg text-xs text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            icon={<CalendarPlus className="h-4 w-4" />}
          >
            Save Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
