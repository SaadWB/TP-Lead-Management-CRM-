'use client';

import React, { useState } from 'react';
import { Phone } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppButton';
import { openWhatsAppChat, formatWhatsAppNumber } from '@/lib/whatsapp';
import { useAuth } from '@/lib/authContext';

interface QuickContactActionsProps {
  phone?: string | null;
  leadId?: string;
  leadName?: string;
  className?: string;
}

/**
 * Requirement 2: Combined Call + WhatsApp quick contact icons.
 * - Side-by-side with small gap (gap-1.5) and flex-shrink: 0
 * - Fixed size: at least 32px (44px on touch/mobile)
 * - Call: tel:<number>
 * - WhatsApp: wa.me logic with 91 prefix for 10-digit Indian numbers
 * - Tooltips: "Call", "Send on WhatsApp"
 * - Disabled with tooltip "Phone number missing or invalid" if invalid
 */
export function QuickContactActions({
  phone,
  leadId,
  leadName,
  className = '',
}: QuickContactActionsProps) {
  const { user } = useAuth();
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const cleanPhone = (phone || '').trim();
  const formatRes = formatWhatsAppNumber(cleanPhone);
  const isValid = formatRes.valid;

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isValid) return;

    openWhatsAppChat({
      phone: cleanPhone,
      leadId,
      callerName: user?.name,
      onInvalid: (msg) => {
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 3000);
      },
    });
  };

  const handleCallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 shrink-0 select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Call Button */}
      {isValid ? (
        <a
          href={`tel:${cleanPhone}`}
          onClick={handleCallClick}
          title={`Call ${cleanPhone}`}
          aria-label={`Call ${cleanPhone}`}
          className="inline-flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] max-sm:w-11 max-sm:h-11 max-sm:min-w-[44px] max-sm:min-h-[44px] rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200/80 transition-all active:scale-95 cursor-pointer shadow-soft-xs"
        >
          <Phone className="h-3.5 w-3.5 max-sm:h-4 max-sm:w-4 shrink-0 text-emerald-700" />
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Phone number missing or invalid"
          aria-label="Call disabled: missing or invalid phone"
          className="inline-flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] max-sm:w-11 max-sm:h-11 max-sm:min-w-[44px] max-sm:min-h-[44px] rounded-lg bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50"
        >
          <Phone className="h-3.5 w-3.5 max-sm:h-4 max-sm:w-4 shrink-0 text-slate-400" />
        </button>
      )}

      {/* WhatsApp Button */}
      <div className="relative inline-flex items-center">
        {isValid ? (
          <button
            type="button"
            onClick={handleWhatsAppClick}
            title={`Send on WhatsApp (${cleanPhone})`}
            aria-label="Send on WhatsApp"
            className="inline-flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] max-sm:w-11 max-sm:h-11 max-sm:min-w-[44px] max-sm:min-h-[44px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all active:scale-95 cursor-pointer shadow-soft-xs"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 max-sm:h-4 max-sm:w-4 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Phone number missing or invalid"
            aria-label="WhatsApp disabled: missing or invalid phone"
            className="inline-flex items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] max-sm:w-11 max-sm:h-11 max-sm:min-w-[44px] max-sm:min-h-[44px] rounded-lg bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 max-sm:h-4 max-sm:w-4 shrink-0 text-slate-400" />
          </button>
        )}

        {/* Error Toast for unexpected failures */}
        {errorToast && (
          <div className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded shadow-lg whitespace-nowrap z-50 animate-fade-in pointer-events-none">
            {errorToast}
          </div>
        )}
      </div>
    </div>
  );
}
