'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Lock, Mail, ArrowRight, UserCheck, PhoneCall, Briefcase } from 'lucide-react';

export default function LoginPage() {
  const { login, quickLogin } = useAuth();
  const [email, setEmail] = useState('admin@tenderprocure.com');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Mesh Accents */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center">
        {/* Brand Logo */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-600 text-white font-black text-xl shadow-soft-lg mb-3">
          TP
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">TenderProcure CRM</h2>
        <p className="mt-1 text-xs text-slate-400">
          Executive Sales & Telecalling Pipeline Management Platform
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-soft-xl rounded-2xl border border-slate-200/90 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Company Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@tenderprocure.com"
              icon={<Mail className="h-4 w-4" />}
            />

            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
            />

            <Button
              type="submit"
              size="md"
              loading={loading}
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Sign In to CRM
            </Button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center mb-3">
              Fast Demo Login (1-Click Test Access)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickLogin('SUPER_ADMIN')}
                className="p-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> Admin
                </div>
                <span className="text-[10px] text-purple-700 block mt-0.5 truncate">
                  Full Access
                </span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('TELECALLER')}
                className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-600" /> Telecaller
                </div>
                <span className="text-[10px] text-blue-700 block mt-0.5 truncate">
                  Kanban Queue
                </span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin('SALESMAN')}
                className="p-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <Briefcase className="h-3.5 w-3.5 text-teal-600" /> Salesman
                </div>
                <span className="text-[10px] text-teal-700 block mt-0.5 truncate">
                  Demo & Closer
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Security footer note */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Role-isolated data permissions enforced with server-side validation.
        </p>
      </div>
    </div>
  );
}
