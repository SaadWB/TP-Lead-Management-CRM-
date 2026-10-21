'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, TELECALLER_KANBAN_COLUMNS } from '@crm/shared';
import { Phone, Calendar, ArrowRight, UserCheck, Clock, GripVertical } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatDate, getPriorityColor } from '@/lib/utils';

interface KanbanCardProps {
  lead: Lead;
  onCardClick: (leadId: string) => void;
  onQuickMove: (leadId: string, newStage: string) => void;
}

export function KanbanCard({ lead, onCardClick, onQuickMove }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'Lead',
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyle = getPriorityColor(lead.priority);
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue =
    lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] < todayStr;
  const isDueToday =
    lead.nextFollowUpDate && lead.nextFollowUpDate.split('T')[0] === todayStr;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-soft-sm hover:shadow-soft hover:border-slate-300 transition-all cursor-pointer ${
        isDragging ? 'opacity-40 ring-2 ring-sky-500 shadow-soft-lg' : ''
      }`}
      onClick={() => onCardClick(lead.id)}
    >
      {/* Drag handle & Top Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-300 hover:text-slate-600 transition-colors -ml-1"
            title="Drag card"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}
          >
            {lead.priority}
          </span>
          {lead.callAttempts > 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
              {lead.callAttempts} {lead.callAttempts === 1 ? 'call' : 'calls'}
            </span>
          )}
        </div>

        {/* Quick stage selector menu */}
        <select
          value={lead.pipelineStage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onQuickMove(lead.id, e.target.value)}
          className="text-[10px] font-medium bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
        >
          {TELECALLER_KANBAN_COLUMNS.map((col) => (
            <option key={col.id} value={col.id}>
              {col.title}
            </option>
          ))}
          <option value="CONVERTED">Won</option>
          <option value="LOST">Lost</option>
        </select>
      </div>

      {/* Company Name & Product */}
      <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1 mb-0.5">
        {lead.companyName}
      </h4>
      <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
        {lead.serviceProduct}
      </p>

      {/* Contact Person & Click-to-call */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 py-1 border-t border-slate-100">
        <span className="font-medium truncate max-w-[140px] text-slate-700">{lead.contactPerson || '-'}</span>
        <a
          href={`tel:${lead.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
          title="Click to dial"
        >
          <Phone className="h-3 w-3" /> {lead.phone}
        </a>
      </div>

      {/* Follow-up / Overdue Alert */}
      {lead.nextFollowUpDate && (
        <div
          className={`mt-2 px-2 py-1.5 rounded-lg flex items-center justify-between text-[10px] ${
            isOverdue
              ? 'bg-rose-50 border border-rose-200 text-rose-700 font-bold animate-pulse'
              : isDueToday
              ? 'bg-amber-50 border border-amber-200 text-amber-800 font-bold'
              : 'bg-slate-50 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-1 truncate">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.nextAction || 'Follow-up'}</span>
          </div>
          <span className="shrink-0 ml-1">
            {isOverdue ? 'OVERDUE' : isDueToday ? 'Today' : formatDate(lead.nextFollowUpDate)}
          </span>
        </div>
      )}

      {/* Assigned Salesman tag & read-only Sales Stage */}
      {lead.assignedSalesman && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-teal-700 font-semibold">
          <span className="flex items-center gap-1 truncate">
            <UserCheck className="h-3 w-3 shrink-0" /> Closer: {lead.assignedSalesman.name}
          </span>
          {lead.salesStage && (
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[9px] shrink-0">
              {lead.salesStage.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
