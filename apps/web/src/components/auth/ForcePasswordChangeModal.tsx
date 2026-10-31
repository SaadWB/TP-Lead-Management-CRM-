'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '@/lib/apiClient';
import { ShieldCheck, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { User } from '@crm/shared';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
  user: User | null;
  onSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

export function ForcePasswordChangeModal({
  isOpen,
  user,
  onSuccess,
  onLogout,
}: ForcePasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const hasMinLength = newPassword.length >= 10;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid = hasMinLength && hasLetter && hasDigit && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) {
      setError('Please satisfy all password security requirements.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post<{ user: User; token: string }>('/auth/change-password', {
        newPassword,
      });

      if (res.success && res.data) {
        if (res.data.token) {
          api.setToken(res.data.token);
        }
        onSuccess(res.data.user);
      } else {
        setError(res.message || 'Failed to update password');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Non-closable: user MUST change password
      title="Action Required: Change Your Initial Password"
      description="For company account security, you must set a new strong password before accessing the system."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl text-sky-900 text-xs flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0" />
          <span>
            Logged in as <strong>{user.email}</strong>. Please choose a strong password known only to you.
          </span>
        </div>

        <Input
          label="New Password"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min 10 characters with letters & numbers"
          icon={<Lock className="h-4 w-4" />}
          autoFocus
        />

        <Input
          label="Confirm New Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          icon={<Lock className="h-4 w-4" />}
        />

        {/* Security Policy Requirements Checklist */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
          <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
            Password Policy Requirements:
          </span>
          <div className="flex items-center gap-2 text-slate-600">
            {hasMinLength ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={hasMinLength ? 'text-emerald-700 font-semibold' : ''}>
              At least 10 characters long
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            {hasLetter && hasDigit ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={hasLetter && hasDigit ? 'text-emerald-700 font-semibold' : ''}>
              Contains a combination of letters and numbers
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            {passwordsMatch ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={passwordsMatch ? 'text-emerald-700 font-semibold' : ''}>
              Both passwords match
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onLogout}>
            Log Out
          </Button>

          <Button type="submit" size="sm" loading={loading} disabled={!isFormValid}>
            Set New Password & Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
}

