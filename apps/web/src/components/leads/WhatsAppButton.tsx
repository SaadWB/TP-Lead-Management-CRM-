'use client';

import React, { useState } from 'react';
import { MessageSquare, Phone } from 'lucide-react';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { useAuth } from '@/lib/authContext';

// Clean SVG for official WhatsApp branding
export function WhatsAppIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.677.15-.2.301-.777.978-.953 1.179-.175.2-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.894-.798-1.498-1.784-1.674-2.085-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.677-1.631-.928-2.232-.244-.585-.492-.505-.677-.515-.175-.008-.376-.01-.577-.01-.2 0-.526.075-.802.376-.276.301-1.053 1.028-1.053 2.508 0 1.48 1.078 2.909 1.229 3.11.15.2 2.122 3.24 5.14 4.544.718.31 1.279.496 1.716.634.721.23 1.378.197 1.9.119.58-.088 1.78-.727 2.03-1.43.25-.702.25-1.304.175-1.43-.075-.125-.276-.2-.577-.35z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 1.892.524 3.662 1.434 5.176L2 22l4.982-1.396A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.583 0-3.064-.45-4.329-1.232l-.31-.194-2.962.83.844-2.883-.203-.323A8.136 8.136 0 013.833 12c0-4.51 3.657-8.167 8.167-8.167 4.51 0 8.167 3.657 8.167 8.167 0 4.51-3.657 8.167-8.167 8.167z"
      />
    </svg>
  );
}

interface WhatsAppButtonProps {
  phone: string;
  leadId?: string;
  leadName?: string;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export function WhatsAppButton({
  phone,
  leadId,
  leadName,
  className = '',
  showText = false,
  size = 'sm',
}: WhatsAppButtonProps) {
  const { user } = useAuth();
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWhatsAppChat({
      phone,
      leadId,
      callerName: user?.name,
      onInvalid: (msg) => {
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 3000);
      },
    });
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        title="Send on WhatsApp"
        aria-label="Send on WhatsApp"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all duration-150 shadow-soft-xs cursor-pointer active:scale-95 ${
          size === 'sm' ? 'p-1.5 min-w-[32px] min-h-[32px] text-xs' : 'px-3 py-2 min-h-[44px] text-sm'
        } ${className}`}
      >
        <WhatsAppIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {showText && <span>WhatsApp</span>}
      </button>

      {errorToast && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded shadow-lg whitespace-nowrap z-50 animate-fade-in pointer-events-none">
          {errorToast}
        </div>
      )}
    </div>
  );
}

/**
 * Combined Action: Call + WhatsApp side-by-side
 */
export function PhoneActions({
  phone,
  leadId,
  className = '',
  size = 'sm',
}: {
  phone: string;
  leadId?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Call button */}
      <a
        href={`tel:${phone}`}
        className={`inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer active:scale-95 ${
          size === 'sm' ? 'p-1.5 min-w-[32px] min-h-[32px]' : 'px-3 py-2 min-h-[44px] gap-1.5 text-xs'
        }`}
        title={`Call ${phone}`}
        aria-label={`Call ${phone}`}
      >
        <Phone className={size === 'sm' ? 'h-3.5 w-3.5 text-slate-700' : 'h-4 w-4 text-slate-700'} />
        {size === 'md' && <span>Call</span>}
      </a>

      {/* WhatsApp button */}
      <WhatsAppButton phone={phone} leadId={leadId} size={size} showText={size === 'md'} />
    </div>
  );
}
