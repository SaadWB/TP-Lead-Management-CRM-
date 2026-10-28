import { Request, Response, NextFunction } from 'express';
import { logCallSchema, USER_ROLES, normalizeCallOutcome } from '@crm/shared';
import { leadRepository } from '../../repositories/leadRepository';
import { callLogRepository } from '../../repositories/callLogRepository';
import { activityRepository } from '../../repositories/activityRepository';
import { followUpTaskRepository } from '../../repositories/followUpTaskRepository';
import { userRepository } from '../../repositories/userRepository';
import { notificationService } from '../../services/notificationService';
import { dbStore } from '../../repositories/dbStore';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export async function logCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const leadId = req.params.leadId;
    const lead = await leadRepository.findById(leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Role check
    if (
      req.user!.role !== USER_ROLES.SUPER_ADMIN &&
      lead.assignedTelecallerId !== req.user!.id &&
      lead.assignedSalesmanId !== req.user!.id
    ) {
      throw new ForbiddenError('You can only log calls for leads assigned to you');
    }

    const data = logCallSchema.parse(req.body);
    const outcome = normalizeCallOutcome(data.outcome);

    const matchedOutcome = dbStore.store.callOutcomeOptions?.find(
      (o) => o.name.toLowerCase() === outcome.toLowerCase() || o.name.toLowerCase() === (data.outcome || '').toLowerCase()
    );

    // Validate follow-up date and time
    let followUpDate: string | undefined = undefined;
    const requiresDateTime =
      matchedOutcome?.flags?.requiresDateTime ||
      outcome === 'Callback Requested' ||
      outcome === 'Demo Requested' ||
      outcome === 'Call Back Later' ||
      outcome === 'Demo Scheduled';

    if (requiresDateTime) {
      if (!data.nextFollowUpDate) {
        throw new BadRequestError(`Date and time are required when selecting "${outcome}".`);
      }
      const parsedTime = new Date(data.nextFollowUpDate).getTime();
      if (isNaN(parsedTime) || parsedTime < Date.now() - 60000) {
        throw new BadRequestError('Follow-up date and time cannot be in the past.');
      }
      followUpDate = data.nextFollowUpDate;
    } else if (outcome === 'Interested') {
      // Rule 5: Interested lead is automatically added to Follow-ups after 3 days
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(10, 0, 0, 0);
      followUpDate = d.toISOString();
    } else if (data.nextFollowUpDate) {
      const parsedTime = new Date(data.nextFollowUpDate).getTime();
      if (!isNaN(parsedTime) && parsedTime >= Date.now() - 60000) {
        followUpDate = data.nextFollowUpDate;
      }
    }


    // 1. Create CallLog entry
    const callLog = await callLogRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      outcome,
      notes: data.notes,
      contactDate: data.contactDate,
      followUpNeeded: !!followUpDate,
      nextFollowUpDate: followUpDate || null,
      nextAction: data.nextAction || null,
      durationSeconds: data.durationSeconds,
    });

    // 2. Increment call attempts & update lead status to the selected Call Outcome
    const updateLeadData: any = {
      callAttempts: (lead.callAttempts || 0) + 1,
      lastCallOutcome: outcome,
      pipelineStage: outcome, // The selected outcome becomes the lead's current status
      lastContactDate: data.contactDate,
      lastStatusUpdatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    if (followUpDate) {
      updateLeadData.nextFollowUpDate = followUpDate;
    }
    if (data.nextAction) {
      updateLeadData.nextAction = data.nextAction;
    }

    // Assign to Salesman handoff
    if (outcome === 'Assign to Salesman' && data.assignedSalesmanId) {
      const salesman = await userRepository.findById(data.assignedSalesmanId);
      if (!salesman || salesman.role !== USER_ROLES.SALESMAN || !salesman.isActive) {
        throw new BadRequestError('Invalid or inactive Salesman selected for assignment');
      }
      updateLeadData.assignedSalesmanId = data.assignedSalesmanId;
      updateLeadData.salesStage = 'ASSIGNED';

      // Record assignment history
      dbStore.store.assignmentHistories.push({
        id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        leadId: lead.id,
        assignedById: req.user!.id,
        previousUserId: lead.assignedSalesmanId || lead.assignedTelecallerId,
        newUserId: data.assignedSalesmanId,
        roleType: 'SALESMAN',
        handoverSummary: data.notes || 'Handed over from call logging',
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
    }

    const updatedLead = await leadRepository.update(lead.id, updateLeadData);

    // 3. Create FollowUpTask if follow-up date was set
    if (followUpDate) {
      await followUpTaskRepository.create({
        leadId: lead.id,
        assignedUserId: req.user!.id,
        taskType: outcome === 'Demo Requested' ? 'DEMO' : 'CALL',
        dueDate: followUpDate.split('T')[0],
        dueTime: followUpDate.includes('T') ? followUpDate.split('T')[1].substring(0, 5) : '10:00',
        notes: data.nextAction || `${outcome} follow-up scheduled`,
      });
    }

    // 4. Create LeadActivity record
    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: 'CALL_LOGGED',
      description: `Call logged by ${req.user!.name}. Outcome: ${outcome}.${
        data.notes ? ` Notes: ${data.notes}` : ''
      }${followUpDate ? ` Scheduled for: ${followUpDate}` : ''}`,
      metadata: { outcome, durationSeconds: data.durationSeconds, followUpDate },
    });

    sendSuccess(res, { callLog, lead: updatedLead }, 'Call logged successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function getCallLogsByLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const leadId = req.params.leadId;
    const lead = await leadRepository.findById(leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const logs = await callLogRepository.findByLeadId(leadId);
    sendSuccess(res, logs);
  } catch (error) {
    next(error);
  }
}
