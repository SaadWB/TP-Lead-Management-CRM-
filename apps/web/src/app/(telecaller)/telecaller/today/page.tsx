'use client';

import React, { Suspense } from 'react';
import { TelecallerLeadsWorkspace } from '@/components/telecaller/TelecallerLeadsWorkspace';
import { MyPerformancePanel } from '@/components/telecaller/MyPerformancePanel';

/**
 * Today's Work = the exact My Leads table, restricted to leads with a scheduled
 * Next Follow-up Date (mandatory filter), nearest date & time first,
 * with the accurate daily performance panel on top.
 */
export default function TelecallerTodayPage() {
  return (
    <Suspense fallback={null}>
      <TelecallerLeadsWorkspace mode="today" topSlot={<MyPerformancePanel compact />} />
    </Suspense>
  );
}
