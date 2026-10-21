'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Lead } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { AlertCircle, CheckCircle2, Clock, Calendar } from 'lucide-react';

interface FollowUpCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  mode: 'CLOSED' | 'NOT_CLOSED';
  onSuccess: (updated: Lead) => void;
}

export function FollowUpCompletionModal({
  isOpen,
  onClose,
  lead,
  mode,
  onSuccess,
}: FollowUpCompletionModalProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !lead) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setError('');

    if (mode === 'NOT_CLOSED' && !notes.trim()) {
      setError('Please provide a reason/note for why the follow-up was not closed.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/follow-up-completion`, {
        action: mode,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
        setNotes('');
      } else {
        setError(res.message || 'Failed to complete follow-up');
      }
    } catch (err: any) {
      setError(err.message || 'Error completing follow-up');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'CLOSED' ? `Mark Follow-up as Closed` : `Follow-up Not Closed`}
      description={
        mode === 'CLOSED'
          ? `Move ${lead.companyName} to the Closed list and complete the active follow-up.`
          : `Document why ${lead.companyName} was not closed. The lead will automatically return to Follow-ups after 3 days.`
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
          <div className="text-xs font-bold text-slate-800">{lead.companyName}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-3">
            <span>Contact: <strong className="text-slate-700">{lead.contactPerson || '-'}</strong></span>
            <span>Phone: <strong className="text-emerald-700 font-semibold">{lead.phone}</strong></span>
          </div>
        </div>

        {mode === 'NOT_CLOSED' ? (
          <div className="space-y-2">
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Automatic 3-Day Reschedule</span>
                <span className="text-[11px] text-amber-800">
                  Per Round 4 rule, this lead will automatically return to your Follow-ups list on the 3rd day.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Reason / Follow-up Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="State client objection, discussion progress, or why it wasn't closed..."
                className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Great job! Moving to Closed removes this opportunity from the active follow-up queue.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Closing Remarks (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional closing notes..."
                className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            className={mode === 'CLOSED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            {mode === 'CLOSED' ? 'Confirm Closed' : 'Save & Reschedule in 3 Days'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
