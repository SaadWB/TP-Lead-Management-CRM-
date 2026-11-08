import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { dbStore } from '../../src/repositories/dbStore';
import { leadRepository } from '../../src/repositories/leadRepository';

describe('Integration Tests: API Endpoints & Auth Flow', () => {
  let adminToken: string;
  let telecallerToken: string;
  let telecallerId: string;
  let testLeadId: string;

  beforeAll(async () => {
    await dbStore.syncFromDatabase();

    const testPassword = 'Password@123';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Ensure Telecaller exists without ID collision
    let telecaller = await prisma.user.findUnique({ where: { email: 'telecaller1@tenderprocure.com' } });
    if (!telecaller) {
      telecaller = await prisma.user.create({
        data: {
          name: 'Telecaller Test',
          email: 'telecaller1@tenderprocure.com',
          passwordHash,
          role: 'TELECALLER',
          isActive: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: telecaller.id },
        data: { isActive: true, passwordHash },
      });
    }
    telecallerId = telecaller.id;

    // Ensure Test Lead exists assigned to this telecaller
    let testLead = dbStore.store.leads.find((l) => l.assignedTelecallerId === telecallerId && !l.isDeleted);
    if (!testLead) {
      testLead = await leadRepository.create({
        companyName: 'Integration Test Corp',
        serviceProduct: 'Security & Facility Mgmt',
        contactPerson: 'John Tester',
        phone: '9876543210',
        email: 'john@integrationtest.com',
        priority: 'HIGH',
        pipelineStage: 'New Lead',
        assignedTelecallerId: telecallerId,
        createdById: telecallerId,
        callAttempts: 0,
        isRetry: false,
        retryCount: 0,
        isDeleted: false,
      });
    }
    testLeadId = testLead.id;

    await dbStore.syncFromDatabase();

    // 1. Login as Super Admin
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password@123';
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@tenderprocure.com', password: adminPassword });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.token).toBeDefined();
    adminToken = adminRes.body.data.token;

    // 2. Login as Telecaller
    const teleRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'telecaller1@tenderprocure.com', password: testPassword });

    expect(teleRes.status).toBe(200);
    expect(teleRes.body.success).toBe(true);
    telecallerToken = teleRes.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /health should return 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/v1/auth/me should return current user for authenticated token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@tenderprocure.com');
    expect(res.body.data.role).toBe('SUPER_ADMIN');
  });

  it('GET /api/v1/leads should list leads with role-based scoping', async () => {
    // Super admin can see all leads
    const adminLeadsRes = await request(app)
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminLeadsRes.status).toBe(200);
    expect(adminLeadsRes.body.data.length).toBeGreaterThan(0);

    // Telecaller gets only their assigned leads
    const teleLeadsRes = await request(app)
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${telecallerToken}`);

    expect(teleLeadsRes.status).toBe(200);
    teleLeadsRes.body.data.forEach((lead: any) => {
      expect(lead.assignedTelecallerId).toBe(telecallerId);
    });
  });

  it('POST /api/v1/calls/lead/:id should log call and increment attempts', async () => {
    const callRes = await request(app)
      .post(`/api/v1/calls/lead/${testLeadId}`)
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({
        outcome: 'Details on WhatsApp',
        notes: 'Discussion about tender integration went very well',
        contactDate: new Date().toISOString(),
        durationSeconds: 180,
        followUpNeeded: true,
        nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
        nextAction: 'Deliver compliance check presentation',
      });

    expect(callRes.status).toBe(201);
    expect(callRes.body.success).toBe(true);
    expect(callRes.body.data.callLog.outcome).toBe('Details Requested');
    expect(callRes.body.data.lead.callAttempts).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/leads/:id/stage should update pipeline stage and record activity', async () => {
    const stageRes = await request(app)
      .post(`/api/v1/leads/${testLeadId}/stage`)
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({
        pipelineStage: 'Connected',
        notes: 'Lead expressed high interest in subscription',
      });

    expect(stageRes.status).toBe(200);
    expect(stageRes.body.success).toBe(true);
    expect(stageRes.body.data.pipelineStage).toBe('Connected');
  });

  it('GET /api/v1/reports/dashboard should calculate metrics correctly', async () => {
    const metricsRes = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.data.totalLeads).toBeGreaterThan(0);
    expect(metricsRes.body.data.stageDistribution).toBeDefined();
    expect(metricsRes.body.data.telecallerPerformance).toBeDefined();
    expect(metricsRes.body.data.salesmanPerformance).toBeDefined();
  });
});
