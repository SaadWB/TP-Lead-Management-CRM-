'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Lead, LOST_REASONS } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Award, TrendingDown, Check } from 'lucide-react';

interface SalesOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  mode: 'WON' | 'LOST';
  onSuccess: (updated: Lead) => void;
}

export function SalesOutcomeModal({
  isOpen,
  onClose,
  lead,
  mode,
  onSuccess,
}: SalesOutcomeModalProps) {
  const [dealValue, setDealValue] = useState('25000');
  const [lostReason, setLostReason] = useState<string>('PRICE_TOO_HIGH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!lead) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        pipelineStage: mode === 'WON' ? 'CONVERTED' : 'LOST',
        notes,
      };

      if (mode === 'WON') {
        payload.dealValue = parseFloat(dealValue) || 0;
      } else {
        if (!lostReason) {
          setError('Mandatory lost reason is required');
          setLoading(false);
          return;
        }
        payload.lostReason = lostReason;
        payload.lostNotes = notes;
      }

      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, payload);
      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update deal outcome');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'WON' ? `Mark Deal Won: ${lead.companyName}` : `Mark Lead Lost: ${lead.companyName}`}
      description={
        mode === 'WON'
          ? 'Record contract conversion and revenue attribution.'
          : 'Document loss reason for sales intelligence and pipeline analytics.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {mode === 'WON' ? (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Congratulations! Converting this deal moves it to the Closed Won column.</span>
            </div>
            <Input
              label="Contract / Deal Value ($ USD)"
              type="number"
              required
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="e.g. 25000"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Lost reason is mandatory to understand friction and competitor positioning.</span>
            </div>
            <Select
              label="Primary Reason for Loss"
              required
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              options={Object.entries(LOST_REASONS).map(([k, label]) => ({
                value: k,
                label,
              }))}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Closing Notes & Context</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={mode === 'WON' ? 'Contract terms, onboarding date...' : 'Client feedback, competitor pricing...'}
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
            variant={mode === 'WON' ? 'primary' : 'danger'}
          >
            {mode === 'WON' ? 'Confirm Conversion' : 'Confirm Lost Lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
