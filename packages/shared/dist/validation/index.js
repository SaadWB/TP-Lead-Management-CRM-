"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceSchema = exports.bulkDeleteSchema = exports.bulkPrioritySchema = exports.importCommitSchema = exports.bulkAssignLeadsSchema = exports.assignLeadSchema = exports.updateFollowUpTaskSchema = exports.createFollowUpTaskSchema = exports.logCallSchema = exports.updateSalesStageSchema = exports.updateStageSchema = exports.updateLeadSchema = exports.createLeadSchema = exports.updateUserSchema = exports.createUserSchema = exports.changePasswordSchema = exports.loginSchema = exports.passwordPolicySchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
const COMMON_PASSWORDS = new Set([
    'password',
    'password123',
    'password@123',
    'admin',
    'admin123',
    'admin12345',
    '1234567890',
    '123456789',
    '12345678',
    'qwertyuiop',
    'letmein123',
    'welcome123',
    'tenderprocure',
    'tpadmin123',
]);
exports.passwordPolicySchema = zod_1.z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .refine((val) => /[A-Za-z]/.test(val), 'Password must contain at least one letter')
    .refine((val) => /\d/.test(val), 'Password must contain at least one number')
    .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase().trim()), 'This password is too common and insecure');
// Authentication Schemas
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: exports.passwordPolicySchema,
});
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: exports.passwordPolicySchema,
    role: zod_1.z.enum([constants_1.USER_ROLES.SUPER_ADMIN, constants_1.USER_ROLES.TELECALLER, constants_1.USER_ROLES.SALESMAN]),
    phone: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    password: exports.passwordPolicySchema.optional(),
    role: zod_1.z.enum([constants_1.USER_ROLES.SUPER_ADMIN, constants_1.USER_ROLES.TELECALLER, constants_1.USER_ROLES.SALESMAN]).optional(),
    phone: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// Lead Schemas
// In Single-Lead creation: State and City removed; Lead Source & Lead Source Other added
exports.createLeadSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2, 'Company name is required'),
    serviceProduct: zod_1.z.string().min(1, 'Service or product is required'),
    contactPerson: zod_1.z.string().optional().nullable().default(''),
    phone: zod_1.z.string().min(7, 'A valid phone number is required'),
    email: zod_1.z.string().email('Invalid email').optional().nullable(),
    alternatePhone: zod_1.z.string().optional().nullable(),
    website: zod_1.z.string().url('Invalid website URL').or(zod_1.z.literal('')).optional().nullable(),
    priority: zod_1.z.string().default(constants_1.PRIORITIES.MEDIUM),
    pipelineStage: zod_1.z.string().default('New Lead'),
    lastCallOutcome: zod_1.z.string().optional().nullable(),
    nextFollowUpDate: zod_1.z.string().optional().nullable(),
    nextAction: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    leadSource: zod_1.z.string().optional().nullable(),
    leadSourceOther: zod_1.z.string().max(100, 'Other details must be at most 100 characters').optional().nullable(),
    assignedTelecallerId: zod_1.z.string().optional().nullable(),
    assignedSalesmanId: zod_1.z.string().optional().nullable(),
});
exports.updateLeadSchema = exports.createLeadSchema.partial().extend({
    city: zod_1.z.string().optional().nullable(),
    state: zod_1.z.string().optional().nullable(),
});
exports.updateStageSchema = zod_1.z.object({
    pipelineStage: zod_1.z.string().optional(),
    lastCallOutcome: zod_1.z.string().optional().nullable(),
    nextFollowUpDate: zod_1.z.string().optional().nullable(),
    nextAction: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    assignedSalesmanId: zod_1.z.string().optional(),
    handoverSummary: zod_1.z.string().optional(),
    meetingDate: zod_1.z.string().optional(),
    dealValue: zod_1.z.number().positive().optional(),
    lostReason: zod_1.z.string().optional(),
    lostNotes: zod_1.z.string().optional(),
});
exports.updateSalesStageSchema = zod_1.z.object({
    salesStage: zod_1.z.enum([
        'ASSIGNED',
        'DEMO_SCHEDULED',
        'DEMO_COMPLETED',
        'FOLLOW_UP_REQUIRED',
        'QUALIFIED',
        'NEGOTIATION',
        'CONVERTED',
        'LOST',
        'ON_HOLD',
    ]),
    followUpDate: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    dealValue: zod_1.z.number().positive().optional(),
    lostReason: zod_1.z.string().optional(),
    lostNotes: zod_1.z.string().optional(),
});
exports.logCallSchema = zod_1.z.object({
    outcome: zod_1.z.string().min(1, 'Call outcome is required'),
    notes: zod_1.z.string().default(''),
    contactDate: zod_1.z.string().default(() => new Date().toISOString()),
    durationSeconds: zod_1.z.number().int().nonnegative().optional(),
    followUpNeeded: zod_1.z.boolean().optional().default(false),
    nextFollowUpDate: zod_1.z.string().optional().nullable(),
    nextAction: zod_1.z.string().optional().nullable(),
    assignedSalesmanId: zod_1.z.string().optional().nullable(),
    updateStageTo: zod_1.z.string().optional(),
});
exports.createFollowUpTaskSchema = zod_1.z.object({
    leadId: zod_1.z.string().min(1, 'Lead ID is required'),
    taskType: zod_1.z.enum([
        constants_1.TASK_TYPES.CALL,
        constants_1.TASK_TYPES.FOLLOW_UP,
        constants_1.TASK_TYPES.DEMO,
        constants_1.TASK_TYPES.MEETING,
        constants_1.TASK_TYPES.OTHER,
    ]),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
    dueTime: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    assignedUserId: zod_1.z.string().optional(),
});
exports.updateFollowUpTaskSchema = zod_1.z.object({
    status: zod_1.z.enum([constants_1.TASK_STATUSES.PENDING, constants_1.TASK_STATUSES.COMPLETED, constants_1.TASK_STATUSES.CANCELLED]).optional(),
    dueDate: zod_1.z.string().optional(),
    dueTime: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    outcomeNotes: zod_1.z.string().optional(),
});
exports.assignLeadSchema = zod_1.z.object({
    assignedUserId: zod_1.z.string().min(1, 'Assignee ID is required'),
    roleType: zod_1.z.enum(['TELECALLER', 'SALESMAN']),
    handoverSummary: zod_1.z.string().optional(),
    scheduleDemo: zod_1.z.boolean().optional(),
    demoDate: zod_1.z.string().optional(),
});
exports.bulkAssignLeadsSchema = zod_1.z.object({
    leadIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one lead is required'),
    assignedUserId: zod_1.z.string().min(1, 'Assignee ID is required'),
    roleType: zod_1.z.enum(['TELECALLER', 'SALESMAN']),
});
exports.importCommitSchema = zod_1.z.object({
    fileName: zod_1.z.string(),
    records: zod_1.z.array(zod_1.z.object({
        companyName: zod_1.z.string(),
        serviceProduct: zod_1.z.string(),
        contactPerson: zod_1.z.string().optional().nullable().default(''),
        phone: zod_1.z.string(),
        email: zod_1.z.string().optional().nullable(),
        alternatePhone: zod_1.z.string().optional().nullable(),
        website: zod_1.z.string().optional().nullable(),
        city: zod_1.z.string().optional().nullable(),
        state: zod_1.z.string().optional().nullable(),
        leadSource: zod_1.z.string().optional().nullable(),
        leadSourceOther: zod_1.z.string().optional().nullable(),
        priority: zod_1.z.string().default(constants_1.PRIORITIES.MEDIUM),
        pipelineStage: zod_1.z.string().default(constants_1.CALL_OUTCOMES.NEW_LEAD),
        callAttempts: zod_1.z.number().default(0),
        lastCallOutcome: zod_1.z.string().optional().nullable(),
        lastContactDate: zod_1.z.string().optional().nullable(),
        nextFollowUpDate: zod_1.z.string().optional().nullable(),
        nextAction: zod_1.z.string().optional().nullable(),
        notes: zod_1.z.string().optional().nullable(),
        assignedTelecallerId: zod_1.z.string().optional().nullable(),
        action: zod_1.z.enum(['IMPORT', 'UPDATE', 'SKIP']).default('IMPORT'),
        matchedExistingId: zod_1.z.string().optional(),
    })),
    distributionMethod: zod_1.z.enum(['MANUAL', 'EVEN']),
    selectedTelecallerIds: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.bulkPrioritySchema = zod_1.z.object({
    leadIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one lead ID is required'),
    priority: zod_1.z.enum([constants_1.PRIORITIES.LOW, constants_1.PRIORITIES.MEDIUM, constants_1.PRIORITIES.HIGH, constants_1.PRIORITIES.URGENT]),
});
exports.bulkDeleteSchema = zod_1.z.object({
    leadIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one lead ID is required'),
});
exports.createSourceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Source name cannot be empty').max(100),
    color: zod_1.z.string().optional().nullable(),
});
