'use client';

import React, { Suspense } from 'react';
import { TelecallerLeadsWorkspace } from '@/components/telecaller/TelecallerLeadsWorkspace';

export default function TelecallerMyLeadsPage() {
  return (
    <Suspense fallback={null}>
      <TelecallerLeadsWorkspace mode="all" />
    </Suspense>
  );
}
