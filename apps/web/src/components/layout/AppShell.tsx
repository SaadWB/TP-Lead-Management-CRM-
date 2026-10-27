'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { useHeaderContext } from './PageHeaderContext';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const headerContext = useHeaderContext();

  const isMobileSidebarOpen = headerContext?.isMobileSidebarOpen ?? false;
  const closeMobileSidebar = headerContext?.closeMobileSidebar ?? (() => {});

  useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        closeMobileSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen, closeMobileSidebar]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-wide">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      {/* Desktop Left Sidebar - hidden on mobile & tablet */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile Slide-in Drawer with Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={closeMobileSidebar}
          aria-label="Close menu backdrop"
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out z-10',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <Sidebar isMobileDrawer={true} onClose={closeMobileSidebar} className="w-full border-r-0" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 bg-slate-50 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation for Telecaller */}
      <MobileBottomNav />
    </div>
  );
}
