# Production Deployment Architecture Guide

The application consists of two independent services:
1. **Frontend**: Next.js App Router (deployed to **Vercel**)
2. **Backend**: Express.js REST API (deployed to **Render** or **Railway**)
3. **Database**: Managed PostgreSQL (**Neon** or **Supabase**)

> ⚠️ **Important:** Deploying the Next.js frontend to Vercel does **NOT** deploy the separate Express REST server. The frontend and backend must be configured and deployed independently.

---

## 1. Database Provisioning (Neon PostgreSQL)

1. Create a project at [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy your pooled connection string:
   ```env
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.region.neon.tech/neondb?sslmode=require"
   ```
3. Run the Prisma migration against your production database:
   ```bash
   npx prisma migrate deploy
   ```
4. (Optional) Run the seed script to initialize production baseline roles:
   ```bash
   npm run prisma:seed
   ```

---

## 2. Backend Deployment (Render or Railway)

### On Render / Railway:
1. Connect your Git repository.
2. Set Root Directory to workspace root or `apps/api`.
3. Configure Build and Start commands:
   - **Build Command:**
     ```bash
     npm install && npm run build --workspace=@crm/shared && npm run build --workspace=@crm/api && npx prisma generate
     ```
   - **Start Command:**
     ```bash
     npm run start --workspace=@crm/api
     ```
4. Set Environment Variables:
   - `PORT`: `5000` (or assigned by provider)
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `JWT_SECRET`: High-entropy 64-character secret key
   - `CORS_ORIGIN`: Your production Vercel frontend URL (e.g. `https://crm.tenderprocure.com`)
   - `RESEND_API_KEY`: Production Resend API key (`re_...`)
   - `EMAIL_FROM`: `TenderProcure CRM <notifications@tenderprocure.com>`

---

## 3. Frontend Deployment (Vercel)

1. Import your Git repository into [Vercel](https://vercel.com).
2. Set Root Directory to:
   ```
   apps/web
   ```
3. Configure Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_API_URL`: Your production backend URL (e.g. `https://api.tenderprocure.com`)
4. Deploy the project.

---

## 4. Scheduled Reminder Processing

To trigger notifications and email reminders for upcoming and overdue tasks, configure an external cron service (such as Render Cron Jobs, GitHub Actions, or cron-job.org) to ping the reminder endpoint every 15 minutes:

```http
POST https://api.tenderprocure.com/api/v1/notifications/process-reminders
Authorization: Bearer <ADMIN_SERVICE_TOKEN>
```

This endpoint processes due tasks idempotently and dispatches in-app notifications and transactional emails via Resend.
