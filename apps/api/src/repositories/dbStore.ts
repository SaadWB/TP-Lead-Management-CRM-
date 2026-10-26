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
} from '@crm/shared';

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
}

const DATA_DIR = path.resolve(__dirname, '../../../../.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function generateInitialSeed(): DataStore {
  const defaultPasswordHash = bcrypt.hashSync('Password@123', 10);
  const now = new Date();
  const pastDay = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const futureDay = (days: number, hour = 14) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const users = [
    {
      id: 'usr_admin_1',
      name: 'Alexander Vance (Super Admin)',
      email: 'admin@tenderprocure.com',
      passwordHash: defaultPasswordHash,
      role: 'SUPER_ADMIN' as UserRole,
      phone: '+1-555-0100',
      isActive: true,
      createdAt: pastDay(30),
      updatedAt: pastDay(1),
    },
    {
      id: 'usr_tele_1',
      name: 'Priya Sharma',
      email: 'telecaller1@tenderprocure.com',
      passwordHash: defaultPasswordHash,
      role: 'TELECALLER' as UserRole,
      phone: '+1-555-0101',
      isActive: true,
      createdAt: pastDay(25),
      updatedAt: pastDay(1),
    },
    {
      id: 'usr_tele_2',
      name: 'Rahul Verma',
      email: 'telecaller2@tenderprocure.com',
      passwordHash: defaultPasswordHash,
      role: 'TELECALLER' as UserRole,
      phone: '+1-555-0102',
      isActive: true,
      createdAt: pastDay(25),
      updatedAt: pastDay(1),
    },
    {
      id: 'usr_sales_1',
      name: 'David Kim',
      email: 'sales1@tenderprocure.com',
      passwordHash: defaultPasswordHash,
      role: 'SALESMAN' as UserRole,
      phone: '+1-555-0103',
      isActive: true,
      createdAt: pastDay(20),
      updatedAt: pastDay(1),
    },
    {
      id: 'usr_sales_2',
      name: 'Ananya Patel',
      email: 'sales2@tenderprocure.com',
      passwordHash: defaultPasswordHash,
      role: 'SALESMAN' as UserRole,
      phone: '+1-555-0104',
      isActive: true,
      createdAt: pastDay(20),
      updatedAt: pastDay(1),
    },
  ];

  const leads: Lead[] = [
    {
      id: 'lead_101',
      companyName: 'Apex Industrial Solvents',
      serviceProduct: 'Government Tender Procurement SaaS',
      contactPerson: 'Robert Sterling',
      phone: '+1-555-234-5678',
      email: 'r.sterling@apexind.com',
      website: 'https://apexind.example.com',
      city: 'Chicago',
      state: 'IL',
      priority: 'HIGH' as Priority,
      pipelineStage: 'CONNECTED' as PipelineStage,
      callAttempts: 2,
      lastCallOutcome: 'CONNECTED' as CallOutcome,
      lastContactDate: pastDay(1),
      nextFollowUpDate: futureDay(1, 11),
      nextAction: 'Send technical compliance proposal and pricing sheet',
      notes: 'Actively bidding on 3 defense sector tenders. Needs automated bid tracking.',
      leadSource: 'Import - Q4 Manufacturing List',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: null,
      createdById: 'usr_admin_1',
      createdAt: pastDay(5),
      updatedAt: pastDay(1),
      lastActivityAt: pastDay(1),
    },
    {
      id: 'lead_102',
      companyName: 'BluePeak Healthcare Infrastructure',
      serviceProduct: 'Healthcare Supply Chain Bid Engine',
      contactPerson: 'Elena Rostova',
      phone: '+1-555-345-6789',
      email: 'elena@bluepeakhealth.org',
      website: 'https://bluepeakhealth.example.org',
      city: 'Boston',
      state: 'MA',
      priority: 'URGENT' as Priority,
      pipelineStage: 'INTERESTED' as PipelineStage,
      callAttempts: 3,
      lastCallOutcome: 'INTERESTED' as CallOutcome,
      lastContactDate: pastDay(2),
      nextFollowUpDate: pastDay(0), // due today!
      nextAction: 'Confirm demo attendees from executive procurement committee',
      notes: 'Very interested in our tender alert feature. Mentioned 12 branch locations.',
      leadSource: 'Website Inbound',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: null,
      createdById: 'usr_admin_1',
      createdAt: pastDay(7),
      updatedAt: pastDay(2),
      lastActivityAt: pastDay(2),
    },
    {
      id: 'lead_103',
      companyName: 'Crestline Civil Engineering',
      serviceProduct: 'Municipal Tender Bid Management',
      contactPerson: 'Marcus Holloway',
      phone: '+1-555-456-7890',
      email: 'marcus@crestlineeng.com',
      website: 'https://crestlineeng.example.com',
      city: 'Denver',
      state: 'CO',
      priority: 'MEDIUM' as Priority,
      pipelineStage: 'NEW' as PipelineStage,
      callAttempts: 0,
      lastCallOutcome: null,
      lastContactDate: null,
      nextFollowUpDate: futureDay(2, 10),
      nextAction: 'First exploratory discovery call',
      notes: 'Imported from heavy infrastructure trade expo.',
      leadSource: 'Expo 2026',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: null,
      createdById: 'usr_admin_1',
      createdAt: pastDay(2),
      updatedAt: pastDay(2),
      lastActivityAt: pastDay(2),
    },
    {
      id: 'lead_104',
      companyName: 'Dynasty Logistics Corp',
      serviceProduct: 'Fleet & Freight Tender Portal',
      contactPerson: 'Sarah Jenkins',
      phone: '+1-555-567-8901',
      email: 'sjenkins@dynastylog.com',
      website: 'https://dynastylog.example.com',
      city: 'Atlanta',
      state: 'GA',
      priority: 'HIGH' as Priority,
      pipelineStage: 'DEMO_MEETING_REQUIRED' as PipelineStage,
      callAttempts: 4,
      lastCallOutcome: 'CALL_BACK_REQUESTED' as CallOutcome,
      lastContactDate: pastDay(1),
      nextFollowUpDate: futureDay(1, 15),
      nextAction: 'Schedule 45-minute live platform demonstration with Sales',
      notes: 'Wants to see custom RFQ parsing and multi-user approval hierarchies.',
      leadSource: 'Referral',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: null,
      createdById: 'usr_admin_1',
      createdAt: pastDay(10),
      updatedAt: pastDay(1),
      lastActivityAt: pastDay(1),
    },
    {
      id: 'lead_105',
      companyName: 'Evergreen Environmental Services',
      serviceProduct: 'Waste Management Tender Portal',
      contactPerson: 'Tariq Al-Mansoor',
      phone: '+1-555-678-9012',
      email: 'tariq@evergreenservices.com',
      city: 'Seattle',
      state: 'WA',
      priority: 'LOW' as Priority,
      pipelineStage: 'NOT_INTERESTED' as PipelineStage,
      callAttempts: 2,
      lastCallOutcome: 'NOT_INTERESTED' as CallOutcome,
      lastContactDate: pastDay(4),
      nextFollowUpDate: null,
      nextAction: 'Keep on quarterly newsletter drip',
      notes: 'Currently locked into a 3-year contract with legacy vendor.',
      leadSource: 'Cold Outreach List',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: null,
      createdById: 'usr_admin_1',
      createdAt: pastDay(12),
      updatedAt: pastDay(4),
      lastActivityAt: pastDay(4),
    },
    {
      id: 'lead_106',
      companyName: 'Fortress Cyber Defense Ltd',
      serviceProduct: 'Federal Security Tender Automation',
      contactPerson: 'Nathan Drake',
      phone: '+1-555-789-0123',
      email: 'nathan@fortressdefense.gov.mock',
      city: 'Washington',
      state: 'DC',
      priority: 'URGENT' as Priority,
      pipelineStage: 'ASSIGNED_TO_SALESMAN' as PipelineStage,
      callAttempts: 5,
      lastCallOutcome: 'CONNECTED' as CallOutcome,
      lastContactDate: pastDay(2),
      nextFollowUpDate: futureDay(1, 16),
      nextAction: 'Sales discovery & architecture sign-off',
      notes: 'Qualified by Priya. High-value opportunity with $80k annual estimated license.',
      leadSource: 'GovTech Summit',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: 'usr_sales_1',
      createdById: 'usr_admin_1',
      createdAt: pastDay(15),
      updatedAt: pastDay(2),
      lastActivityAt: pastDay(2),
    },
    {
      id: 'lead_107',
      companyName: 'Global Telecom Towers Inc',
      serviceProduct: '5G Infrastructure Tender Tracker',
      contactPerson: 'Claire Redfield',
      phone: '+1-555-890-1234',
      email: 'claire@globaltelecom.com',
      city: 'Dallas',
      state: 'TX',
      priority: 'HIGH' as Priority,
      pipelineStage: 'DEMO_SCHEDULED' as PipelineStage,
      callAttempts: 3,
      lastCallOutcome: 'CONNECTED' as CallOutcome,
      lastContactDate: pastDay(3),
      nextFollowUpDate: futureDay(2, 14),
      nextAction: 'Sales demo with VP of Operations',
      notes: 'Salesman David Kim leading demo scheduled for 2:00 PM.',
      leadSource: 'Direct Outreach',
      assignedTelecallerId: 'usr_tele_1',
      assignedSalesmanId: 'usr_sales_1',
      createdById: 'usr_admin_1',
      createdAt: pastDay(18),
      updatedAt: pastDay(3),
      lastActivityAt: pastDay(3),
    },
    {
      id: 'lead_108',
      companyName: 'Horizon Renewable Energy',
      serviceProduct: 'Solar Tender Intelligence Suite',
      contactPerson: 'Vikram Mehta',
      phone: '+1-555-901-2345',
      email: 'vikram@horizonenergy.io',
      city: 'Austin',
      state: 'TX',
      priority: 'URGENT' as Priority,
      pipelineStage: 'NEGOTIATION' as PipelineStage,
      callAttempts: 6,
      lastCallOutcome: 'CONNECTED' as CallOutcome,
      lastContactDate: pastDay(1),
      nextFollowUpDate: futureDay(1, 17),
      nextAction: 'Send revised master services agreement with SLA annexure',
      notes: 'Negotiating annual enterprise contract at $45,000.',
      leadSource: 'Webinar Attendee',
      assignedTelecallerId: 'usr_tele_2',
      assignedSalesmanId: 'usr_sales_1',
      createdById: 'usr_admin_1',
      createdAt: pastDay(22),
      updatedAt: pastDay(1),
      lastActivityAt: pastDay(1),
    },
    {
      id: 'lead_109',
      companyName: 'Ironclad Heavy Machinery',
      serviceProduct: 'Equipment Leasing Tender CRM',
      contactPerson: 'Leon Kennedy',
      phone: '+1-555-012-3456',
      email: 'leon@ironcladequip.com',
      city: 'Detroit',
      state: 'MI',
      priority: 'MEDIUM' as Priority,
      pipelineStage: 'CONVERTED' as PipelineStage,
      callAttempts: 7,
      lastCallOutcome: 'CONNECTED' as CallOutcome,
      lastContactDate: pastDay(5),
      nextFollowUpDate: null,
      nextAction: 'Onboarding handover completed',
      notes: 'Closed by David Kim. Deal value $36,000 paid annually upfront.',
      leadSource: 'Trade Show',
      assignedTelecallerId: 'usr_tele_2',
      assignedSalesmanId: 'usr_sales_1',
      createdById: 'usr_admin_1',
      createdAt: pastDay(35),
      updatedAt: pastDay(5),
      lastActivityAt: pastDay(5),
      convertedAt: pastDay(5),
      dealValue: 36000,
    },
    {
      id: 'lead_110',
      companyName: 'Jupiter Aerospace Sensors',
      serviceProduct: 'Defense Subcontracting Tracker',
      contactPerson: 'Arthur Pendelton',
      phone: '+1-555-123-9999',
      email: 'arthur@jupitersensors.com',
      city: 'Huntsville',
      state: 'AL',
      priority: 'LOW' as Priority,
      pipelineStage: 'LOST' as PipelineStage,
      callAttempts: 4,
      lastCallOutcome: 'NOT_INTERESTED' as CallOutcome,
      lastContactDate: pastDay(8),
      nextFollowUpDate: null,
      nextAction: null,
      notes: 'Budget cuts forced postponement of tender automation initiatives.',
      leadSource: 'Cold Outreach',
      assignedTelecallerId: 'usr_tele_2',
      assignedSalesmanId: 'usr_sales_2',
      createdById: 'usr_admin_1',
      createdAt: pastDay(28),
      updatedAt: pastDay(8),
      lastActivityAt: pastDay(8),
      lostReason: 'NO_BUDGET',
      lostNotes: 'Internal freeze on software procurement for FY2026.',
    },
  ];

  const activities: LeadActivity[] = [
    {
      id: 'act_1',
      leadId: 'lead_101',
      userId: 'usr_tele_1',
      type: 'CALL_LOGGED' as ActivityType,
      description: 'Priya Sharma logged call outcome: CONNECTED. Notes: Actively bidding on 3 defense sector tenders.',
      createdAt: pastDay(1),
    },
    {
      id: 'act_2',
      leadId: 'lead_102',
      userId: 'usr_tele_1',
      type: 'STAGE_CHANGED' as ActivityType,
      description: 'Stage changed to INTERESTED by Priya Sharma',
      createdAt: pastDay(2),
    },
    {
      id: 'act_3',
      leadId: 'lead_106',
      userId: 'usr_tele_1',
      type: 'LEAD_ASSIGNED' as ActivityType,
      description: 'Handed over to Salesman David Kim with handover summary: High-value $80k opportunity.',
      createdAt: pastDay(2),
    },
    {
      id: 'act_4',
      leadId: 'lead_109',
      userId: 'usr_sales_1',
      type: 'LEAD_CONVERTED' as ActivityType,
      description: 'Lead marked WON / CONVERTED with contract value $36,000 by David Kim.',
      createdAt: pastDay(5),
    },
  ];

  const assignmentHistories: LeadAssignmentHistory[] = [
    {
      id: 'asg_1',
      leadId: 'lead_106',
      assignedById: 'usr_tele_1',
      previousUserId: 'usr_tele_1',
      newUserId: 'usr_sales_1',
      roleType: 'SALESMAN',
      handoverSummary: 'Client ready for custom RFQ parsing demo. Enterprise team size.',
      createdAt: pastDay(2),
    },
  ];

  const callLogs: CallLog[] = [
    {
      id: 'call_1',
      leadId: 'lead_101',
      userId: 'usr_tele_1',
      outcome: 'CONNECTED' as CallOutcome,
      notes: 'Spoke with Robert. He handles civil supply bids. Very open to our compliance auto-check.',
      contactDate: pastDay(1),
      followUpNeeded: true,
      nextFollowUpDate: futureDay(1, 11),
      nextAction: 'Send pricing and compliance deck',
      durationSeconds: 380,
      createdAt: pastDay(1),
    },
    {
      id: 'call_2',
      leadId: 'lead_102',
      userId: 'usr_tele_1',
      outcome: 'INTERESTED' as CallOutcome,
      notes: 'Elena confirmed interest. Scheduled follow-up with executive board.',
      contactDate: pastDay(2),
      followUpNeeded: true,
      nextFollowUpDate: pastDay(0),
      nextAction: 'Confirm demo attendees from executive procurement committee',
      durationSeconds: 420,
      createdAt: pastDay(2),
    },
  ];

  const followUpTasks: FollowUpTask[] = [
    {
      id: 'task_1',
      leadId: 'lead_102',
      assignedUserId: 'usr_tele_1',
      taskType: 'FOLLOW_UP' as TaskType,
      dueDate: pastDay(0).split('T')[0],
      dueTime: '11:00',
      notes: 'Follow up regarding procurement committee availability.',
      status: 'PENDING' as TaskStatus,
      createdAt: pastDay(2),
      updatedAt: pastDay(2),
      isOverdue: false,
    },
    {
      id: 'task_2',
      leadId: 'lead_101',
      assignedUserId: 'usr_tele_1',
      taskType: 'CALL' as TaskType,
      dueDate: futureDay(1).split('T')[0],
      dueTime: '14:30',
      notes: 'Discuss technical proposal with Robert.',
      status: 'PENDING' as TaskStatus,
      createdAt: pastDay(1),
      updatedAt: pastDay(1),
      isOverdue: false,
    },
    {
      id: 'task_3',
      leadId: 'lead_107',
      assignedUserId: 'usr_sales_1',
      taskType: 'DEMO' as TaskType,
      dueDate: futureDay(2).split('T')[0],
      dueTime: '14:00',
      notes: 'Run full platform demo for Claire and telecom team.',
      status: 'PENDING' as TaskStatus,
      createdAt: pastDay(3),
      updatedAt: pastDay(3),
      isOverdue: false,
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      userId: 'usr_tele_1',
      title: 'Follow-up Due Today',
      message: 'Follow-up scheduled with Elena Rostova (BluePeak Healthcare Infrastructure)',
      type: 'UPCOMING_TASK',
      isRead: false,
      link: '/leads/lead_102',
      createdAt: pastDay(0),
    },
    {
      id: 'notif_2',
      userId: 'usr_sales_1',
      title: 'New Lead Assigned',
      message: 'Priya Sharma transferred Fortress Cyber Defense Ltd ($80k opportunity) to you.',
      type: 'LEAD_ASSIGNMENT',
      isRead: false,
      link: '/leads/lead_106',
      createdAt: pastDay(2),
    },
  ];

  return {
    users,
    leads,
    activities,
    assignmentHistories,
    callLogs,
    followUpTasks,
    notifications,
    customOptions: {
      priorities: [],
      callOutcomes: [],
    },
  };
}

class StoreManager {
  private data: DataStore;
  private lastMtime: number = 0;
  private lastCheckTime: number = 0;
  private lastRuleRunTime: number = 0;

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
        if (migrated) {
          this.saveData(store);
        }
        return store;
      }
    } catch (err) {
      console.warn('[StoreManager] Could not read local file store, resetting to initial seed.');
    }
    const seed = generateInitialSeed();
    this.saveData(seed);
    return seed;
  }

  /**
   * Rule 5: Automatic Follow-up & Return-to-Fresh Rules
   * - No Answer / Ringing or Busy / Declined returns to New Fresh Leads on 3rd calendar day after call
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

      const isRetryOutcome =
        lead.lastCallOutcome === 'No Answer' ||
        lead.lastCallOutcome === 'Busy' ||
        lead.lastCallOutcome === 'Call Cut' ||
        lead.pipelineStage === 'No Answer / Ringing' ||
        lead.pipelineStage === 'Busy / Declined';

      if (isRetryOutcome && lead.lastContactDate && lead.pipelineStage !== 'New Lead' && lead.pipelineStage !== 'Closed') {
        const callDate = new Date(lead.lastContactDate);
        const callDateStr = callDate.toISOString().split('T')[0];
        const diffMs = new Date(todayStr).getTime() - new Date(callDateStr).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= 3) {
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
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
}

export const dbStore = new StoreManager();
