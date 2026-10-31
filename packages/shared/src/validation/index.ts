import { z } from 'zod';
import {
  USER_ROLES,
  PRIORITIES,
  SALES_STAGES,
  CALL_OUTCOMES,
  TASK_TYPES,
  TASK_STATUSES,
  LOST_REASONS,
} from '../constants';

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

export const passwordPolicySchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .refine((val) => /[A-Za-z]/.test(val), 'Password must contain at least one letter')
  .refine((val) => /\d/.test(val), 'Password must contain at least one number')
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase().trim()), 'This password is too common and insecure');

// Authentication Schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordPolicySchema,
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: passwordPolicySchema,
  role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.TELECALLER, USER_ROLES.SALESMAN]),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: passwordPolicySchema.optional(),
  role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.TELECALLER, USER_ROLES.SALESMAN]).optional(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Lead Schemas
// In Single-Lead creation: State and City removed; Lead Source & Lead Source Other added
export const createLeadSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  serviceProduct: z.string().min(1, 'Service or product is required'),
  contactPerson: z.string().optional().nullable().default(''),
  phone: z.string().min(7, 'A valid phone number is required'),
  email: z.string().email('Invalid email').optional().nullable(),
  alternatePhone: z.string().optional().nullable(),
  website: z.string().url('Invalid website URL').or(z.literal('')).optional().nullable(),
  priority: z.string().default(PRIORITIES.MEDIUM),
  pipelineStage: z.string().default('New Lead'),
  lastCallOutcome: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  leadSource: z.string().optional().nullable(),
  leadSourceOther: z.string().max(100, 'Other details must be at most 100 characters').optional().nullable(),
  assignedTelecallerId: z.string().optional().nullable(),
  assignedSalesmanId: z.string().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

export const updateStageSchema = z.object({
  pipelineStage: z.string().optional(),
  lastCallOutcome: z.string().optional().nullable(),
  nextFollowUpDate: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedSalesmanId: z.string().optional(),
  handoverSummary: z.string().optional(),
  meetingDate: z.string().optional(),
  dealValue: z.number().positive().optional(),
  lostReason: z.string().optional(),
  lostNotes: z.string().optional(),
});

export const updateSalesStageSchema = z.object({
  salesStage: z.enum([
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
  followUpDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  dealValue: z.number().positive().optional(),
  lostReason: z.string().optional(),
  lostNotes: z.string().optional(),
});

export const logCallSchema = z.object({
  outcome: z.string().min(1, 'Call outcome is required'),
  notes: z.string().default(''),
  contactDate: z.string().default(() => new Date().toISOString()),
  durationSeconds: z.number().int().nonnegative().optional(),
  followUpNeeded: z.boolean().optional().default(false),
  nextFollowUpDate: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  assignedSalesmanId: z.string().optional().nullable(),
  updateStageTo: z.string().optional(),
});

export const createFollowUpTaskSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  taskType: z.enum([
    TASK_TYPES.CALL,
    TASK_TYPES.FOLLOW_UP,
    TASK_TYPES.DEMO,
    TASK_TYPES.MEETING,
    TASK_TYPES.OTHER,
  ]),
  dueDate: z.string().min(1, 'Due date is required'),
  dueTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().optional(),
});

export const updateFollowUpTaskSchema = z.object({
  status: z.enum([TASK_STATUSES.PENDING, TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED]).optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  outcomeNotes: z.string().optional(),
});

export const assignLeadSchema = z.object({
  assignedUserId: z.string().min(1, 'Assignee ID is required'),
  roleType: z.enum(['TELECALLER', 'SALESMAN']),
  handoverSummary: z.string().optional(),
  scheduleDemo: z.boolean().optional(),
  demoDate: z.string().optional(),
});

export const bulkAssignLeadsSchema = z.object({
  leadIds: z.array(z.string()).min(1, 'At least one lead is required'),
  assignedUserId: z.string().min(1, 'Assignee ID is required'),
  roleType: z.enum(['TELECALLER', 'SALESMAN']),
});

export const importCommitSchema = z.object({
  fileName: z.string(),
  records: z.array(
    z.object({
      companyName: z.string(),
      serviceProduct: z.string(),
      contactPerson: z.string().optional().nullable().default(''),
      phone: z.string(),
      email: z.string().optional().nullable(),
      alternatePhone: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      leadSource: z.string().optional().nullable(),
      leadSourceOther: z.string().optional().nullable(),
      priority: z.string().default(PRIORITIES.MEDIUM),
      pipelineStage: z.string().default(CALL_OUTCOMES.NEW_LEAD),
      callAttempts: z.number().default(0),
      lastCallOutcome: z.string().optional().nullable(),
      lastContactDate: z.string().optional().nullable(),
      nextFollowUpDate: z.string().optional().nullable(),
      nextAction: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      assignedTelecallerId: z.string().optional().nullable(),
      action: z.enum(['IMPORT', 'UPDATE', 'SKIP']).default('IMPORT'),
      matchedExistingId: z.string().optional(),
    })
  ),
  distributionMethod: z.enum(['MANUAL', 'EVEN']),
  selectedTelecallerIds: z.array(z.string()).optional(),
});

export const bulkPrioritySchema = z.object({
  leadIds: z.array(z.string()).min(1, 'At least one lead ID is required'),
  priority: z.enum([PRIORITIES.LOW, PRIORITIES.MEDIUM, PRIORITIES.HIGH, PRIORITIES.URGENT]),
});

export const bulkDeleteSchema = z.object({
  leadIds: z.array(z.string()).min(1, 'At least one lead ID is required'),
});

export const createSourceSchema = z.object({
  name: z.string().min(1, 'Source name cannot be empty').max(100),
  color: z.string().optional().nullable(),
});
