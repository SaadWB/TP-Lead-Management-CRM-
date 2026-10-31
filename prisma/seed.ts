import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from apps/api/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const DEFAULT_PIPELINE_STAGES = [
  { name: 'New Lead', color: 'blue', order: 0, isDefault: true },
  { name: 'Attempting Contact', color: 'amber', order: 1, isDefault: true },
  { name: 'Connected', color: 'sky', order: 2, isDefault: true },
  { name: 'Follow-up', color: 'purple', order: 3, isDefault: true },
  { name: 'Demo', color: 'indigo', order: 4, isDefault: true },
  { name: 'Closed', color: 'slate', order: 5, isDefault: true },
];

const DEFAULT_CALL_OUTCOMES = [
  { name: 'No Answer', color: 'amber', suggestedPipelineStage: 'Attempting Contact', autoReturnNewLeadsDays: 3, isDefault: true, order: 0 },
  { name: 'Busy', color: 'amber', suggestedPipelineStage: 'Follow-up', isDefault: true, order: 1 },
  { name: 'Call Cut', color: 'rose', suggestedPipelineStage: 'Attempting Contact', autoReturnNewLeadsDays: 3, isDefault: true, order: 2 },
  { name: 'Call Back Later', color: 'purple', suggestedPipelineStage: 'Follow-up', requiresDateTime: true, requiresNextFollowUp: true, isDefault: true, order: 3 },
  { name: 'Connected – Discussed', color: 'sky', suggestedPipelineStage: 'Connected', isDefault: true, order: 4 },
  { name: 'Details Requested', color: 'blue', suggestedPipelineStage: 'Follow-up', requiresNextFollowUp: true, isDefault: true, order: 5 },
  { name: 'Demo Interested', color: 'indigo', suggestedPipelineStage: 'Follow-up', requiresNextFollowUp: true, isDefault: true, order: 6 },
  { name: 'Demo Scheduled', color: 'indigo', suggestedPipelineStage: 'Demo', requiresDateTime: true, requiresNextFollowUp: true, isDefault: true, order: 7 },
  { name: 'Demo Completed', color: 'teal', suggestedPipelineStage: 'Follow-up', requiresNextFollowUp: true, isDefault: true, order: 8 },
  { name: 'Decision Pending', color: 'amber', suggestedPipelineStage: 'Follow-up', requiresNextFollowUp: true, isDefault: true, order: 9 },
  { name: 'Not Interested', color: 'rose', suggestedPipelineStage: 'Closed', closesLead: true, isDefault: true, order: 10 },
  { name: 'Wrong Number', color: 'rose', suggestedPipelineStage: 'Closed', closesLead: true, isDefault: true, order: 11 },
];

export const DEFAULT_LEAD_SOURCES = [
  { name: 'Website', color: 'blue', order: 0, isDefault: true },
  { name: 'Referral', color: 'emerald', order: 1, isDefault: true },
  { name: 'Cold Call', color: 'amber', order: 2, isDefault: true },
  { name: 'WhatsApp', color: 'teal', order: 3, isDefault: true },
  { name: 'Social Media (Facebook / LinkedIn / Instagram)', color: 'indigo', order: 4, isDefault: true },
  { name: 'Exhibition / Event', color: 'purple', order: 5, isDefault: true },
  { name: 'Tender Portal', color: 'sky', order: 6, isDefault: true },
  { name: 'Existing Customer', color: 'cyan', order: 7, isDefault: true },
  { name: 'Other', color: 'slate', order: 8, isDefault: true },
];

async function main() {
  console.log('🌱 Starting TenderProcure CRM Production Database Seed...');

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@tenderprocure.com';
  const rawAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'InitialAdminStrongPassword123!';

  if (!rawAdminPassword || rawAdminPassword.trim().length < 10) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD environment variable is missing or less than 10 characters long. ' +
      'Please configure a strong password in apps/api/.env before running database seed.'
    );
  }

  // Cost factor 12 for bcrypt
  const passwordHash = await bcrypt.hash(rawAdminPassword.trim(), 12);

  // 1. Seed or update required first Super Admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      isActive: true,
      role: Role.SUPER_ADMIN,
    },
    create: {
      name: process.env.INITIAL_ADMIN_NAME || 'Super Administrator',
      email: adminEmail,
      passwordHash,
      role: Role.SUPER_ADMIN,
      phone: null,
      isActive: true,
      mustChangePassword: true, // Force password change on first login
    },
  });

  console.log(`✅ Admin user verified: ${admin.email} (ID: ${admin.id}, mustChangePassword: true)`);

  // 2. Initialize default pipeline stages
  for (const stage of DEFAULT_PIPELINE_STAGES) {
    await prisma.pipelineStageOption.upsert({
      where: { name: stage.name },
      update: {},
      create: stage,
    });
  }
  console.log(`✅ Default pipeline stages initialized (${DEFAULT_PIPELINE_STAGES.length} stages)`);

  // 3. Initialize default call outcomes
  for (const outcome of DEFAULT_CALL_OUTCOMES) {
    await prisma.callOutcomeOption.upsert({
      where: { name: outcome.name },
      update: {},
      create: outcome,
    });
  }
  console.log(`✅ Default call outcome options initialized (${DEFAULT_CALL_OUTCOMES.length} options)`);

  // 4. Initialize default lead sources (9 options)
  for (const source of DEFAULT_LEAD_SOURCES) {
    await prisma.leadSourceOption.upsert({
      where: { name: source.name },
      update: {},
      create: source,
    });
  }
  console.log(`✅ Default lead sources initialized (${DEFAULT_LEAD_SOURCES.length} sources)`);

  console.log('🎉 Production seed completed successfully! Remote MySQL is ready.');
}

main()
  .catch((e) => {
    console.error('❌ Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
