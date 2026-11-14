'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { User, UserRole } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { useSWRData, invalidateCache } from '@/lib/apiCache';
import { formatDate } from '@/lib/utils';
import {
  UserPlus,
  Shield,
  PhoneCall,
  Briefcase,
  Users,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function AdminUsersPage() {
  const { data: usersData, loading: swrLoading, mutate: fetchUsers } = useSWRData<User[]>('/users');
  const [users, setUsers] = useState<User[]>(usersData || []);
  const [loading, setLoading] = useState<boolean>(!usersData || usersData.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New user form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('TenderProcure@2026');
  const [role, setRole] = useState<UserRole>('TELECALLER');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fallback explicit load to ensure users are always hydrated
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<User[]>('/users');
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        throw new Error(res.message || 'Failed to load user records');
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Unable to fetch user records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usersData && usersData.length > 0) {
      setUsers(usersData);
      setLoading(false);
    } else {
      loadUsers();
    }
  }, [usersData]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const res = await api.post('/users', {
        name,
        email,
        password,
        role,
        phone: phone || undefined,
      });

      if (res.success) {
        setIsAddOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        invalidateCache('/users');
        loadUsers();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(userId: string) {
    try {
      const res = await api.post<any>(`/users/${userId}/toggle-status`);
      if (res.success && res.data?.requiresReassignment) {
        const confirmForce = window.confirm(
          `Warning: ${res.data.message}\nDo you still wish to deactivate this account?`
        );
        if (confirmForce) {
          await api.post(`/users/${userId}/toggle-status?force=true`);
          invalidateCache('/users');
          loadUsers();
        }
      } else {
        invalidateCache('/users');
        loadUsers();
      }
    } catch (err: any) {
      alert(err.message || 'Status toggle failed');
    }
  }

  const superAdmins = users.filter((u) => u.role === 'SUPER_ADMIN');
  const telecallers = users.filter((u) => u.role === 'TELECALLER');
  const salesmen = users.filter((u) => u.role === 'SALESMAN');

  return (
    <AppLayout
      title="User Management & Roles"
      subtitle="Manage team members, roles, activity status, and lead allocation quotas."
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Users</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{users.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Telecallers</span>
              <span className="text-xl font-black text-sky-700 mt-0.5 block">{telecallers.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Sales Closers</span>
              <span className="text-xl font-black text-teal-700 mt-0.5 block">{salesmen.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Super Admins</span>
              <span className="text-xl font-black text-purple-700 mt-0.5 block">{superAdmins.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Header Action Bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Active CRM Personnel ({users.length})</h2>
            <p className="text-xs text-slate-500">Super Admins, Telecallers, and Sales Executives with access rights</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadUsers}
              icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              icon={<UserPlus className="h-4 w-4" />}
            >
              Add Team Member
            </Button>
          </div>
        </div>

        {/* Error notification banner if any */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadUsers}>
              Retry
            </Button>
          </div>
        )}

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Name & Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Phone</th>
                    <th className="p-3.5 text-center">Active Leads Queue</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Member Since</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && users.length === 0 ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="p-3.5">
                          <div className="w-36 h-3 bg-slate-200 rounded mb-1.5" />
                          <div className="w-48 h-2.5 bg-slate-100 rounded" />
                        </td>
                        <td className="p-3.5">
                          <div className="w-20 h-5 bg-slate-100 rounded" />
                        </td>
                        <td className="p-3.5">
                          <div className="w-24 h-3 bg-slate-100 rounded" />
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="w-14 h-4 bg-slate-100 rounded mx-auto" />
                        </td>
                        <td className="p-3.5">
                          <div className="w-16 h-5 bg-slate-100 rounded" />
                        </td>
                        <td className="p-3.5">
                          <div className="w-20 h-3 bg-slate-100 rounded" />
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="w-16 h-6 bg-slate-100 rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="h-8 w-8 text-slate-300" />
                          <span className="font-bold text-sm text-slate-700">No users found</span>
                          <span className="text-xs text-slate-400">Click &ldquo;Add Team Member&rdquo; above to provision user accounts.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const roleBadge =
                        u.role === 'SUPER_ADMIN'
                          ? 'purple'
                          : u.role === 'TELECALLER'
                          ? 'blue'
                          : 'teal';

                      const leadCount =
                        u.role === 'TELECALLER'
                          ? u._count?.assignedTelecallerLeads || 0
                          : u._count?.assignedSalesmanLeads || 0;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block">{u.name}</span>
                            <span className="text-[11px] text-slate-500 block">{u.email}</span>
                          </td>
                          <td className="p-3.5">
                            <Badge variant={roleBadge} size="sm">
                              {u.role.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3.5 font-medium text-slate-600">{u.phone || '—'}</td>
                          <td className="p-3.5 text-center">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {leadCount} leads
                            </span>
                          </td>
                          <td className="p-3.5">
                            <Badge variant={u.isActive ? 'emerald' : 'slate'} size="sm" dot>
                              {u.isActive ? 'Active' : 'Deactivated'}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                            {formatDate(u.createdAt)}
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              variant={u.isActive ? 'outline' : 'primary'}
                              size="sm"
                              onClick={() => handleToggleStatus(u.id)}
                              className="text-xs py-1"
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New CRM Team Member"
        description="Provision account for Telecaller, Sales Closer, or Administrator."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya@tenderprocure.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Role *</label>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              options={[
                { value: 'TELECALLER', label: 'Telecaller (Calls, Follow-ups & Initial Pipeline)' },
                { value: 'SALESMAN', label: 'Sales Closer (Demos, Meetings & Deal Closing)' },
                { value: 'SUPER_ADMIN', label: 'Super Administrator (Full System Control)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">Default temporary password: TenderProcure@2026</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              icon={<UserPlus className="h-4 w-4" />}
            >
              Create Team Member
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
