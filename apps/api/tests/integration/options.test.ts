import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { dbStore } from '../../src/repositories/dbStore';

describe('Integration Tests: Options Management & Role Enforcement (Round 10)', () => {
  const app = createApp();
  let adminToken: string;
  let telecallerToken: string;
  let salesmanToken: string;

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

    // Ensure Salesman exists without ID collision
    let salesman = await prisma.user.findUnique({ where: { email: 'sales1@tenderprocure.com' } });
    if (!salesman) {
      salesman = await prisma.user.create({
        data: {
          name: 'Salesman Test',
          email: 'sales1@tenderprocure.com',
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

    await dbStore.syncFromDatabase();

    // 1. Admin Login
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password@123';
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@tenderprocure.com', password: adminPassword });
    adminToken = adminRes.body?.data?.token;

    // 2. Telecaller Login
    const teleRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'telecaller1@tenderprocure.com', password: testPassword });
    telecallerToken = teleRes.body?.data?.token;

    // 3. Salesman Login
    const salesRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sales1@tenderprocure.com', password: testPassword });
    salesmanToken = salesRes.body?.data?.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/v1/options should be accessible to telecaller and return active options', async () => {
    const res = await request(app)
      .get('/api/v1/options')
      .set('Authorization', `Bearer ${telecallerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pipelineStages).toBeInstanceOf(Array);
    expect(res.body.data.callOutcomes).toBeInstanceOf(Array);
    expect(res.body.data.pipelineStages.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/options/pipeline should reject Telecaller with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/options/pipeline')
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({ name: 'Unauthorized Stage' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/options/outcomes should reject Salesman with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/options/outcomes')
      .set('Authorization', `Bearer ${salesmanToken}`)
      .send({ name: 'Unauthorized Outcome' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/leads/custom-options should reject Telecaller with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/leads/custom-options')
      .set('Authorization', `Bearer ${telecallerToken}`)
      .send({ type: 'CALL_OUTCOME', name: 'R10 Hack Attempt' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Admin can add, rename, reorder, deactivate, and audit pipeline & outcome options', async () => {
    // 1. Add new pipeline stage
    const testStageName = `Test Stage ${Date.now()}`;
    const createStageRes = await request(app)
      .post('/api/v1/options/pipeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: testStageName, color: 'purple' });

    expect(createStageRes.status).toBe(200);
    expect(createStageRes.body.success).toBe(true);
    const stageId = createStageRes.body.data.id;

    // 2. Prevent duplicate stage names (case-insensitive)
    const dupRes = await request(app)
      .post('/api/v1/options/pipeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: testStageName.toLowerCase() });
    expect(dupRes.status).toBe(400);

    // 3. Rename stage
    const renamedStageName = `${testStageName} Renamed`;
    const renameRes = await request(app)
      .patch(`/api/v1/options/pipeline/${stageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: renamedStageName });
    expect(renameRes.status).toBe(200);
    expect(renameRes.body.data.name).toBe(renamedStageName);

    // 4. Deactivate stage
    const deactRes = await request(app)
      .patch(`/api/v1/options/pipeline/${stageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.isActive).toBe(false);

    // 5. Telecaller should not see deactivated stage in active list
    const teleListRes = await request(app)
      .get('/api/v1/options')
      .set('Authorization', `Bearer ${telecallerToken}`);
    const foundInTele = teleListRes.body.data.pipelineStages.some((s: any) => s.id === stageId);
    expect(foundInTele).toBe(false);

    // 6. Delete unused stage
    const delRes = await request(app)
      .delete(`/api/v1/options/pipeline/${stageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);

    // 7. Verify Audit Log was recorded
    const auditRes = await request(app)
      .get('/api/v1/options/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    const hasCreateAudit = auditRes.body.data.some((l: any) => l.action === 'CREATE_PIPELINE_STAGE');
    expect(hasCreateAudit).toBe(true);
  });
});
