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
import { formatDate } from '@/lib/utils';
import { UserPlus, Shield, PhoneCall, Briefcase } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New user form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [role, setRole] = useState<UserRole>('TELECALLER');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get<User[]>('/users');
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

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
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
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
          fetchUsers();
        }
      } else {
        fetchUsers();
      }
    } catch (err: any) {
      alert(err.message || 'Status toggle failed');
    }
  }

  return (
    <AppLayout
      title="User Management & Roles"
      subtitle="Manage team members, roles, activity status, and lead allocation quotas."
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Active CRM Personnel ({users.length})</h2>
            <p className="text-xs text-slate-500">Super Admins, Telecallers, and Sales Executives</p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            icon={<UserPlus className="h-4 w-4" />}
          >
            Add Team Member
          </Button>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
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
                      <tr key={u.id} className="hover:bg-slate-50/60">
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
                  })}
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
        <form onSubmit={handleCreateUser} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <Input
            label="Full Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya Chen"
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="m.chen@tenderprocure.com"
          />

          <Input
            label="Initial Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              options={[
                { value: 'TELECALLER', label: 'Telecaller (Kanban Calling)' },
                { value: 'SALESMAN', label: 'Salesman (Demo & Closer)' },
                { value: 'SUPER_ADMIN', label: 'Super Admin (Full Access)' },
              ]}
            />
            <Input
              label="Contact Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1-555-0199"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
