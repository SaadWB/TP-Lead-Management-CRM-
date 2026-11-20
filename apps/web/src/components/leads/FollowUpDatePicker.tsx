'use client';

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Check, X, Loader2, AlertCircle, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  splitDatetime,
  combineDateAndTime,
  getTodayLocalDateString,
  BUSINESS_TIME_SLOTS,
  getNextAvailableSlot,
  isPastLocalDateTime,
  formatTimeLabel,
} from '@/lib/dateUtils';

const POPOVER_WIDTH = 288; // w-72
const VIEWPORT_MARGIN = 8;
import { formatDateTime, formatDate } from '@/lib/utils';

export interface FollowUpDatePickerProps {
  value?: string | null;
  onChange: (isoString: string | null) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  isOverdue?: boolean;
  isMissing?: boolean;
  showPreview?: boolean;
}

export function FollowUpDatePicker({
  value,
  onChange,
  disabled = false,
  className = '',
  compact = false,
  isOverdue = false,
  isMissing = false,
  showPreview = true,
}: FollowUpDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Split current value into Date (YYYY-MM-DD) and Time (HH:mm)
  const initial = splitDatetime(value);
  const [selectedDate, setSelectedDate] = useState<string>(initial.date);
  const [selectedTime, setSelectedTime] = useState<string>(initial.time || '11:00');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Sync state when prop value changes and popover is closed
  useEffect(() => {
    if (!isOpen) {
      const s = splitDatetime(value);
      setSelectedDate(s.date);
      setSelectedTime(s.time || '11:00');
    }
  }, [value, isOpen]);

  /*
   * The popover is rendered in a portal on <body> with fixed positioning.
   * Inside the table it used to be `absolute` within an `overflow-x-auto max-h-[72vh]`
   * scroll container, so rows near the bottom/right got their picker clipped or hidden
   * behind sticky columns. Now it flips above the trigger when there is no room below
   * and is clamped inside the viewport.
   */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popHeight = popoverRef.current?.offsetHeight || 440;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    let top: number;
    if (spaceBelow >= popHeight + VIEWPORT_MARGIN || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4;
    } else {
      top = rect.top - popHeight - 4;
    }
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - popHeight - VIEWPORT_MARGIN));
    const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, vw - width - VIEWPORT_MARGIN));
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
    // Second pass once the popover has its real height
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // capture: table scroll containers too
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close popover when clicking outside (trigger and portal both count as inside) or on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const todayStr = getTodayLocalDateString();

  // Helper for quick date buttons
  function setQuickDate(daysOffset: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setSelectedDate(ymd);
  }

  const isPast = isPastLocalDateTime(selectedDate, selectedTime);
  const timeOptions = BUSINESS_TIME_SLOTS.some((t) => t.value === selectedTime)
    ? BUSINESS_TIME_SLOTS
    : [{ value: selectedTime, label: formatTimeLabel(selectedTime) }, ...BUSINESS_TIME_SLOTS].sort((a, b) =>
        a.value.localeCompare(b.value)
      );

  async function handleSave() {
    if (!selectedDate) {
      alert('Please select a date.');
      return;
    }
    if (isPast) {
      alert('This date & time has already passed. Please pick a later time.');
      return;
    }
    setIsSaving(true);
    try {
      const iso = combineDateAndTime(selectedDate, selectedTime);
      await onChange(iso);
      setIsSaving(false);
      setIsOpen(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save follow-up date:', err);
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsSaving(true);
    try {
      await onChange(null);
      setSelectedDate('');
      setSelectedTime('11:00');
      setIsSaving(false);
      setIsOpen(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to clear follow-up date:', err);
      setIsSaving(false);
    }
  }

  // Combined preview string
  const currentIsoPreview = selectedDate ? combineDateAndTime(selectedDate, selectedTime) : null;

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || isSaving}
        onClick={() => {
          if (!isOpen) {
            const s = splitDatetime(value);
            // Default to the next free business slot (today, or tomorrow 11 AM after hours)
            if (!s.date) {
              const slot = getNextAvailableSlot();
              setSelectedDate(slot.date);
              setSelectedTime(slot.time);
            } else {
              setSelectedDate(s.date);
              setSelectedTime(s.time || '11:00');
            }
          }
          setIsOpen(!isOpen);
        }}
        className={`w-full text-left transition-all flex items-center justify-between gap-1.5 rounded-lg border font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${
          compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-2 text-xs'
        } ${
          isOverdue
            ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-300 text-rose-900 font-bold'
            : isMissing
            ? 'bg-amber-50 hover:bg-amber-100/70 border-amber-300 text-amber-900'
            : value
            ? 'bg-slate-50 hover:bg-white border-slate-200 text-slate-800'
            : 'bg-white hover:bg-slate-50 border-dashed border-slate-300 text-slate-500'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer shadow-soft-xs'}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar
            className={`h-3.5 w-3.5 shrink-0 ${
              isOverdue ? 'text-rose-600' : isMissing ? 'text-amber-600' : 'text-sky-600'
            }`}
          />
          <span className="truncate">
            {value ? formatDateTime(value) : 'Schedule Follow-up...'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-sky-600" />}
          {justSaved && <Check className="h-3 w-3 text-emerald-600" />}
          {!isSaving && !justSaved && (
            <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-slate-600" />
          )}
        </div>
      </button>

      {/* Status Warning below button */}
      {showPreview && !isOpen && (
        <div className="mt-0.5 flex items-center justify-between text-[10px]">
          {isMissing ? (
            <span className="font-bold text-rose-600 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> Follow-up Required
            </span>
          ) : isOverdue ? (
            <span className="font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> Overdue
            </span>
          ) : null}
          {justSaved && (
            <span className="text-emerald-600 font-bold text-[10px] ml-auto">
              ✓ Saved
            </span>
          )}
        </div>
      )}

      {/* Floating Popover Picker (portal, fixed position, always on top) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Select follow-up date and time"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            width: Math.min(POPOVER_WIDTH, typeof window !== 'undefined' ? window.innerWidth - VIEWPORT_MARGIN * 2 : POPOVER_WIDTH),
            maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
            visibility: position ? 'visible' : 'hidden',
          }}
          className="z-[1000] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 p-3.5 space-y-3 animate-fade-in text-slate-800 text-left"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-sky-600" /> Select Date &amp; Time
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Date Shortcuts */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Date
            </span>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className={`py-1 rounded font-medium border text-center transition-colors ${
                  selectedDate === todayStr
                    ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                className="py-1 rounded font-medium border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 text-center"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(2)}
                className="py-1 rounded font-medium border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 text-center"
              >
                +2 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(7)}
                className="py-1 rounded font-medium border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 text-center"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Explicit Date Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Follow-up Date
            </label>
            <input
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          {/* Quick Time Shortcuts */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Time
            </span>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {[
                { val: '10:30', label: '10:30 AM' },
                { val: '12:00', label: '12:00 PM' },
                { val: '15:00', label: '03:00 PM' },
                { val: '17:30', label: '05:30 PM' },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setSelectedTime(t.val)}
                  className={`py-1 rounded font-medium border text-center transition-colors ${
                    selectedTime === t.val
                      ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Explicit Time Dropdown with 15-min intervals */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Specific Time (15-min slots)
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            >
              {timeOptions.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {isPast && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>This time has already passed.</span>
            </div>
          )}

          {/* Live Human-readable Preview */}
          {currentIsoPreview && !isPast && (
            <div className="p-2 bg-sky-50/80 border border-sky-100 rounded-lg text-[11px] text-sky-900 font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="truncate">
                Scheduled: <strong>{formatDateTime(currentIsoPreview)}</strong>
              </span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
            {value ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={isSaving}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
              >
                Clear
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !selectedDate || isPast}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-soft-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
