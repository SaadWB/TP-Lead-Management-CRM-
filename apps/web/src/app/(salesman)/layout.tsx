'use client';

import React, { ReactNode } from 'react';
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext';
import { AppShell } from '@/components/layout/AppShell';

export default function SalesmanLayout({ children }: { children: ReactNode }) {
  return (
    <PageHeaderProvider>
      <AppShell>{children}</AppShell>
    </PageHeaderProvider>
  );
}
