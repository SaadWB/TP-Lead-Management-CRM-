import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; _dbSchemaChecked?: boolean };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

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


