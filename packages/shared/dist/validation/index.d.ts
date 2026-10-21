import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const createUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<["SUPER_ADMIN", "TELECALLER", "SALESMAN"]>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "TELECALLER" | "SALESMAN";
    isActive: boolean;
    password: string;
    phone?: string | null | undefined;
}, {
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "TELECALLER" | "SALESMAN";
    password: string;
    phone?: string | null | undefined;
    isActive?: boolean | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["SUPER_ADMIN", "TELECALLER", "SALESMAN"]>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
    role?: "SUPER_ADMIN" | "TELECALLER" | "SALESMAN" | undefined;
    phone?: string | null | undefined;
    isActive?: boolean | undefined;
    password?: string | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
    role?: "SUPER_ADMIN" | "TELECALLER" | "SALESMAN" | undefined;
    phone?: string | null | undefined;
    isActive?: boolean | undefined;
    password?: string | undefined;
}>;
export declare const createLeadSchema: z.ZodObject<{
    companyName: z.ZodString;
    serviceProduct: z.ZodString;
    contactPerson: z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    phone: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    alternatePhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    website: z.ZodNullable<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>>;
    city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    state: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    priority: z.ZodDefault<z.ZodString>;
    pipelineStage: z.ZodDefault<z.ZodString>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    leadSource: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assignedTelecallerId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assignedSalesmanId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    companyName: string;
    contactPerson: string | null;
    pipelineStage: string;
    serviceProduct: string;
    priority: string;
    email?: string | null | undefined;
    alternatePhone?: string | null | undefined;
    website?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    notes?: string | null | undefined;
    leadSource?: string | null | undefined;
    assignedTelecallerId?: string | null | undefined;
    assignedSalesmanId?: string | null | undefined;
}, {
    phone: string;
    companyName: string;
    serviceProduct: string;
    email?: string | null | undefined;
    contactPerson?: string | null | undefined;
    pipelineStage?: string | undefined;
    alternatePhone?: string | null | undefined;
    website?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    priority?: string | undefined;
    notes?: string | null | undefined;
    leadSource?: string | null | undefined;
    assignedTelecallerId?: string | null | undefined;
    assignedSalesmanId?: string | null | undefined;
}>;
export declare const updateLeadSchema: z.ZodObject<{
    companyName: z.ZodOptional<z.ZodString>;
    serviceProduct: z.ZodOptional<z.ZodString>;
    contactPerson: z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodString>>>>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    alternatePhone: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    website: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>>>;
    city: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    state: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    pipelineStage: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    leadSource: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    assignedTelecallerId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    assignedSalesmanId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    email?: string | null | undefined;
    phone?: string | undefined;
    companyName?: string | undefined;
    contactPerson?: string | null | undefined;
    pipelineStage?: string | undefined;
    serviceProduct?: string | undefined;
    alternatePhone?: string | null | undefined;
    website?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    priority?: string | undefined;
    notes?: string | null | undefined;
    leadSource?: string | null | undefined;
    assignedTelecallerId?: string | null | undefined;
    assignedSalesmanId?: string | null | undefined;
}, {
    email?: string | null | undefined;
    phone?: string | undefined;
    companyName?: string | undefined;
    contactPerson?: string | null | undefined;
    pipelineStage?: string | undefined;
    serviceProduct?: string | undefined;
    alternatePhone?: string | null | undefined;
    website?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    priority?: string | undefined;
    notes?: string | null | undefined;
    leadSource?: string | null | undefined;
    assignedTelecallerId?: string | null | undefined;
    assignedSalesmanId?: string | null | undefined;
}>;
export declare const updateStageSchema: z.ZodObject<{
    pipelineStage: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    assignedSalesmanId: z.ZodOptional<z.ZodString>;
    handoverSummary: z.ZodOptional<z.ZodString>;
    meetingDate: z.ZodOptional<z.ZodString>;
    dealValue: z.ZodOptional<z.ZodNumber>;
    lostReason: z.ZodOptional<z.ZodString>;
    lostNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pipelineStage: string;
    notes?: string | undefined;
    assignedSalesmanId?: string | undefined;
    dealValue?: number | undefined;
    lostReason?: string | undefined;
    lostNotes?: string | undefined;
    handoverSummary?: string | undefined;
    meetingDate?: string | undefined;
}, {
    pipelineStage: string;
    notes?: string | undefined;
    assignedSalesmanId?: string | undefined;
    dealValue?: number | undefined;
    lostReason?: string | undefined;
    lostNotes?: string | undefined;
    handoverSummary?: string | undefined;
    meetingDate?: string | undefined;
}>;
export declare const updateSalesStageSchema: z.ZodObject<{
    salesStage: z.ZodEnum<["ASSIGNED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "FOLLOW_UP_REQUIRED", "QUALIFIED", "NEGOTIATION", "CONVERTED", "LOST", "ON_HOLD"]>;
    followUpDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dealValue: z.ZodOptional<z.ZodNumber>;
    lostReason: z.ZodOptional<z.ZodString>;
    lostNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    salesStage: "ASSIGNED" | "DEMO_SCHEDULED" | "DEMO_COMPLETED" | "FOLLOW_UP_REQUIRED" | "QUALIFIED" | "NEGOTIATION" | "CONVERTED" | "LOST" | "ON_HOLD";
    notes?: string | null | undefined;
    dealValue?: number | undefined;
    lostReason?: string | undefined;
    lostNotes?: string | undefined;
    followUpDate?: string | null | undefined;
}, {
    salesStage: "ASSIGNED" | "DEMO_SCHEDULED" | "DEMO_COMPLETED" | "FOLLOW_UP_REQUIRED" | "QUALIFIED" | "NEGOTIATION" | "CONVERTED" | "LOST" | "ON_HOLD";
    notes?: string | null | undefined;
    dealValue?: number | undefined;
    lostReason?: string | undefined;
    lostNotes?: string | undefined;
    followUpDate?: string | null | undefined;
}>;
export declare const logCallSchema: z.ZodObject<{
    outcome: z.ZodString;
    notes: z.ZodDefault<z.ZodString>;
    contactDate: z.ZodDefault<z.ZodString>;
    durationSeconds: z.ZodOptional<z.ZodNumber>;
    followUpNeeded: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    nextFollowUpDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nextAction: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assignedSalesmanId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    updateStageTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes: string;
    outcome: string;
    contactDate: string;
    followUpNeeded: boolean;
    nextFollowUpDate?: string | null | undefined;
    nextAction?: string | null | undefined;
    assignedSalesmanId?: string | null | undefined;
    durationSeconds?: number | undefined;
    updateStageTo?: string | undefined;
}, {
    outcome: string;
    nextFollowUpDate?: string | null | undefined;
    nextAction?: string | null | undefined;
    notes?: string | undefined;
    assignedSalesmanId?: string | null | undefined;
    contactDate?: string | undefined;
    durationSeconds?: number | undefined;
    followUpNeeded?: boolean | undefined;
    updateStageTo?: string | undefined;
}>;
export declare const createFollowUpTaskSchema: z.ZodObject<{
    leadId: z.ZodString;
    taskType: z.ZodEnum<["CALL", "FOLLOW_UP", "DEMO", "MEETING", "OTHER"]>;
    dueDate: z.ZodString;
    dueTime: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assignedUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    leadId: string;
    taskType: "CALL" | "FOLLOW_UP" | "DEMO" | "MEETING" | "OTHER";
    dueDate: string;
    notes?: string | null | undefined;
    dueTime?: string | null | undefined;
    assignedUserId?: string | undefined;
}, {
    leadId: string;
    taskType: "CALL" | "FOLLOW_UP" | "DEMO" | "MEETING" | "OTHER";
    dueDate: string;
    notes?: string | null | undefined;
    dueTime?: string | null | undefined;
    assignedUserId?: string | undefined;
}>;
export declare const updateFollowUpTaskSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["PENDING", "COMPLETED", "CANCELLED"]>>;
    dueDate: z.ZodOptional<z.ZodString>;
    dueTime: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    outcomeNotes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    status?: "PENDING" | "COMPLETED" | "CANCELLED" | undefined;
    dueDate?: string | undefined;
    dueTime?: string | null | undefined;
    outcomeNotes?: string | undefined;
}, {
    notes?: string | null | undefined;
    status?: "PENDING" | "COMPLETED" | "CANCELLED" | undefined;
    dueDate?: string | undefined;
    dueTime?: string | null | undefined;
    outcomeNotes?: string | undefined;
}>;
export declare const assignLeadSchema: z.ZodObject<{
    assignedUserId: z.ZodString;
    roleType: z.ZodEnum<["TELECALLER", "SALESMAN"]>;
    handoverSummary: z.ZodOptional<z.ZodString>;
    scheduleDemo: z.ZodOptional<z.ZodBoolean>;
    demoDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assignedUserId: string;
    roleType: "TELECALLER" | "SALESMAN";
    handoverSummary?: string | undefined;
    scheduleDemo?: boolean | undefined;
    demoDate?: string | undefined;
}, {
    assignedUserId: string;
    roleType: "TELECALLER" | "SALESMAN";
    handoverSummary?: string | undefined;
    scheduleDemo?: boolean | undefined;
    demoDate?: string | undefined;
}>;
export declare const bulkAssignLeadsSchema: z.ZodObject<{
    leadIds: z.ZodArray<z.ZodString, "many">;
    assignedUserId: z.ZodString;
    roleType: z.ZodEnum<["TELECALLER", "SALESMAN"]>;
}, "strip", z.ZodTypeAny, {
    assignedUserId: string;
    roleType: "TELECALLER" | "SALESMAN";
    leadIds: string[];
}, {
    assignedUserId: string;
    roleType: "TELECALLER" | "SALESMAN";
    leadIds: string[];
}>;
export declare const importCommitSchema: z.ZodObject<{
    fileName: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
        companyName: z.ZodString;
        serviceProduct: z.ZodString;
        contactPerson: z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
        phone: z.ZodString;
        email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        alternatePhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        website: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        state: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        priority: z.ZodDefault<z.ZodString>;
        pipelineStage: z.ZodDefault<z.ZodString>;
        callAttempts: z.ZodDefault<z.ZodNumber>;
        lastCallOutcome: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        lastContactDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        nextFollowUpDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        nextAction: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        leadSource: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        assignedTelecallerId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        action: z.ZodDefault<z.ZodEnum<["IMPORT", "UPDATE", "SKIP"]>>;
        matchedExistingId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        companyName: string;
        contactPerson: string | null;
        pipelineStage: string;
        serviceProduct: string;
        priority: string;
        callAttempts: number;
        action: "IMPORT" | "SKIP" | "UPDATE";
        email?: string | null | undefined;
        alternatePhone?: string | null | undefined;
        website?: string | null | undefined;
        city?: string | null | undefined;
        state?: string | null | undefined;
        lastCallOutcome?: string | null | undefined;
        lastContactDate?: string | null | undefined;
        nextFollowUpDate?: string | null | undefined;
        nextAction?: string | null | undefined;
        notes?: string | null | undefined;
        leadSource?: string | null | undefined;
        assignedTelecallerId?: string | null | undefined;
        matchedExistingId?: string | undefined;
    }, {
        phone: string;
        companyName: string;
        serviceProduct: string;
        email?: string | null | undefined;
        contactPerson?: string | null | undefined;
        pipelineStage?: string | undefined;
        alternatePhone?: string | null | undefined;
        website?: string | null | undefined;
        city?: string | null | undefined;
        state?: string | null | undefined;
        priority?: string | undefined;
        callAttempts?: number | undefined;
        lastCallOutcome?: string | null | undefined;
        lastContactDate?: string | null | undefined;
        nextFollowUpDate?: string | null | undefined;
        nextAction?: string | null | undefined;
        notes?: string | null | undefined;
        leadSource?: string | null | undefined;
        assignedTelecallerId?: string | null | undefined;
        action?: "IMPORT" | "SKIP" | "UPDATE" | undefined;
        matchedExistingId?: string | undefined;
    }>, "many">;
    distributionMethod: z.ZodEnum<["MANUAL", "EVEN"]>;
    selectedTelecallerIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    records: {
        phone: string;
        companyName: string;
        contactPerson: string | null;
        pipelineStage: string;
        serviceProduct: string;
        priority: string;
        callAttempts: number;
        action: "IMPORT" | "SKIP" | "UPDATE";
        email?: string | null | undefined;
        alternatePhone?: string | null | undefined;
        website?: string | null | undefined;
        city?: string | null | undefined;
        state?: string | null | undefined;
        lastCallOutcome?: string | null | undefined;
        lastContactDate?: string | null | undefined;
        nextFollowUpDate?: string | null | undefined;
        nextAction?: string | null | undefined;
        notes?: string | null | undefined;
        leadSource?: string | null | undefined;
        assignedTelecallerId?: string | null | undefined;
        matchedExistingId?: string | undefined;
    }[];
    distributionMethod: "MANUAL" | "EVEN";
    selectedTelecallerIds?: string[] | undefined;
}, {
    fileName: string;
    records: {
        phone: string;
        companyName: string;
        serviceProduct: string;
        email?: string | null | undefined;
        contactPerson?: string | null | undefined;
        pipelineStage?: string | undefined;
        alternatePhone?: string | null | undefined;
        website?: string | null | undefined;
        city?: string | null | undefined;
        state?: string | null | undefined;
        priority?: string | undefined;
        callAttempts?: number | undefined;
        lastCallOutcome?: string | null | undefined;
        lastContactDate?: string | null | undefined;
        nextFollowUpDate?: string | null | undefined;
        nextAction?: string | null | undefined;
        notes?: string | null | undefined;
        leadSource?: string | null | undefined;
        assignedTelecallerId?: string | null | undefined;
        action?: "IMPORT" | "SKIP" | "UPDATE" | undefined;
        matchedExistingId?: string | undefined;
    }[];
    distributionMethod: "MANUAL" | "EVEN";
    selectedTelecallerIds?: string[] | undefined;
}>;
export declare const bulkPrioritySchema: z.ZodObject<{
    leadIds: z.ZodArray<z.ZodString, "many">;
    priority: z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>;
}, "strip", z.ZodTypeAny, {
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    leadIds: string[];
}, {
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    leadIds: string[];
}>;
export declare const bulkDeleteSchema: z.ZodObject<{
    leadIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    leadIds: string[];
}, {
    leadIds: string[];
}>;
