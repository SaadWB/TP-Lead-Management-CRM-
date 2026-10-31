"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPORT_TEMPLATE_COLUMNS = exports.DEFAULT_LEAD_SOURCE_LIST = exports.DEFAULT_LEAD_SOURCES = exports.ACTIVITY_TYPES = exports.LOST_REASONS = exports.TASK_STATUSES = exports.TASK_TYPES = exports.TELECALLER_KANBAN_COLUMNS = exports.SALES_STAGE_OPTIONS = exports.SALES_STAGES = exports.PRIORITIES = exports.CALL_OUTCOME_LIST = exports.TELECALLER_CALL_OUTCOMES = exports.CALL_OUTCOMES = exports.PIPELINE_STAGE_LIST = exports.PIPELINE_STAGES = exports.USER_ROLES = void 0;
exports.getSuggestedPipelineForOutcome = getSuggestedPipelineForOutcome;
exports.normalizeCallOutcome = normalizeCallOutcome;
exports.USER_ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    TELECALLER: 'TELECALLER',
    SALESMAN: 'SALESMAN',
};
exports.PIPELINE_STAGES = {
    NEW_LEAD: 'New Lead',
    ATTEMPTING_CONTACT: 'Attempting Contact',
    CONNECTED: 'Connected',
    FOLLOW_UP: 'Follow-up',
    DEMO: 'Demo',
    CLOSED: 'Closed',
};
exports.PIPELINE_STAGE_LIST = Object.values(exports.PIPELINE_STAGES);
exports.CALL_OUTCOMES = {
    NO_ANSWER: 'No Answer',
    BUSY: 'Busy',
    CALL_CUT: 'Call Cut',
    CALL_BACK_LATER: 'Call Back Later',
    CONNECTED_DISCUSSED: 'Connected – Discussed',
    DETAILS_REQUESTED: 'Details Requested',
    DEMO_INTERESTED: 'Demo Interested',
    DEMO_SCHEDULED: 'Demo Scheduled',
    DEMO_COMPLETED: 'Demo Completed',
    DECISION_PENDING: 'Decision Pending',
    NOT_INTERESTED: 'Not Interested',
    WRONG_NUMBER: 'Wrong Number',
    // Backward-compatible aliases
    NEW_LEAD: 'New Lead',
    CALLBACK_REQUESTED: 'Call Back Later',
    DETAILS_ON_WHATSAPP: 'Details Requested',
    DEMO_REQUESTED: 'Demo Interested',
    INTERESTED: 'Connected – Discussed',
    DISCUSSING: 'Connected – Discussed',
    INVALID_NUMBER: 'Wrong Number',
    DO_NOT_CONTACT: 'Not Interested',
    CLOSED: 'Closed',
    ASSIGN_TO_SALESMAN: 'Assign to Salesman',
};
exports.TELECALLER_CALL_OUTCOMES = [
    'No Answer',
    'Busy',
    'Call Cut',
    'Call Back Later',
    'Connected – Discussed',
    'Details Requested',
    'Demo Interested',
    'Demo Scheduled',
    'Demo Completed',
    'Decision Pending',
    'Not Interested',
    'Wrong Number',
];
exports.CALL_OUTCOME_LIST = Object.values(exports.CALL_OUTCOMES);
exports.PRIORITIES = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
};
exports.SALES_STAGES = {
    ASSIGNED: 'ASSIGNED',
    DEMO_SCHEDULED: 'DEMO_SCHEDULED',
    DEMO_COMPLETED: 'DEMO_COMPLETED',
    FOLLOW_UP_REQUIRED: 'FOLLOW_UP_REQUIRED',
    QUALIFIED: 'QUALIFIED',
    NEGOTIATION: 'NEGOTIATION',
    CONVERTED: 'CONVERTED',
    LOST: 'LOST',
    ON_HOLD: 'ON_HOLD',
};
exports.SALES_STAGE_OPTIONS = [
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
exports.TELECALLER_KANBAN_COLUMNS = [
    { id: 'New Lead', title: 'New Lead', color: 'blue', description: 'Lead added, no contact attempt yet' },
    { id: 'Attempting Contact', title: 'Attempting Contact', color: 'amber', description: 'Trying to reach, no meaningful conversation yet' },
    { id: 'Connected', title: 'Connected', color: 'sky', description: 'Spoke to prospect, need or next step not clear yet' },
    { id: 'Follow-up', title: 'Follow-up', color: 'purple', description: 'Need to contact again for call, feedback, details, or decision' },
    { id: 'Demo', title: 'Demo', color: 'indigo', description: 'Demo process started (scheduled, confirmation, or post-demo)' },
    { id: 'Closed', title: 'Closed', color: 'slate', description: 'Active process ended (Converted, Not Interested, Invalid, Nurture)' },
];
function getSuggestedPipelineForOutcome(outcome) {
    if (!outcome)
        return 'New Lead';
    const norm = normalizeCallOutcome(outcome);
    switch (norm) {
        case 'No Answer':
        case 'Call Cut':
            return 'Attempting Contact';
        case 'Busy':
        case 'Call Back Later':
        case 'Details Requested':
        case 'Demo Interested':
        case 'Demo Completed':
        case 'Decision Pending':
            return 'Follow-up';
        case 'Connected – Discussed':
            return 'Connected';
        case 'Demo Scheduled':
            return 'Demo';
        case 'Not Interested':
        case 'Wrong Number':
            return 'Closed';
        default:
            return 'Follow-up';
    }
}
function normalizeCallOutcome(raw) {
    if (!raw)
        return '';
    const val = raw.trim();
    if (exports.TELECALLER_CALL_OUTCOMES.includes(val)) {
        return val;
    }
    const lower = val.toLowerCase().replace(/[\/\-_]/g, ' ').replace(/\s+/g, ' ');
    if (lower.includes('no answer') || lower.includes('ringing'))
        return 'No Answer';
    if (lower.includes('busy') || lower.includes('declined'))
        return 'Busy';
    if (lower.includes('cut'))
        return 'Call Cut';
    if (lower.includes('callback') || lower.includes('call back'))
        return 'Call Back Later';
    if (lower.includes('whatsapp') || lower.includes('details requested') || lower.includes('brochure'))
        return 'Details Requested';
    if (lower.includes('demo scheduled'))
        return 'Demo Scheduled';
    if (lower.includes('demo completed'))
        return 'Demo Completed';
    if (lower.includes('demo requested') || lower.includes('demo interested'))
        return 'Demo Interested';
    if (lower.includes('decision pending'))
        return 'Decision Pending';
    if (lower.includes('connected') || lower.includes('discussing') || lower.includes('interested'))
        return 'Connected – Discussed';
    if (lower.includes('not interested') || lower.includes('dnc') || lower.includes('do not contact'))
        return 'Not Interested';
    if (lower.includes('invalid') || lower.includes('wrong number'))
        return 'Wrong Number';
    if (lower === 'closed')
        return 'Closed';
    return val;
}
exports.TASK_TYPES = {
    CALL: 'CALL',
    FOLLOW_UP: 'FOLLOW_UP',
    DEMO: 'DEMO',
    MEETING: 'MEETING',
    OTHER: 'OTHER',
};
exports.TASK_STATUSES = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
};
exports.LOST_REASONS = {
    PRICE_TOO_HIGH: 'Price too high / Budget limitation',
    CHOSE_COMPETITOR: 'Chose competitor product',
    FEATURE_MISSING: 'Missing required feature or scope',
    NO_BUDGET: 'No active project budget',
    NOT_READY: 'Timing not right / Delayed to next quarter',
    UNRESPONSIVE: 'Unresponsive after multiple attempts',
    OTHER: 'Other reason',
};
exports.ACTIVITY_TYPES = {
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
};
exports.DEFAULT_LEAD_SOURCES = [
    'Website',
    'Referral',
    'Cold Call',
    'WhatsApp',
    'Social Media (Facebook / LinkedIn / Instagram)',
    'Exhibition / Event',
    'Tender Portal',
    'Existing Customer',
    'Other',
];
exports.DEFAULT_LEAD_SOURCE_LIST = Object.values(exports.DEFAULT_LEAD_SOURCES);
exports.IMPORT_TEMPLATE_COLUMNS = [
    'Company',
    'Service / Product',
    'Contact Person',
    'Phone',
    'Email',
    'Lead Source',
    'Priority',
    'Pipeline Stage',
    'Call Attempts',
    'Last Call Outcome',
    'Last Contact Date',
    'Next Follow-Up Date',
    'Next Action',
    'Notes/Objection',
];
