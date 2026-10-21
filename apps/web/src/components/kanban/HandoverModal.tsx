'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Lead, User } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Send, UserCheck, Calendar } from 'lucide-react';

interface HandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  targetStage: string;
  onSuccess: (updatedLead: Lead) => void;
}

export function HandoverModal({
  isOpen,
  onClose,
  lead,
  targetStage,
  onSuccess,
}: HandoverModalProps) {
  const [salesmen, setSalesmen] = useState<User[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [handoverSummary, setHandoverSummary] = useState('');
  const [scheduleMeeting, setScheduleMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSalesmen();
    }
  }, [isOpen]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    if (!selectedSalesmanId) {
      setError('Please select an active Salesman for handover');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: targetStage || 'Assign to Salesman',
        assignedSalesmanId: selectedSalesmanId,
        handoverSummary,
        meetingDate: scheduleMeeting && meetingDate ? meetingDate : undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign lead to salesman');
    } finally {
      setLoading(false);
    }
  }

  if (!lead) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Handover to Sales: ${lead.companyName}`}
      description="Transfer qualified opportunity to a dedicated sales closing executive."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <div className="p-3 bg-sky-50 rounded-lg border border-sky-200/80 text-xs text-sky-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-sky-600" /> Handing Over: {lead.companyName}
          </p>
          <p className="text-slate-600">
            Contact: <strong>{lead.contactPerson || '-'}</strong> ({lead.phone}) | Need: {lead.serviceProduct}
          </p>
        </div>

        <Select
          label="Select Sales Closer"
          required
          value={selectedSalesmanId}
          onChange={(e) => setSelectedSalesmanId(e.target.value)}
          options={salesmen.map((s) => ({
            value: s.id,
            label: `${s.name} (${s._count?.assignedSalesmanLeads || 0} active leads)`,
          }))}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Handover Briefing Summary</label>
          <textarea
            rows={3}
            value={handoverSummary}
            onChange={(e) => setHandoverSummary(e.target.value)}
            placeholder="Key client pain points, procurement timeline, decision-maker authority, agreed demo agenda..."
            className="w-full bg-white border border-slate-300 rounded-lg text-xs text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleMeeting}
              onChange={(e) => setScheduleMeeting(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
            />
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-sky-600" /> Schedule Live Demo / Meeting on Sales Calendar
            </span>
          </label>

          {scheduleMeeting && (
            <div className="pt-1">
              <Input
                label="Demo Date & Time"
                type="datetime-local"
                required={scheduleMeeting}
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={loading}
            icon={<Send className="h-4 w-4" />}
          >
            Confirm Sales Handover
          </Button>
        </div>
      </form>
    </Modal>
  );
}
