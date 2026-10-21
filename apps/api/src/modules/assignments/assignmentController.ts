import { Request, Response, NextFunction } from 'express';
import { assignLeadSchema, bulkAssignLeadsSchema, USER_ROLES } from '@crm/shared';
import { leadRepository } from '../../repositories/leadRepository';
import { userRepository } from '../../repositories/userRepository';
import { activityRepository } from '../../repositories/activityRepository';
import { notificationService } from '../../services/notificationService';
import { dbStore } from '../../repositories/dbStore';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export async function assignSingleLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const leadId = req.params.leadId;
    const lead = await leadRepository.findById(leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const data = assignLeadSchema.parse(req.body);
    const targetUser = await userRepository.findById(data.assignedUserId);
    if (!targetUser || !targetUser.isActive) {
      throw new BadRequestError('Assignee user is not found or is inactive');
    }

    // Role check:
    // If Telecaller is assigning to Salesman, check lead is assigned to Telecaller
    if (req.user!.role === USER_ROLES.TELECALLER) {
      if (lead.assignedTelecallerId !== req.user!.id) {
        throw new ForbiddenError('You can only transfer your own assigned leads to a Salesman');
      }
      if (data.roleType !== 'SALESMAN' || targetUser.role !== USER_ROLES.SALESMAN) {
        throw new BadRequestError('Telecallers can only assign leads to an active Salesman');
      }
    } else if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin and assigned Telecaller can assign leads');
    }

    const previousUserId =
      data.roleType === 'TELECALLER' ? lead.assignedTelecallerId : lead.assignedSalesmanId;

    const updateData: any = {
      ...(data.roleType === 'TELECALLER'
        ? { assignedTelecallerId: targetUser.id }
        : { assignedSalesmanId: targetUser.id, pipelineStage: 'ASSIGNED_TO_SALESMAN' }),
      lastActivityAt: new Date().toISOString(),
    };

    const updatedLead = await leadRepository.update(lead.id, updateData);

    // Record assignment history
    const historyItem = {
      id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      leadId: lead.id,
      assignedById: req.user!.id,
      previousUserId: previousUserId || null,
      newUserId: targetUser.id,
      roleType: data.roleType,
      handoverSummary: data.handoverSummary || null,
      createdAt: new Date().toISOString(),
    };
    dbStore.store.assignmentHistories.push(historyItem);
    dbStore.persist();

    // Activity log
    await activityRepository.create({
      leadId: lead.id,
      userId: req.user!.id,
      type: previousUserId ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED',
      description: `Lead assigned to ${data.roleType.toLowerCase()} ${targetUser.name} by ${req.user!.name}${
        data.handoverSummary ? ` (Handover: ${data.handoverSummary})` : ''
      }`,
    });

    // Schedule demo task if selected
    if (data.scheduleDemo && data.demoDate) {
      dbStore.store.followUpTasks.push({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        leadId: lead.id,
        assignedUserId: targetUser.id,
        taskType: 'DEMO',
        dueDate: data.demoDate.split('T')[0],
        dueTime: data.demoDate.includes('T') ? data.demoDate.split('T')[1].substring(0, 5) : '14:00',
        notes: `Demo scheduled during handover by ${req.user!.name}: ${data.handoverSummary || 'Initial demo'}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // In-app & Email notification
    await notificationService.notifyLeadAssignment(
      targetUser.id,
      lead.id,
      lead.companyName,
      lead.contactPerson || '-',
      req.user!.name
    );

    sendSuccess(res, updatedLead, `Lead successfully assigned to ${targetUser.name}`);
  } catch (error) {
    next(error);
  }
}

export async function bulkAssignLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = bulkAssignLeadsSchema.parse(req.body);
    const targetUser = await userRepository.findById(data.assignedUserId);
    if (!targetUser || !targetUser.isActive) {
      throw new BadRequestError('Target user not found or inactive');
    }

    let count = 0;
    for (const leadId of data.leadIds) {
      const lead = await leadRepository.findById(leadId);
      if (!lead) continue;

      const previousUserId =
        data.roleType === 'TELECALLER' ? lead.assignedTelecallerId : lead.assignedSalesmanId;

      await leadRepository.update(lead.id, {
        ...(data.roleType === 'TELECALLER'
          ? { assignedTelecallerId: targetUser.id }
          : { assignedSalesmanId: targetUser.id, pipelineStage: 'ASSIGNED_TO_SALESMAN' }),
      });

      dbStore.store.assignmentHistories.push({
        id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        leadId: lead.id,
        assignedById: req.user!.id,
        previousUserId: previousUserId || null,
        newUserId: targetUser.id,
        roleType: data.roleType,
        handoverSummary: 'Bulk assignment by Admin',
        createdAt: new Date().toISOString(),
      });

      await activityRepository.create({
        leadId: lead.id,
        userId: req.user!.id,
        type: 'LEAD_ASSIGNED',
        description: `Lead bulk-assigned to ${targetUser.name} by ${req.user!.name}`,
      });

      count++;
    }

    dbStore.persist();

    // Send single consolidated notification for bulk assignment
    await notificationService.notifyLeadAssignment(
      targetUser.id,
      data.leadIds[0],
      `${count} Assigned Leads`,
      'Batch Assignment',
      req.user!.name
    );

    sendSuccess(res, { assignedCount: count }, `Successfully assigned ${count} leads to ${targetUser.name}`);
  } catch (error) {
    next(error);
  }
}
