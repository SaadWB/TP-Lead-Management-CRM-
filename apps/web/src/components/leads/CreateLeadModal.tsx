'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Priority, Lead, User, DEFAULT_LEAD_SOURCES } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { invalidateCache, prependCachedLead } from '@/lib/apiCache';
import { Plus } from 'lucide-react';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  defaultLeadSource?: string;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess, defaultLeadSource }: CreateLeadModalProps) {
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [alternateName, setAlternateName] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [serviceProduct, setServiceProduct] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [leadSource, setLeadSource] = useState<string>(defaultLeadSource || '');
  const [leadSourceOther, setLeadSourceOther] = useState('');
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>(
    DEFAULT_LEAD_SOURCES.map((s) => ({ value: s, label: s }))
  );
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [userOptions, setUserOptions] = useState<{ value: string; label: string; role: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (defaultLeadSource) {
      setLeadSource(defaultLeadSource);
    }
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

    // Fetch active users for lead assignment
    api.get<User[]>('/users', { isActive: true })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const formatted = res.data
            .filter((u) => u.isActive)
            .map((u) => ({
              value: u.id,
              label: `${u.name} (${u.role === 'TELECALLER' ? 'Telecaller' : u.role === 'SALESMAN' ? 'Sales Closer' : 'Admin'})`,
              role: u.role,
            }));
          setUserOptions(formatted);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !phone.trim()) {
      setError('Please fill in Company Name and Phone Number');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const selectedUser = userOptions.find((u) => u.value === assignedUserId);
      const isSalesman = selectedUser?.role === 'SALESMAN';

      const res = await api.post<Lead>('/leads', {
        companyName: companyName.trim(),
        serviceProduct: serviceProduct.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        alternateName: alternateName.trim() || undefined,
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        priority,
        leadSource: leadSource || defaultLeadSource || undefined,
        leadSourceOther: leadSource?.toLowerCase() === 'other' ? leadSourceOther.trim() || undefined : undefined,
        assignedTelecallerId: isSalesman ? undefined : assignedUserId || undefined,
        assignedSalesmanId: isSalesman ? assignedUserId || undefined : undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        prependCachedLead(res.data);
        invalidateCache('/leads');
        invalidateCache('/reports/dashboard');
        onSuccess(res.data);
        onClose();
        // Reset form
        setContactPerson('');
        setPhone('');
        setAlternateName('');
        setAlternatePhone('');
        setCompanyName('');
        setEmail('');
        setServiceProduct('');
        setWebsite('');
        setCity('');
        setState('');
        setPriority('MEDIUM');
        setLeadSource(defaultLeadSource || '');
        setLeadSourceOther('');
        setAssignedUserId('');
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

        {/* 1. Primary Person & 2. Primary Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Primary Person (Contact Person)"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Jane Miller"
          />
          <Input
            label="Primary Phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
          />
        </div>

        {/* 3. Alternate Person & 4. Alternate Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Alternate Person (Secondary Contact)"
            value={alternateName}
            onChange={(e) => setAlternateName(e.target.value)}
            placeholder="e.g. Secondary Contact Person"
          />
          <Input
            label="Alternate Phone (Secondary Phone)"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            placeholder="Secondary contact number"
          />
        </div>

        {/* 5. Company Name & 6. Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Company Name"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Apex Industrial Solutions"
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@apex.com"
          />
        </div>

        {/* 7. Service/Product & 8. Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Service / Product"
            value={serviceProduct}
            onChange={(e) => setServiceProduct(e.target.value)}
            placeholder="e.g. Defense Tender Auto-Tracker (Optional)"
          />
          <Input
            label="Website URL"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {/* 9. Location (City, State) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai"
          />
          <Input
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="e.g. Maharashtra"
          />
        </div>

        {/* 10. Lead Source, Priority (Cold, Warm, Hot, Urgent), Assign Lead To */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Lead Source"
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            options={[
              { value: '', label: 'Select lead source' },
              ...sourceOptions,
            ]}
          />
          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            options={[
              { value: 'LOW', label: 'Cold (Low)' },
              { value: 'MEDIUM', label: 'Warm (Medium)' },
              { value: 'HIGH', label: 'Hot (High)' },
              { value: 'URGENT', label: 'Urgent (Hot)' },
            ]}
          />
          <Select
            label="Assign Lead To"
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            options={[
              { value: '', label: '-- Unassigned --' },
              ...userOptions.map((u) => ({ value: u.value, label: u.label })),
            ]}
          />
        </div>

        {leadSource?.toLowerCase() === 'other' && (
          <div className="animate-in fade-in duration-200 space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">Lead Source Details</label>
              <span className="text-[10px] text-slate-400 font-mono">{leadSourceOther.length}/100</span>
            </div>
            <Input
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
