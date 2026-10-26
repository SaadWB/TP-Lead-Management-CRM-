'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TelecallerTasksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/telecaller/today');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-slate-400 text-xs font-semibold">
      Redirecting to Today&apos;s Work follow-ups...
    </div>
  );
}
