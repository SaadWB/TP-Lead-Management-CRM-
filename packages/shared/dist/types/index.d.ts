import { UserRole, PipelineStage, SalesStage, Priority, CallOutcome, TaskType, TaskStatus, ActivityType, LostReason } from '../constants';
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
        [key: string]: unknown;
    };
    errors?: unknown[];
}
export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        assignedTelecallerLeads?: number;
        assignedSalesmanLeads?: number;
        tasks?: number;
    };
}
export interface AuthSession {
    user: User;
    token: string;
}
export interface Lead {
    id: string;
    companyName: string;
    serviceProduct: string;
    contactPerson?: string | null;
    phone: string;
    email?: string | null;
    alternatePhone?: string | null;
    website?: string | null;
    city?: string | null;
    state?: string | null;
    priority: Priority;
    pipelineStage: PipelineStage;
    salesStage?: SalesStage | null;
    callAttempts: number;
    isRetry?: boolean;
    retryCount?: number;
    lastCallOutcome?: CallOutcome | null;
    lastContactDate?: string | null;
    lastStatusUpdatedAt?: string | null;
    nextFollowUpDate?: string | null;
    nextAction?: string | null;
    notes?: string | null;
    leadSource?: string | null;
    assignedTelecallerId?: string | null;
    assignedSalesmanId?: string | null;
    createdById?: string | null;
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string | null;
    convertedAt?: string | null;
    dealValue?: number | null;
    lostReason?: LostReason | null;
    lostNotes?: string | null;
    archivedAt?: string | null;
    assignedTelecaller?: Pick<User, 'id' | 'name' | 'email'> | null;
    assignedSalesman?: Pick<User, 'id' | 'name' | 'email'> | null;
    activities?: LeadActivity[];
    callLogs?: CallLog[];
    followUpTasks?: FollowUpTask[];
    assignmentHistories?: LeadAssignmentHistory[];
}
export interface LeadActivity {
    id: string;
    leadId: string;
    userId?: string | null;
    user?: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
    type: ActivityType;
    description: string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
}
export interface CallLog {
    id: string;
    leadId: string;
    userId: string;
    user?: Pick<User, 'id' | 'name' | 'email'> | null;
    outcome: CallOutcome;
    notes: string;
    contactDate: string;
    followUpNeeded: boolean;
    nextFollowUpDate?: string | null;
    nextAction?: string | null;
    durationSeconds?: number | null;
    createdAt: string;
}
export interface FollowUpTask {
    id: string;
    leadId: string;
    lead?: Pick<Lead, 'id' | 'companyName' | 'contactPerson' | 'phone' | 'pipelineStage'>;
    assignedUserId: string;
    assignedUser?: Pick<User, 'id' | 'name' | 'email'>;
    taskType: TaskType;
    dueDate: string;
    dueTime?: string | null;
    notes?: string | null;
    status: TaskStatus;
    completedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    isOverdue?: boolean;
}
export interface LeadAssignmentHistory {
    id: string;
    leadId: string;
    assignedById: string;
    assignedBy?: Pick<User, 'id' | 'name' | 'email'>;
    previousUserId?: string | null;
    previousUser?: Pick<User, 'id' | 'name' | 'email'> | null;
    newUserId: string;
    newUser?: Pick<User, 'id' | 'name' | 'email'>;
    roleType: 'TELECALLER' | 'SALESMAN';
    handoverSummary?: string | null;
    createdAt: string;
}
export interface NotificationItem {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    link?: string | null;
    createdAt: string;
}
export interface ImportPreviewRow {
    rowIndex: number;
    rawData: Record<string, string>;
    mapped: {
        companyName: string;
        serviceProduct: string;
        contactPerson: string;
        phone: string;
        email?: string;
        priority?: Priority;
        pipelineStage?: PipelineStage;
        callAttempts?: number;
        lastCallOutcome?: CallOutcome;
        lastContactDate?: string;
        nextFollowUpDate?: string;
        nextAction?: string;
        notes?: string;
        website?: string;
        city?: string;
        state?: string;
        leadSource?: string;
        alternatePhone?: string;
    };
    errors: string[];
    isValid: boolean;
    duplicateStatus?: 'NONE' | 'EXACT' | 'POTENTIAL';
    duplicateMatch?: {
        id: string;
        companyName: string;
        contactPerson: string;
        phone: string;
        email?: string | null;
        pipelineStage: PipelineStage;
        assignedTelecallerName?: string;
        reason: string;
    };
    resolution?: 'IMPORT' | 'SKIP' | 'UPDATE';
    assignedTelecallerId?: string;
}
export interface ImportDuplicateRecord {
    tempRowId: string;
    uploadedRecord: {
        companyName: string;
        contactPerson: string;
        phone: string;
        email?: string;
        serviceProduct: string;
    };
    existingRecord: {
        id: string;
        companyName: string;
        contactPerson: string;
        phone: string;
        email?: string | null;
        pipelineStage: string;
        telecallerName?: string;
    };
    matchingReason: string;
    recommendedAction: 'SKIP' | 'UPDATE' | 'IMPORT_SEPARATE';
    selectedAction: 'SKIP' | 'UPDATE' | 'IMPORT_SEPARATE';
}
export interface ImportSummary {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    recordsToImport: number;
    recordsToSkip: number;
    assignmentDistribution: {
        telecallerId: string;
        telecallerName: string;
        count: number;
    }[];
}
export interface DashboardMetrics {
    totalLeads: number;
    newLeads: number;
    unassignedLeads: number;
    leadsAssignedToTelecallers: number;
    leadsInProgress: number;
    interestedLeads: number;
    leadsAssignedToSalesmen: number;
    demosMeetingsScheduled: number;
    followUpsDueToday: number;
    overdueFollowUps: number;
    convertedLeads: number;
    lostLeads: number;
    conversionRate: number;
    stageDistribution: {
        stage: string;
        count: number;
        label: string;
        color: string;
    }[];
    priorityDistribution: {
        priority: string;
        count: number;
    }[];
    sourceDistribution: {
        source: string;
        count: number;
    }[];
    telecallerPerformance?: {
        userId: string;
        name: string;
        assignedCount: number;
        callsLogged: number;
        connectedCount: number;
        demosHandedOver: number;
    }[];
    salesmanPerformance?: {
        userId: string;
        name: string;
        assignedCount: number;
        demosScheduled: number;
        demosCompleted: number;
        convertedCount: number;
        lostCount: number;
        totalRevenue: number;
    }[];
    recentActivities: LeadActivity[];
    inactiveLeadsCount?: number;
}
export interface OutcomeBehaviorFlags {
    requiresDateTime?: boolean;
    requiresNextFollowUp?: boolean;
    closesLead?: boolean;
    autoReturnNewLeadsDays?: number | null;
}
export interface PipelineStageOption {
    id: string;
    name: string;
    color?: string;
    isDefault: boolean;
    isActive: boolean;
    order: number;
    leadCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface CallOutcomeOption {
    id: string;
    name: string;
    color?: string;
    suggestedPipelineStage?: string;
    flags: OutcomeBehaviorFlags;
    isDefault: boolean;
    isActive: boolean;
    order: number;
    leadCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface AuditLogItem {
    id: string;
    userId?: string | null;
    user?: {
        id: string;
        name: string;
        email: string;
        role?: string;
    } | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: Record<string, any> | null;
    createdAt: string;
}
