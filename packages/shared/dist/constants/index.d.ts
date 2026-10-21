export declare const USER_ROLES: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly TELECALLER: "TELECALLER";
    readonly SALESMAN: "SALESMAN";
};
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export declare const CALL_OUTCOMES: {
    readonly NEW_LEAD: "New Lead";
    readonly NO_ANSWER: "No Answer / Ringing";
    readonly BUSY: "Busy / Declined";
    readonly CALLBACK_REQUESTED: "Callback Requested";
    readonly NOT_INTERESTED: "Not Interested";
    readonly DETAILS_ON_WHATSAPP: "Details on WhatsApp";
    readonly DEMO_REQUESTED: "Demo Requested";
    readonly INTERESTED: "Interested";
    readonly DISCUSSING: "Discussing";
    readonly INVALID_NUMBER: "Invalid / Wrong Number";
    readonly DO_NOT_CONTACT: "Do Not Contact";
    readonly CLOSED: "Closed";
    readonly ASSIGN_TO_SALESMAN: "Assign to Salesman";
};
export type CallOutcome = (typeof CALL_OUTCOMES)[keyof typeof CALL_OUTCOMES];
export declare const CALL_OUTCOME_LIST: ("New Lead" | "No Answer / Ringing" | "Busy / Declined" | "Callback Requested" | "Not Interested" | "Details on WhatsApp" | "Demo Requested" | "Interested" | "Discussing" | "Invalid / Wrong Number" | "Do Not Contact" | "Closed" | "Assign to Salesman")[];
export declare const PRIORITIES: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
    readonly URGENT: "URGENT";
};
export type Priority = (typeof PRIORITIES)[keyof typeof PRIORITIES] | string;
export declare const SALES_STAGES: {
    readonly ASSIGNED: "ASSIGNED";
    readonly DEMO_SCHEDULED: "DEMO_SCHEDULED";
    readonly DEMO_COMPLETED: "DEMO_COMPLETED";
    readonly FOLLOW_UP_REQUIRED: "FOLLOW_UP_REQUIRED";
    readonly QUALIFIED: "QUALIFIED";
    readonly NEGOTIATION: "NEGOTIATION";
    readonly CONVERTED: "CONVERTED";
    readonly LOST: "LOST";
    readonly ON_HOLD: "ON_HOLD";
};
export type SalesStage = (typeof SALES_STAGES)[keyof typeof SALES_STAGES];
export declare const SALES_STAGE_OPTIONS: {
    value: SalesStage;
    label: string;
    color: string;
}[];
export type PipelineStage = string;
export declare const TELECALLER_KANBAN_COLUMNS: {
    id: CallOutcome;
    title: string;
    color: string;
    description: string;
}[];
export declare function normalizeCallOutcome(raw: string | null | undefined): CallOutcome;
export declare const TASK_TYPES: {
    readonly CALL: "CALL";
    readonly FOLLOW_UP: "FOLLOW_UP";
    readonly DEMO: "DEMO";
    readonly MEETING: "MEETING";
    readonly OTHER: "OTHER";
};
export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];
export declare const TASK_STATUSES: {
    readonly PENDING: "PENDING";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
export declare const LOST_REASONS: {
    readonly PRICE_TOO_HIGH: "Price too high / Budget limitation";
    readonly CHOSE_COMPETITOR: "Chose competitor product";
    readonly FEATURE_MISSING: "Missing required feature or scope";
    readonly NO_BUDGET: "No active project budget";
    readonly NOT_READY: "Timing not right / Delayed to next quarter";
    readonly UNRESPONSIVE: "Unresponsive after multiple attempts";
    readonly OTHER: "Other reason";
};
export type LostReason = keyof typeof LOST_REASONS;
export declare const ACTIVITY_TYPES: {
    readonly LEAD_CREATED: "LEAD_CREATED";
    readonly LEAD_IMPORTED: "LEAD_IMPORTED";
    readonly LEAD_ASSIGNED: "LEAD_ASSIGNED";
    readonly LEAD_REASSIGNED: "LEAD_REASSIGNED";
    readonly STAGE_CHANGED: "STAGE_CHANGED";
    readonly CALL_LOGGED: "CALL_LOGGED";
    readonly NOTE_ADDED: "NOTE_ADDED";
    readonly FOLLOW_UP_SCHEDULED: "FOLLOW_UP_SCHEDULED";
    readonly FOLLOW_UP_COMPLETED: "FOLLOW_UP_COMPLETED";
    readonly DEMO_SCHEDULED: "DEMO_SCHEDULED";
    readonly DEMO_COMPLETED: "DEMO_COMPLETED";
    readonly LEAD_CONVERTED: "LEAD_CONVERTED";
    readonly LEAD_LOST: "LEAD_LOST";
};
export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];
export declare const IMPORT_TEMPLATE_COLUMNS: readonly ["Company", "Service / Product", "Contact Person", "Phone", "Email", "Priority", "Pipeline Stage", "Call Attempts", "Last Call Outcome", "Last Contact Date", "Next Follow-Up Date", "Next Action", "Notes/Objection"];
