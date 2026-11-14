import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { auditLogRepository } from '../../repositories/auditLogRepository';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { USER_ROLES } from '@crm/shared';

function mapOutcomeWithFlags(o: any) {
  return {
    id: o.id,
    name: o.name,
    color: o.color,
    suggestedPipelineStage: o.suggestedPipelineStage,
    flags: {
      requiresDateTime: Boolean(o.requiresDateTime),
      requiresNextFollowUp: Boolean(o.requiresNextFollowUp),
      closesLead: Boolean(o.closesLead),
      autoReturnNewLeadsDays: o.autoReturnNewLeadsDays ?? null,
    },
    isDefault: o.isDefault,
    isActive: o.isActive,
    order: o.order,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * List Pipeline and Outcome options
 * Public to authenticated users. Inactive options included only if requested by SUPER_ADMIN.
 */
export async function listOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
    const includeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    const where: any = includeInactive ? {} : { isActive: true };

    const [stages, outcomes, sources] = await Promise.all([
      prisma.pipelineStageOption.findMany({ where, orderBy: { order: 'asc' } }),
      prisma.callOutcomeOption.findMany({ where, orderBy: { order: 'asc' } }),
      prisma.leadSourceOption.findMany({ where, orderBy: { order: 'asc' } }),
    ]);

    // Attach lead counts directly from database
    const [stageCounts, outcomeCounts, sourceCounts] = await Promise.all([
      prisma.lead.groupBy({
        by: ['pipelineStage'],
        _count: { id: true },
        where: { isDeleted: false },
      }),
      prisma.lead.groupBy({
        by: ['lastCallOutcome'],
        _count: { id: true },
        where: { isDeleted: false, lastCallOutcome: { not: null } },
      }),
      prisma.lead.groupBy({
        by: ['leadSource'],
        _count: { id: true },
        where: { isDeleted: false, leadSource: { not: null } },
      }),
    ]);

    const stageMap = new Map<string, number>();
    stageCounts.forEach((sc) => {
      if (sc.pipelineStage) stageMap.set(sc.pipelineStage.toLowerCase(), sc._count.id);
    });

    const outcomeMap = new Map<string, number>();
    outcomeCounts.forEach((oc) => {
      if (oc.lastCallOutcome) outcomeMap.set(oc.lastCallOutcome.toLowerCase(), oc._count.id);
    });

    const sourceMap = new Map<string, number>();
    sourceCounts.forEach((src) => {
      if (src.leadSource) sourceMap.set(src.leadSource.toLowerCase(), src._count.id);
    });

    const enrichedStages = stages.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      leadCount: stageMap.get(s.name.toLowerCase()) || 0,
    }));

    const enrichedOutcomes = outcomes.map((o) => ({
      ...mapOutcomeWithFlags(o),
      leadCount: outcomeMap.get(o.name.toLowerCase()) || 0,
    }));

    const enrichedSources = sources.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      leadCount: sourceMap.get(s.name.toLowerCase()) || 0,
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

    const existing = await prisma.pipelineStageOption.findFirst({
      where: { name: cleanName },
    });
    if (existing) {
      throw new BadRequestError(`Pipeline stage "${cleanName}" already exists.`);
    }

    const maxOrderAggregate = await prisma.pipelineStageOption.aggregate({ _max: { order: true } });
    const maxOrder = maxOrderAggregate._max.order ?? -1;

    const newStage = await prisma.pipelineStageOption.create({
      data: {
        name: cleanName,
        color: color || 'blue',
        isDefault: false,
        isActive: true,
        order: maxOrder + 1,
      },
    });

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

    const stage = await prisma.pipelineStageOption.findUnique({ where: { id } });
    if (!stage) {
      throw new NotFoundError('Pipeline stage not found.');
    }

    const oldName = stage.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;
    const updateData: any = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Pipeline stage name cannot be empty.');
      }
      const cleanName = name.trim();
      if (cleanName.toLowerCase() !== stage.name.toLowerCase()) {
        const duplicate = await prisma.pipelineStageOption.findFirst({
          where: { name: cleanName, id: { not: id } },
        });
        if (duplicate) {
          throw new BadRequestError(`Pipeline stage "${cleanName}" already exists.`);
        }
        updateData.name = cleanName;
        nameChanged = true;

        const updateRes = await prisma.lead.updateMany({
          where: { pipelineStage: oldName },
          data: { pipelineStage: cleanName, lastStatusUpdatedAt: new Date() },
        });
        updatedLeadsCount = updateRes.count;
      }
    }

    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.pipelineStageOption.update({
      where: { id },
      data: updateData,
    });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_PIPELINE_STAGE',
      entity: 'PIPELINE_STAGE',
      entityId: updated.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? updated.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: updated.color,
        isActive: updated.isActive,
      },
    });

    sendSuccess(
      res,
      updated,
      nameChanged && updatedLeadsCount > 0
        ? `Pipeline stage renamed to "${updated.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Pipeline stage "${updated.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Pipeline Stage (Admin only)
 */
export async function deletePipelineStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const stage = await prisma.pipelineStageOption.findUnique({ where: { id } });
    if (!stage) {
      throw new NotFoundError('Pipeline stage not found.');
    }

    const usedCount = await prisma.lead.count({
      where: { pipelineStage: stage.name, isDeleted: false },
    });

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete pipeline stage "${stage.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    await prisma.pipelineStageOption.delete({ where: { id } });

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

    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        prisma.pipelineStageOption.update({
          where: { id },
          data: { order: index },
        }).catch(() => {})
      )
    );

    const reordered = await prisma.pipelineStageOption.findMany({ orderBy: { order: 'asc' } });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_PIPELINE_STAGES',
      entity: 'PIPELINE_STAGE',
      details: { orderedIds },
    });

    sendSuccess(res, reordered, 'Pipeline stages reordered.');
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

    const existing = await prisma.callOutcomeOption.findFirst({
      where: { name: cleanName },
    });
    if (existing) {
      throw new BadRequestError(`Call outcome "${cleanName}" already exists.`);
    }

    const maxOrderAggregate = await prisma.callOutcomeOption.aggregate({ _max: { order: true } });
    const maxOrder = maxOrderAggregate._max.order ?? -1;

    const newOutcome = await prisma.callOutcomeOption.create({
      data: {
        name: cleanName,
        color: color || 'indigo',
        suggestedPipelineStage: suggestedPipelineStage || 'Follow-up',
        requiresDateTime: !!flags?.requiresDateTime,
        requiresNextFollowUp: !!flags?.requiresNextFollowUp,
        closesLead: !!flags?.closesLead,
        autoReturnNewLeadsDays:
          typeof flags?.autoReturnNewLeadsDays === 'number' && flags.autoReturnNewLeadsDays > 0
            ? flags.autoReturnNewLeadsDays
            : null,
        isDefault: false,
        isActive: true,
        order: maxOrder + 1,
      },
    });

    const mapped = mapOutcomeWithFlags(newOutcome);

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'CREATE_CALL_OUTCOME',
      entity: 'CALL_OUTCOME',
      entityId: newOutcome.id,
      details: { name: cleanName, color: newOutcome.color, flags: mapped.flags, suggestedPipelineStage },
    });

    sendSuccess(res, mapped, `Call outcome "${cleanName}" created successfully.`);
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

    const outcome = await prisma.callOutcomeOption.findUnique({ where: { id } });
    if (!outcome) {
      throw new NotFoundError('Call outcome not found.');
    }

    const oldName = outcome.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;
    const updateData: any = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Call outcome name cannot be empty.');
      }
      const cleanName = name.trim();
      if (cleanName.toLowerCase() !== outcome.name.toLowerCase()) {
        if (cleanName.toLowerCase().includes('special inquiry')) {
          throw new BadRequestError('"Special Inquiry" has been permanently removed.');
        }

        const duplicate = await prisma.callOutcomeOption.findFirst({
          where: { name: cleanName, id: { not: id } },
        });
        if (duplicate) {
          throw new BadRequestError(`Call outcome "${cleanName}" already exists.`);
        }

        updateData.name = cleanName;
        nameChanged = true;

        const updateRes = await prisma.lead.updateMany({
          where: { lastCallOutcome: oldName },
          data: { lastCallOutcome: cleanName, lastStatusUpdatedAt: new Date() },
        });
        updatedLeadsCount = updateRes.count;

        await prisma.callLog.updateMany({
          where: { outcome: oldName },
          data: { outcome: cleanName },
        });
      }
    }

    if (color !== undefined) updateData.color = color;
    if (suggestedPipelineStage !== undefined) updateData.suggestedPipelineStage = suggestedPipelineStage;
    if (flags !== undefined) {
      if (flags.requiresDateTime !== undefined) updateData.requiresDateTime = Boolean(flags.requiresDateTime);
      if (flags.requiresNextFollowUp !== undefined) updateData.requiresNextFollowUp = Boolean(flags.requiresNextFollowUp);
      if (flags.closesLead !== undefined) updateData.closesLead = Boolean(flags.closesLead);
      if (flags.autoReturnNewLeadsDays !== undefined) {
        updateData.autoReturnNewLeadsDays =
          typeof flags.autoReturnNewLeadsDays === 'number' && flags.autoReturnNewLeadsDays > 0
            ? flags.autoReturnNewLeadsDays
            : null;
      }
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.callOutcomeOption.update({
      where: { id },
      data: updateData,
    });

    const mapped = mapOutcomeWithFlags(updated);

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_CALL_OUTCOME',
      entity: 'CALL_OUTCOME',
      entityId: updated.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? updated.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: updated.color,
        flags: mapped.flags,
        suggestedPipelineStage: updated.suggestedPipelineStage,
        isActive: updated.isActive,
      },
    });

    sendSuccess(
      res,
      mapped,
      nameChanged && updatedLeadsCount > 0
        ? `Call outcome renamed to "${updated.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Call outcome "${updated.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Call Outcome (Admin only)
 */
export async function deleteCallOutcome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const outcome = await prisma.callOutcomeOption.findUnique({ where: { id } });
    if (!outcome) {
      throw new NotFoundError('Call outcome not found.');
    }

    const usedCount = await prisma.lead.count({
      where: { lastCallOutcome: outcome.name, isDeleted: false },
    });

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete call outcome "${outcome.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    await prisma.callOutcomeOption.delete({ where: { id } });

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

    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        prisma.callOutcomeOption.update({
          where: { id },
          data: { order: index },
        }).catch(() => {})
      )
    );

    const reordered = await prisma.callOutcomeOption.findMany({ orderBy: { order: 'asc' } });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_CALL_OUTCOMES',
      entity: 'CALL_OUTCOME',
      details: { orderedIds },
    });

    sendSuccess(res, reordered.map(mapOutcomeWithFlags), 'Call outcomes reordered.');
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

    const existing = await prisma.leadSourceOption.findFirst({
      where: { name: cleanName },
    });
    if (existing) {
      throw new BadRequestError(`Lead source "${cleanName}" already exists.`);
    }

    const maxOrderAggregate = await prisma.leadSourceOption.aggregate({ _max: { order: true } });
    const maxOrder = maxOrderAggregate._max.order ?? -1;

    const newSource = await prisma.leadSourceOption.create({
      data: {
        name: cleanName,
        color: color || 'blue',
        isDefault: false,
        isActive: true,
        order: maxOrder + 1,
      },
    });

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

    const source = await prisma.leadSourceOption.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundError('Lead source not found.');
    }

    const oldName = source.name;
    let nameChanged = false;
    let updatedLeadsCount = 0;
    const updateData: any = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Lead source name cannot be empty.');
      }
      const cleanName = name.trim();
      const duplicate = await prisma.leadSourceOption.findFirst({
        where: { name: cleanName, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestError(`Lead source "${cleanName}" already exists.`);
      }

      if (cleanName.toLowerCase() !== source.name.toLowerCase()) {
        nameChanged = true;
        updateData.name = cleanName;

        const updateRes = await prisma.lead.updateMany({
          where: { leadSource: oldName },
          data: { leadSource: cleanName },
        });
        updatedLeadsCount = updateRes.count;
      }
    }

    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.leadSourceOption.update({
      where: { id },
      data: updateData,
    });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'UPDATE_LEAD_SOURCE',
      entity: 'LEAD_SOURCE',
      entityId: updated.id,
      details: {
        oldName: nameChanged ? oldName : undefined,
        newName: nameChanged ? updated.name : undefined,
        updatedLeadsCount: nameChanged ? updatedLeadsCount : undefined,
        color: updated.color,
        isActive: updated.isActive,
      },
    });

    sendSuccess(
      res,
      updated,
      nameChanged && updatedLeadsCount > 0
        ? `Lead source renamed to "${updated.name}". Updated ${updatedLeadsCount} existing leads.`
        : `Lead source "${updated.name}" updated.`
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Lead Source (Admin only)
 */
export async function deleteLeadSource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const source = await prisma.leadSourceOption.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundError('Lead source not found.');
    }

    const usedCount = await prisma.lead.count({
      where: { leadSource: source.name, isDeleted: false },
    });

    if (usedCount > 0) {
      throw new BadRequestError(
        `Cannot delete source "${source.name}" because it is currently used by ${usedCount} lead(s). Deactivate it instead.`
      );
    }

    await prisma.leadSourceOption.delete({ where: { id } });

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

    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        prisma.leadSourceOption.update({
          where: { id },
          data: { order: index },
        }).catch(() => {})
      )
    );

    const reordered = await prisma.leadSourceOption.findMany({ orderBy: { order: 'asc' } });

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'REORDER_LEAD_SOURCES',
      entity: 'LEAD_SOURCE',
      details: { orderedIds },
    });

    sendSuccess(res, reordered, 'Lead sources reordered.');
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
