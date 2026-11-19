'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import {
  splitDatetime,
  combineDateAndTime,
  getTodayLocalDateString,
  BUSINESS_TIME_SLOTS,
} from '@/lib/dateUtils';
import { formatDateTime } from '@/lib/utils';

export interface DateTimePickerProps {
  value?: string | null;
  onChange: (val: string) => void;
  required?: boolean;
  minDate?: string;
  label?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  required = false,
  minDate,
  label = 'Date & Time',
  className = '',
}: DateTimePickerProps) {
  const initial = splitDatetime(value);
  const todayStr = minDate || getTodayLocalDateString();

  const [date, setDate] = useState<string>(initial.date || todayStr);
  const [time, setTime] = useState<string>(initial.time || '11:00');

  useEffect(() => {
    const s = splitDatetime(value);
    if (s.date) setDate(s.date);
    if (s.time) setTime(s.time);
  }, [value]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    const combined = combineDateAndTime(newDate, time);
    if (combined) {
      onChange(combined);
    }
  }

  function handleTimeChange(newTime: string) {
    setTime(newTime);
    const combined = combineDateAndTime(date || todayStr, newTime);
    if (combined) {
      onChange(combined);
    }
  }

  function setQuickDate(daysOffset: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    handleDateChange(ymd);
  }

  const currentCombined = date ? combineDateAndTime(date, time) : null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-sky-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Date & Time Selectors side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Date Part */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Select Date
          </span>
          <input
            type="date"
            required={required}
            min={todayStr}
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        {/* Time Part */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Select Time
          </span>
          <select
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          >
            {BUSINESS_TIME_SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Date & Time Chips for 1-click convenience */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
          Quick:
        </span>
        <button
          type="button"
          onClick={() => setQuickDate(0)}
          className={`px-2 py-0.5 text-[11px] rounded-lg border font-medium transition-colors ${
            date === todayStr
              ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setQuickDate(1)}
          className="px-2 py-0.5 text-[11px] rounded-lg border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 font-medium"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => setQuickDate(2)}
          className="px-2 py-0.5 text-[11px] rounded-lg border bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 font-medium"
        >
          +2 Days
        </button>

        <span className="text-slate-300 mx-0.5">|</span>

        {[
          { val: '10:30', label: '10:30 AM' },
          { val: '12:00', label: '12:00 PM' },
          { val: '15:00', label: '03:00 PM' },
          { val: '17:30', label: '05:30 PM' },
        ].map((t) => (
          <button
            key={t.val}
            type="button"
            onClick={() => handleTimeChange(t.val)}
            className={`px-2 py-0.5 text-[11px] rounded-lg border font-medium transition-colors ${
              time === t.val
                ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Human-readable confirmation preview */}
      {currentCombined && (
        <div className="p-2.5 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs text-sky-900 font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-600 shrink-0" />
          <span>
            Scheduled: <strong>{formatDateTime(currentCombined)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
