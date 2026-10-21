# REST API Documentation (v1)

Base URL: `http://localhost:5000/api/v1`

All responses follow a consistent envelope structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message",
  "meta": { "total": 100, "page": 1, "limit": 50 }
}
```

---

## 1. Authentication (`/auth`)

### `POST /auth/login`
- **Body:** `{ "email": "admin@tenderprocure.com", "password": "Password@123" }`
- **Response:** `{ user: User, token: string }`

### `GET /auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response:** Authenticated user profile with active lead counts.

### `POST /auth/logout`
- Clears session cookie.

---

## 2. Lead Management (`/leads`)

Role Scoping:
- **SUPER_ADMIN**: Global access across all leads.
- **TELECALLER**: Access restricted to leads where `assignedTelecallerId == user.id`.
- **SALESMAN**: Access restricted to leads where `assignedSalesmanId == user.id`.

### `GET /leads`
- **Query Params:** `search`, `pipelineStage`, `priority`, `assignedTelecallerId`, `assignedSalesmanId`, `isUnassigned`, `followUpStatus` (`TODAY` | `OVERDUE`), `page`, `limit`
- **Response:** Paginated list of enriched leads with call logs, follow-up tasks, activities, and assignment history.

### `GET /leads/:id`
- Returns individual lead detail. Enforces role-based isolation.

### `POST /leads`
- **Body:** `{ companyName, serviceProduct, contactPerson, phone, email, priority, notes }`
- Creates lead and logs activity.

### `PATCH /leads/:id`
- Updates lead fields and appends audit notes.

### `POST /leads/:id/stage`
- Updates pipeline stage.
- **Body:**
  - `pipelineStage` (required)
  - `assignedSalesmanId` (required when moving to `ASSIGNED_TO_SALESMAN`)
  - `handoverSummary` (handover notes for closer)
  - `meetingDate` (optional date to schedule demo)
  - `dealValue` (optional contract value when marking `CONVERTED`)
  - `lostReason` (mandatory when marking `LOST`)
  - `lostNotes` (context for lost lead)

### `GET /leads/check-duplicate`
- **Query Params:** `phone`, `email`, `companyName`
- Returns duplicate matches against existing leads in the database.

---

## 3. Manual Calling (`/calls`)

### `POST /calls/lead/:leadId`
- **Body:**
  - `outcome`: `CONNECTED` | `NO_ANSWER` | `BUSY` | `CALL_BACK_REQUESTED` | `INTERESTED` | `NOT_INTERESTED` | `INVALID_NUMBER` | `DO_NOT_CONTACT`
  - `notes`: Call summary
  - `durationSeconds`: Call duration in seconds
  - `contactDate`: ISO timestamp
  - `followUpNeeded`: boolean
  - `nextFollowUpDate`: ISO timestamp
  - `nextAction`: string
  - `updateStageTo`: optional pipeline stage transition
- Increments `callAttempts`, updates `lastCallOutcome`, updates `lastContactDate`, creates `CallLog`, creates `FollowUpTask` if requested, and appends `LeadActivity`.

---

## 4. Tasks & Follow-ups (`/tasks`)

### `GET /tasks`
- **Query Params:** `timeFilter` (`TODAY` | `OVERDUE` | `UPCOMING` | `ALL`), `status` (`PENDING` | `COMPLETED`), `taskType`

### `POST /tasks`
- **Body:** `{ leadId, taskType, dueDate, dueTime, notes }`

### `PATCH /tasks/:id`
- **Body:** `{ status: "COMPLETED", outcomeNotes: "..." }`

---

## 5. Bulk Excel/CSV Import (`/imports`)

*Super Admin Only*

### `POST /imports/upload`
- Multipart form data: `file` (.xlsx or .csv)
- Returns parsed sheet names, column headers, preview rows, and suggested auto-mapping.

### `POST /imports/validate`
- **Body:** `{ rows: [...], columnMapping: { ... } }`
- Validates rows, checks email/phone formatting, detects duplicates against DB and within the file, returns side-by-side comparison data.

### `POST /imports/commit`
- **Body:** `{ fileName, records: [...], distributionMethod: "EVEN"|"MANUAL", selectedTelecallerIds: [...] }`
- Imports approved records in database transaction, distributes quotas across telecallers, and returns summary report.

---

## 6. Reports & Analytics (`/reports`)

### `GET /reports/dashboard`
- Calculates all 12 core KPI metrics, stage distribution, telecaller conversion rates, and salesman deal values.

### `GET /reports/export`
- Streams full lead directory as an audited CSV file attachment.
