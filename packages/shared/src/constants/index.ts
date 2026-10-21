export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TELECALLER: 'TELECALLER',
  SALESMAN: 'SALESMAN',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const CALL_OUTCOMES = {
  NEW_LEAD: 'New Lead',
  NO_ANSWER: 'No Answer / Ringing',
  BUSY: 'Busy / Declined',
  CALLBACK_REQUESTED: 'Callback Requested',
  NOT_INTERESTED: 'Not Interested',
  DETAILS_ON_WHATSAPP: 'Details on WhatsApp',
  DEMO_REQUESTED: 'Demo Requested',
  INTERESTED: 'Interested',
  DISCUSSING: 'Discussing',
  INVALID_NUMBER: 'Invalid / Wrong Number',
  DO_NOT_CONTACT: 'Do Not Contact',
  CLOSED: 'Closed',
  ASSIGN_TO_SALESMAN: 'Assign to Salesman',
} as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[keyof typeof CALL_OUTCOMES];
export const CALL_OUTCOME_LIST = Object.values(CALL_OUTCOMES);

export const PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type Priority = (typeof PRIORITIES)[keyof typeof PRIORITIES] | string;


export const SALES_STAGES = {
  ASSIGNED: 'ASSIGNED',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  DEMO_COMPLETED: 'DEMO_COMPLETED',
  FOLLOW_UP_REQUIRED: 'FOLLOW_UP_REQUIRED',
  QUALIFIED: 'QUALIFIED',
  NEGOTIATION: 'NEGOTIATION',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
  ON_HOLD: 'ON_HOLD',
} as const;

export type SalesStage = (typeof SALES_STAGES)[keyof typeof SALES_STAGES];

export const SALES_STAGE_OPTIONS: { value: SalesStage; label: string; color: string }[] = [
  { value: 'ASSIGNED', label: 'Assigned', color: 'blue' },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled', color: 'purple' },
  { value: 'DEMO_COMPLETED', label: 'Demo Completed', color: 'indigo' },
  { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-up Required', color: 'amber' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'teal' },
  { value: 'NEGOTIATION', label: 'Negotiation', color: 'cyan' },
  { value: 'CONVERTED', label: 'Converted', color: 'emerald' },
  { value: 'LOST', label: 'Lost', color: 'rose' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'slate' },
];

export type PipelineStage = string;

export const TELECALLER_KANBAN_COLUMNS: { id: CallOutcome; title: string; color: string; description: string }[] = [
  { id: 'New Lead', title: 'New Lead', color: 'blue', description: 'Freshly uploaded or uncontacted leads' },
  { id: 'No Answer / Ringing', title: 'No Answer / Ringing', color: 'amber', description: 'Call placed but not answered' },
  { id: 'Busy / Declined', title: 'Busy / Declined', color: 'orange', description: 'Line engaged or call rejected' },
  { id: 'Callback Requested', title: 'Callback Requested', color: 'purple', description: 'Contact requested a callback at scheduled time' },
  { id: 'Not Interested', title: 'Not Interested', color: 'slate', description: 'Prospect declined offering' },
  { id: 'Details on WhatsApp', title: 'Details on WhatsApp', color: 'emerald', description: 'Info / brochure requested on WhatsApp' },
  { id: 'Demo Requested', title: 'Demo Requested', color: 'cyan', description: 'Prospect requested product demonstration' },
  { id: 'Interested', title: 'Interested', color: 'emerald', description: 'Prospect expressed positive interest' },
  { id: 'Discussing', title: 'Discussing', color: 'sky', description: 'Active preliminary discussions' },
  { id: 'Invalid / Wrong Number', title: 'Invalid / Wrong Number', color: 'rose', description: 'Wrong number or invalid contact' },
  { id: 'Do Not Contact', title: 'Do Not Contact', color: 'red', description: 'Explicit opt-out / DNC requested' },
  { id: 'Closed', title: 'Closed', color: 'indigo', description: 'Closed by telecaller' },
  { id: 'Assign to Salesman', title: 'Assign to Salesman', color: 'teal', description: 'Handed over to direct sales closer' },
];


export function normalizeCallOutcome(raw: string | null | undefined): CallOutcome {
  if (!raw) return 'New Lead';
  const val = raw.trim();
  if (CALL_OUTCOME_LIST.includes(val as CallOutcome)) {
    return val as CallOutcome;
  }
  const upper = val.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'NEW' || upper === 'NEW_LEAD') return 'New Lead';
  if (upper === 'CONTACT_ATTEMPTED' || upper === 'NO_ANSWER' || upper === 'NO_ANSWER_/_RINGING') return 'No Answer / Ringing';
  if (upper === 'BUSY' || upper === 'DECLINED' || upper === 'BUSY_/_DECLINED') return 'Busy / Declined';
  if (upper === 'CONNECTED' || upper === 'DETAILS_ON_WHATSAPP') return 'Details on WhatsApp';
  if (upper === 'CALL_BACK_REQUESTED' || upper === 'CALLBACK_REQUESTED' || upper === 'FOLLOW_UP_SCHEDULED') return 'Callback Requested';
  if (upper === 'DEMO_REQUESTED' || upper === 'DEMO_MEETING_REQUIRED') return 'Demo Requested';
  if (upper === 'INTERESTED') return 'Interested';
  if (upper === 'DISCUSSING') return 'Discussing';
  if (upper === 'NOT_INTERESTED') return 'Not Interested';
  if (upper === 'INVALID_CONTACT' || upper === 'INVALID_NUMBER' || upper === 'INVALID_/_WRONG_NUMBER') return 'Invalid / Wrong Number';
  if (upper === 'DO_NOT_CONTACT' || upper === 'DNC') return 'Do Not Contact';
  if (upper === 'CLOSED' || upper === 'CONVERTED') return 'Closed';
  if (upper === 'ASSIGNED_TO_SALESMAN' || upper === 'ASSIGN_TO_SALESMAN') return 'Assign to Salesman';
  return 'New Lead';
}

export const TASK_TYPES = {
  CALL: 'CALL',
  FOLLOW_UP: 'FOLLOW_UP',
  DEMO: 'DEMO',
  MEETING: 'MEETING',
  OTHER: 'OTHER',
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const TASK_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export const LOST_REASONS = {
  PRICE_TOO_HIGH: 'Price too high / Budget limitation',
  CHOSE_COMPETITOR: 'Chose competitor product',
  FEATURE_MISSING: 'Missing required feature or scope',
  NO_BUDGET: 'No active project budget',
  NOT_READY: 'Timing not right / Delayed to next quarter',
  UNRESPONSIVE: 'Unresponsive after multiple attempts',
  OTHER: 'Other reason',
} as const;

export type LostReason = keyof typeof LOST_REASONS;

export const ACTIVITY_TYPES = {
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_IMPORTED: 'LEAD_IMPORTED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_REASSIGNED: 'LEAD_REASSIGNED',
  STAGE_CHANGED: 'STAGE_CHANGED',
  CALL_LOGGED: 'CALL_LOGGED',
  NOTE_ADDED: 'NOTE_ADDED',
  FOLLOW_UP_SCHEDULED: 'FOLLOW_UP_SCHEDULED',
  FOLLOW_UP_COMPLETED: 'FOLLOW_UP_COMPLETED',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  DEMO_COMPLETED: 'DEMO_COMPLETED',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  LEAD_LOST: 'LEAD_LOST',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

export const IMPORT_TEMPLATE_COLUMNS = [
  'Company',
  'Service / Product',
  'Contact Person',
  'Phone',
  'Email',
  'Priority',
  'Pipeline Stage',
  'Call Attempts',
  'Last Call Outcome',
  'Last Contact Date',
  'Next Follow-Up Date',
  'Next Action',
  'Notes/Objection',
] as const;

