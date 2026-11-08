import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { dbStore } from '../../src/repositories/dbStore';

describe('Integration Tests: Critical CRM User Journeys', () => {
  let adminToken: string;
  let telecallerToken: string;
  let salesmanToken: string;
  let telecallerId: string;
  let salesmanId: string;
  let adminId: string;

  beforeAll(async () => {
    await dbStore.syncFromDatabase();

    const testPassword = 'Password@123';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. Ensure Telecaller exists
    let telecaller = await prisma.user.findUnique({ where: { email: 'journey_telecaller@tenderprocure.com' } });
    if (!telecaller) {
      telecaller = await prisma.user.create({
        data: {
          name: 'Journey Telecaller',
          email: 'journey_telecaller@tenderprocure.com',
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

    // 2. Ensure Salesman exists
    let salesman = await prisma.user.findUnique({ where: { email: 'journey_salesman@tenderprocure.com' } });
    if (!salesman) {
      salesman = await prisma.user.create({
        data: {
          name: 'Journey Salesman',
          email: 'journey_salesman@tenderprocure.com',
          passwordHash,
          role: 'SALESMAN',
          isActive: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: salesman.id },
        data: { isActive: true, passwordHash },
      });
    }
    salesmanId = salesman.id;

    await dbStore.syncFromDatabase();

    // Login Admin
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password@123';
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@tenderprocure.com', password: adminPassword });
    adminToken = adminRes.body?.data?.token;
    adminId = adminRes.body?.data?.user?.id;

    // Login Telecaller
    const teleRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'journey_telecaller@tenderprocure.com', password: testPassword });
    telecallerToken = teleRes.body?.data?.token;

    // Login Salesman
    const salesRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'journey_salesman@tenderprocure.com', password: testPassword });
    salesmanToken = salesRes.body?.data?.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Critical Journey: Complete Lead Lifecycle from Creation to Handover to Closure', async () => {
    // 1. Super Admin creates a lead
    const uniqueCompany = `E2E Test Enterprise ${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: uniqueCompany,
        serviceProduct: 'Security Guard Services & CCTV',
        contactPerson: 'David Miller',
        phone: '9871122334',
        email: `david_${Date.now()}@testenterprise.com`,
        priority: 'HIGH',
        leadSource: 'Website',
        assignedTelecallerId: telecallerId,
        notes: 'Initial inbound inquiry from website form.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const createdLead = createRes.body.data;
    const leadId = createdLead.id;
    expect(leadId).toBeDefined();
    expect(createdLead.companyName).toBe(uniqueCompany);
    expect(createdLead.assignedTelecallerId).toBe(telecallerId);
    expect(createdLead.pipelineStage).toBe('New Lead');

    // 2. Telecaller sees the newly assigned lead in their list
    const teleListRes = await request(app)
      .get(`/api/v1/leads?search=${encodeURIComponent(uniqueCompany)}`)
      .set('Authorization', `Bearer ${telecallerToken}`);

    expect(teleListRes.status).toBe(200);
    expect(teleListRes.body.data.length).toBeGreaterThan(0);
    expect(teleListRes.body.data[0].id).toBe(leadId);

    // 3. Telecaller logs a call with outcome "Connected – Discussed"
    const callRes = await request(app)
      .post(`/api/v1/calls/lead/${leadId}`)
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({
        outcome: 'Connected – Discussed',
        notes: 'Spoke with David. Very interested in our CCTV tender packages.',
        contactDate: new Date().toISOString(),
        durationSeconds: 120,
      });

    expect(callRes.status).toBe(201);
    expect(callRes.body.data.lead.pipelineStage).toBe('Connected');
    expect(callRes.body.data.lead.callAttempts).toBe(1);

    // 4. Telecaller hands over the lead to Salesman for Demo
    const handoverRes = await request(app)
      .post(`/api/v1/assignments/lead/${leadId}`)
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({
        assignedUserId: salesmanId,
        roleType: 'SALESMAN',
        handoverSummary: 'Prospect requested full software demo for 5 branches.',
        scheduleDemo: true,
        demoDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(handoverRes.status).toBe(200);
    expect(handoverRes.body.data.assignedSalesmanId).toBe(salesmanId);
    expect(handoverRes.body.data.pipelineStage).toBe('Demo');

    // 5. Salesman views the assigned lead in their deals
    const salesLeadRes = await request(app)
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${salesmanToken}`);

    expect(salesLeadRes.status).toBe(200);
    expect(salesLeadRes.body.data.assignedSalesmanId).toBe(salesmanId);

    // 6. Salesman updates sales stage to DEMO_COMPLETED with notes
    const salesStageRes = await request(app)
      .patch(`/api/v1/leads/${leadId}/sales-stage`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        salesStage: 'DEMO_COMPLETED',
        notes: 'Demo successfully delivered to board. Proposal requested.',
      });

    expect(salesStageRes.status).toBe(200);
    expect(salesStageRes.body.data.salesStage).toBe('DEMO_COMPLETED');

    // 7. Salesman closes the deal as CONVERTED with deal value
    const convertRes = await request(app)
      .patch(`/api/v1/leads/${leadId}/sales-stage`)
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({
        salesStage: 'CONVERTED',
        dealValue: 75000,
        notes: 'Contract signed for 1 year!',
      });

    expect(convertRes.status).toBe(200);
    expect(convertRes.body.data.salesStage).toBe('CONVERTED');
    expect(convertRes.body.data.dealValue).toBe(75000);
    expect(convertRes.body.data.convertedAt).toBeDefined();

    // 8. Super Admin checks dashboard metrics reflect the conversion
    const dashRes = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalLeads).toBeGreaterThan(0);
    expect(dashRes.body.data.convertedLeads).toBeGreaterThan(0);
  });

  it('Security: Enforces Role Isolation and Prevents IDOR', async () => {
    // 1. Admin creates a lead assigned exclusively to telecaller
    const res = await request(app)
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: `Secret Corp ${Date.now()}`,
        serviceProduct: 'Confidential Tender',
        phone: '9998887776',
        priority: 'URGENT',
        assignedTelecallerId: telecallerId,
      });

    const leadId = res.body.data.id;

    // 2. Salesman (unassigned) tries to view the lead directly via API -> 403 Forbidden
    const unauthorizedGet = await request(app)
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${salesmanToken}`);

    expect(unauthorizedGet.status).toBe(403);
    expect(unauthorizedGet.body.success).toBe(false);

    // 3. Telecaller tries to delete the lead -> 403 Forbidden (Admin only)
    const unauthorizedDelete = await request(app)
      .delete(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${telecallerToken}`);

    expect(unauthorizedDelete.status).toBe(403);

    // 4. Admin successfully soft-deletes the lead -> 200
    const adminDelete = await request(app)
      .delete(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminDelete.status).toBe(200);

    // 5. Soft-deleted lead no longer appears in active list
    const checkList = await request(app)
      .get(`/api/v1/leads?search=${encodeURIComponent('Secret Corp')}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const found = checkList.body.data.some((l: any) => l.id === leadId);
    expect(found).toBe(false);
  });
});

