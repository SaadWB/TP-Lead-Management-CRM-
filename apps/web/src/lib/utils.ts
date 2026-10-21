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
  switch (priority) {
    case 'URGENT':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'HIGH':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'MEDIUM':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'LOW':
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export function getStageColor(stage: string) {
  switch (stage) {
    case 'NEW':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'CONTACT_ATTEMPTED':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'CONNECTED':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'INTERESTED':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'FOLLOW_UP_SCHEDULED':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'DEMO_MEETING_REQUIRED':
    case 'DEMO_SCHEDULED':
      return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' };
    case 'DEMO_COMPLETED':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    case 'FOLLOW_UP_REQUIRED':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'ON_HOLD':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'ASSIGNED_TO_SALESMAN':
    case 'ASSIGNED':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
    case 'QUALIFIED':
    case 'NEGOTIATION':
      return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    case 'CONVERTED':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' };
    case 'LOST':
    case 'NOT_INTERESTED':
    case 'DO_NOT_CONTACT':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}
