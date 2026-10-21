import { createLeadSchema, updateStageSchema, PRIORITIES, CALL_OUTCOMES } from '@crm/shared';

describe('Unit Tests: Lead Validation & Business Rules', () => {
  describe('Lead Schema Validation', () => {
    it('should validate valid lead creation data', () => {
      const validData = {
        companyName: 'Acme Procurement Corp',
        serviceProduct: 'Tender Tracking Portal',
        contactPerson: 'Jane Doe',
        phone: '+1-555-0199',
        email: 'jane@acme.org',
        priority: PRIORITIES.HIGH,
        pipelineStage: CALL_OUTCOMES.NEW_LEAD,
      };

      const result = createLeadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject lead creation without mandatory fields', () => {
      const invalidData = {
        companyName: '',
        contactPerson: '',
        phone: '123',
      };

      const result = createLeadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorFields = result.error.errors.map((e) => e.path[0]);
        expect(errorFields).toContain('companyName');
        expect(errorFields).toContain('serviceProduct');
        expect(errorFields).toContain('phone');
      }
    });

    it('should allow lead creation with empty contactPerson (optional requirement)', () => {
      const validData = {
        companyName: 'Acme Corp',
        serviceProduct: 'ERP',
        phone: '+91 9876543210',
      };
      const result = createLeadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject malformed email format', () => {
      const invalidEmail = {
        companyName: 'Acme',
        serviceProduct: 'SaaS',
        contactPerson: 'Jane',
        phone: '+1-555-1234567',
        email: 'not-an-email',
      };

      const result = createLeadSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('Stage Transition Rules', () => {
    it('should parse stage change successfully', () => {
      const stagePayload = {
        pipelineStage: 'INTERESTED',
        notes: 'Client interested in bid notifications',
      };

      const result = updateStageSchema.safeParse(stagePayload);
      expect(result.success).toBe(true);
    });

    it('should allow handover summary and salesman assignment', () => {
      const handoverPayload = {
        pipelineStage: 'ASSIGNED_TO_SALESMAN',
        assignedSalesmanId: 'usr_sales_1',
        handoverSummary: 'Needs live demo of enterprise compliance features',
      };

      const result = updateStageSchema.safeParse(handoverPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('Follow-up Due Date & Overdue Calculation', () => {
    it('should accurately detect overdue dates', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const isOverdue = (dateStr: string, status: string) => {
        return status === 'PENDING' && dateStr < today;
      };

      expect(isOverdue(yesterday, 'PENDING')).toBe(true);
      expect(isOverdue(yesterday, 'COMPLETED')).toBe(false);
      expect(isOverdue(today, 'PENDING')).toBe(false);
      expect(isOverdue(tomorrow, 'PENDING')).toBe(false);
    });

    it('should calculate conversion rate accurately with documented formula', () => {
      const calcRate = (converted: number, lost: number) => {
        const closed = converted + lost;
        return closed > 0 ? Math.round((converted / closed) * 100) : 0;
      };

      expect(calcRate(10, 10)).toBe(50);
      expect(calcRate(1, 3)).toBe(25);
      expect(calcRate(0, 5)).toBe(0);
      expect(calcRate(0, 0)).toBe(0);
    });
  });
});
