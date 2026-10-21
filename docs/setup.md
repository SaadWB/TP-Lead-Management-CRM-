# Local Development & Setup Guide

This guide details the complete process for setting up and running the **TenderProcure Leads CRM** monorepo locally.

---

## 1. Prerequisites

- **Node.js**: v18.18+ or v20+ (Node v22+ supported)
- **npm**: v9+ or v10+
- **PostgreSQL**: (Optional for local test runner, required for production Neon / managed DB)

---

## 2. Project Architecture

```
leads-crm/
├── apps/
│   ├── web/        # Next.js 14 App Router frontend
│   └── api/        # Express.js REST API backend with layered architecture
├── packages/
│   └── shared/     # Cross-app TypeScript interfaces, Zod schemas, constants
├── prisma/         # PostgreSQL schema & seed script
└── docs/           # Documentation
```

---

## 3. Installation Steps

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Build the shared package:**
   ```bash
   npm run build --workspace=@crm/shared
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (copied from `.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tenderprocure_crm?schema=public"
   JWT_SECRET="super-secret-jwt-key-replace-in-production-min-32-chars-long"
   JWT_EXPIRES_IN="7d"
   CORS_ORIGIN="http://localhost:3000"
   RESEND_API_KEY="re_mock_placeholder"
   EMAIL_FROM="TenderProcure CRM <notifications@tenderprocure.com>"
   NEXT_PUBLIC_API_URL="http://localhost:5000"
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

---

## 4. Running the Development Servers

You can run both apps concurrently from the workspace root, or start them independently:

### Option A: Run Both Concurrently
```bash
npm run dev
```

### Option B: Run Express API and Next.js Web independently
In Terminal 1 (API Server on port 5000):
```bash
npm run dev:api
```

In Terminal 2 (Next.js Web on port 3000):
```bash
npm run dev:web
```

---

## 5. Development Credentials

The system comes pre-seeded with realistic test accounts for all three roles:

| Role | Email | Password | Primary Workspace |
|------|-------|----------|-------------------|
| **Super Admin** | `admin@tenderprocure.com` | `Password@123` | `/admin/dashboard` |
| **Telecaller** | `telecaller1@tenderprocure.com` | `Password@123` | `/telecaller/kanban` |
| **Salesman** | `sales1@tenderprocure.com` | `Password@123` | `/salesman/dashboard` |

> 💡 **Tip:** The login screen provides 1-click test buttons for all 3 roles, and the top bar has a quick role-switcher pill for rapid evaluation.

---

## 6. Running Automated Tests

Run unit and integration test suites:
```bash
npm run test --workspace=@crm/api
```
