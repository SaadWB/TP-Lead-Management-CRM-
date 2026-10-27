import { api } from '@/lib/apiClient';

export interface WhatsAppFormatResult {
  valid: boolean;
  formatted: string;
  error?: string;
}

/**
 * Formats a phone number for WhatsApp:
 * - Removes spaces, dashes, brackets, and '+'
 * - If 10 digits, prepends India country code 91
 * - If starts with 0 and has 11 digits, strips 0 and prepends 91
 * - Valid numbers have 10-15 digits
 */
export function formatWhatsAppNumber(phone: string | null | undefined): WhatsAppFormatResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, formatted: '', error: 'Invalid phone number' };
  }

  // Remove spaces, dashes, brackets, plus, and dots
  let cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '').trim();

  // Strip leading 0 if 11 digits (e.g. 09876543210 -> 9876543210)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // If 10 digits, add India country code 91
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }

  // Must be only digits and between 10 and 15 digits
  if (/^\d{10,15}$/.test(cleaned)) {
    return { valid: true, formatted: cleaned };
  }

  return { valid: false, formatted: '', error: 'Invalid phone number' };
}

/**
 * Creates the full wa.me link with pre-filled message
 */
export function getWhatsAppUrl(formattedNumber: string, callerName?: string): string {
  const defaultText = `Hello, this is ${callerName || 'our team'} from TenderProcure. As discussed, sharing the details with you.`;
  return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(defaultText)}`;
}

/**
 * Opens WhatsApp in new tab and logs a note in lead history: "WhatsApp opened"
 */
export async function openWhatsAppChat({
  phone,
  leadId,
  callerName,
  onInvalid,
}: {
  phone: string;
  leadId?: string;
  callerName?: string;
  onInvalid?: (err: string) => void;
}): Promise<boolean> {
  const result = formatWhatsAppNumber(phone);
  if (!result.valid) {
    if (onInvalid) {
      onInvalid(result.error || 'Invalid phone number');
    } else {
      alert('Invalid phone number');
    }
    return false;
  }

  const url = getWhatsAppUrl(result.formatted, callerName);
  window.open(url, '_blank', 'noopener,noreferrer');

  // Log "WhatsApp opened" to lead history asynchronously if leadId is provided
  if (leadId) {
    try {
      await api.post(`/leads/${leadId}/whatsapp-log`, {});
    } catch {
      // Non-blocking log
    }
  }

  return true;
}
