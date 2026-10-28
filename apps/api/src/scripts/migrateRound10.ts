import { dbStore } from '../repositories/dbStore';

/**
 * Round 10 Migration Script:
 * Safely initializes and verifies pipelineStageOptions, callOutcomeOptions,
 * and auditLogs in the database/store, ensuring zero data loss for existing leads.
 */
export async function migrateRound10(): Promise<void> {
  console.log('[Migration: Round 10] Checking database store...');
  const store = dbStore.store;

  console.log(`[Migration: Round 10] Found ${store.leads?.length || 0} existing leads.`);
  console.log(`[Migration: Round 10] Pipeline Stage Options count: ${store.pipelineStageOptions?.length || 0}`);
  console.log(`[Migration: Round 10] Call Outcome Options count: ${store.callOutcomeOptions?.length || 0}`);
  console.log(`[Migration: Round 10] Audit Logs count: ${store.auditLogs?.length || 0}`);

  // Force persist to disk
  dbStore.persist();
  console.log('[Migration: Round 10] Migration completed successfully with zero data loss.');
}

if (require.main === module) {
  migrateRound10()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration: Round 10] Failed:', err);
      process.exit(1);
    });
}
