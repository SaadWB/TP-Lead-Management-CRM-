import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getPriorityColor(priority: string) {
  const norm = (priority || '').toUpperCase();
  switch (norm) {
    case 'URGENT':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' };
    case 'HIGH':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' };
    case 'MEDIUM':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' };
    case 'LOW':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' };
  }
}

export function getStageColor(stage: string) {
  const norm = (stage || '').trim().toLowerCase();
  if (norm.includes('new')) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' };
  }
  if (norm.includes('attempt') || norm.includes('contact_attempted')) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' };
  }
  if (norm.includes('connected')) {
    return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300', dot: 'bg-sky-500' };
  }
  if (norm.includes('follow') || norm.includes('follow_up')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500' };
  }
  if (norm.includes('demo')) {
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-500' };
  }
  if (norm.includes('salesman') || norm.includes('assigned')) {
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', dot: 'bg-teal-500' };
  }
  if (norm.includes('convert') || norm.includes('won')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' };
  }
  if (norm.includes('closed')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' };
  }
  if (norm.includes('lost') || norm.includes('not interested') || norm.includes('wrong')) {
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' };
  }
  return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' };
}

export function getOutcomeColor(outcome?: string | null) {
  if (!outcome) {
    return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
  }
  const norm = outcome.trim().toLowerCase();
  if (norm.includes('connected') || norm.includes('discussed')) {
    return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300', dot: 'bg-sky-500' };
  }
  if (norm.includes('details') || norm.includes('requested')) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' };
  }
  if (norm.includes('demo scheduled')) {
    return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500' };
  }
  if (norm.includes('demo interested')) {
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-500' };
  }
  if (norm.includes('demo completed')) {
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300', dot: 'bg-teal-500' };
  }
  if (norm.includes('call back')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500' };
  }
  if (norm.includes('pending') || norm.includes('decision')) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' };
  }
  if (norm.includes('no answer')) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' };
  }
  if (norm.includes('busy')) {
    return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' };
  }
  if (norm.includes('call cut')) {
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' };
  }
  if (norm.includes('not interested') || norm.includes('wrong number')) {
    return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' };
  }
  return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' };
}
