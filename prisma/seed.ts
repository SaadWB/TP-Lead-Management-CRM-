import { PrismaClient, Role, Priority, TaskType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting TenderProcure CRM Prisma Database Seed...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Seed Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tenderprocure.com' },
    update: {},
    create: {
      name: 'Alexander Vance (Super Admin)',
      email: 'admin@tenderprocure.com',
      passwordHash,
      role: Role.SUPER_ADMIN,
      phone: '+1-555-0100',
      isActive: true,
    },
  });

  // 2. Seed Telecallers
  const telecaller1 = await prisma.user.upsert({
    where: { email: 'telecaller1@tenderprocure.com' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'telecaller1@tenderprocure.com',
      passwordHash,
      role: Role.TELECALLER,
      phone: '+1-555-0101',
      isActive: true,
    },
  });

  const telecaller2 = await prisma.user.upsert({
    where: { email: 'telecaller2@tenderprocure.com' },
    update: {},
    create: {
      name: 'Rahul Verma',
      email: 'telecaller2@tenderprocure.com',
      passwordHash,
      role: Role.TELECALLER,
      phone: '+1-555-0102',
      isActive: true,
    },
  });

  // 3. Seed Salesmen
  const salesman1 = await prisma.user.upsert({
    where: { email: 'sales1@tenderprocure.com' },
    update: {},
    create: {
      name: 'David Kim',
      email: 'sales1@tenderprocure.com',
      passwordHash,
      role: Role.SALESMAN,
      phone: '+1-555-0103',
      isActive: true,
    },
  });

  const salesman2 = await prisma.user.upsert({
    where: { email: 'sales2@tenderprocure.com' },
    update: {},
    create: {
      name: 'Ananya Patel',
      email: 'sales2@tenderprocure.com',
      passwordHash,
      role: Role.SALESMAN,
      phone: '+1-555-0104',
      isActive: true,
    },
  });

  // 4. Seed Leads
  const lead1 = await prisma.lead.create({
    data: {
      companyName: 'Apex Industrial Solvents',
      serviceProduct: 'Government Tender Procurement SaaS',
      contactPerson: 'Robert Sterling',
      phone: '+1-555-234-5678',
      email: 'r.sterling@apexind.com',
      city: 'Chicago',
      state: 'IL',
      priority: Priority.HIGH,
      pipelineStage: 'CONNECTED',
      callAttempts: 2,
      lastCallOutcome: 'CONNECTED',
      lastContactDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      nextAction: 'Send technical compliance proposal and pricing sheet',
      notes: 'Actively bidding on 3 defense sector tenders. Needs automated bid tracking.',
      leadSource: 'Import - Q4 Manufacturing List',
      assignedTelecallerId: telecaller1.id,
      createdById: admin.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      companyName: 'Fortress Cyber Defense Ltd',
      serviceProduct: 'Federal Security Tender Automation',
      contactPerson: 'Nathan Drake',
      phone: '+1-555-789-0123',
      email: 'nathan@fortressdefense.gov.mock',
      city: 'Washington',
      state: 'DC',
      priority: Priority.URGENT,
      pipelineStage: 'ASSIGNED_TO_SALESMAN',
      callAttempts: 5,
      lastCallOutcome: 'CONNECTED',
      notes: 'Qualified by Priya. High-value opportunity with $80k annual estimated license.',
      leadSource: 'GovTech Summit',
      assignedTelecallerId: telecaller1.id,
      assignedSalesmanId: salesman1.id,
      createdById: admin.id,
    },
  });

  // 5. Seed CallLog & Task
  await prisma.callLog.create({
    data: {
      leadId: lead1.id,
      userId: telecaller1.id,
      outcome: 'CONNECTED',
      notes: 'Spoke with Robert. He handles civil supply bids. Very open to our compliance auto-check.',
      durationSeconds: 380,
    },
  });

  await prisma.followUpTask.create({
    data: {
      leadId: lead1.id,
      assignedUserId: telecaller1.id,
      taskType: TaskType.CALL,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      dueTime: '11:00',
      notes: 'Discuss technical proposal with Robert.',
    },
  });

  console.log('✅ Seed completed successfully with Admin, Telecallers, Salesmen, Leads, Call Logs, and Tasks!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
