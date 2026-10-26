import React from 'react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

export default function TelecallerLoading() {
  return (
    <div className="p-1">
      <SkeletonLoader type="table" />
    </div>
  );
}
