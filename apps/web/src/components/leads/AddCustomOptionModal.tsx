'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '@/lib/apiClient';
import { AlertCircle, PlusCircle, Check } from 'lucide-react';

interface AddCustomOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'PRIORITY' | 'CALL_OUTCOME';
  existingOptions: string[];
  onSuccess: (newOption: string) => void;
}

export function AddCustomOptionModal({
  isOpen,
  onClose,
  type,
  existingOptions,
  onSuccess,
}: AddCustomOptionModalProps) {
  const [optionName, setOptionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const typeLabel = type === 'PRIORITY' ? 'Priority' : 'Call Outcome';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = optionName.trim();
    setError('');

    if (!clean) {
      setError(`Please enter a valid ${typeLabel} name.`);
      return;
    }

    if (clean.toLowerCase().includes('special inquiry')) {
      setError('"Special Inquiry" has been permanently removed and cannot be added.');
      return;
    }

    const isDuplicate = existingOptions.some(
      (opt) => opt.toLowerCase() === clean.toLowerCase()
    );
    if (isDuplicate) {
      setError(`"${clean}" already exists in the ${typeLabel} options.`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<any>('/leads/custom-options', {
        type,
        name: clean,
      });

      if (res.success) {
        onSuccess(clean);
        setOptionName('');
        onClose();
      } else {
        setError(res.message || 'Failed to add option');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save new option');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add New ${typeLabel} Option`}
      description={`Create a new dynamic ${typeLabel.toLowerCase()} that will immediately appear across filters, cards, and dropdowns.`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Input
            label={`${typeLabel} Name`}
            placeholder={`e.g. ${type === 'PRIORITY' ? 'Critical' : 'Partner Referral'}`}
            value={optionName}
            onChange={(e) => {
              setOptionName(e.target.value);
              if (error) setError('');
            }}
            required
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading} icon={<PlusCircle className="h-3.5 w-3.5" />}>
            Add Option
          </Button>
        </div>
      </form>
    </Modal>
  );
}
