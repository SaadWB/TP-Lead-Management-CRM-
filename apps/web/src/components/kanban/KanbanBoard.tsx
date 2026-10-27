'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Lead, TELECALLER_KANBAN_COLUMNS } from '@crm/shared';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { HandoverModal } from './HandoverModal';
import { ScheduleFollowUpModal } from './ScheduleFollowUpModal';
import { api } from '@/lib/apiClient';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  onCardClick: (leadId: string) => void;
  customColumns?: { id: string; title: string; color: string; description: string }[];
}

export function KanbanBoard({ leads, onLeadsChange, onCardClick, customColumns }: KanbanBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [handoverTarget, setHandoverTarget] = useState<{ lead: Lead; targetStage: string } | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<{ lead: Lead; targetStage: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const found = leads.find((l) => l.id === active.id);
    if (found) setActiveLead(found);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = String(active.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Target can be a column container ID or another card in a column
    let targetStage: string | undefined;
    const isColumn = TELECALLER_KANBAN_COLUMNS.some((col) => col.id === over.id);

    if (isColumn) {
      targetStage = String(over.id);
    } else {
      const overLead = leads.find((l) => l.id === over.id);
      if (overLead) {
        targetStage = overLead.pipelineStage;
      }
    }

    if (!targetStage || targetStage === lead.pipelineStage) return;

    // Check if moving to Follow-up or Demo without date -> requires Date and Time popup
    if (
      targetStage === 'Callback Requested' ||
      targetStage === 'Demo Requested' ||
      ((targetStage === 'Follow-up' || targetStage === 'Demo') && !lead.nextFollowUpDate)
    ) {
      setFollowUpTarget({ lead, targetStage });
      return;
    }

    // Check if moving to Sales Closer handover
    if (targetStage === 'Assign to Salesman' || targetStage === 'ASSIGNED_TO_SALESMAN') {
      setHandoverTarget({ lead, targetStage: 'Assign to Salesman' });
      return;
    }

    // Normal transition with optimistic UI update
    await executeStageUpdate(lead, targetStage);
  }

  async function executeStageUpdate(lead: Lead, targetStage: string) {
    const previousStage = lead.pipelineStage;
    // 1. Optimistic update
    const updatedList = leads.map((l) =>
      l.id === lead.id ? { ...l, pipelineStage: targetStage as any } : l
    );
    onLeadsChange(updatedList);

    // 2. Persist to backend
    try {
      const res = await api.post<Lead>(`/leads/${lead.id}/stage`, {
        pipelineStage: targetStage,
      });

      if (!res.success || !res.data) {
        throw new Error(res.message || 'Stage update failed');
      }

      // Update with server response
      onLeadsChange(leads.map((l) => (l.id === lead.id ? res.data! : l)));
    } catch (err: any) {
      // Rollback UI
      onLeadsChange(
        leads.map((l) => (l.id === lead.id ? { ...l, pipelineStage: previousStage } : l))
      );
      alert(err.message || 'Failed to move lead. Reverted.');
    }
  }

  function handleQuickMove(leadId: string, newStage: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipelineStage === newStage) return;

    if (
      newStage === 'Callback Requested' ||
      newStage === 'Demo Requested' ||
      ((newStage === 'Follow-up' || newStage === 'Demo') && !lead.nextFollowUpDate)
    ) {
      setFollowUpTarget({ lead, targetStage: newStage });
      return;
    }

    if (newStage === 'Assign to Salesman' || newStage === 'ASSIGNED_TO_SALESMAN') {
      setHandoverTarget({ lead, targetStage: 'Assign to Salesman' });
      return;
    }

    executeStageUpdate(lead, newStage);
  }

  return (
    <div className="h-full flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Horizontal scrollable columns container */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 kanban-scroll items-start snap-x snap-mandatory sm:snap-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            ...TELECALLER_KANBAN_COLUMNS,
            ...(customColumns || []).filter(
              (c) =>
                !TELECALLER_KANBAN_COLUMNS.some((col) => col.id === c.id) &&
                !c.title.toLowerCase().includes('special inquiry')
            ),
          ].map((column) => {
            const columnLeads = leads.filter((l) => l.pipelineStage === column.id);
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                leads={columnLeads}
                onCardClick={onCardClick}
                onQuickMove={handleQuickMove}
              />
            );
          })}
        </div>

        {/* Drag Overlay for smooth preview while dragging */}
        <DragOverlay>
          {activeLead ? (
            <div className="w-72 opacity-90 shadow-soft-xl rotate-1 scale-102">
              <KanbanCard
                lead={activeLead}
                onCardClick={() => {}}
                onQuickMove={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Date & Time follow-up modal for Callback Requested or Demo Requested */}
      {followUpTarget && (
        <ScheduleFollowUpModal
          isOpen={!!followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          lead={followUpTarget.lead}
          targetStage={followUpTarget.targetStage}
          onSuccess={(updated) => {
            onLeadsChange(leads.map((l) => (l.id === updated.id ? updated : l)));
            setFollowUpTarget(null);
          }}
        />
      )}

      {/* Handover Modal when dropped on Salesman */}
      {handoverTarget && (
        <HandoverModal
          isOpen={!!handoverTarget}
          onClose={() => setHandoverTarget(null)}
          lead={handoverTarget.lead}
          targetStage={handoverTarget.targetStage}
          onSuccess={(updated) => {
            onLeadsChange(leads.map((l) => (l.id === updated.id ? updated : l)));
            setHandoverTarget(null);
          }}
        />
      )}
    </div>
  );
}
