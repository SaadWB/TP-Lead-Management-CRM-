import { prisma } from '../config/prisma';
import {
  PipelineStageOption,
  CallOutcomeOption,
  LeadSourceOption,
} from '@crm/shared';

export function getDefaultPipelineStageOptions(): PipelineStageOption[] {
  const now = new Date().toISOString();
  return [
    { id: 'stg_new_lead', name: 'New Lead', color: 'blue', isDefault: true, isActive: true, order: 0, createdAt: now, updatedAt: now },
    { id: 'stg_attempting_contact', name: 'Attempting Contact', color: 'amber', isDefault: true, isActive: true, order: 1, createdAt: now, updatedAt: now },
    { id: 'stg_connected', name: 'Connected', color: 'sky', isDefault: true, isActive: true, order: 2, createdAt: now, updatedAt: now },
    { id: 'stg_follow_up', name: 'Follow-up', color: 'purple', isDefault: true, isActive: true, order: 3, createdAt: now, updatedAt: now },
    { id: 'stg_demo', name: 'Demo', color: 'indigo', isDefault: true, isActive: true, order: 4, createdAt: now, updatedAt: now },
    { id: 'stg_closed', name: 'Closed', color: 'slate', isDefault: true, isActive: true, order: 5, createdAt: now, updatedAt: now },
  ];
}

export function getDefaultCallOutcomeOptions(): CallOutcomeOption[] {
  const now = new Date().toISOString();
  return [
    { id: 'outc_no_answer', name: 'No Answer', color: 'amber', suggestedPipelineStage: 'Attempting Contact', flags: { autoReturnNewLeadsDays: 3 }, isDefault: true, isActive: true, order: 0, createdAt: now, updatedAt: now },
    { id: 'outc_busy', name: 'Busy', color: 'amber', suggestedPipelineStage: 'Follow-up', flags: {}, isDefault: true, isActive: true, order: 1, createdAt: now, updatedAt: now },
    { id: 'outc_call_cut', name: 'Call Cut', color: 'rose', suggestedPipelineStage: 'Attempting Contact', flags: { autoReturnNewLeadsDays: 3 }, isDefault: true, isActive: true, order: 2, createdAt: now, updatedAt: now },
    { id: 'outc_call_back_later', name: 'Call Back Later', color: 'purple', suggestedPipelineStage: 'Follow-up', flags: { requiresDateTime: true, requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 3, createdAt: now, updatedAt: now },
    { id: 'outc_connected_discussed', name: 'Connected – Discussed', color: 'sky', suggestedPipelineStage: 'Connected', flags: {}, isDefault: true, isActive: true, order: 4, createdAt: now, updatedAt: now },
    { id: 'outc_details_requested', name: 'Details Requested', color: 'blue', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 5, createdAt: now, updatedAt: now },
    { id: 'outc_demo_interested', name: 'Demo Interested', color: 'indigo', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 6, createdAt: now, updatedAt: now },
    { id: 'outc_demo_scheduled', name: 'Demo Scheduled', color: 'indigo', suggestedPipelineStage: 'Demo', flags: { requiresDateTime: true, requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 7, createdAt: now, updatedAt: now },
    { id: 'outc_demo_completed', name: 'Demo Completed', color: 'teal', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 8, createdAt: now, updatedAt: now },
    { id: 'outc_decision_pending', name: 'Decision Pending', color: 'amber', suggestedPipelineStage: 'Follow-up', flags: { requiresNextFollowUp: true }, isDefault: true, isActive: true, order: 9, createdAt: now, updatedAt: now },
    { id: 'outc_not_interested', name: 'Not Interested', color: 'rose', suggestedPipelineStage: 'Closed', flags: { closesLead: true }, isDefault: true, isActive: true, order: 10, createdAt: now, updatedAt: now },
    { id: 'outc_wrong_number', name: 'Wrong Number', color: 'rose', suggestedPipelineStage: 'Closed', flags: { closesLead: true }, isDefault: true, isActive: true, order: 11, createdAt: now, updatedAt: now },
  ];
}

export function getDefaultLeadSourceOptions(): LeadSourceOption[] {
  const now = new Date().toISOString();
  return [
    { id: 'src_website', name: 'Website', color: 'blue', isDefault: true, isActive: true, order: 0, createdAt: now, updatedAt: now },
    { id: 'src_referral', name: 'Referral', color: 'emerald', isDefault: true, isActive: true, order: 1, createdAt: now, updatedAt: now },
    { id: 'src_cold_call', name: 'Cold Call', color: 'amber', isDefault: true, isActive: true, order: 2, createdAt: now, updatedAt: now },
    { id: 'src_whatsapp', name: 'WhatsApp', color: 'teal', isDefault: true, isActive: true, order: 3, createdAt: now, updatedAt: now },
    { id: 'src_social_media', name: 'Social Media (Facebook / LinkedIn / Instagram)', color: 'indigo', isDefault: true, isActive: true, order: 4, createdAt: now, updatedAt: now },
    { id: 'src_exhibition_event', name: 'Exhibition / Event', color: 'purple', isDefault: true, isActive: true, order: 5, createdAt: now, updatedAt: now },
    { id: 'src_tender_portal', name: 'Tender Portal', color: 'sky', isDefault: true, isActive: true, order: 6, createdAt: now, updatedAt: now },
    { id: 'src_existing_customer', name: 'Existing Customer', color: 'cyan', isDefault: true, isActive: true, order: 7, createdAt: now, updatedAt: now },
    { id: 'src_other', name: 'Other', color: 'slate', isDefault: true, isActive: true, order: 8, createdAt: now, updatedAt: now },
  ];
}

export class DirectDatabaseManager {
  public store = {
    users: [],
    leads: [],
    activities: [],
    assignmentHistories: [],
    callLogs: [],
    followUpTasks: [],
    notifications: [],
    customOptions: { priorities: [], callOutcomes: [] },
    pipelineStageOptions: [],
    callOutcomeOptions: [],
    leadSourceOptions: [],
    auditLogs: [],
  };

  public async syncFromDatabase(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      console.warn('[DirectDB] Connection check:', err.message);
    }
  }

  public async ensureSynced(): Promise<void> {}
  public persist(): void {}
  public processAutomaticRules(): boolean { return false; }
  public async syncLeadToDatabase(): Promise<void> {}
  public async syncUserToDatabase(): Promise<void> {}
  public async syncAuditLogToDatabase(): Promise<void> {}
  public async syncLeadSourceToDatabase(): Promise<void> {}
}

export const dbStore = new DirectDatabaseManager();
