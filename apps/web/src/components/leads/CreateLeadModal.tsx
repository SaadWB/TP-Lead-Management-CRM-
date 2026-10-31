'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Priority, Lead, DEFAULT_LEAD_SOURCES } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { Plus } from 'lucide-react';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [serviceProduct, setServiceProduct] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [leadSource, setLeadSource] = useState<string>('');
  const [leadSourceOther, setLeadSourceOther] = useState('');
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>(
    DEFAULT_LEAD_SOURCES.map((s) => ({ value: s, label: s }))
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // Fetch live options from server so newly configured sources appear immediately
    api.get<{ leadSources?: { name: string; isActive: boolean; order: number }[] }>('/options')
      .then((res) => {
        if (res.success && res.data?.leadSources) {
          const activeSources = res.data.leadSources
            .filter((s) => s.isActive)
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ value: s.name, label: s.name }));
          if (activeSources.length > 0) {
            setSourceOptions(activeSources);
          }
        }
      })
      .catch(() => {
        // Fallback to default lead sources
      });
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !phone.trim() || !serviceProduct.trim()) {
      setError('Please fill in Company Name, Service / Product, and Phone Number');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await api.post<Lead>('/leads', {
        companyName: companyName.trim(),
        serviceProduct: serviceProduct.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        priority,
        leadSource: leadSource || undefined,
        leadSourceOther: leadSource === 'Other' ? leadSourceOther.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
        // Reset form
        setCompanyName('');
        setServiceProduct('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setPriority('MEDIUM');
        setLeadSource('');
        setLeadSourceOther('');
        setNotes('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Lead"
      description="Add a new lead to the CRM pipeline."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Company Name"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Apex Industrial Solutions"
          />
          <Input
            label="Service / Product Required"
            required
            value={serviceProduct}
            onChange={(e) => setServiceProduct(e.target.value)}
            placeholder="e.g. Defense Tender Auto-Tracker"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Contact Person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Jane Miller"
          />
          <Input
            label="Phone Number"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1-555-0123"
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@apex.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            options={[
              { value: 'LOW', label: 'Low Priority' },
              { value: 'MEDIUM', label: 'Medium Priority' },
              { value: 'HIGH', label: 'High Priority' },
              { value: 'URGENT', label: 'Urgent Priority' },
            ]}
          />
          <Select
            label="Lead Source"
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            options={[
              { value: '', label: 'Select lead source' },
              ...sourceOptions,
            ]}
          />
        </div>

        {leadSource === 'Other' && (
          <div className="animate-in fade-in duration-200">
            <Input
              label="Lead Source Details"
              value={leadSourceOther}
              onChange={(e) => setLeadSourceOther(e.target.value)}
              placeholder="e.g. Partner introduction, newspaper ad (max 100 characters)"
              maxLength={100}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Initial Notes & Requirements</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Initial outreach context, source referral details..."
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
            icon={<Plus className="h-4 w-4" />}
          >
            Create Lead
          </Button>
        </div>
      </form>
    </Modal>
  );
}
