'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Lead } from '@crm/shared';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  column: {
    id: string;
    title: string;
    color: string;
    description: string;
  };
  leads: Lead[];
  onCardClick: (leadId: string) => void;
  onQuickMove: (leadId: string, newStage: string) => void;
}

export function KanbanColumn({
  column,
  leads,
  onCardClick,
  onQuickMove,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      columnId: column.id,
    },
  });

  const colorDots: Record<string, string> = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    teal: 'bg-teal-500',
    slate: 'bg-slate-400',
    rose: 'bg-rose-500',
    red: 'bg-red-500',
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-2xl bg-slate-100/80 border transition-colors max-h-full ${
        isOver
          ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-500/20'
          : 'border-slate-200/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorDots[column.color] || 'bg-slate-400'}`} />
          <h3 className="text-xs font-bold text-slate-800 truncate" title={column.title}>
            {column.title}
          </h3>
        </div>
        <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200/80 px-2 py-0.5 rounded-full shadow-soft-sm">
          {leads.length}
        </span>
      </div>

      {/* Cards List Container */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5 kanban-scroll min-h-[120px]">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onCardClick={onCardClick}
              onQuickMove={onQuickMove}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="h-28 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-200 rounded-xl">
            <p className="text-[11px] text-slate-400 font-medium">No leads in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
}
