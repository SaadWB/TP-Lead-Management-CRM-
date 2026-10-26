'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  LayoutDashboard,
  Kanban,
  Users,
  FileSpreadsheet,
  BarChart3,
  CalendarCheck,
  Briefcase,
  Layers,
  LogOut,
  ChevronRight,
  ShieldAlert,
  CheckSquare,
  Table,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/Badge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  if (!user) return null;

  const adminNav: NavItem[] = [
    { title: 'Command Center', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Global Leads', href: '/admin/leads', icon: Layers },
    { title: 'Upload & Assign', href: '/admin/import', icon: FileSpreadsheet, badge: 'Wizard' },
    { title: 'User Management', href: '/admin/users', icon: Users },
    { title: 'Reports & Funnels', href: '/admin/reports', icon: BarChart3 },
  ];

  const telecallerNav: NavItem[] = [
    { title: 'My Leads', href: '/telecaller/leads', icon: Table, badge: 'Table' },
    { title: "Today's Work", href: '/telecaller/today', icon: CheckSquare, badge: 'Follow-ups' },
    { title: 'Calling Dashboard', href: '/telecaller/kanban', icon: Kanban, badge: 'Board' },
    { title: 'My Performance', href: '/telecaller/dashboard', icon: LayoutDashboard },
  ];

  const salesmanNav: NavItem[] = [
    { title: 'Sales Dashboard', href: '/salesman/dashboard', icon: LayoutDashboard },
    { title: 'Assigned Deals', href: '/salesman/leads', icon: Briefcase },
    { title: 'Demos & Meetings', href: '/salesman/tasks', icon: CalendarCheck },
  ];

  let currentNav: NavItem[] = [];
  if (user.role === 'SUPER_ADMIN') currentNav = adminNav;
  else if (user.role === 'TELECALLER') currentNav = telecallerNav;
  else if (user.role === 'SALESMAN') currentNav = salesmanNav;

  const roleLabels: Record<string, { label: string; color: any }> = {
    SUPER_ADMIN: { label: 'Admin', color: 'purple' },
    TELECALLER: { label: 'Telecaller', color: 'blue' },
    SALESMAN: { label: 'Sales Executive', color: 'teal' },
  };

  const roleMeta = roleLabels[user.role] || { label: user.role, color: 'slate' };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center font-black text-white text-base shadow-soft-sm">
          TP
        </div>
        <div>
          <span className="font-extrabold text-sm tracking-tight text-white block">TenderProcure</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
            Leads & Sales CRM
          </span>
        </div>
      </div>

      {/* Role Pill */}
      <div className="px-5 pt-4 pb-2">
        <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/60 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Workspace
            </span>
            <span className="text-xs font-semibold text-white truncate block">
              {user.name.split(' ')[0]}&apos;s Queue
            </span>
          </div>
          <Badge variant={roleMeta.color} size="sm">
            {roleMeta.label}
          </Badge>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Workspace Navigation
        </div>
        {currentNav.map((item) => {
          const activeHref = optimisticPath ?? pathname;
          const isActive =
            activeHref === item.href ||
            (item.href === '/telecaller/kanban' && activeHref === '/telecaller/leads');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => setOptimisticPath(item.href)}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer group',
                isActive
                  ? 'bg-sky-600 text-white shadow-soft font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>{item.title}</span>
              </div>
              {item.badge ? (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded',
                    isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-sky-400'
                  )}
                >
                  {item.badge}
                </span>
              ) : (
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity',
                    isActive && 'opacity-100'
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Log Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
