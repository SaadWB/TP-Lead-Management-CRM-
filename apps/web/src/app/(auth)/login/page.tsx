'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      switch (user.role) {
        case 'SUPER_ADMIN':
          router.replace('/admin/dashboard');
          break;
        case 'TELECALLER':
          router.replace('/telecaller/leads');
          break;
        case 'SALESMAN':
          router.replace('/salesman/dashboard');
          break;
      }
    }
  }, [user, authLoading, router]);

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
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white p-2 shadow-soft-lg mb-3 border border-slate-800/80">
          <img
            src="/tenderprocure-logo.png"
            alt="TenderProcure Logo"
            className="w-full h-full object-contain"
          />
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
        </div>

        {/* Security footer note */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Role-isolated data permissions enforced with server-side validation.
        </p>
      </div>
    </div>
  );
}
