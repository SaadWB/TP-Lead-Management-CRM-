'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Lead, SalesStage, SALES_STAGE_OPTIONS, LOST_REASONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Calendar, Clock, AlertCircle, Award, CheckCircle2 } from 'lucide-react';

interface UpdateSalesStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  initialStage?: SalesStage;
  onSuccess: (updated: Lead) => void;
}

export function UpdateSalesStageModal({
  isOpen,
  onClose,
  lead,
  initialStage,
  onSuccess,
}: UpdateSalesStageModalProps) {
  const [salesStage, setSalesStage] = useState<SalesStage>('ASSIGNED');
  const [followUpDate, setFollowUpDate] = useState('');
  const [dealValue, setDealValue] = useState('25000');
  const [lostReason, setLostReason] = useState('PRICE_TOO_HIGH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lead) {
      setSalesStage(initialStage || (lead.salesStage as SalesStage) || 'ASSIGNED');
      setFollowUpDate(lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 16) : '');
      setNotes('');
      setError('');
    }
  }, [lead, initialStage, isOpen]);

  if (!lead) return null;

  const isScheduleRequired = salesStage === 'DEMO_SCHEDULED' || salesStage === 'FOLLOW_UP_REQUIRED';
  const nowString = new Date().toISOString().slice(0, 16);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setError('');

    if (isScheduleRequired) {
      if (!followUpDate) {
        setError(`Date and time are required when moving to "${salesStage}".`);
        return;
      }
      const selectedTime = new Date(followUpDate).getTime();
      if (isNaN(selectedTime) || selectedTime < Date.now() - 60000) {
        setError('Date and time cannot be in the past.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        salesStage,
        notes: notes.trim() || undefined,
      };

      if (isScheduleRequired) {
        payload.followUpDate = followUpDate;
      }

      if (salesStage === 'CONVERTED') {
        payload.dealValue = parseFloat(dealValue) || 0;
      }

      if (salesStage === 'LOST') {
        payload.lostReason = lostReason;
        payload.lostNotes = notes.trim() || undefined;
      }

      const res = await api.patch<Lead>(`/leads/${lead.id}/sales-stage`, payload);
      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update sales stage');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Sales Stage: ${lead.companyName}`}
      description="Update stage progression for this opportunity and schedule demos or follow-ups."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
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

        {/* Sales Stage Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Sales Stage</label>
          <select
            value={salesStage}
            onChange={(e) => setSalesStage(e.target.value as SalesStage)}
            className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            {SALES_STAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date and Time picker when DEMO_SCHEDULED or FOLLOW_UP_REQUIRED */}
        {isScheduleRequired && (
          <div className="space-y-2 p-3 bg-cyan-50/70 border border-cyan-200/80 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-900">
              <Calendar className="h-4 w-4 text-cyan-700" />
              <span>Schedule Date & Time <span className="text-rose-500">*</span></span>
            </div>
            <p className="text-[11px] text-cyan-800">
              A follow-up task will automatically be created on your dashboard for this exact date and time.
            </p>
            <input
              type="datetime-local"
              required
              min={nowString}
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full text-xs bg-white border border-cyan-300 rounded-lg p-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
        )}

        {/* Converted Deal Value */}
        {salesStage === 'CONVERTED' && (
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Award className="h-4 w-4 text-emerald-600" />
              <span>Deal Conversion Value</span>
            </div>
            <Input
              label="Contract / Deal Value ($ USD)"
              type="number"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              required
            />
          </div>
        )}

        {/* Lost Reason */}
        {salesStage === 'LOST' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Lost Reason</label>
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              {Object.entries(LOST_REASONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Remarks / Notes field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Remarks / Notes (Optional)</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document client feedback, requirements discussed, next action items..."
            className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
            Save Stage
          </Button>
        </div>
      </form>
    </Modal>
  );
}
