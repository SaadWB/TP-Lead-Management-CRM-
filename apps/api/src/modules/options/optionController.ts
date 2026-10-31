import { Request, Response, NextFunction } from 'express';
import { dbStore } from '../../repositories/dbStore';
import { auditLogRepository } from '../../repositories/auditLogRepository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { USER_ROLES, PipelineStageOption, CallOutcomeOption, LeadSourceOption } from '@crm/shared';

/**
 * List Pipeline and Outcome options
 * Public to authenticated users. Inactive options included only if requested by SUPER_ADMIN.
 */
export async function listOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = dbStore.store;
    const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
    const includeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    let stages = [...(store.pipelineStageOptions || [])];
    let outcomes = [...(store.callOutcomeOptions || [])];
    let sources = [...(store.leadSourceOptions || [])];

    if (!includeInactive) {
      stages = stages.filter((s) => s.isActive);
      outcomes = outcomes.filter((o) => o.isActive);
      sources = sources.filter((s) => s.isActive);
    }

    // Attach lead counts
    const leads = store.leads || [];
    const enrichedStages = stages
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        ...s,
        leadCount: leads.filter((l) => l.pipelineStage?.toLowerCase() === s.name.toLowerCase()).length,
      }));

    const enrichedOutcomes = outcomes
      .sort((a, b) => a.order - b.order)
      .map((o) => ({
        ...o,
        leadCount: leads.filter((l) => l.lastCallOutcome?.toLowerCase() === o.name.toLowerCase()).length,
      }));

    const enrichedSources = sources
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        ...s,
        leadCount: leads.filter((l) => l.leadSource?.toLowerCase() === s.name.toLowerCase()).length,
      }));

    sendSuccess(res, {
      pipelineStages: enrichedStages,
      callOutcomes: enrichedOutcomes,
      leadSources: enrichedSources,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Pipeline Stage (Admin only)
 */
export async function createPipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Pipeline stage name cannot be empty.');
    }
    const cleanName = name.trim();

    const store = dbStore.store;
    if (!store.pipelineStageOptions) store.pipelineStageOptions = [];

    const isDuplicate = store.pipelineStageOptions.some(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new BadRequestError(`Pipeline stage "${cleanName}" already exists.`);
    }

    const maxOrder = store.pipelineStageOptions.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
    const now = new Date().toISOString();
    const newStage: PipelineStageOption = {
      id: `stg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      color: color || 'blue',
      isDefault: false,
      isActive: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    store.pipelineStageOptions.push(newStage);
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'CREATE_PIPELINE_STAGE',
      entity: 'PIPELINE_STAGE',
      entityId: newStage.id,
      details: { name: cleanName, color: newStage.color },
    });

    sendSuccess(res, newStage, `Pipeline stage "${cleanName}" created successfully.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Update / Rename / Deactivate Pipeline Stage (Admin only)
 */
export async function updatePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, color, isActive } = req.body;

    const store = dbStore.store;
    const stage = store.pipelineStageOptions?.find((s) => s.id === id);
    if (!stage) {
      throw new NotFoundError('Pipeline stage not found.');
    }

    const oldName = stage.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Pipeline stage name cannot be empty.');
      }
      const cleanName = name.trim();
      if (cleanName.toLowerCase() !== stage.name.toLowerCase()) {
        const isDuplicate = store.pipelineStageOptions.some(
          (s) => s.id !== id && s.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (isDuplicate) {
          throw new BadRequestError(`Pipeline stage "${cleanName}" already exists.`);
        }

        stage.name = cleanName;
        nameChanged = true;

        // Automatically update all existing leads using this stage name
        for (const lead of store.leads) {
          if (lead.pipelineStage === oldName) {
            lead.pipelineStage = cleanName;
            lead.lastStatusUpdatedAt = new Date().toISOString();
            updatedLeadsCount++;
          }
        }
      }
    }

    if (color !== undefined) {
      stage.color = color;
    }

    if (isActive !== undefined) {
      stage.isActive = Boolean(isActive);
    }

    stage.updatedAt = new Date().toISOString();
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_PIPELINE_STAGE',
      entity: 'PIPELINE_STAGE',
      entityId: stage.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? stage.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: stage.color,
        isActive: stage.isActive,
      },
    });

    sendSuccess(
      res,
      stage,
      nameChanged && updatedLeadsCount > 0
        ? `Pipeline stage renamed to "${stage.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Pipeline stage "${stage.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Pipeline Stage (Admin only)
 * Never hard-delete if used by leads.
 */
export async function deletePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const store = dbStore.store;
    const index = store.pipelineStageOptions?.findIndex((s) => s.id === id);
    if (index === undefined || index === -1) {
      throw new NotFoundError('Pipeline stage not found.');
    }

    const stage = store.pipelineStageOptions[index];
    const usedCount = (store.leads || []).filter(
      (l) => l.pipelineStage?.toLowerCase() === stage.name.toLowerCase()
    ).length;

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete pipeline stage "${stage.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    store.pipelineStageOptions.splice(index, 1);
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'DELETE_PIPELINE_STAGE',
      entity: 'PIPELINE_STAGE',
      entityId: stage.id,
      details: { name: stage.name },
    });

    sendSuccess(res, { id }, `Pipeline stage "${stage.name}" deleted.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder Pipeline Stages (Admin only)
 */
export async function reorderPipelineStages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      throw new BadRequestError('orderedIds must be an array of string IDs.');
    }

    const store = dbStore.store;
    orderedIds.forEach((id: string, index: number) => {
      const stage = store.pipelineStageOptions?.find((s) => s.id === id);
      if (stage) {
        stage.order = index;
        stage.updatedAt = new Date().toISOString();
      }
    });

    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_PIPELINE_STAGES',
      entity: 'PIPELINE_STAGE',
      details: { orderedIds },
    });

    sendSuccess(res, store.pipelineStageOptions, 'Pipeline stages reordered.');
  } catch (error) {
    next(error);
  }
}

/**
 * Create Call Outcome (Admin only)
 */
export async function createCallOutcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, color, suggestedPipelineStage, flags } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Call outcome name cannot be empty.');
    }
    const cleanName = name.trim();

    if (cleanName.toLowerCase().includes('special inquiry')) {
      throw new BadRequestError('"Special Inquiry" has been permanently removed and cannot be added.');
    }

    const store = dbStore.store;
    if (!store.callOutcomeOptions) store.callOutcomeOptions = [];

    const isDuplicate = store.callOutcomeOptions.some(
      (o) => o.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new BadRequestError(`Call outcome "${cleanName}" already exists.`);
    }

    const maxOrder = store.callOutcomeOptions.reduce((max, o) => Math.max(max, o.order ?? 0), -1);
    const now = new Date().toISOString();
    const newOutcome: CallOutcomeOption = {
      id: `outc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      color: color || 'indigo',
      suggestedPipelineStage: suggestedPipelineStage || 'Follow-up',
      flags: {
        requiresDateTime: !!flags?.requiresDateTime,
        requiresNextFollowUp: !!flags?.requiresNextFollowUp,
        closesLead: !!flags?.closesLead,
        autoReturnNewLeadsDays:
          typeof flags?.autoReturnNewLeadsDays === 'number' && flags.autoReturnNewLeadsDays > 0
            ? flags.autoReturnNewLeadsDays
            : null,
      },
      isDefault: false,
      isActive: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    store.callOutcomeOptions.push(newOutcome);
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'CREATE_CALL_OUTCOME',
      entity: 'CALL_OUTCOME',
      entityId: newOutcome.id,
      details: { name: cleanName, color: newOutcome.color, flags: newOutcome.flags, suggestedPipelineStage },
    });

    sendSuccess(res, newOutcome, `Call outcome "${cleanName}" created successfully.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Update / Rename / Deactivate Call Outcome (Admin only)
 */
export async function updateCallOutcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, color, suggestedPipelineStage, flags, isActive } = req.body;

    const store = dbStore.store;
    const outcome = store.callOutcomeOptions?.find((o) => o.id === id);
    if (!outcome) {
      throw new NotFoundError('Call outcome not found.');
    }

    const oldName = outcome.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Call outcome name cannot be empty.');
      }
      const cleanName = name.trim();
      if (cleanName.toLowerCase() !== outcome.name.toLowerCase()) {
        if (cleanName.toLowerCase().includes('special inquiry')) {
          throw new BadRequestError('"Special Inquiry" has been permanently removed.');
        }

        const isDuplicate = store.callOutcomeOptions.some(
          (o) => o.id !== id && o.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (isDuplicate) {
          throw new BadRequestError(`Call outcome "${cleanName}" already exists.`);
        }

        outcome.name = cleanName;
        nameChanged = true;

        // Automatically update existing leads
        for (const lead of store.leads) {
          if (lead.lastCallOutcome === oldName) {
            lead.lastCallOutcome = cleanName;
            lead.lastStatusUpdatedAt = new Date().toISOString();
            updatedLeadsCount++;
          }
        }

        // Also update callLogs
        for (const cl of store.callLogs) {
          if (cl.outcome === oldName) {
            cl.outcome = cleanName;
          }
        }
      }
    }

    if (color !== undefined) {
      outcome.color = color;
    }

    if (suggestedPipelineStage !== undefined) {
      outcome.suggestedPipelineStage = suggestedPipelineStage;
    }

    if (flags !== undefined) {
      outcome.flags = {
        ...outcome.flags,
        requiresDateTime: flags.requiresDateTime !== undefined ? !!flags.requiresDateTime : outcome.flags.requiresDateTime,
        requiresNextFollowUp:
          flags.requiresNextFollowUp !== undefined ? !!flags.requiresNextFollowUp : outcome.flags.requiresNextFollowUp,
        closesLead: flags.closesLead !== undefined ? !!flags.closesLead : outcome.flags.closesLead,
        autoReturnNewLeadsDays:
          flags.autoReturnNewLeadsDays !== undefined
            ? typeof flags.autoReturnNewLeadsDays === 'number' && flags.autoReturnNewLeadsDays > 0
              ? flags.autoReturnNewLeadsDays
              : null
            : outcome.flags.autoReturnNewLeadsDays,
      };
    }

    if (isActive !== undefined) {
      outcome.isActive = Boolean(isActive);
    }

    outcome.updatedAt = new Date().toISOString();
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_CALL_OUTCOME',
      entity: 'CALL_OUTCOME',
      entityId: outcome.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? outcome.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: outcome.color,
        flags: outcome.flags,
        suggestedPipelineStage: outcome.suggestedPipelineStage,
        isActive: outcome.isActive,
      },
    });

    sendSuccess(
      res,
      outcome,
      nameChanged && updatedLeadsCount > 0
        ? `Call outcome renamed to "${outcome.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Call outcome "${outcome.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Call Outcome (Admin only)
 * Never hard-delete if used by leads.
 */
export async function deleteCallOutcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const store = dbStore.store;
    const index = store.callOutcomeOptions?.findIndex((o) => o.id === id);
    if (index === undefined || index === -1) {
      throw new NotFoundError('Call outcome not found.');
    }

    const outcome = store.callOutcomeOptions[index];
    const usedCount = (store.leads || []).filter(
      (l) => l.lastCallOutcome?.toLowerCase() === outcome.name.toLowerCase()
    ).length;

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete call outcome "${outcome.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    store.callOutcomeOptions.splice(index, 1);
    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'DELETE_CALL_OUTCOME',
      entity: 'CALL_OUTCOME',
      entityId: outcome.id,
      details: { name: outcome.name },
    });

    sendSuccess(res, { id }, `Call outcome "${outcome.name}" deleted.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder Call Outcomes (Admin only)
 */
export async function reorderCallOutcomes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      throw new BadRequestError('orderedIds must be an array of string IDs.');
    }

    const store = dbStore.store;
    orderedIds.forEach((id: string, index: number) => {
      const outcome = store.callOutcomeOptions?.find((o) => o.id === id);
      if (outcome) {
        outcome.order = index;
        outcome.updatedAt = new Date().toISOString();
      }
    });

    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_CALL_OUTCOMES',
      entity: 'CALL_OUTCOME',
      details: { orderedIds },
    });

    sendSuccess(res, store.callOutcomeOptions, 'Call outcomes reordered.');
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Lead Source (Admin only)
 */
export async function createLeadSource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Lead source name cannot be empty.');
    }
    const cleanName = name.trim();

    const store = dbStore.store;
    if (!store.leadSourceOptions) store.leadSourceOptions = [];

    const isDuplicate = store.leadSourceOptions.some(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      throw new BadRequestError(`Lead source "${cleanName}" already exists.`);
    }

    const maxOrder = store.leadSourceOptions.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
    const now = new Date().toISOString();
    const newSource: LeadSourceOption = {
      id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      color: color || 'blue',
      isDefault: false,
      isActive: true,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    store.leadSourceOptions.push(newSource);
    dbStore.persist();
    dbStore.syncLeadSourceToDatabase(newSource).catch(console.error);

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'CREATE_LEAD_SOURCE',
      entity: 'LEAD_SOURCE',
      entityId: newSource.id,
      details: { name: cleanName, color: newSource.color },
    });

    sendSuccess(res, newSource, `Lead source "${cleanName}" created successfully.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Update / Rename / Toggle Lead Source (Admin only)
 */
export async function updateLeadSource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, color, isActive } = req.body;

    const store = dbStore.store;
    const source = store.leadSourceOptions?.find((s) => s.id === id);
    if (!source) {
      throw new NotFoundError('Lead source not found.');
    }

    const oldName = source.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Lead source name cannot be empty.');
      }
      const cleanName = name.trim();
      const isDuplicate = store.leadSourceOptions?.some(
        (s) => s.id !== id && s.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (isDuplicate) {
        throw new BadRequestError(`Lead source "${cleanName}" already exists.`);
      }

      if (cleanName.toLowerCase() !== source.name.toLowerCase()) {
        nameChanged = true;
        source.name = cleanName;

        // Cascade rename to existing leads in memory and sync to DB
        if (Array.isArray(store.leads)) {
          for (const lead of store.leads) {
            if (lead.leadSource?.toLowerCase() === oldName.toLowerCase()) {
              lead.leadSource = cleanName;
              lead.updatedAt = new Date().toISOString();
              updatedLeadsCount++;
              dbStore.syncLeadToDatabase(lead).catch(console.error);
            }
          }
        }
      } else {
        source.name = cleanName;
      }
    }

    if (color !== undefined) {
      source.color = color;
    }

    if (isActive !== undefined) {
      source.isActive = Boolean(isActive);
    }

    source.updatedAt = new Date().toISOString();
    dbStore.persist();
    dbStore.syncLeadSourceToDatabase(source).catch(console.error);

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_LEAD_SOURCE',
      entity: 'LEAD_SOURCE',
      entityId: source.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? source.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: source.color,
        isActive: source.isActive,
      },
    });

    sendSuccess(
      res,
      source,
      nameChanged && updatedLeadsCount > 0
        ? `Lead source renamed to "${source.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Lead source "${source.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Lead Source (Admin only)
 * NEVER hard-delete if used by leads.
 */
export async function deleteLeadSource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const store = dbStore.store;
    const index = store.leadSourceOptions?.findIndex((s) => s.id === id);
    if (index === undefined || index === -1) {
      throw new NotFoundError('Lead source not found.');
    }

    const source = store.leadSourceOptions[index];
    const usedCount = (store.leads || []).filter(
      (l) => l.leadSource?.toLowerCase() === source.name.toLowerCase()
    ).length;

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete source "${source.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    store.leadSourceOptions.splice(index, 1);
    dbStore.persist();

    // Remove from database
    import('../../config/prisma').then(({ prisma }) => {
      prisma.leadSourceOption.delete({ where: { id } }).catch(() => {});
    });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'DELETE_LEAD_SOURCE',
      entity: 'LEAD_SOURCE',
      entityId: source.id,
      details: { name: source.name },
    });

    sendSuccess(res, { id }, `Lead source "${source.name}" deleted.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder Lead Sources (Admin only)
 */
export async function reorderLeadSources(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      throw new BadRequestError('orderedIds must be an array of string IDs.');
    }

    const store = dbStore.store;
    orderedIds.forEach((id: string, index: number) => {
      const source = store.leadSourceOptions?.find((s) => s.id === id);
      if (source) {
        source.order = index;
        source.updatedAt = new Date().toISOString();
        dbStore.syncLeadSourceToDatabase(source).catch(console.error);
      }
    });

    dbStore.persist();

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_LEAD_SOURCES',
      entity: 'LEAD_SOURCE',
      details: { orderedIds },
    });

    sendSuccess(res, store.leadSourceOptions, 'Lead sources reordered.');
  } catch (error) {
    next(error);
  }
}

/**
 * List Options Audit Logs (Admin only)
 */
export async function getOptionsAuditLogs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logs = await auditLogRepository.list({ limit: 100 });
    const optionLogs = logs.filter(
      (l) => l.entity === 'PIPELINE_STAGE' || l.entity === 'CALL_OUTCOME' || l.entity === 'LEAD_SOURCE'
    );
    sendSuccess(res, optionLogs);
  } catch (error) {
    next(error);
  }
}
