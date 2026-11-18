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

if (!globalForPrisma._retryMiddlewareInstalled) {
  prisma.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err: any) {
      const isTransient =
        err?.code === 'P1017' ||
        err?.code === 'P1001' ||
        err?.code === 'P1008' ||
        err?.code === 'P2024' ||
        err?.code === 'P2034' ||
        err?.message?.includes('closed the connection') ||
        err?.message?.includes('ETIMEDOUT') ||
        err?.message?.includes('ECONNRESET');

      if (isTransient) {
        console.warn(`[Prisma Middleware] Auto-retrying ${params.model || 'raw'}.${params.action} after transient DB disconnect...`);
        await new Promise((resolve) => setTimeout(resolve, 250));
        return await next(params);
      }
      throw err;
    }
  });
  globalForPrisma._retryMiddlewareInstalled = true;
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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


