import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  _dbSchemaChecked?: boolean;
  _retryMiddlewareInstalled?: boolean;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Reuse ONE client per server instance in every environment (incl. production / serverless warm
// starts). Creating extra clients opens extra connection pools and exhausts MySQL connections.
globalForPrisma.prisma = prisma;

const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034']);
const READ_ACTIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'queryRaw',
]);

function isTransientDbError(err: any): boolean {
  const msg = String(err?.message || '');
  return (
    TRANSIENT_CODES.has(err?.code) ||
    msg.includes('closed the connection') ||
    msg.includes('Connection lost') ||
    msg.includes("Can't reach database server") ||
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('EPIPE')
  );
}

let reconnecting: Promise<void> | null = null;
async function resetConnectionPool(): Promise<void> {
  // MySQL drops idle connections (wait_timeout); a stale pool keeps failing until it is rebuilt.
  if (!reconnecting) {
    reconnecting = (async () => {
      try {
        await prisma.$disconnect();
      } catch {
        /* ignore */
      }
      try {
        await prisma.$connect();
      } catch {
        /* next query will retry the connect */
      }
    })().finally(() => {
      reconnecting = null;
    });
  }
  await reconnecting;
}

if (!globalForPrisma._retryMiddlewareInstalled) {
  prisma.$use(async (params, next) => {
    // Reads are safe to retry several times. Writes are retried once, and only when the
    // failure happened while acquiring a connection (the statement never reached MySQL).
    const isRead = READ_ACTIONS.has(params.action);
    const maxAttempts = isRead ? 3 : 2;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      try {
        return await next(params);
      } catch (err: any) {
        const connectionPhase =
          err?.code === 'P1001' || err?.code === 'P2024' || err?.code === 'P1017' ||
          String(err?.message || '').includes("Can't reach database server");
        const retryable = isTransientDbError(err) && (isRead || connectionPhase);
        if (!retryable || attempt >= maxAttempts) throw err;
        console.warn(
          `[Prisma] Transient DB error on ${params.model || 'raw'}.${params.action} (${err?.code || 'no-code'}), retry ${attempt}/${maxAttempts - 1}`
        );
        if (err?.code === 'P1017' || String(err?.message || '').includes('closed the connection')) {
          await resetConnectionPool();
        }
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt + Math.floor(Math.random() * 150)));
      }
    }
  });
  globalForPrisma._retryMiddlewareInstalled = true;
}

let schemaCheckPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  if (globalForPrisma._dbSchemaChecked) return;
  if (!schemaCheckPromise) {
    schemaCheckPromise = (async () => {
      try {
        await prisma.$queryRawUnsafe('SELECT 1');

        // Check if alternateName column exists in Lead table
        const cols: any = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `Lead` LIKE 'alternateName'");
        if (!Array.isArray(cols) || cols.length === 0) {
          console.log('[Prisma] Adding missing column `alternateName` to `Lead` table...');
          try {
            await prisma.$executeRawUnsafe("ALTER TABLE `Lead` ADD COLUMN `alternateName` VARCHAR(100) NULL AFTER `contactPerson`");
            console.log('[Prisma] Successfully added `alternateName` column to `Lead` table.');
          } catch (alterErr: any) {
            console.warn('[Prisma] ALTER TABLE notice:', alterErr.message);
          }
        }
        globalForPrisma._dbSchemaChecked = true;
      } catch (err: any) {
        console.warn('[Prisma] Schema auto-ensure warning:', err.message);
      }
    })();
  }
  await schemaCheckPromise;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await ensureDatabaseSchema();
    return true;
  } catch (err) {
    console.warn('[Prisma] Database connection check failed:', (err as Error).message);
    return false;
  }
}


