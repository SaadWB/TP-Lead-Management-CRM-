'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { api } from '@/lib/apiClient';
import { PipelineStageOption, CallOutcomeOption } from '@crm/shared';

interface CrmOptionsContextType {
  pipelineStages: PipelineStageOption[];
  callOutcomes: CallOutcomeOption[];
  activePipelineStages: PipelineStageOption[];
  activeCallOutcomes: CallOutcomeOption[];
  stageNames: string[];
  outcomeNames: string[];
  loading: boolean;
  refreshOptions: () => Promise<void>;
  getSuggestedPipeline: (outcomeName?: string | null) => string;
  getOutcomeFlags: (outcomeName?: string | null) => CallOutcomeOption['flags'] | undefined;
}

const defaultStages: PipelineStageOption[] = [
  { id: '1', name: 'New Lead', color: 'blue', isDefault: true, isActive: true, order: 0, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Attempting Contact', color: 'amber', isDefault: true, isActive: true, order: 1, createdAt: '', updatedAt: '' },
  { id: '3', name: 'Connected', color: 'sky', isDefault: true, isActive: true, order: 2, createdAt: '', updatedAt: '' },
  { id: '4', name: 'Follow-up', color: 'purple', isDefault: true, isActive: true, order: 3, createdAt: '', updatedAt: '' },
  { id: '5', name: 'Demo', color: 'indigo', isDefault: true, isActive: true, order: 4, createdAt: '', updatedAt: '' },
  { id: '6', name: 'Closed', color: 'slate', isDefault: true, isActive: true, order: 5, createdAt: '', updatedAt: '' },
];

const defaultOutcomes: CallOutcomeOption[] = [
  { id: '1', name: 'No Answer', suggestedPipelineStage: 'Attempting Contact', flags: { autoReturnNewLeadsDays: 3 }, isDefault: true, isActive: true, order: 0, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Busy', suggestedPipelineStage: 'Follow-up', flags: {}, isDefault: true, isActive: true, order: 1, createdAt: '', updatedAt: '' },
  { id: '3', name: 'Call Cut', suggestedPipelineStage: 'Attempting Contact', flags: { autoReturnNewLeadsDays: 3 }, isDefault: true, isActive: true, order: 2, createdAt: '', updatedAt: '' },
  { id: '4', name: 'Call Back Later', suggestedPipelineStage: 'Follow-up', flags: { requiresDateTime: true, requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 3, createdAt: '', updatedAt: '' },
  { id: '5', name: 'Connected – Discussed', suggestedPipelineStage: 'Connected', flags: {}, isDefault: true, isActive: true, order: 4, createdAt: '', updatedAt: '' },
  { id: '6', name: 'Details Requested', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 5, createdAt: '', updatedAt: '' },
  { id: '7', name: 'Demo Interested', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 6, createdAt: '', updatedAt: '' },
  { id: '8', name: 'Demo Scheduled', suggestedPipelineStage: 'Demo', flags: { requiresDateTime: true, requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 7, createdAt: '', updatedAt: '' },
  { id: '9', name: 'Demo Completed', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 8, createdAt: '', updatedAt: '' },
  { id: '10', name: 'Decision Pending', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 9, createdAt: '', updatedAt: '' },
  { id: '11', name: 'Not Interested', suggestedPipelineStage: 'Closed', flags: { closesLead: true }, isDefault: true, isActive: true, order: 10, createdAt: '', updatedAt: '' },
  { id: '12', name: 'Wrong Number', suggestedPipelineStage: 'Closed', flags: { closesLead: true }, isDefault: true, isActive: true, order: 11, createdAt: '', updatedAt: '' },
];

export function useCrmOptionsState() {
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>(defaultStages);
  const [callOutcomes, setCallOutcomes] = useState<CallOutcomeOption[]>(defaultOutcomes);
  const [loading, setLoading] = useState(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        pipelineStages: PipelineStageOption[];
        callOutcomes: CallOutcomeOption[];
      }>('/options?includeInactive=true');

      if (res.success && res.data) {
        if (Array.isArray(res.data.pipelineStages) && res.data.pipelineStages.length > 0) {
          setPipelineStages(res.data.pipelineStages);
        }
        if (Array.isArray(res.data.callOutcomes) && res.data.callOutcomes.length > 0) {
          setCallOutcomes(res.data.callOutcomes);
        }
      }
    } catch {
      // Keep fallbacks
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const activePipelineStages = pipelineStages.filter((s) => s.isActive);
  const activeCallOutcomes = callOutcomes.filter((o) => o.isActive);

  const stageNames = activePipelineStages.map((s) => s.name);
  const outcomeNames = activeCallOutcomes.map((o) => o.name);

  const getSuggestedPipeline = useCallback(
    (outcomeName?: string | null): string => {
      if (!outcomeName) return 'New Lead';
      const clean = outcomeName.trim().toLowerCase();
      const match = callOutcomes.find((o) => o.name.toLowerCase() === clean);
      if (match?.suggestedPipelineStage) {
        return match.suggestedPipelineStage;
      }
      if (clean.includes('not interested') || clean.includes('wrong number')) return 'Closed';
      if (clean.includes('demo scheduled')) return 'Demo';
      if (clean.includes('connected')) return 'Connected';
      if (clean.includes('no answer') || clean.includes('call cut')) return 'Attempting Contact';
      return 'Follow-up';
    },
    [callOutcomes]
  );

  const getOutcomeFlags = useCallback(
    (outcomeName?: string | null) => {
      if (!outcomeName) return undefined;
      const clean = outcomeName.trim().toLowerCase();
      const match = callOutcomes.find((o) => o.name.toLowerCase() === clean);
      return match?.flags;
    },
    [callOutcomes]
  );

  return {
    pipelineStages,
    callOutcomes,
    activePipelineStages,
    activeCallOutcomes,
    stageNames,
    outcomeNames,
    loading,
    refreshOptions: fetchOptions,
    getSuggestedPipeline,
    getOutcomeFlags,
  };
}
