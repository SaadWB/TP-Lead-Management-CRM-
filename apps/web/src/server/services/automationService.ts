import { prisma } from '../config/prisma';

export async function processAutomaticRules(): Promise<void> {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const staleLeads = await prisma.lead.findMany({
      where: {
        isDeleted: false,
        archivedAt: null,
        pipelineStage: { notIn: ['New Lead', 'Closed'] },
        lastCallOutcome: { in: ['No Answer', 'Busy', 'Call Cut'] },
        lastContactDate: { lte: threeDaysAgo },
        OR: [
          { nextFollowUpDate: null },
          { nextFollowUpDate: { lt: now } },
        ],
      },
    });

    for (const lead of staleLeads) {
      const oldStage = lead.pipelineStage;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineStage: 'New Lead',
          isRetry: true,
          retryCount: (lead.retryCount || 0) + 1,
          lastActivityAt: now,
          lastStatusUpdatedAt: now,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'STAGE_CHANGED',
          description: `Automatically returned to New Fresh Leads (Retry) on the 3rd day after "${oldStage}".`,
          metadata: {
            oldStage,
            newStage: 'New Lead',
            isRetry: true,
            automatic: true,
          },
        },
      });
    }
  } catch (err: any) {
    console.warn('[processAutomaticRules] warning:', err.message);
  }
}
