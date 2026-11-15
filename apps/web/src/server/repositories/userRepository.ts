import { User, UserRole } from '@crm/shared';
import { prisma } from '../config/prisma';

function mapPrismaUserToShared(dbUser: any): User & { passwordHash: string } {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as UserRole,
    phone: dbUser.phone || null,
    isActive: dbUser.isActive,
    mustChangePassword: dbUser.mustChangePassword ?? false,
    failedLoginAttempts: dbUser.failedLoginAttempts ?? 0,
    lockoutUntil: dbUser.lockoutUntil ? new Date(dbUser.lockoutUntil).toISOString() : null,
    lastLoginAt: dbUser.lastLoginAt ? new Date(dbUser.lastLoginAt).toISOString() : null,
    lastActiveAt: dbUser.lastActiveAt ? new Date(dbUser.lastActiveAt).toISOString() : null,
    createdAt: new Date(dbUser.createdAt).toISOString(),
    updatedAt: new Date(dbUser.updatedAt).toISOString(),
    passwordHash: dbUser.passwordHash,
  };
}

export const USER_ALIAS_MAP: Record<string, string> = {
  usr_admin_1: 'cmvwg3iiw00005o0tnw3lgmbl',
  usr_tele_1: 'usr_tele_test_1',
  usr_sales_1: 'usr_sales_test_1',
  usr_1792905505215_5rdan: 'cmw38krfc0000oti1ggc3iqxt',
};

export function areUserIdsEquivalent(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) return false;
  if (id1 === id2) return true;
  const res1 = resolveUserAlias(id1);
  const res2 = resolveUserAlias(id2);
  return res1 === res2 || USER_ALIAS_MAP[id1] === id2 || USER_ALIAS_MAP[id2] === id1;
}

export function resolveUserAlias(id: string | null | undefined): string | null {
  if (!id) return null;
  return USER_ALIAS_MAP[id] || id;
}

export class UserRepository {
  async findById(id: string): Promise<(User & { passwordHash?: string }) | null> {
    let dbUser = await prisma.user.findUnique({ where: { id } });
    if (!dbUser && USER_ALIAS_MAP[id]) {
      dbUser = await prisma.user.findUnique({ where: { id: USER_ALIAS_MAP[id] } });
    }
    if (!dbUser) return null;
    return mapPrismaUserToShared(dbUser);
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const normalized = email.toLowerCase().trim();
    const dbUser = await prisma.user.findUnique({ where: { email: normalized } });
    if (!dbUser) return null;
    return mapPrismaUserToShared(dbUser);
  }

  async findAll(filter?: { role?: UserRole; isActive?: boolean }): Promise<User[]> {
    const where: any = {};
    if (filter?.role) where.role = filter.role as any;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const dbUsers = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return dbUsers.map((u) => {
      const { passwordHash, ...userWithoutPass } = mapPrismaUserToShared(u);
      return userWithoutPass;
    });
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    phone?: string | null;
    isActive?: boolean;
    mustChangePassword?: boolean;
  }): Promise<User> {
    const email = data.email.toLowerCase().trim();
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash: data.passwordHash,
        role: data.role as any,
        phone: data.phone || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        mustChangePassword: data.mustChangePassword ?? false,
      },
    });

    const { passwordHash, ...userWithoutPass } = mapPrismaUserToShared(created);
    return userWithoutPass;
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt'>> & {
      passwordHash?: string;
      failedLoginAttempts?: number;
      lockoutUntil?: string | null;
      lastLoginAt?: string | null;
      lastActiveAt?: string | null;
    }
  ): Promise<User | null> {
    let targetId = id;
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing && USER_ALIAS_MAP[id]) {
      targetId = USER_ALIAS_MAP[id];
    }

    const prismaUpdateData: any = {};
    if (data.name !== undefined) prismaUpdateData.name = data.name;
    if (data.email !== undefined) prismaUpdateData.email = data.email.toLowerCase().trim();
    if (data.role !== undefined) prismaUpdateData.role = data.role as any;
    if (data.phone !== undefined) prismaUpdateData.phone = data.phone;
    if (data.isActive !== undefined) prismaUpdateData.isActive = data.isActive;
    if (data.mustChangePassword !== undefined) prismaUpdateData.mustChangePassword = data.mustChangePassword;
    if (data.failedLoginAttempts !== undefined) prismaUpdateData.failedLoginAttempts = data.failedLoginAttempts;
    if (data.lockoutUntil !== undefined) {
      prismaUpdateData.lockoutUntil = data.lockoutUntil ? new Date(data.lockoutUntil) : null;
    }
    if (data.lastLoginAt !== undefined) {
      prismaUpdateData.lastLoginAt = data.lastLoginAt ? new Date(data.lastLoginAt) : null;
    }
    if (data.lastActiveAt !== undefined) {
      prismaUpdateData.lastActiveAt = data.lastActiveAt ? new Date(data.lastActiveAt) : null;
    }
    if (data.passwordHash !== undefined) prismaUpdateData.passwordHash = data.passwordHash;

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: prismaUpdateData,
    });

    const { passwordHash, ...safe } = mapPrismaUserToShared(updated);
    return safe;
  }

  async countActiveByRole(role: UserRole): Promise<number> {
    return prisma.user.count({
      where: { role: role as any, isActive: true },
    });
  }
}

export const userRepository = new UserRepository();
