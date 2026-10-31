'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/apiClient';
import { PipelineStageOption, CallOutcomeOption, LeadSourceOption, AuditLogItem } from '@crm/shared';
import { TABLE_TOKENS } from '@/lib/tableTokens';
import { formatDate } from '@/lib/utils';
import {
  SlidersHorizontal,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  EyeOff,
  Eye,
  History,
  Layers,
  PhoneCall,
  Compass,
} from 'lucide-react';

export default function AdminOptionsSettingsPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'outcomes' | 'sources' | 'audit'>('pipeline');

  // Options State
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);
  const [callOutcomes, setCallOutcomes] = useState<CallOutcomeOption[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSourceOption[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Modals
  const [pipelineModal, setPipelineModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    target?: PipelineStageOption;
  }>({ isOpen: false, mode: 'create' });

  const [outcomeModal, setOutcomeModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    target?: CallOutcomeOption;
  }>({ isOpen: false, mode: 'create' });

  const [sourceModal, setSourceModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    target?: LeadSourceOption;
  }>({ isOpen: false, mode: 'create' });

  const [confirmDeactivate, setConfirmDeactivate] = useState<{
    isOpen: boolean;
    type: 'pipeline' | 'outcome' | 'source';
    target: PipelineStageOption | CallOutcomeOption | LeadSourceOption | null;
  }>({ isOpen: false, type: 'pipeline', target: null });

  // Form states
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formSuggestedPipeline, setFormSuggestedPipeline] = useState('Follow-up');
  const [formFlags, setFormFlags] = useState({
    requiresDateTime: false,
    requiresNextFollowUp: false,
    closesLead: false,
    autoReturnNewLeadsDays: '' as string | number,
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorNotice(null);
    try {
      const [optRes, auditRes] = await Promise.all([
        api.get<{
          pipelineStages: PipelineStageOption[];
          callOutcomes: CallOutcomeOption[];
          leadSources?: LeadSourceOption[];
        }>('/options?includeInactive=true'),
        api.get<AuditLogItem[]>('/options/audit-logs'),
      ]);

      if (optRes.success && optRes.data) {
        setPipelineStages(optRes.data.pipelineStages || []);
        setCallOutcomes(optRes.data.callOutcomes || []);
        setLeadSources(optRes.data.leadSources || []);
      }
      if (auditRes.success && auditRes.data) {
        setAuditLogs(auditRes.data);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load options from server');
    } finally {
      setLoading(false);
    }
  }

  function triggerSuccess(msg: string) {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 4000);
  }

  function triggerError(msg: string) {
    setErrorNotice(msg);
    setTimeout(() => setErrorNotice(null), 5000);
  }

  // --- Pipeline Actions ---
  function openCreatePipelineModal() {
    setFormName('');
    setFormColor('blue');
    setPipelineModal({ isOpen: true, mode: 'create' });
  }

  function openEditPipelineModal(stage: PipelineStageOption) {
    setFormName(stage.name);
    setFormColor(stage.color || 'blue');
    setPipelineModal({ isOpen: true, mode: 'edit', target: stage });
  }

  async function handleSavePipeline(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      triggerError('Pipeline stage name cannot be empty.');
      return;
    }
    setFormLoading(true);
    try {
      if (pipelineModal.mode === 'create') {
        const res = await api.post<PipelineStageOption>('/options/pipeline', {
          name: formName.trim(),
          color: formColor,
        });
        if (res.success) {
          triggerSuccess(`Pipeline stage "${formName.trim()}" created successfully.`);
          setPipelineModal({ isOpen: false, mode: 'create' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to create stage');
        }
      } else if (pipelineModal.target) {
        const res = await api.patch<PipelineStageOption>(`/options/pipeline/${pipelineModal.target.id}`, {
          name: formName.trim(),
          color: formColor,
        });
        if (res.success) {
          triggerSuccess(res.message || 'Pipeline stage updated.');
          setPipelineModal({ isOpen: false, mode: 'edit' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to update stage');
        }
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to save pipeline stage');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleTogglePipelineActive(stage: PipelineStageOption) {
    if (stage.isActive && stage.isDefault) {
      setConfirmDeactivate({ isOpen: true, type: 'pipeline', target: stage });
      return;
    }

    try {
      const res = await api.patch<PipelineStageOption>(`/options/pipeline/${stage.id}`, {
        isActive: !stage.isActive,
      });
      if (res.success) {
        triggerSuccess(`Pipeline stage "${stage.name}" is now ${!stage.isActive ? 'Active' : 'Inactive'}.`);
        loadData();
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to update status');
    }
  }

  async function handleConfirmDeactivate() {
    if (!confirmDeactivate.target) return;
    try {
      let endpoint = '';
      if (confirmDeactivate.type === 'pipeline') {
        endpoint = `/options/pipeline/${confirmDeactivate.target.id}`;
      } else if (confirmDeactivate.type === 'outcome') {
        endpoint = `/options/outcomes/${confirmDeactivate.target.id}`;
      } else {
        endpoint = `/options/sources/${confirmDeactivate.target.id}`;
      }

      const res = await api.patch(endpoint, {
        isActive: false,
      });
      if (res.success) {
        triggerSuccess(`"${confirmDeactivate.target.name}" deactivated.`);
        setConfirmDeactivate({ isOpen: false, type: 'pipeline', target: null });
        loadData();
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to deactivate');
    }
  }

  async function handleDeletePipeline(stage: PipelineStageOption) {
    if (stage.leadCount && stage.leadCount > 0) {
      triggerError(`Cannot delete stage "${stage.name}" because ${stage.leadCount} lead(s) currently use it. Deactivate it instead.`);
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete "${stage.name}"?`)) return;

    try {
      const res = await api.delete(`/options/pipeline/${stage.id}`);
      if (res.success) {
        triggerSuccess(`Pipeline stage "${stage.name}" deleted.`);
        loadData();
      } else {
        triggerError(res.message || 'Delete failed');
      }
    } catch (err: any) {
      triggerError(err.message || 'Delete failed');
    }
  }

  async function handleMovePipeline(index: number, direction: 'up' | 'down') {
    const newItems = [...pipelineStages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setPipelineStages(newItems);

    try {
      await api.post('/options/pipeline/reorder', {
        orderedIds: newItems.map((s) => s.id),
      });
      loadData();
    } catch {
      loadData();
    }
  }

  // --- Outcome Actions ---
  function openCreateOutcomeModal() {
    setFormName('');
    setFormColor('indigo');
    setFormSuggestedPipeline('Follow-up');
    setFormFlags({
      requiresDateTime: false,
      requiresNextFollowUp: false,
      closesLead: false,
      autoReturnNewLeadsDays: '',
    });
    setOutcomeModal({ isOpen: true, mode: 'create' });
  }

  function openEditOutcomeModal(outcome: CallOutcomeOption) {
    setFormName(outcome.name);
    setFormColor(outcome.color || 'indigo');
    setFormSuggestedPipeline(outcome.suggestedPipelineStage || 'Follow-up');
    setFormFlags({
      requiresDateTime: !!outcome.flags?.requiresDateTime,
      requiresNextFollowUp: !!outcome.flags?.requiresNextFollowUp,
      closesLead: !!outcome.flags?.closesLead,
      autoReturnNewLeadsDays: outcome.flags?.autoReturnNewLeadsDays ?? '',
    });
    setOutcomeModal({ isOpen: true, mode: 'edit', target: outcome });
  }

  async function handleSaveOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      triggerError('Outcome name cannot be empty.');
      return;
    }
    setFormLoading(true);
    const parsedDays =
      formFlags.autoReturnNewLeadsDays !== '' && !isNaN(Number(formFlags.autoReturnNewLeadsDays))
        ? Number(formFlags.autoReturnNewLeadsDays)
        : null;

    try {
      if (outcomeModal.mode === 'create') {
        const res = await api.post<CallOutcomeOption>('/options/outcomes', {
          name: formName.trim(),
          color: formColor,
          suggestedPipelineStage: formSuggestedPipeline,
          flags: {
            ...formFlags,
            autoReturnNewLeadsDays: parsedDays,
          },
        });
        if (res.success) {
          triggerSuccess(`Call outcome "${formName.trim()}" created successfully.`);
          setOutcomeModal({ isOpen: false, mode: 'create' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to create outcome');
        }
      } else if (outcomeModal.target) {
        const res = await api.patch<CallOutcomeOption>(`/options/outcomes/${outcomeModal.target.id}`, {
          name: formName.trim(),
          color: formColor,
          suggestedPipelineStage: formSuggestedPipeline,
          flags: {
            ...formFlags,
            autoReturnNewLeadsDays: parsedDays,
          },
        });
        if (res.success) {
          triggerSuccess(res.message || 'Call outcome updated.');
          setOutcomeModal({ isOpen: false, mode: 'edit' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to update outcome');
        }
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to save outcome');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleOutcomeActive(outcome: CallOutcomeOption) {
    if (outcome.isActive && outcome.isDefault) {
      setConfirmDeactivate({ isOpen: true, type: 'outcome', target: outcome });
      return;
    }

    try {
      const res = await api.patch<CallOutcomeOption>(`/options/outcomes/${outcome.id}`, {
        isActive: !outcome.isActive,
      });
      if (res.success) {
        triggerSuccess(`Call outcome "${outcome.name}" is now ${!outcome.isActive ? 'Active' : 'Inactive'}.`);
        loadData();
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to update status');
    }
  }

  async function handleDeleteOutcome(outcome: CallOutcomeOption) {
    if (outcome.leadCount && outcome.leadCount > 0) {
      triggerError(
        `Cannot delete outcome "${outcome.name}" because ${outcome.leadCount} lead(s) currently use it. Deactivate it instead.`
      );
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete "${outcome.name}"?`)) return;

    try {
      const res = await api.delete(`/options/outcomes/${outcome.id}`);
      if (res.success) {
        triggerSuccess(`Call outcome "${outcome.name}" deleted.`);
        loadData();
      } else {
        triggerError(res.message || 'Delete failed');
      }
    } catch (err: any) {
      triggerError(err.message || 'Delete failed');
    }
  }

  async function handleMoveOutcome(index: number, direction: 'up' | 'down') {
    const newItems = [...callOutcomes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setCallOutcomes(newItems);

    try {
      await api.post('/options/outcomes/reorder', {
        orderedIds: newItems.map((o) => o.id),
      });
      loadData();
    } catch {
      loadData();
    }
  }

  // --- Lead Source Actions ---
  function openCreateSourceModal() {
    setFormName('');
    setFormColor('blue');
    setSourceModal({ isOpen: true, mode: 'create' });
  }

  function openEditSourceModal(src: LeadSourceOption) {
    setFormName(src.name);
    setFormColor(src.color || 'blue');
    setSourceModal({ isOpen: true, mode: 'edit', target: src });
  }

  async function handleSaveSource(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      triggerError('Lead source name cannot be empty.');
      return;
    }
    setFormLoading(true);
    try {
      if (sourceModal.mode === 'create') {
        const res = await api.post<LeadSourceOption>('/options/sources', {
          name: formName.trim(),
          color: formColor,
        });
        if (res.success) {
          triggerSuccess(`Lead source "${formName.trim()}" created successfully.`);
          setSourceModal({ isOpen: false, mode: 'create' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to create lead source');
        }
      } else if (sourceModal.target) {
        const res = await api.patch<LeadSourceOption>(`/options/sources/${sourceModal.target.id}`, {
          name: formName.trim(),
          color: formColor,
        });
        if (res.success) {
          triggerSuccess(res.message || 'Lead source updated.');
          setSourceModal({ isOpen: false, mode: 'edit' });
          loadData();
        } else {
          triggerError(res.message || 'Failed to update lead source');
        }
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to save lead source');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleSourceActive(src: LeadSourceOption) {
    if (src.isActive && src.isDefault) {
      setConfirmDeactivate({ isOpen: true, type: 'source', target: src });
      return;
    }

    try {
      const res = await api.patch<LeadSourceOption>(`/options/sources/${src.id}`, {
        isActive: !src.isActive,
      });
      if (res.success) {
        triggerSuccess(`Lead source "${src.name}" is now ${!src.isActive ? 'Active' : 'Inactive'}.`);
        loadData();
      }
    } catch (err: any) {
      triggerError(err.message || 'Failed to update status');
    }
  }

  async function handleDeleteSource(src: LeadSourceOption) {
    if (src.leadCount && src.leadCount > 0) {
      triggerError(
        `Cannot delete source "${src.name}" because ${src.leadCount} lead(s) currently use it. Deactivate it instead.`
      );
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete "${src.name}"?`)) return;

    try {
      const res = await api.delete(`/options/sources/${src.id}`);
      if (res.success) {
        triggerSuccess(`Lead source "${src.name}" deleted.`);
        loadData();
      } else {
        triggerError(res.message || 'Delete failed');
      }
    } catch (err: any) {
      triggerError(err.message || 'Delete failed');
    }
  }

  async function handleMoveSource(index: number, direction: 'up' | 'down') {
    const newItems = [...leadSources];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setLeadSources(newItems);

    try {
      await api.post('/options/sources/reorder', {
        orderedIds: newItems.map((s) => s.id),
      });
      loadData();
    } catch {
      loadData();
    }
  }

  return (
    <AppLayout
      title="Options & Pipeline Management"
      subtitle="Manage pipeline stages, call outcomes, and lead sources."
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-sky-600 shrink-0" />
              Pipeline, Outcome & Source Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Admin-controlled definitions for Pipeline Stages, Call Outcomes, and Lead Sources. Telecallers and Closers cannot alter these lists.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'pipeline' && (
              <Button size="sm" onClick={openCreatePipelineModal} icon={<Plus className="h-4 w-4" />}>
                Add Pipeline Stage
              </Button>
            )}
            {activeTab === 'outcomes' && (
              <Button size="sm" onClick={openCreateOutcomeModal} icon={<Plus className="h-4 w-4" />}>
                Add Call Outcome
              </Button>
            )}
            {activeTab === 'sources' && (
              <Button size="sm" onClick={openCreateSourceModal} icon={<Plus className="h-4 w-4" />}>
                Add Lead Source
              </Button>
            )}
          </div>
        </div>

        {/* Notifier Banners */}
        {errorNotice && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorNotice}</span>
          </div>
        )}
        {successNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6 text-sm font-bold select-none overflow-x-auto">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'pipeline'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            Pipeline Stages ({pipelineStages.length})
          </button>

          <button
            onClick={() => setActiveTab('outcomes')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'outcomes'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            Last Call Outcomes ({callOutcomes.length})
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sources'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="h-4 w-4" />
            Lead Sources ({leadSources.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-4 w-4" />
            Audit History ({auditLogs.length})
          </button>
        </div>

        {/* Tab 1: Pipeline Stages */}
        {activeTab === 'pipeline' && (
          <Card className={TABLE_TOKENS.cardContainer}>
            <CardContent className="p-0">
              <div className={TABLE_TOKENS.scrollWrapper}>
                <table className={TABLE_TOKENS.table}>
                  <thead className={TABLE_TOKENS.thead}>
                    <tr>
                      <th className="w-16 p-3 text-center">Order</th>
                      <th className="p-3">Stage Name</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Leads in Stage</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_TOKENS.tbody}>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          Loading pipeline stages...
                        </td>
                      </tr>
                    ) : pipelineStages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          No pipeline stages found.
                        </td>
                      </tr>
                    ) : (
                      pipelineStages.map((stage, idx) => (
                        <tr key={stage.id} className={TABLE_TOKENS.tr}>
                          <td className="w-16 p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleMovePipeline(idx, 'up')}
                                disabled={idx === 0}
                                title="Move Up"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleMovePipeline(idx, 'down')}
                                disabled={idx === pipelineStages.length - 1}
                                title="Move Down"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full bg-${stage.color || 'blue'}-500 shrink-0`} />
                              <span>{stage.name}</span>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            {stage.isDefault ? (
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                System Default
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                Custom
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <Badge variant={stage.isActive ? 'emerald' : 'slate'} size="sm" dot>
                              {stage.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          <td className="p-3 text-center font-bold text-slate-700">
                            {stage.leadCount ?? 0}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditPipelineModal(stage)}
                                title="Edit Name/Color"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleTogglePipelineActive(stage)}
                                title={stage.isActive ? 'Deactivate Stage' : 'Activate Stage'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  stage.isActive
                                    ? 'hover:bg-amber-50 text-amber-600'
                                    : 'hover:bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {stage.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>

                              <button
                                onClick={() => handleDeletePipeline(stage)}
                                title={stage.leadCount && stage.leadCount > 0 ? 'Cannot delete: leads use this stage' : 'Delete Stage'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  stage.leadCount && stage.leadCount > 0
                                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                                    : 'hover:bg-rose-50 text-rose-600'
                                }`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Call Outcomes */}
        {activeTab === 'outcomes' && (
          <Card className={TABLE_TOKENS.cardContainer}>
            <CardContent className="p-0">
              <div className={TABLE_TOKENS.scrollWrapper}>
                <table className={TABLE_TOKENS.table}>
                  <thead className={TABLE_TOKENS.thead}>
                    <tr>
                      <th className="w-16 p-3 text-center">Order</th>
                      <th className="p-3">Outcome Name</th>
                      <th className="p-3">Suggested Pipeline</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Leads with Outcome</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_TOKENS.tbody}>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          Loading call outcomes...
                        </td>
                      </tr>
                    ) : callOutcomes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          No call outcomes found.
                        </td>
                      </tr>
                    ) : (
                      callOutcomes.map((outcome, idx) => (
                        <tr key={outcome.id} className={TABLE_TOKENS.tr}>
                          <td className="w-16 p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleMoveOutcome(idx, 'up')}
                                disabled={idx === 0}
                                title="Move Up"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveOutcome(idx, 'down')}
                                disabled={idx === callOutcomes.length - 1}
                                title="Move Down"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full bg-${outcome.color || 'indigo'}-500 shrink-0`} />
                              <span>{outcome.name}</span>
                            </div>
                          </td>

                          <td className="p-3 text-xs font-semibold text-slate-600">
                            {outcome.suggestedPipelineStage || 'Follow-up'}
                          </td>

                          <td className="p-3 text-center">
                            <Badge variant={outcome.isActive ? 'emerald' : 'slate'} size="sm" dot>
                              {outcome.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          <td className="p-3 text-center font-bold text-slate-700">
                            {outcome.leadCount ?? 0}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditOutcomeModal(outcome)}
                                title="Edit Outcome"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleToggleOutcomeActive(outcome)}
                                title={outcome.isActive ? 'Deactivate Outcome' : 'Activate Outcome'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  outcome.isActive
                                    ? 'hover:bg-amber-50 text-amber-600'
                                    : 'hover:bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {outcome.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>

                              <button
                                onClick={() => handleDeleteOutcome(outcome)}
                                title={outcome.leadCount && outcome.leadCount > 0 ? 'Cannot delete: leads use this outcome' : 'Delete Outcome'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  outcome.leadCount && outcome.leadCount > 0
                                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                                    : 'hover:bg-rose-50 text-rose-600'
                                }`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Lead Sources */}
        {activeTab === 'sources' && (
          <Card className={TABLE_TOKENS.cardContainer}>
            <CardContent className="p-0">
              <div className={TABLE_TOKENS.scrollWrapper}>
                <table className={TABLE_TOKENS.table}>
                  <thead className={TABLE_TOKENS.thead}>
                    <tr>
                      <th className="w-16 p-3 text-center">Order</th>
                      <th className="p-3">Source Name</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Leads with Source</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_TOKENS.tbody}>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          Loading lead sources...
                        </td>
                      </tr>
                    ) : leadSources.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={TABLE_TOKENS.emptyState}>
                          No lead sources found.
                        </td>
                      </tr>
                    ) : (
                      leadSources.map((src, idx) => (
                        <tr key={src.id} className={TABLE_TOKENS.tr}>
                          <td className="w-16 p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleMoveSource(idx, 'up')}
                                disabled={idx === 0}
                                title="Move Up"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveSource(idx, 'down')}
                                disabled={idx === leadSources.length - 1}
                                title="Move Down"
                                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full bg-${src.color || 'blue'}-500 shrink-0`} />
                              <span>{src.name}</span>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            {src.isDefault ? (
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                System Default
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                Custom
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <Badge variant={src.isActive ? 'emerald' : 'slate'} size="sm" dot>
                              {src.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          <td className="p-3 text-center font-bold text-slate-700">
                            {src.leadCount ?? 0}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditSourceModal(src)}
                                title="Edit Name/Color"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleToggleSourceActive(src)}
                                title={src.isActive ? 'Deactivate Source' : 'Activate Source'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  src.isActive
                                    ? 'hover:bg-amber-50 text-amber-600'
                                    : 'hover:bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {src.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>

                              <button
                                onClick={() => handleDeleteSource(src)}
                                title={src.leadCount && src.leadCount > 0 ? 'Cannot delete: leads use this source' : 'Delete Source'}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  src.leadCount && src.leadCount > 0
                                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                                    : 'hover:bg-rose-50 text-rose-600'
                                }`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'audit' && (
          <Card className={TABLE_TOKENS.cardContainer}>
            <CardContent className="p-0">
              <div className={TABLE_TOKENS.scrollWrapper}>
                <table className={TABLE_TOKENS.table}>
                  <thead className={TABLE_TOKENS.thead}>
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_TOKENS.tbody}>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={TABLE_TOKENS.emptyState}>
                          No audit log entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className={TABLE_TOKENS.tr}>
                          <td className="p-3 text-slate-500 whitespace-nowrap text-xs">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="p-3 font-bold text-slate-800 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-xs font-semibold text-slate-600">
                            {log.entity} {log.entityId ? `(#${log.entityId.substring(0, 8)})` : ''}
                          </td>
                          <td className="p-3 text-xs font-medium text-slate-800">
                            {log.user?.name || log.userId || 'System'}
                          </td>
                          <td className="p-3 text-xs text-slate-500 max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Modal */}
        {pipelineModal.isOpen && (
          <Modal
            isOpen={pipelineModal.isOpen}
            onClose={() => setPipelineModal({ isOpen: false, mode: 'create' })}
            title={pipelineModal.mode === 'create' ? 'Create Pipeline Stage' : 'Edit Pipeline Stage'}
            maxWidth="sm"
          >
            <form onSubmit={handleSavePipeline} className="space-y-4">
              <Input
                label="Stage Name"
                placeholder="e.g. Negotiation"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Badge Color</label>
                <select
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="blue">Blue</option>
                  <option value="amber">Amber</option>
                  <option value="sky">Sky</option>
                  <option value="purple">Purple</option>
                  <option value="indigo">Indigo</option>
                  <option value="teal">Teal</option>
                  <option value="emerald">Emerald</option>
                  <option value="rose">Rose</option>
                  <option value="slate">Slate</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPipelineModal({ isOpen: false, mode: 'create' })}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={formLoading}>
                  {pipelineModal.mode === 'create' ? 'Create Stage' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Outcome Modal */}
        {outcomeModal.isOpen && (
          <Modal
            isOpen={outcomeModal.isOpen}
            onClose={() => setOutcomeModal({ isOpen: false, mode: 'create' })}
            title={outcomeModal.mode === 'create' ? 'Create Call Outcome' : 'Edit Call Outcome'}
            maxWidth="md"
          >
            <form onSubmit={handleSaveOutcome} className="space-y-4">
              <Input
                label="Call Outcome Name"
                placeholder="e.g. Pricing Query Requested"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Suggested Pipeline Stage</label>
                  <select
                    value={formSuggestedPipeline}
                    onChange={(e) => setFormSuggestedPipeline(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {pipelineStages
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Badge Color</label>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                    <option value="sky">Sky</option>
                    <option value="amber">Amber</option>
                    <option value="emerald">Emerald</option>
                    <option value="rose">Rose</option>
                    <option value="slate">Slate</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Behavior Rules & Constraints</span>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFlags.requiresDateTime}
                    onChange={(e) =>
                      setFormFlags((prev) => ({ ...prev, requiresDateTime: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Requires Exact Date and Time</span>
                    <span className="text-slate-500 text-[11px]">
                      Mandates a date and time picker when selected (e.g. Call Back Later, Demo Scheduled). Past dates blocked.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFlags.requiresNextFollowUp}
                    onChange={(e) =>
                      setFormFlags((prev) => ({ ...prev, requiresNextFollowUp: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Requires Next Follow-up Date</span>
                    <span className="text-slate-500 text-[11px]">
                      Blocks saving unless a next follow-up date is provided or already scheduled on the lead.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFlags.closesLead}
                    onChange={(e) => setFormFlags((prev) => ({ ...prev, closesLead: e.target.checked }))}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Closes the Lead</span>
                    <span className="text-slate-500 text-[11px]">
                      Sets pipeline to Closed and clears pending follow-up commitments (e.g. Not Interested, Wrong Number).
                    </span>
                  </div>
                </label>

                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-800">
                    Auto-return to New Leads after N days (Optional)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Leave blank if not applicable. For retry outcomes (No Answer, Call Cut), defaults to 3 days.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    placeholder="e.g. 3"
                    value={formFlags.autoReturnNewLeadsDays}
                    onChange={(e) =>
                      setFormFlags((prev) => ({
                        ...prev,
                        autoReturnNewLeadsDays: e.target.value,
                      }))
                    }
                    className="w-32 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOutcomeModal({ isOpen: false, mode: 'create' })}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={formLoading}>
                  {outcomeModal.mode === 'create' ? 'Create Outcome' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Lead Source Modal */}
        {sourceModal.isOpen && (
          <Modal
            isOpen={sourceModal.isOpen}
            onClose={() => setSourceModal({ isOpen: false, mode: 'create' })}
            title={sourceModal.mode === 'create' ? 'Create Lead Source' : 'Edit Lead Source'}
            maxWidth="sm"
          >
            <form onSubmit={handleSaveSource} className="space-y-4">
              <Input
                label="Source Name"
                placeholder="e.g. Industry Trade Expo"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Badge Color</label>
                <select
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="blue">Blue</option>
                  <option value="emerald">Emerald</option>
                  <option value="amber">Amber</option>
                  <option value="teal">Teal</option>
                  <option value="indigo">Indigo</option>
                  <option value="purple">Purple</option>
                  <option value="sky">Sky</option>
                  <option value="cyan">Cyan</option>
                  <option value="rose">Rose</option>
                  <option value="slate">Slate</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSourceModal({ isOpen: false, mode: 'create' })}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={formLoading}>
                  {sourceModal.mode === 'create' ? 'Create Source' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Warning Modal for Deactivating Default Option */}
        {confirmDeactivate.isOpen && confirmDeactivate.target && (
          <Modal
            isOpen={confirmDeactivate.isOpen}
            onClose={() => setConfirmDeactivate({ isOpen: false, type: 'pipeline', target: null })}
            title="Warning: Deactivating System Default Option"
            maxWidth="sm"
          >
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">Core CRM System Default</strong>
                  &ldquo;{confirmDeactivate.target.name}&rdquo; is a standard system default. Deactivating it will hide it from telecaller and closer dropdowns for new selections. Old leads using this option will retain it.
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Are you sure you want to deactivate &ldquo;{confirmDeactivate.target.name}&rdquo;? You can reactivate it anytime.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeactivate({ isOpen: false, type: 'pipeline', target: null })}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmDeactivate}
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  Deactivate Option
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
