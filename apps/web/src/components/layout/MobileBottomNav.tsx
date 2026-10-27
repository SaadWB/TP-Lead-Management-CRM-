'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Table, CheckSquare, Kanban, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user || user.role !== 'TELECALLER') return null;

  const items = [
    { title: 'My Leads', href: '/telecaller/leads', icon: Table },
    { title: "Today", href: '/telecaller/today', icon: CheckSquare },
    { title: 'Kanban', href: '/telecaller/kanban', icon: Kanban },
    { title: 'Reports', href: '/telecaller/dashboard', icon: LayoutDashboard },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 z-30 flex items-center justify-around px-2 py-1 shadow-lg">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 min-h-[48px] min-w-[56px] text-[10px] font-bold active:scale-95',
              isActive
                ? 'text-sky-600 bg-sky-50'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'text-sky-600' : 'text-slate-400')} />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
