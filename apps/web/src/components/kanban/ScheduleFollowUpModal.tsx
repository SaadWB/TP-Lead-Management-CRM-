'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Lead } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  targetStage: string;
  onSuccess: (updatedLead: Lead) => void;
}

export function ScheduleFollowUpModal({
  isOpen,
  onClose,
  lead,
  targetStage,
  onSuccess,
}: ScheduleFollowUpModalProps) {
  const [meetingDate, setMeetingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!lead) return null;

  const nowString = new Date().toISOString().slice(0, 16);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setError('');

    if (!meetingDate) {
      setError('Please select a follow-up Date and Time.');
      return;
    }

    const selectedTime = new Date(meetingDate).getTime();
    if (isNaN(selectedTime) || selectedTime < Date.now() - 60000) {
      setError('Date and time cannot be in the past.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: targetStage,
        meetingDate,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        throw new Error(res.message || 'Failed to schedule follow-up');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to schedule follow-up');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Schedule ${targetStage}: ${lead.companyName}`}
      description={`Set scheduled date and time to move card into "${targetStage}".`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-700 space-y-1">
          <p className="font-bold text-slate-900">{lead.companyName}</p>
          <p className="text-slate-500">
            Contact: <strong>{lead.contactPerson || '-'}</strong> ({lead.phone}) | Product: {lead.serviceProduct}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-sky-600" />
            Scheduled Date &amp; Time (Required)
          </label>
          <Input
            type="datetime-local"
            required
            min={nowString}
            value={meetingDate}
            onChange={(e) => {
              setMeetingDate(e.target.value);
              setError('');
            }}
          />
          <p className="text-[11px] text-slate-500">
            Past dates and times are not allowed. The card will appear in Today&apos;s Work / Follow-ups queue on this date.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Optional Notes / Remarks</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for callback or demo discussion topics..."
            className="w-full bg-white border border-slate-300 rounded-lg text-xs text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading} icon={<Clock className="h-4 w-4" />}>
            Save &amp; Move Card
          </Button>
        </div>
      </form>
    </Modal>
  );
}
