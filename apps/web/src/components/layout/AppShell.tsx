'use client';

import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Persistent Left Sidebar - stays mounted across all client navigations */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
