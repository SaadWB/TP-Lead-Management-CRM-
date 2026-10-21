'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { CALL_OUTCOMES, CallOutcome, Lead, User } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { PhoneCall, Calendar, UserCheck, Clock } from 'lucide-react';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSuccess: (updatedLead: Lead) => void;
}

export function CallLogModal({ isOpen, onClose, lead, onSuccess }: CallLogModalProps) {
  const [outcome, setOutcome] = useState<CallOutcome>('New Lead');
  const [notes, setNotes] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('180');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [salesmen, setSalesmen] = useState<User[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [customOutcomes, setCustomOutcomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSalesmen();
      api.get<{ priorities: string[]; callOutcomes: string[] }>('/leads/custom-options')
        .then((res) => {
          if (res.success && res.data?.callOutcomes) {
            setCustomOutcomes(res.data.callOutcomes);
          }
        })
        .catch(() => {});
      setError('');
      if (lead) {
        setOutcome((lead.pipelineStage as CallOutcome) || 'New Lead');
      }
    }
  }, [isOpen, lead]);

  async function loadSalesmen() {
    try {
      const res = await api.get<User[]>('/users', { role: 'SALESMAN', isActive: true });
      if (res.success && res.data) {
        setSalesmen(res.data);
        if (res.data.length > 0) {
          setSelectedSalesmanId(res.data[0].id);
        }
      }
    } catch {
      // ignore
    }
  }

  if (!lead) return null;

  const isFollowUpOutcome = outcome === 'Callback Requested' || outcome === 'Demo Requested';
  const isAssignSalesman = outcome === 'Assign to Salesman';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setError('');

    // Follow-up date validation
    if (isFollowUpOutcome) {
      if (!nextFollowUpDate) {
        setError(`Please select a Date and Time for ${outcome}.`);
        return;
      }
      const selectedTime = new Date(nextFollowUpDate).getTime();
      if (isNaN(selectedTime) || selectedTime < Date.now() - 60000) {
        setError('Follow-up date and time cannot be in the past.');
        return;
      }
    }

    if (isAssignSalesman && !selectedSalesmanId && !lead.assignedSalesmanId) {
      setError('Please select an active Sales Closer to assign.');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        outcome,
        notes,
        durationSeconds: parseInt(durationSeconds, 10) || 0,
        nextFollowUpDate: isFollowUpOutcome ? nextFollowUpDate : undefined,
        assignedSalesmanId: isAssignSalesman ? selectedSalesmanId : undefined,
      };

      const res = await api.post<{ callLog: any; lead: Lead }>(`/calls/lead/${lead.id}`, payload);
      if (res.success && res.data) {
        onSuccess(res.data.lead);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  }

  const nowString = new Date().toISOString().slice(0, 16);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Manual Call: ${lead.companyName}`}
      description={`Contact: ${lead.contactPerson || '-'} (${lead.phone})`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {/* Call Outcome Dropdown - 13 Standard Options + Custom Options */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Call Outcome <span className="text-rose-500">*</span></label>
          <select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value as CallOutcome);
              setError('');
            }}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            {[
              'New Lead',
              'No Answer / Ringing',
              'Busy / Declined',
              'Callback Requested',
              'Not Interested',
              'Details on WhatsApp',
              'Demo Requested',
              'Interested',
              'Discussing',
              'Invalid / Wrong Number',
              'Do Not Contact',
              'Closed',
              'Assign to Salesman',
              ...customOutcomes.filter(
                (o) =>
                  !o.toLowerCase().includes('special inquiry') &&
                  ![
                    'New Lead',
                    'No Answer / Ringing',
                    'Busy / Declined',
                    'Callback Requested',
                    'Not Interested',
                    'Details on WhatsApp',
                    'Demo Requested',
                    'Interested',
                    'Discussing',
                    'Invalid / Wrong Number',
                    'Do Not Contact',
                    'Closed',
                    'Assign to Salesman',
                  ].includes(o)
              ),
            ].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {outcome === 'Interested' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Automatic Rule: Selecting <strong>Interested</strong> will automatically schedule a follow-up for 3 days later.</span>
          </div>
        )}

        {/* Required Date & Time Picker for Callback Requested and Demo Requested */}
        {isFollowUpOutcome && (
          <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200/80 space-y-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
              <Calendar className="h-4 w-4 text-sky-600" />
              <span>{outcome === 'Demo Requested' ? 'Demo Scheduled Date & Time' : 'Callback Date & Time'} (Required)</span>
            </div>
            <Input
              type="datetime-local"
              required
              min={nowString}
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
            />
            <p className="text-[11px] text-sky-700">
              This lead will automatically be scheduled in your Follow-ups and Today&apos;s Work queue for this date.
            </p>
          </div>
        )}

        {/* Assign to Closer selector */}
        {isAssignSalesman && (
          <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200/80 space-y-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
              <UserCheck className="h-4 w-4 text-teal-600" />
              <span>Select Sales Closer to Handover (Required)</span>
            </div>
            <select
              value={selectedSalesmanId}
              onChange={(e) => setSelectedSalesmanId(e.target.value)}
              className="w-full bg-white border border-teal-300 rounded-lg text-xs text-slate-800 p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {salesmen.length === 0 ? (
                <option value="">No active sales closers found</option>
              ) : (
                salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))
              )}
            </select>
            <p className="text-[11px] text-teal-700">
              The lead will appear on the Closer&apos;s dashboard with Sales Stage &quot;ASSIGNED&quot;.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Input
            label="Call Duration (seconds)"
            type="number"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            placeholder="e.g. 180"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Call Notes & Conversation Details</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key discussion points, procurement requirements, timeline, budget..."
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
            icon={<PhoneCall className="h-4 w-4" />}
          >
            Submit Call Record
          </Button>
        </div>
      </form>
    </Modal>
  );
}
