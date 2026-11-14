import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Lead,
  LeadActivity,
  LeadAssignmentHistory,
  CallLog,
  FollowUpTask,
  NotificationItem,
  UserRole,
  Priority,
  PipelineStage,
  CallOutcome,
  TaskType,
  TaskStatus,
  ActivityType,
  normalizeCallOutcome,
  PipelineStageOption,
  CallOutcomeOption,
  LeadSourceOption,
  AuditLogItem,
} from '@crm/shared';
import { prisma } from '../config/prisma';

export interface CustomOptions {
  priorities: string[];
  callOutcomes: string[];
}

export interface DataStore {
  users: (User & { passwordHash: string })[];
  leads: Lead[];
  activities: LeadActivity[];
  assignmentHistories: LeadAssignmentHistory[];
  callLogs: CallLog[];
  followUpTasks: FollowUpTask[];
  notifications: NotificationItem[];
  customOptions: CustomOptions;
  pipelineStageOptions: PipelineStageOption[];
  callOutcomeOptions: CallOutcomeOption[];
  leadSourceOptions: LeadSourceOption[];
  auditLogs: AuditLogItem[];
}

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


function getDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', '.data');
  }
  let curr = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'package.json')) && (fs.existsSync(path.join(curr, 'prisma')) || fs.existsSync(path.join(curr, 'apps')))) {
      return path.join(curr, '.data');
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(process.cwd(), '.data');
}

const DATA_DIR = getDataDir();
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function generateInitialSeed(): DataStore {
  return {
    users: [],
    leads: [],
    activities: [],
    assignmentHistories: [],
    callLogs: [],
    followUpTasks: [],
    notifications: [],
    customOptions: {
      priorities: [],
      callOutcomes: [],
    },
    pipelineStageOptions: getDefaultPipelineStageOptions(),
    callOutcomeOptions: getDefaultCallOutcomeOptions(),
    leadSourceOptions: getDefaultLeadSourceOptions(),
    auditLogs: [],
  };
}

class StoreManager {
  private data: DataStore;
  private lastMtime: number = 0;
  private lastCheckTime: number = 0;
  private lastRuleRunTime: number = 0;
  private lastDbSyncTime: number = 0;

  constructor() {
    this.data = this.loadData();
  }

  public checkReload(): void {
    const now = Date.now();
    // Throttle filesystem stat checks to at most once per 1000ms
    if (now - this.lastCheckTime < 1000) return;
    this.lastCheckTime = now;

    try {
      if (fs.existsSync(DATA_FILE)) {
        const mtime = fs.statSync(DATA_FILE).mtimeMs;
        if (mtime > this.lastMtime) {
          this.data = this.loadData();
        }
      }
    } catch {}
  }

  private loadData(): DataStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        this.lastMtime = fs.statSync(DATA_FILE).mtimeMs;
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const store: DataStore = JSON.parse(raw);
        let migrated = false;
        if (!store.customOptions) {
          store.customOptions = { priorities: [], callOutcomes: [] };
          migrated = true;
        }

        // Round 5: Remove "Special Inquiry" completely from customOptions
        if (Array.isArray(store.customOptions.callOutcomes)) {
          const filteredOutcomes = store.customOptions.callOutcomes.filter(
            (o) => !o.toLowerCase().includes('special inquiry')
          );
          if (filteredOutcomes.length !== store.customOptions.callOutcomes.length) {
            store.customOptions.callOutcomes = filteredOutcomes;
            migrated = true;
          }
        }

        // Filter out any legacy dummy leads
        if (Array.isArray(store.leads)) {
          const cleanLeads = store.leads.filter(
            (l) => !l.id.startsWith('lead_10') &&
                   !l.companyName?.toLowerCase().includes('acme test') &&
                   !l.companyName?.toLowerCase().includes('noanswer corp') &&
                   !l.companyName?.toLowerCase().includes('round4 test') &&
                   l.companyName?.toLowerCase() !== 'test'
          );
          if (cleanLeads.length !== store.leads.length) {
            store.leads = cleanLeads;
            migrated = true;
          }
        }

        // Filter out any legacy dummy users
        if (Array.isArray(store.users)) {
          const cleanUsers = store.users.filter((u) => !u.id.startsWith('usr_'));
          if (cleanUsers.length !== store.users.length) {
            store.users = cleanUsers;
            migrated = true;
          }
        }

        if (Array.isArray(store.leads)) {
          for (const lead of store.leads) {
            // Round 5: Safely move any leads using Special Inquiry to "New Lead" with history note
            if (lead.pipelineStage && lead.pipelineStage.toLowerCase().includes('special inquiry')) {
              const oldStage = lead.pipelineStage;
              lead.pipelineStage = 'New Lead';
              lead.lastStatusUpdatedAt = new Date().toISOString();
              if (Array.isArray(store.activities)) {
                store.activities.push({
                  id: `act_mig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  leadId: lead.id,
                  userId: null,
                  type: 'STAGE_CHANGED',
                  description: `Safely migrated stage from "${oldStage}" to "New Lead" due to removal of Special Inquiry option.`,
                  metadata: { oldStage, newStage: 'New Lead' },
                  createdAt: new Date().toISOString(),
                });
              }
              migrated = true;
            }

            if (lead.nextFollowUpDate === '-' || lead.nextFollowUpDate === '—' || lead.nextFollowUpDate === 'N/A' || lead.nextFollowUpDate === 'null' || lead.nextFollowUpDate === '') {
              lead.nextFollowUpDate = undefined;
              migrated = true;
            }
            if (lead.lastContactDate === '-' || lead.lastContactDate === '—' || lead.lastContactDate === 'N/A' || lead.lastContactDate === 'null' || lead.lastContactDate === '') {
              lead.lastContactDate = undefined;
              migrated = true;
            }

            if (lead.lastCallOutcome && lead.lastCallOutcome.toLowerCase().includes('special inquiry')) {
              lead.lastCallOutcome = 'New Lead';
              migrated = true;
            }

            const normalizedOutcome = normalizeCallOutcome(lead.pipelineStage);
            if (lead.pipelineStage !== normalizedOutcome) {
              lead.pipelineStage = normalizedOutcome;
              migrated = true;
            }
            if (lead.assignedSalesmanId && !lead.salesStage) {
              lead.salesStage = 'ASSIGNED';
              migrated = true;
            }
            if (lead.lastCallOutcome) {
              const normLast = normalizeCallOutcome(lead.lastCallOutcome);
              if (lead.lastCallOutcome !== normLast) {
                lead.lastCallOutcome = normLast;
                migrated = true;
              }
            }
          }
        }

        // Round 10 Migration: Pipeline Stage and Call Outcome Options + Audit Logs
        if (!Array.isArray(store.pipelineStageOptions) || store.pipelineStageOptions.length === 0) {
          store.pipelineStageOptions = getDefaultPipelineStageOptions();
          migrated = true;
        }

        if (!Array.isArray(store.callOutcomeOptions) || store.callOutcomeOptions.length === 0) {
          store.callOutcomeOptions = getDefaultCallOutcomeOptions();
          if (Array.isArray(store.customOptions?.callOutcomes)) {
            for (const cust of store.customOptions.callOutcomes) {
              const clean = cust.trim();
              if (
                clean &&
                !clean.toLowerCase().includes('special inquiry') &&
                !store.callOutcomeOptions.some((o) => o.name.toLowerCase() === clean.toLowerCase())
              ) {
                store.callOutcomeOptions.push({
                  id: `outc_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: clean,
                  color: 'indigo',
                  suggestedPipelineStage: 'Follow-up',
                  flags: { requiresNextFollowUp: true },
                  isDefault: false,
                  isActive: true,
                  order: store.callOutcomeOptions.length,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
          migrated = true;
        }

        // Preserve any custom stage or outcome from existing leads
        if (Array.isArray(store.leads)) {
          for (const lead of store.leads) {
            if (
              lead.pipelineStage &&
              !store.pipelineStageOptions.some((s) => s.name.toLowerCase() === lead.pipelineStage.toLowerCase())
            ) {
              store.pipelineStageOptions.push({
                id: `stg_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: lead.pipelineStage,
                color: 'slate',
                isDefault: false,
                isActive: true,
                order: store.pipelineStageOptions.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              migrated = true;
            }
            if (
              lead.lastCallOutcome &&
              !store.callOutcomeOptions.some((o) => o.name.toLowerCase() === lead.lastCallOutcome!.toLowerCase())
            ) {
              store.callOutcomeOptions.push({
                id: `outc_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: lead.lastCallOutcome,
                color: 'slate',
                suggestedPipelineStage: 'Follow-up',
                flags: {},
                isDefault: false,
                isActive: true,
                order: store.callOutcomeOptions.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              migrated = true;
            }
          }
        }

        if (!Array.isArray(store.leadSourceOptions) || store.leadSourceOptions.length === 0) {
          store.leadSourceOptions = getDefaultLeadSourceOptions();
          migrated = true;
        }

        if (!Array.isArray(store.auditLogs)) {
          store.auditLogs = [];
          migrated = true;
        }

        if (migrated) {
          this.saveData(store);
        }
        return store;
      }
    } catch (err) {
      console.warn('[StoreManager] Could not read local file store:', (err as Error).message);
      // NEVER overwrite with empty seed if in-memory data already has records!
      if (this.data && Array.isArray(this.data.leads) && this.data.leads.length > 0) {
        return this.data;
      }
    }
    const seed = generateInitialSeed();
    this.saveData(seed);
    return seed;
  }

  /**
   * Rule 5 & Round 10: Automatic Follow-up & Return-to-Fresh Rules
   * - Checks outcome flags for autoReturnNewLeadsDays (default: 3 days for retry outcomes)
   */
  public processAutomaticRules(): boolean {
    const now = Date.now();
    // Throttle automatic rule evaluations to at most once per 30 seconds
    if (now - this.lastRuleRunTime < 30000) return false;
    this.lastRuleRunTime = now;

    this.checkReload();
    const todayStr = new Date(now).toISOString().split('T')[0];
    let changed = false;

    if (!Array.isArray(this.data.leads)) return false;

    for (const lead of this.data.leads) {
      if (lead.archivedAt) continue;

      let returnDays: number | null = null;
      const matchedOutcome = this.data.callOutcomeOptions?.find(
        (o) => o.name.toLowerCase() === (lead.lastCallOutcome || '').toLowerCase()
      );
      if (matchedOutcome?.flags?.autoReturnNewLeadsDays != null) {
        returnDays = matchedOutcome.flags.autoReturnNewLeadsDays;
      } else if (
        lead.lastCallOutcome === 'No Answer' ||
        lead.lastCallOutcome === 'Busy' ||
        lead.lastCallOutcome === 'Call Cut' ||
        lead.pipelineStage === 'No Answer / Ringing' ||
        lead.pipelineStage === 'Busy / Declined'
      ) {
        returnDays = 3;
      }

      // Do not automatically reset leads that have active scheduled follow-ups or are assigned
      if (lead.nextFollowUpDate && !isNaN(new Date(lead.nextFollowUpDate).getTime()) && new Date(lead.nextFollowUpDate).getTime() >= new Date(todayStr).getTime()) {
        continue;
      }

      if (returnDays !== null && lead.lastContactDate && lead.pipelineStage !== 'New Lead' && lead.pipelineStage !== 'Closed') {
        const callDate = new Date(lead.lastContactDate);
        if (isNaN(callDate.getTime())) continue; // Guard against malformed historical dates
        const callDateStr = callDate.toISOString().split('T')[0];
        const diffMs = new Date(todayStr).getTime() - new Date(callDateStr).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= returnDays) {
          const oldStage = lead.pipelineStage;
          lead.pipelineStage = 'New Lead';
          lead.isRetry = true;
          lead.retryCount = (lead.retryCount || 0) + 1;
          lead.lastActivityAt = new Date(now).toISOString();

          this.data.activities.push({
            id: `act_auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            leadId: lead.id,
            userId: null,
            type: 'STAGE_CHANGED',
            description: `Automatically returned to New Fresh Leads (Retry) on the 3rd day after "${oldStage}".`,
            metadata: {
              oldStage,
              newStage: 'New Lead',
              isRetry: true,
              automatic: true,
              diffDays,
            },
            createdAt: new Date(now).toISOString(),
          });
          changed = true;
        }
      }
    }

    if (changed) {
      this.persist();
    }
    return changed;
  }

  private saveData(data: DataStore): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpFile, DATA_FILE);
      } catch {
        // Fallback for Windows if rename fails due to open handle
        fs.copyFileSync(tmpFile, DATA_FILE);
        try { fs.unlinkSync(tmpFile); } catch {}
      }
      this.lastMtime = fs.statSync(DATA_FILE).mtimeMs;
      this.lastCheckTime = Date.now();
    } catch (err) {
      console.error('[StoreManager] Failed to persist data to store.json', err);
    }
  }

  public get store(): DataStore {
    this.checkReload();
    return this.data;
  }

  public persist(): void {
    this.saveData(this.data);
  }

  public resetToSeed(): DataStore {
    this.data = generateInitialSeed();
    this.persist();
    return this.data;
  }

  public async ensureSynced(force = false): Promise<void> {
    const now = Date.now();
    // 1. If initial sync from DB has never completed, await initial sync once so tables & cards are fully hydrated
    if (this.lastDbSyncTime === 0) {
      await this.syncFromDatabase();
      return;
    }

    // 2. If memory is populated, DO NOT block the HTTP response!
    // Trigger non-blocking background sync every 30s to stay fresh without stalling tables
    if (force || now - this.lastDbSyncTime > 30000) {
      this.lastDbSyncTime = now;
      this.syncFromDatabase().catch((err) => {
        console.warn('[StoreManager] Background sync error:', (err as Error).message);
      });
    }
  }

  public async syncFromDatabase(): Promise<void> {
    try {
      const [dbUsers, dbLeads] = await Promise.all([
        prisma.user.findMany(),
        prisma.lead.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (dbUsers.length > 0) {
        const userMap = new Map(this.data.users.map((u) => [u.id, u]));

        for (const u of dbUsers) {
          const mappedDbUser: User & { passwordHash: string } = {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role as UserRole,
            phone: u.phone || null,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword ?? false,
            failedLoginAttempts: u.failedLoginAttempts ?? 0,
            lockoutUntil: u.lockoutUntil ? new Date(u.lockoutUntil).toISOString() : null,
            lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
            lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
            createdAt: new Date(u.createdAt).toISOString(),
            updatedAt: new Date(u.updatedAt).toISOString(),
            passwordHash: u.passwordHash,
          };

          const existingMem = userMap.get(u.id);
          if (!existingMem) {
            userMap.set(u.id, mappedDbUser);
          } else {
            // Preserve the most recent lastActiveAt and lastLoginAt so active sessions are never clobbered
            const memActiveMs = existingMem.lastActiveAt ? new Date(existingMem.lastActiveAt).getTime() : 0;
            const dbActiveMs = mappedDbUser.lastActiveAt ? new Date(mappedDbUser.lastActiveAt).getTime() : 0;
            const latestActiveMs = Math.max(memActiveMs, dbActiveMs);

            const memLoginMs = existingMem.lastLoginAt ? new Date(existingMem.lastLoginAt).getTime() : 0;
            const dbLoginMs = mappedDbUser.lastLoginAt ? new Date(mappedDbUser.lastLoginAt).getTime() : 0;
            const latestLoginMs = Math.max(memLoginMs, dbLoginMs);

            const memUpdatedMs = new Date(existingMem.updatedAt).getTime();
            const dbUpdatedMs = new Date(u.updatedAt).getTime();

            if (dbUpdatedMs > memUpdatedMs) {
              userMap.set(u.id, {
                ...mappedDbUser,
                lastActiveAt: latestActiveMs > 0 ? new Date(latestActiveMs).toISOString() : null,
                lastLoginAt: latestLoginMs > 0 ? new Date(latestLoginMs).toISOString() : null,
              });
            } else {
              userMap.set(u.id, {
                ...existingMem,
                lastActiveAt: latestActiveMs > 0 ? new Date(latestActiveMs).toISOString() : null,
                lastLoginAt: latestLoginMs > 0 ? new Date(latestLoginMs).toISOString() : null,
              });
            }
          }
        }
        this.data.users = Array.from(userMap.values());
      }

      if (dbLeads.length > 0) {
        const leadMap = new Map(this.data.leads.map((l) => [l.id, l]));

        for (const l of dbLeads) {
          const mappedDbLead: Lead = {
            id: l.id,
            companyName: l.companyName,
            serviceProduct: l.serviceProduct,
            contactPerson: l.contactPerson || undefined,
            phone: l.phone,
            email: l.email || undefined,
            alternatePhone: l.alternatePhone || undefined,
            website: l.website || undefined,
            city: l.city || undefined,
            state: l.state || undefined,
            priority: l.priority as Priority,
            pipelineStage: l.pipelineStage,
            salesStage: (l.salesStage as any) || undefined,
            callAttempts: l.callAttempts,
            isRetry: l.isRetry,
            retryCount: l.retryCount,
            lastCallOutcome: l.lastCallOutcome || undefined,
            lastContactDate: l.lastContactDate ? new Date(l.lastContactDate).toISOString() : undefined,
            lastStatusUpdatedAt: l.lastStatusUpdatedAt ? new Date(l.lastStatusUpdatedAt).toISOString() : undefined,
            nextFollowUpDate: l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toISOString() : undefined,
            nextAction: l.nextAction || undefined,
            notes: l.notes || undefined,
            leadSource: l.leadSource || undefined,
            leadSourceOther: l.leadSourceOther || undefined,
            assignedTelecallerId: l.assignedTelecallerId || undefined,
            assignedSalesmanId: l.assignedSalesmanId || undefined,
            createdById: l.createdById || undefined,
            convertedAt: l.convertedAt ? new Date(l.convertedAt).toISOString() : undefined,
            dealValue: l.dealValue || undefined,
            lostReason: (l.lostReason as any) || undefined,
            lostNotes: l.lostNotes || undefined,
            archivedAt: l.archivedAt ? new Date(l.archivedAt).toISOString() : undefined,
            isDeleted: l.isDeleted,
            deletedAt: l.deletedAt ? new Date(l.deletedAt).toISOString() : undefined,
            deletedById: l.deletedById || undefined,
            createdAt: new Date(l.createdAt).toISOString(),
            updatedAt: new Date(l.updatedAt).toISOString(),
            lastActivityAt: l.lastActivityAt ? new Date(l.lastActivityAt).toISOString() : undefined,
          };

          const existingMem = leadMap.get(l.id);
          if (!existingMem) {
            leadMap.set(l.id, mappedDbLead);
          } else {
            // Compare timestamps: Never overwrite newer in-memory assignments or status changes with stale DB reads!
            const memUpdatedMs = new Date(existingMem.updatedAt).getTime();
            const dbUpdatedMs = new Date(l.updatedAt).getTime();

            if (dbUpdatedMs > memUpdatedMs) {
              leadMap.set(l.id, mappedDbLead);
            } else if (memUpdatedMs > dbUpdatedMs) {
              // In-memory has pending changes (e.g. recent assignment or call outcome) - keep it and re-sync to DB
              this.syncLeadToDatabase(existingMem).catch(() => {});
            }
          }
        }
        this.data.leads = Array.from(leadMap.values());
      }
      this.lastDbSyncTime = Date.now();
      this.persist();
    } catch (err) {
      console.warn('[StoreManager] syncFromDatabase error:', (err as Error).message);
    }
  }

  public async syncLeadToDatabase(lead: Lead): Promise<void> {
    try {
      const isValidDate = (d?: string | null) => d && !isNaN(new Date(d).getTime());
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          companyName: lead.companyName,
          serviceProduct: lead.serviceProduct,
          contactPerson: lead.contactPerson || null,
          phone: lead.phone,
          email: lead.email || null,
          alternatePhone: lead.alternatePhone || null,
          website: lead.website || null,
          city: lead.city || null,
          state: lead.state || null,
          priority: (lead.priority as any) || 'MEDIUM',
          pipelineStage: lead.pipelineStage || 'New Lead',
          salesStage: lead.salesStage || null,
          callAttempts: lead.callAttempts || 0,
          isRetry: lead.isRetry || false,
          retryCount: lead.retryCount || 0,
          lastCallOutcome: lead.lastCallOutcome || null,
          lastContactDate: isValidDate(lead.lastContactDate) ? new Date(lead.lastContactDate!) : null,
          lastStatusUpdatedAt: isValidDate(lead.lastStatusUpdatedAt) ? new Date(lead.lastStatusUpdatedAt!) : null,
          nextFollowUpDate: isValidDate(lead.nextFollowUpDate) ? new Date(lead.nextFollowUpDate!) : null,
          nextAction: lead.nextAction || null,
          notes: lead.notes || null,
          leadSource: lead.leadSource || null,
          leadSourceOther: lead.leadSourceOther || null,
          assignedTelecallerId: lead.assignedTelecallerId || null,
          assignedSalesmanId: lead.assignedSalesmanId || null,
          createdById: lead.createdById || null,
          convertedAt: isValidDate(lead.convertedAt) ? new Date(lead.convertedAt!) : null,
          dealValue: lead.dealValue || null,
          lostReason: lead.lostReason || null,
          lostNotes: lead.lostNotes || null,
          archivedAt: isValidDate(lead.archivedAt) ? new Date(lead.archivedAt!) : null,
          isDeleted: lead.isDeleted || false,
          deletedAt: isValidDate(lead.deletedAt) ? new Date(lead.deletedAt!) : null,
          deletedById: lead.deletedById || null,
        },
        create: {
          id: lead.id,
          companyName: lead.companyName,
          serviceProduct: lead.serviceProduct,
          contactPerson: lead.contactPerson || null,
          phone: lead.phone,
          email: lead.email || null,
          alternatePhone: lead.alternatePhone || null,
          website: lead.website || null,
          city: lead.city || null,
          state: lead.state || null,
          priority: (lead.priority as any) || 'MEDIUM',
          pipelineStage: lead.pipelineStage || 'New Lead',
          salesStage: lead.salesStage || null,
          callAttempts: lead.callAttempts || 0,
          isRetry: lead.isRetry || false,
          retryCount: lead.retryCount || 0,
          lastCallOutcome: lead.lastCallOutcome || null,
          lastContactDate: isValidDate(lead.lastContactDate) ? new Date(lead.lastContactDate!) : null,
          lastStatusUpdatedAt: isValidDate(lead.lastStatusUpdatedAt) ? new Date(lead.lastStatusUpdatedAt!) : null,
          nextFollowUpDate: isValidDate(lead.nextFollowUpDate) ? new Date(lead.nextFollowUpDate!) : null,
          nextAction: lead.nextAction || null,
          notes: lead.notes || null,
          leadSource: lead.leadSource || null,
          leadSourceOther: lead.leadSourceOther || null,
          assignedTelecallerId: lead.assignedTelecallerId || null,
          assignedSalesmanId: lead.assignedSalesmanId || null,
          createdById: lead.createdById || null,
          convertedAt: isValidDate(lead.convertedAt) ? new Date(lead.convertedAt!) : null,
          dealValue: lead.dealValue || null,
          lostReason: lead.lostReason || null,
          lostNotes: lead.lostNotes || null,
          archivedAt: isValidDate(lead.archivedAt) ? new Date(lead.archivedAt!) : null,
          isDeleted: lead.isDeleted || false,
          deletedAt: isValidDate(lead.deletedAt) ? new Date(lead.deletedAt!) : null,
          deletedById: lead.deletedById || null,
        },
      });
    } catch (err) {
      console.error('[dbStore] Failed to sync lead to remote MySQL:', (err as Error).message);
    }
  }

  public async syncAuditLogToDatabase(log: AuditLogItem): Promise<void> {
    try {
      await prisma.auditLog.upsert({
        where: { id: log.id },
        update: {
          userId: log.userId || null,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId || null,
          details: log.details || undefined,
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
        },
        create: {
          id: log.id,
          userId: log.userId || null,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId || null,
          details: log.details || undefined,
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
        },
      });
    } catch (err) {
      console.error('[dbStore] Failed to sync audit log to remote MySQL:', (err as Error).message);
    }
  }

  public async syncLeadSourceToDatabase(src: LeadSourceOption): Promise<void> {
    try {
      await prisma.leadSourceOption.upsert({
        where: { name: src.name },
        update: {
          color: src.color || null,
          isActive: src.isActive,
          order: src.order,
        },
        create: {
          id: src.id,
          name: src.name,
          color: src.color || null,
          isDefault: src.isDefault,
          isActive: src.isActive,
          order: src.order,
        },
      });
    } catch (err) {
      console.error('[dbStore] Failed to sync lead source to remote MySQL:', (err as Error).message);
    }
  }
}

export const dbStore = new StoreManager();
