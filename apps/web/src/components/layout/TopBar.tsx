'use client';

import React from 'react';
import { useAuth } from '@/lib/authContext';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { Button } from '../ui/Button';
import { Search, Plus } from 'lucide-react';
import { useHeaderContext } from './PageHeaderContext';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onOpenCreateLead?: () => void;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export function TopBar(props: TopBarProps) {
  const { user, quickLogin } = useAuth();
  const headerContext = useHeaderContext();

  const title = props.title ?? headerContext?.header.title ?? 'TenderProcure CRM';
  const subtitle = props.subtitle ?? headerContext?.header.subtitle;
  const onOpenCreateLead = props.onOpenCreateLead ?? headerContext?.header.onOpenCreateLead;
  const searchTerm = props.searchTerm ?? headerContext?.header.searchTerm;
  const onSearchChange = props.onSearchChange ?? headerContext?.header.onSearchChange;
  const searchPlaceholder = props.searchPlaceholder ?? headerContext?.header.searchPlaceholder ?? 'Search company, phone, contact...';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Title & Context */}
      <div>
        <h1 className="text-base font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      {/* Middle Search (if search callback is supplied) */}
      {onSearchChange && (
        <div className="hidden md:flex items-center flex-1 max-w-md relative">
          <Search className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all"
          />
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Role Switcher - Admin Only */}
        {user?.role === 'SUPER_ADMIN' && (
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-500 px-1 uppercase tracking-wider">
              Switch:
            </span>
            <button
              onClick={() => quickLogin('SUPER_ADMIN')}
              className="px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors bg-purple-600 text-white shadow-soft-sm"
            >
              Admin
            </button>
            <button
              onClick={() => quickLogin('TELECALLER')}
              className="px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors text-slate-600 hover:text-slate-900"
            >
              Telecaller
            </button>
            <button
              onClick={() => quickLogin('SALESMAN')}
              className="px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors text-slate-600 hover:text-slate-900"
            >
              Salesman
            </button>
          </div>
        )}

        {/* Notifications */}
        <NotificationPopover />

        {/* Quick Add Lead Button - Admin Only */}
        {user?.role === 'SUPER_ADMIN' && onOpenCreateLead && (
          <Button
            size="sm"
            onClick={onOpenCreateLead}
            icon={<Plus className="h-4 w-4" />}
          >
            New Lead
          </Button>
        )}
      </div>
    </header>
  );
}
