# TenderProcure Leads & Sales CRM

A production-grade, full-stack Sales and Lead Management System designed for high-velocity telecalling teams, enterprise demos, and sales closers. Inspired by the best workflow principles of Zoho CRM and Odoo CRM with a clean, executive interface.

---

## 🌟 Key Features

1. **Role-Based Workspaces & RBAC**:
   - **Super Admin**: Centralized KPI command center, Excel/CSV bulk import wizard, duplicate detection review, balanced telecaller quota distribution, user management, and CSV reporting.
   - **Telecaller**: **High-Velocity Drag-and-Drop Kanban Board** (primary workspace) powered by `@dnd-kit`, single-click click-to-call, manual call logging (outcomes, notes, attempts counter), scheduled follow-ups, and sales closer handover.
   - **Salesman**: Dedicated sales pipeline, review telecaller handover briefs, manage live demos and RFP meetings, update sales stages, mark won (with deal value) or lost (with mandatory reason).

2. **Drag-and-Drop Kanban Board**:
   - Primary telecaller interface with status columns: *New, Contact Attempted, Connected, Interested, Follow-up Scheduled, Demo/Meeting Required, Assigned to Salesman, Not Interested*.
   - Optimistic UI updates with rollback on backend failure.
   - Integrated sales handover modal when moved to Demo or Salesman.
   - Accessible keyboard-friendly quick status dropdown alternative.

3. **6-Step Bulk Excel/CSV Import Wizard**:
   - Formats: `.xlsx` and `.csv`.
   - Live preview of workbook sheets and rows.
   - Column mapping with automatic header detection.
   - Pre-import duplicate detection against database records and batch file.
   - Side-by-side duplicate review screen with resolution options (*Skip, Update Existing, Import Separate*).
   - Telecaller quota allocation (round-robin balanced or designated single queue).
   - Downloadable standard spreadsheet template.

4. **Lead Details Drawer & Activity Timeline**:
   - Company information, contact details, calling logs with durations, pending/overdue tasks, chronological notes archive, and an end-to-end activity timeline.

5. **Security & Data Isolation**:
   - Strict server-side permission checks preventing unauthorized access.
   - Password hashing with bcrypt, JWT token authentication, secure HTTP-only cookies.
   - Standardized REST API (`/api/v1`) with Zod schema validation.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
npm run build --workspace=@crm/shared
npm run prisma:generate
```

### 2. Run the Development Servers
```bash
# Start both API and Web concurrently:
npm run dev

# Or run separately:
npm run dev:api   # Express REST API on http://localhost:5000
npm run dev:web   # Next.js Web on http://localhost:3000
```

### 3. Demo Login Credentials
| Role | Email | Password | Primary Workspace |
|------|-------|----------|-------------------|
| **Super Admin** | `admin@tenderprocure.com` | `Password@123` | `/admin/dashboard` |
| **Telecaller** | `telecaller1@tenderprocure.com` | `Password@123` | `/telecaller/kanban` |
| **Salesman** | `sales1@tenderprocure.com` | `Password@123` | `/salesman/dashboard` |

> *Fast Demo Login:* The login page and the top bar both include 1-click test buttons to instantly switch between Admin, Telecaller, and Salesman.

---

## 🧪 Testing

Run automated unit and integration tests:
```bash
npm run test --workspace=@crm/api
```

---

## 📚 Documentation

- [Setup Guide](docs/setup.md)
- [REST API Reference](docs/api.md)
- [Production Deployment Guide](docs/deployment.md)
