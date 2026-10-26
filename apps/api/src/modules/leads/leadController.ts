import { Request, Response, NextFunction } from 'express';
import {
  createLeadSchema,
  updateLeadSchema,
  updateStageSchema,
  updateSalesStageSchema,
  bulkPrioritySchema,
  bulkDeleteSchema,
  Priority,
  PipelineStage,
  USER_ROLES,
  normalizeCallOutcome,
  getSuggestedPipelineForOutcome,
  TELECALLER_CALL_OUTCOMES,
} from '@crm/shared';
import { leadRepository, LeadFilterOptions } from '../../repositories/leadRepository';
import { userRepository } from '../../repositories/userRepository';
import { activityRepository } from '../../repositories/activityRepository';
import { followUpTaskRepository } from '../../repositories/followUpTaskRepository';
import { notificationService } from '../../services/notificationService';
import { dbStore } from '../../repositories/dbStore';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

/**
 * Enforces role-based lead isolation.
 * Throws ForbiddenError if user is not authorized to access lead.
 */
function assertLeadAccess(user: Express.Request['user'], lead: { assignedTelecallerId?: string | null; assignedSalesmanId?: string | null }): void {
  if (!user) {
    throw new ForbiddenError('Unauthorized');
  }
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    return; // Super Admin has global access
  }
  if (user.role === USER_ROLES.TELECALLER) {
    if (lead.assignedTelecallerId !== user.id) {
      throw new ForbiddenError('You are not authorized to access this lead.');
    }
    return;
  }
  if (user.role === USER_ROLES.SALESMAN) {
    if (lead.assignedSalesmanId !== user.id) {
      throw new ForbiddenError('You are not authorized to access this lead.');
    }
    return;
  }
  throw new ForbiddenError('Unauthorized role');
}

export async function listLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const filter: LeadFilterOptions = {
      search: req.query.search as string | undefined,
      pipelineStage: req.query.pipelineStage as string | undefined,
      lastCallOutcome: req.query.lastCallOutcome as string | undefined,
      salesStage: req.query.salesStage as string | undefined,
      priority: req.query.priority as Priority | undefined,
      leadSource: req.query.leadSource as string | undefined,
      followUpStatus: req.query.followUpStatus as any,
      kpi: req.query.kpi as string | undefined,
      dateField: req.query.dateField as any,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };

    // Strict role-based query enforcement
    if (user.role === USER_ROLES.TELECALLER) {
      filter.assignedTelecallerId = user.id;
    } else if (user.role === USER_ROLES.SALESMAN) {
      filter.assignedSalesmanId = user.id;
    } else if (user.role === USER_ROLES.SUPER_ADMIN) {
      // Super Admin can filter by any telecaller or salesman
      if (req.query.assignedTelecallerId) {
        filter.assignedTelecallerId = req.query.assignedTelecallerId as string;
      }
      if (req.query.assignedSalesmanId) {
        filter.assignedSalesmanId = req.query.assignedSalesmanId as string;
      }
      if (req.query.isUnassigned === 'true') {
        filter.isUnassigned = true;
      }
    }

    const { leads, total } = await leadRepository.findMany(filter);
    sendSuccess(res, leads, undefined, 200, {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.ceil(total / (filter.limit || 50)),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeadById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    assertLeadAccess(req.user, lead);
    sendSuccess(res, lead);
  } catch (error) {
    next(error);
  }
}

export async function createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Only Super Admin is permitted to create new leads
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Lead creation is restricted to Super Admin users only.');
    }

    const data = createLeadSchema.parse(req.body);

    const newLead = await leadRepository.create({
      companyName: data.companyName,
      serviceProduct: data.serviceProduct,
      contactPerson: data.contactPerson || '',
      phone: data.phone,
      email: data.email || null,
      alternatePhone: data.alternatePhone || null,
      website: data.website || null,
      city: data.city || null,
      state: data.state || null,
      priority: data.priority as Priority,
      pipelineStage: (data.pipelineStage || 'NEW') as PipelineStage,
      notes: data.notes || null,
      leadSource: data.leadSource || 'Manual Entry',
      assignedTelecallerId: data.assignedTelecallerId || null,
      assignedSalesmanId: data.assignedSalesmanId || null,
      createdById: req.user!.id,
      callAttempts: 0,
    });

    // Record activity
    await activityRepository.create({
      leadId: newLead.id,
      userId: req.user!.id,
      type: 'LEAD_CREATED',
      description: `Lead created by ${req.user!.name}`,
    });

    // Notify telecaller if assigned by someone else
    if (data.assignedTelecallerId && data.assignedTelecallerId !== req.user!.id) {
      await notificationService.notifyLeadAssignment(
        data.assignedTelecallerId,
        newLead.id,
        newLead.companyName,
        newLead.contactPerson || '-',
        req.user!.name
      );
    }

    sendSuccess(res, newLead, 'Lead created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    assertLeadAccess(req.user, lead);

    const data = updateLeadSchema.parse(req.body);

    // Only Super Admin can change priority
    if (data.priority && req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can update lead priority.');
    }

    const patchData: any = { ...(data as any) };
    if (data.pipelineStage && data.pipelineStage !== lead.pipelineStage) {
      patchData.lastStatusUpdatedAt = new Date().toISOString();
    }

    const updated = await leadRepository.update(req.params.id, patchData);

    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: 'NOTE_ADDED',
      description: `Lead details updated by ${req.user!.name}`,
    });

    sendSuccess(res, updated, 'Lead updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateLeadPriority(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can update lead priority.');
    }
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) throw new NotFoundError('Lead not found');

    const { priority } = req.body;
    if (!priority || !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
      throw new BadRequestError('Invalid priority value. Must be LOW, MEDIUM, HIGH, or URGENT.');
    }

    const updated = await leadRepository.update(req.params.id, { priority });
    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: 'NOTE_ADDED',
      description: `Priority updated to ${priority} by ${req.user!.name}`,
    });

    sendSuccess(res, updated, 'Priority updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdatePriority(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can bulk update lead priorities.');
    }
    const data = bulkPrioritySchema.parse(req.body);
    const updatedCount = await leadRepository.bulkUpdatePriority(data.leadIds, data.priority as Priority);

    for (const leadId of data.leadIds) {
      await activityRepository.create({
        leadId,
        userId: req.user!.id,
        type: 'NOTE_ADDED',
        description: `Priority bulk updated to ${data.priority} by ${req.user!.name}`,
      });
    }

    sendSuccess(res, { updatedCount }, `Successfully updated priority for ${updatedCount} leads`);
  } catch (error) {
    next(error);
  }
}

export async function deleteLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can delete leads.');
    }
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) throw new NotFoundError('Lead not found');

    await leadRepository.delete(req.params.id);
    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: 'NOTE_ADDED',
      description: `Lead deleted by ${req.user!.name}`,
    });

    sendSuccess(res, { id: req.params.id }, 'Lead deleted successfully');
  } catch (error) {
    next(error);
  }
}

export async function bulkDeleteLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can bulk delete leads.');
    }
    const data = bulkDeleteSchema.parse(req.body);
    const deletedCount = await leadRepository.bulkDelete(data.leadIds);

    for (const leadId of data.leadIds) {
      await activityRepository.create({
        leadId,
        userId: req.user!.id,
        type: 'NOTE_ADDED',
        description: `Lead deleted in bulk by ${req.user!.name}`,
      });
    }

    sendSuccess(res, { deletedCount }, `Successfully deleted ${deletedCount} leads`);
  } catch (error) {
    next(error);
  }
}

export async function updateLeadStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Role check: Closer cannot change the Telecaller's Call Outcome
    if (req.user!.role === USER_ROLES.SALESMAN) {
      throw new ForbiddenError("Closer cannot change the Telecaller's Call Outcome.");
    }

    assertLeadAccess(req.user, lead);

    const data = updateStageSchema.parse(req.body);
    const oldStage = lead.pipelineStage;
    const oldOutcome = lead.lastCallOutcome;

    let targetOutcome: string | null | undefined = data.lastCallOutcome !== undefined ? data.lastCallOutcome : undefined;
    let targetPipeline: string | undefined = data.pipelineStage;

    // If outcome is provided, normalize it
    if (targetOutcome) {
      targetOutcome = normalizeCallOutcome(targetOutcome);
    }

    // If outcome is provided but not pipeline, suggest default pipeline
    if (targetOutcome && !targetPipeline) {
      targetPipeline = getSuggestedPipelineForOutcome(targetOutcome);
    } else if (!targetPipeline && !targetOutcome) {
      targetPipeline = oldStage;
    }

    // Validation rules for specific stage transitions
    if (
      (targetPipeline === 'Assign to Salesman' || targetPipeline === 'ASSIGNED_TO_SALESMAN') &&
      !data.assignedSalesmanId &&
      !lead.assignedSalesmanId
    ) {
      throw new BadRequestError('Assigning to Salesman requires selecting an active Sales Closer.');
    }

    // Rules for dates:
    // Call Back Later and Demo Scheduled: date and time is required (past dates not allowed)
    let followUpDate: string | undefined = data.nextFollowUpDate || (data as any).meetingDate || (req.body as any).followUpDate;
    if (targetOutcome === 'Call Back Later' || targetOutcome === 'Demo Scheduled') {
      if (!followUpDate) {
        throw new BadRequestError(`Date and time are required when selecting "${targetOutcome}".`);
      }
      const parsedTime = new Date(followUpDate).getTime();
      if (isNaN(parsedTime) || parsedTime < Date.now() - 60000) {
        throw new BadRequestError('Date and time cannot be in the past.');
      }
    } else if (
      targetOutcome === 'Demo Interested' ||
      targetOutcome === 'Details Requested' ||
      targetOutcome === 'Demo Completed' ||
      targetOutcome === 'Decision Pending'
    ) {
      // Demo Interested, Details Requested, Demo Completed, Decision Pending: Next Follow-up date is required
      if (!followUpDate && !lead.nextFollowUpDate) {
        throw new BadRequestError(`Next follow-up date is required for "${targetOutcome}".`);
      }
    } else if (targetOutcome === 'Not Interested' || targetOutcome === 'Wrong Number') {
      // Not Interested and Wrong Number set Pipeline to Closed, no follow-up date
      targetPipeline = 'Closed';
      followUpDate = undefined;
    }

    const now = new Date();
    const updatePayload: any = {
      lastStatusUpdatedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    };

    if (targetPipeline) {
      updatePayload.pipelineStage = targetPipeline;
    }
    if (targetOutcome !== undefined) {
      updatePayload.lastCallOutcome = targetOutcome;
    }

    if (
      targetOutcome === 'No Answer' ||
      targetOutcome === 'Busy' ||
      targetOutcome === 'Call Cut' ||
      targetOutcome === 'Connected – Discussed'
    ) {
      updatePayload.lastContactDate = now.toISOString();
      updatePayload.callAttempts = (lead.callAttempts || 0) + 1;
    }

    if (targetPipeline === 'Closed') {
      updatePayload.nextFollowUpDate = null;
    } else if (followUpDate) {
      updatePayload.nextFollowUpDate = followUpDate;
    }

    if (data.nextAction !== undefined) {
      updatePayload.nextAction = data.nextAction;
    }

    if (data.notes) {
      updatePayload.notes = lead.notes
        ? `${lead.notes}\n[${now.toISOString().split('T')[0]}]: ${data.notes}`
        : data.notes;
    }

    // Handover to Sales Closer
    if (data.assignedSalesmanId) {
      const salesman = await userRepository.findById(data.assignedSalesmanId);
      if (!salesman || salesman.role !== USER_ROLES.SALESMAN || !salesman.isActive) {
        throw new BadRequestError('Invalid or inactive salesman selected');
      }

      updatePayload.assignedSalesmanId = data.assignedSalesmanId;
      updatePayload.salesStage = 'ASSIGNED'; // Automatically set Sales Stage to ASSIGNED

      // Create Assignment History record
      dbStore.store.assignmentHistories.push({
        id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        leadId: lead.id,
        assignedById: req.user!.id,
        previousUserId: lead.assignedSalesmanId || lead.assignedTelecallerId,
        newUserId: data.assignedSalesmanId,
        roleType: 'SALESMAN',
        handoverSummary: data.handoverSummary || null,
        createdAt: new Date().toISOString(),
      });

      // Notify Salesman
      await notificationService.notifyLeadAssignment(
        data.assignedSalesmanId,
        lead.id,
        lead.companyName,
        lead.contactPerson || '-',
        req.user!.name
      );
    } else if (
      (targetPipeline === 'Assign to Salesman' || targetOutcome === 'Assign to Salesman') &&
      lead.assignedSalesmanId
    ) {
      updatePayload.salesStage = lead.salesStage || 'ASSIGNED';
    }

    // Schedule task if follow-up date was set
    if (followUpDate) {
      await followUpTaskRepository.create({
        leadId: lead.id,
        assignedUserId: req.user!.id,
        taskType: (targetOutcome === 'Demo Scheduled' || targetOutcome === 'Demo Interested' || targetPipeline === 'Demo') ? 'DEMO' : 'CALL',
        dueDate: followUpDate.split('T')[0],
        dueTime: followUpDate.includes('T') ? followUpDate.split('T')[1].substring(0, 5) : '10:00',
        notes: data.notes || `Scheduled follow-up for ${targetOutcome || targetPipeline}`,
      });
    }

    // Won / Converted
    if (targetPipeline === 'Closed' && targetOutcome === 'Converted') {
      updatePayload.convertedAt = new Date().toISOString();
      if (data.dealValue) updatePayload.dealValue = data.dealValue;
    }

    // Lost / Reason
    if (data.lostReason) {
      updatePayload.lostReason = data.lostReason;
      updatePayload.lostNotes = data.lostNotes || null;
    }

    const updated = await leadRepository.update(lead.id, updatePayload);

    // Record stage transition activity
    const activityDesc = `Pipeline set to "${targetPipeline}"${targetOutcome ? `, Outcome: "${targetOutcome}"` : ''} by ${req.user!.name}.${
      data.notes ? ` Notes: ${data.notes}` : ''
    }${data.handoverSummary ? ` (Summary: ${data.handoverSummary})` : ''}${followUpDate ? ` (Follow-up: ${followUpDate})` : ''}`;

    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: 'STAGE_CHANGED',
      description: activityDesc,
      metadata: {
        oldStage,
        oldOutcome,
        newPipeline: targetPipeline,
        newOutcome: targetOutcome,
        handoverSummary: data.handoverSummary,
        followUpDate,
        notes: data.notes,
      },
    });

    sendSuccess(res, updated, `Pipeline updated to ${targetPipeline}`);
  } catch (error) {
    next(error);
  }
}

export async function updateSalesStage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await leadRepository.findById(req.params.id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // C3: Role-Based Access
    // Closer can update Sales Stage only for leads assigned to them.
    if (req.user!.role === USER_ROLES.SALESMAN) {
      if (lead.assignedSalesmanId !== req.user!.id) {
        throw new ForbiddenError('A Closer can update the Sales Stage only for leads assigned to them.');
      }
    } else if (req.user!.role === USER_ROLES.TELECALLER) {
      throw new ForbiddenError('Telecallers cannot update the Sales Stage.');
    } else if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Unauthorized to update sales stage.');
    }

    const data = updateSalesStageSchema.parse(req.body);
    const oldStage = lead.salesStage || 'ASSIGNED';
    const newStage = data.salesStage;

    // C2: If DEMO_SCHEDULED or FOLLOW_UP_REQUIRED, require Date and Time picker (past dates not allowed)
    if (newStage === 'DEMO_SCHEDULED' || newStage === 'FOLLOW_UP_REQUIRED') {
      if (!data.followUpDate) {
        throw new BadRequestError(`Date and time are required when selecting "${newStage}".`);
      }
      const parsedTime = new Date(data.followUpDate).getTime();
      if (isNaN(parsedTime) || parsedTime < Date.now() - 60000) {
        throw new BadRequestError('Date and time cannot be in the past.');
      }
    }

    const updatePayload: any = {
      salesStage: newStage,
      lastActivityAt: new Date().toISOString(),
    };

    if (data.followUpDate) {
      updatePayload.nextFollowUpDate = data.followUpDate;

      // Schedule follow-up task for Closer
      await followUpTaskRepository.create({
        leadId: lead.id,
        assignedUserId: lead.assignedSalesmanId || req.user!.id,
        taskType: newStage === 'DEMO_SCHEDULED' ? 'DEMO' : 'FOLLOW_UP',
        dueDate: data.followUpDate.split('T')[0],
        dueTime: data.followUpDate.includes('T') ? data.followUpDate.split('T')[1].substring(0, 5) : '14:00',
        notes: data.notes || `Sales follow-up for stage: ${newStage}`,
      });
    }

    if (data.notes) {
      updatePayload.notes = lead.notes
        ? `${lead.notes}\n[${new Date().toISOString().split('T')[0]} - ${newStage}]: ${data.notes}`
        : data.notes;
    }

    if (newStage === 'CONVERTED') {
      updatePayload.convertedAt = new Date().toISOString();
      if (data.dealValue) updatePayload.dealValue = data.dealValue;
    }

    if (newStage === 'LOST') {
      if (data.lostReason) updatePayload.lostReason = data.lostReason;
      if (data.lostNotes) updatePayload.lostNotes = data.lostNotes;
    }

    // Closer CANNOT change Telecaller's Call Outcome (pipelineStage is untouched!)
    const updated = await leadRepository.update(lead.id, updatePayload);

    // Record in lead's history: timestamp, old stage, new stage, who changed it, remarks
    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: newStage === 'CONVERTED' ? 'LEAD_CONVERTED' : newStage === 'LOST' ? 'LEAD_LOST' : 'STAGE_CHANGED',
      description: `Sales stage changed from "${oldStage}" to "${newStage}" by ${req.user!.name}.${
        data.notes ? ` Remarks: ${data.notes}` : ''
      }${data.followUpDate ? ` (Follow-up: ${data.followUpDate})` : ''}`,
      metadata: {
        oldStage,
        newStage,
        changedBy: req.user!.name,
        notes: data.notes,
        followUpDate: data.followUpDate,
        dealValue: data.dealValue,
      },
    });

    sendSuccess(res, updated, `Sales stage moved to ${newStage}`);
  } catch (error) {
    next(error);
  }
}

export async function checkDuplicates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const phone = req.query.phone as string;
    const email = req.query.email as string | undefined;
    const companyName = req.query.companyName as string | undefined;

    if (!phone && !email && !companyName) {
      throw new BadRequestError('Must provide phone, email, or companyName to check duplicates');
    }

    const matches = await leadRepository.findDuplicates(phone || '', email, companyName);
    sendSuccess(res, {
      hasDuplicates: matches.length > 0,
      matches,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Requirement 5: Follow-up completion flow
 * Closed: lead moves to Closed list and leaves follow-up list.
 * Not Closed: asks for note, then lead is automatically added to Follow-ups again after 3 days.
 */
export async function completeFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // 'CLOSED' | 'NOT_CLOSED'
    const lead = await leadRepository.findById(id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    assertLeadAccess(req.user, lead);

    const now = new Date();
    const updatePayload: any = {
      lastStatusUpdatedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    };

    if (action === 'CLOSED') {
      updatePayload.pipelineStage = 'Closed';
      updatePayload.lastCallOutcome = 'Closed';
      updatePayload.nextFollowUpDate = null;
      updatePayload.nextAction = 'Follow-up Closed';

      // Complete all pending follow-up tasks for this lead
      const tasks = dbStore.store.followUpTasks.filter((t) => t.leadId === lead.id && t.status === 'PENDING');
      for (const t of tasks) {
        t.status = 'COMPLETED';
        t.completedAt = now.toISOString();
      }

      await activityRepository.create({
        leadId: lead.id,
        userId: req.user!.id,
        type: 'STAGE_CHANGED',
        description: `Follow-up completed: Lead marked as Closed by ${req.user!.name}.${notes ? ` Notes: ${notes}` : ''}`,
        metadata: { action: 'CLOSED', notes },
      });
    } else if (action === 'NOT_CLOSED') {
      if (!notes || !notes.trim()) {
        throw new BadRequestError('A note is required explaining why the follow-up was not closed.');
      }

      // Automatically added to Follow-ups again after 3 days
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 3);
      nextDate.setHours(10, 0, 0, 0);
      const nextDateIso = nextDate.toISOString();

      updatePayload.nextFollowUpDate = nextDateIso;
      updatePayload.nextAction = `Follow-up retry: ${notes.trim()}`;
      if (notes) {
        updatePayload.notes = lead.notes
          ? `${lead.notes}\n[${now.toISOString().split('T')[0]} - Not Closed]: ${notes.trim()}`
          : `[${now.toISOString().split('T')[0]} - Not Closed]: ${notes.trim()}`;
      }

      // Complete current pending tasks and create new task for 3 days later
      const currentTasks = dbStore.store.followUpTasks.filter((t) => t.leadId === lead.id && t.status === 'PENDING');
      for (const t of currentTasks) {
        t.status = 'COMPLETED';
        t.completedAt = now.toISOString();
      }

      await followUpTaskRepository.create({
        leadId: lead.id,
        assignedUserId: lead.assignedTelecallerId || req.user!.id,
        taskType: 'FOLLOW_UP',
        dueDate: nextDateIso.split('T')[0],
        dueTime: '10:00',
        notes: `Follow-up rescheduled (Not Closed): ${notes.trim()}`,
      });

      await activityRepository.create({
        leadId: lead.id,
        userId: req.user!.id,
        type: 'NOTE_ADDED',
        description: `Follow-up completed: Not Closed - "${notes.trim()}". Automatically rescheduled follow-up for 3 days later (${nextDateIso.split('T')[0]}) by ${req.user!.name}.`,
        metadata: { action: 'NOT_CLOSED', notes: notes.trim(), nextFollowUpDate: nextDateIso },
      });
    } else {
      throw new BadRequestError('Invalid action. Must be CLOSED or NOT_CLOSED.');
    }

    const updated = await leadRepository.update(lead.id, updatePayload);
    sendSuccess(res, updated, `Follow-up marked as ${action === 'CLOSED' ? 'Closed' : 'Not Closed (rescheduled in 3 days)'}`);
  } catch (error) {
    next(error);
  }
}

/**
 * Requirement 4: Custom Options for Priority and Last Call Outcome
 */
export async function getCustomOptions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const opts = dbStore.store.customOptions || { priorities: [], callOutcomes: [] };
    sendSuccess(res, opts);
  } catch (error) {
    next(error);
  }
}

export async function addCustomOption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.body.type;
    const name = req.body.name || req.body.option;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Option name cannot be empty.');
    }
    const cleanName = name.trim();

    // Round 5: "Special Inquiry" option is permanently removed and cannot be added
    if (cleanName.toLowerCase().includes('special inquiry')) {
      throw new BadRequestError('"Special Inquiry" has been permanently removed and cannot be added.');
    }

    if (!dbStore.store.customOptions) {
      dbStore.store.customOptions = { priorities: [], callOutcomes: [] };
    }

    if (type === 'PRIORITY') {
      const defaultPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const existing = [...defaultPriorities, ...dbStore.store.customOptions.priorities];
      if (existing.some((p) => p.toLowerCase() === cleanName.toLowerCase())) {
        throw new BadRequestError(`Priority "${cleanName}" already exists.`);
      }
      dbStore.store.customOptions.priorities.push(cleanName);
      dbStore.persist();
      sendSuccess(res, dbStore.store.customOptions, `Priority "${cleanName}" added successfully.`);
    } else if (type === 'CALL_OUTCOME') {
      const defaultOutcomes = [...TELECALLER_CALL_OUTCOMES];
      const existing = [...defaultOutcomes, ...dbStore.store.customOptions.callOutcomes];
      if (existing.some((o) => o.toLowerCase() === cleanName.toLowerCase())) {
        throw new BadRequestError(`Call Outcome "${cleanName}" already exists.`);
      }
      dbStore.store.customOptions.callOutcomes.push(cleanName);
      dbStore.persist();
      sendSuccess(res, dbStore.store.customOptions, `Call Outcome "${cleanName}" added successfully.`);
    } else {
      throw new BadRequestError('Invalid option type. Must be PRIORITY or CALL_OUTCOME.');
    }
  } catch (error) {
    next(error);
  }
}

