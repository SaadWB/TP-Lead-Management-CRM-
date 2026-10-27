import request from 'supertest';
import { app } from '../../src/app';

describe('Integration Tests: API Endpoints & Auth Flow', () => {
  let adminToken: string;
  let telecallerToken: string;

  beforeAll(async () => {
    // 1. Login as Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@tenderprocure.com', password: 'Password@123' });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.token).toBeDefined();
    adminToken = adminRes.body.data.token;

    // 2. Login as Telecaller
    const teleRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'telecaller1@tenderprocure.com', password: 'Password@123' });

    expect(teleRes.status).toBe(200);
    expect(teleRes.body.success).toBe(true);
    telecallerToken = teleRes.body.data.token;
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
      expect(lead.assignedTelecallerId).toBe('usr_tele_1');
    });
  });

  it('POST /api/v1/calls/lead/:id should log call and increment attempts', async () => {
    const leadId = 'lead_101'; // Assigned to telecaller1
    const callRes = await request(app)
      .post(`/api/v1/calls/lead/${leadId}`)
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
    const leadId = 'lead_101';
    const stageRes = await request(app)
      .post(`/api/v1/leads/${leadId}/stage`)
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({
        pipelineStage: 'Interested',
        notes: 'Lead expressed high interest in subscription',
      });

    expect(stageRes.status).toBe(200);
    expect(stageRes.body.success).toBe(true);
    expect(stageRes.body.data.pipelineStage).toBe('Interested');
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
