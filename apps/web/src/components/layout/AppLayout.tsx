'use client';

import React, { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useHeaderContext } from './PageHeaderContext';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onOpenCreateLead?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}

export function AppLayout({
  children,
  title,
  subtitle,
  onOpenCreateLead,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
}: AppLayoutProps) {
  const headerContext = useHeaderContext();
  const setHeader = headerContext?.setHeader;
  const updateCallbacks = headerContext?.updateCallbacks;

  // Sync callbacks to ref on every render without triggering re-render
  useEffect(() => {
    if (updateCallbacks) {
      updateCallbacks({ onOpenCreateLead, onSearchChange });
    }
  });

  // Sync header data when metadata changes
  useEffect(() => {
    if (setHeader) {
      setHeader({
        title,
        subtitle,
        searchTerm,
        searchPlaceholder,
        onOpenCreateLead,
        onSearchChange,
      });
    }
  }, [
    setHeader,
    title,
    subtitle,
    searchTerm,
    searchPlaceholder,
    Boolean(onOpenCreateLead),
    Boolean(onSearchChange),
  ]);

  // If inside persistent AppShell layout, render children directly without unmounting shell
  if (headerContext) {
    return <>{children}</>;
  }

  // Fallback for standalone rendering
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={title}
          subtitle={subtitle}
          onOpenCreateLead={onOpenCreateLead}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
