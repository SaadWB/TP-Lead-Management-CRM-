'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ImportWizard } from '@/components/import/ImportWizard';

export default function AdminImportPage() {
  return (
    <AppLayout
      title="Excel & CSV Lead Bulk Import"
      subtitle="Upload lead workbooks, map fields, detect duplicates, and assign to telecallers with automated quotas."
    >
      <ImportWizard />
    </AppLayout>
  );
}
