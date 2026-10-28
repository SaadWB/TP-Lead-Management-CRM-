'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TABLE_TOKENS } from '@/lib/tableTokens';
import { AlertCircle } from 'lucide-react';

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function TableContainer({ children, maxHeight, className = '', ...props }: TableContainerProps) {
  return (
    <div className={cn(TABLE_TOKENS.cardContainer, className)} {...props}>
      <div className={TABLE_TOKENS.scrollWrapper} style={{ maxHeight }}>
        {children}
      </div>
    </div>
  );
}

export function Table({ className = '', children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn(TABLE_TOKENS.table, className)} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn(TABLE_TOKENS.thead, className)} {...props}>
      {children}
    </thead>
  );
}

export function TableHead({
  className = '',
  align = 'left',
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  const alignClass = align === 'center' ? TABLE_TOKENS.thCenter : align === 'right' ? TABLE_TOKENS.thRight : TABLE_TOKENS.th;
  return (
    <th className={cn(alignClass, className)} {...props}>
      {children}
    </th>
  );
}

export function TableHeadSticky({
  position = 'left',
  offset = 'left-0',
  className = '',
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { position?: 'left' | 'right'; offset?: string }) {
  return (
    <th
      className={cn(
        position === 'left' ? TABLE_TOKENS.thStickyCheckbox : TABLE_TOKENS.thStickyActions,
        offset,
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn(TABLE_TOKENS.tbody, className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = '',
  selected = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      className={cn(
        TABLE_TOKENS.tr,
        selected ? TABLE_TOKENS.trSelected : '',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  className = '',
  align = 'left',
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  const alignClass = align === 'center' ? TABLE_TOKENS.tdCenter : align === 'right' ? TABLE_TOKENS.tdRight : TABLE_TOKENS.td;
  return (
    <td className={cn(alignClass, className)} {...props}>
      {children}
    </td>
  );
}

export function TableCellSticky({
  position = 'left',
  offset = 'left-0',
  className = '',
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { position?: 'left' | 'right'; offset?: string }) {
  return (
    <td
      className={cn(
        position === 'left' ? TABLE_TOKENS.tdStickyCheckbox : TABLE_TOKENS.tdStickyActions,
        offset,
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableEmpty({
  colSpan = 8,
  title = 'No records found',
  description,
  icon,
}: {
  colSpan?: number;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={TABLE_TOKENS.emptyState}>
        <div className="flex flex-col items-center justify-center gap-2">
          {icon || <AlertCircle className="h-7 w-7 text-slate-300" />}
          <span className="font-bold text-sm text-slate-700">{title}</span>
          {description && <span className="text-xs text-slate-400 max-w-sm">{description}</span>}
        </div>
      </td>
    </tr>
  );
}

export function TableSkeletonRows({
  rows = 5,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="p-3">
              <div className={cn(TABLE_TOKENS.skeletonBar, 'h-4 w-full max-w-[120px]')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
