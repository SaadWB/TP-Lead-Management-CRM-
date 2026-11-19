'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { toDatetimeLocalValue, toIsoFromDatetimeLocal, getMinDatetimeLocal } from '@/lib/dateUtils';
import { formatDateTime } from '@/lib/utils';

export interface FollowUpDatePickerProps {
  value?: string | null;
  onChange: (isoString: string | null) => Promise<void> | void;
  disabled?: boolean;
  min?: string;
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
  min,
  className = '',
  compact = false,
  isOverdue = false,
  isMissing = false,
  showPreview = true,
}: FollowUpDatePickerProps) {
  const initialLocal = toDatetimeLocalValue(value);
  const [localValue, setLocalValue] = useState<string>(initialLocal);
  const [isFocused, setIsFocused] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes if not actively focused or dirty
  useEffect(() => {
    if (!isFocused && !isDirty) {
      setLocalValue(toDatetimeLocalValue(value));
    }
  }, [value, isFocused, isDirty]);

  const minDate = min || getMinDatetimeLocal();

  async function handleCommit(valToSave: string) {
    const trimmed = valToSave.trim();
    const currentPropLocal = toDatetimeLocalValue(value);

    // If no real change from server value, clear dirty and exit
    if (trimmed === currentPropLocal) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);
    try {
      if (!trimmed) {
        await onChange(null);
      } else {
        const iso = toIsoFromDatetimeLocal(trimmed);
        if (iso) {
          await onChange(iso);
        }
      }
      setIsDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update follow-up date:', err);
      // Revert to current prop on error
      setLocalValue(toDatetimeLocalValue(value));
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setIsFocused(false);
    // If user clicked inside the action buttons (save/clear), let button handler take over
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.date-picker-actions')) {
      return;
    }
    if (isDirty) {
      handleCommit(localValue);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit(localValue);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(toDatetimeLocalValue(value));
      setIsDirty(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className={`relative flex flex-col gap-1 ${className}`}>
      <div className="relative flex items-center group">
        <input
          ref={inputRef}
          type="datetime-local"
          disabled={disabled || isSaving}
          min={minDate}
          value={localValue}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onChange={(e) => {
            setLocalValue(e.target.value);
            setIsDirty(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 ${
            compact
              ? 'text-xs px-2 py-1 rounded-lg'
              : 'text-xs px-2.5 py-2 rounded-lg'
          } ${
            isOverdue
              ? 'bg-rose-50 border border-rose-300 text-rose-900 font-bold'
              : isMissing
              ? 'bg-amber-50/70 border border-amber-300 text-amber-900'
              : isDirty
              ? 'bg-sky-50/50 border border-sky-300 text-slate-900 ring-1 ring-sky-400'
              : 'bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200 text-slate-800'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        {/* Action icons & Status indicators */}
        <div className="date-picker-actions absolute right-1.5 flex items-center gap-1">
          {isSaving && (
            <span className="p-1 text-sky-600 animate-spin" title="Saving follow-up time...">
              <Loader2 className="h-3.5 w-3.5" />
            </span>
          )}

          {justSaved && !isSaving && (
            <span className="p-1 text-emerald-600 bg-emerald-50 rounded" title="Follow-up saved!">
              <Check className="h-3.5 w-3.5" />
            </span>
          )}

          {isDirty && !isSaving && (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleCommit(localValue)}
                className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm text-[10px] font-bold flex items-center gap-0.5"
                title="Save selected date & time"
              >
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">Save</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setLocalValue(toDatetimeLocalValue(value));
                  setIsDirty(false);
                }}
                className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded"
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}

          {!isDirty && !isSaving && !justSaved && localValue && !disabled && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setLocalValue('');
                handleCommit('');
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-opacity"
              title="Clear follow-up date"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Human-readable confirmation / preview badge under the field */}
      {showPreview && (
        <div className="flex items-center justify-between text-[10px]">
          {isMissing ? (
            <span className="font-bold text-rose-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Follow-up Required
            </span>
          ) : isOverdue ? (
            <span className="font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Overdue: {formatDateTime(value)}
            </span>
          ) : value ? (
            <span className="text-slate-500 font-medium flex items-center gap-1 truncate">
              <Calendar className="h-3 w-3 text-sky-500 shrink-0" />
              <span className="truncate">Due: {formatDateTime(value)}</span>
            </span>
          ) : (
            <span className="text-slate-400 italic">No follow-up set</span>
          )}

          {justSaved && (
            <span className="text-emerald-600 font-bold animate-pulse text-[10px]">
              ✓ Updated
            </span>
          )}
        </div>
      )}
    </div>
  );
}
