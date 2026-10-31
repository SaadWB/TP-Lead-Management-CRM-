import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch (err) {
    console.warn('[Prisma] Database connection check failed:', (err as Error).message);
    return false;
  }
}

