import { User, UserRole } from '@crm/shared';
import { dbStore } from './dbStore';
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
  usr_tele_test_1: 'usr_tele_1',
  usr_tele_1: 'usr_tele_test_1',
  usr_sales_test_1: 'usr_sales_1',
  usr_sales_1: 'usr_sales_test_1',
  cmvwg3iiw00005o0tnw3lgmbl: 'usr_admin_1',
  usr_admin_1: 'cmvwg3iiw00005o0tnw3lgmbl',
  usr_1792905505215_5rdan: 'cmw38krfc0000oti1ggc3iqxt',
  cmw38krfc0000oti1ggc3iqxt: 'usr_1792905505215_5rdan',
};

export function areUserIdsEquivalent(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) return false;
  if (id1 === id2) return true;
  return USER_ALIAS_MAP[id1] === id2 || USER_ALIAS_MAP[id2] === id1;
}

export function resolveUserAlias(id: string | null | undefined): string | null {
  if (!id) return null;
  return USER_ALIAS_MAP[id] || id;
}

export class UserRepository {
  async findById(id: string): Promise<(User & { passwordHash?: string }) | null> {
    // Fast in-memory lookup first (0ms)
    const memUser = dbStore.store.users.find((u) => u.id === id);
    if (memUser) {
      return { ...memUser };
    }

    // Check alias mappings for backward compatibility between historical and new user IDs
    if (USER_ALIAS_MAP[id]) {
      const aliasUser = dbStore.store.users.find((u) => u.id === USER_ALIAS_MAP[id]);
      if (aliasUser) {
        return { ...aliasUser };
      }
    }

    // Fallback to database if not in memory
    try {
      const dbUser = await prisma.user.findUnique({ where: { id } });
      if (dbUser) {
        const mapped = mapPrismaUserToShared(dbUser);
        const idx = dbStore.store.users.findIndex((u) => u.id === mapped.id);
        if (idx !== -1) {
          dbStore.store.users[idx] = mapped;
        } else {
          dbStore.store.users.push(mapped);
        }
        dbStore.persist();
        return mapped;
      }
    } catch (err) {
      console.warn('[userRepository] findById DB query failed:', (err as Error).message);
    }

    return null;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const normalized = email.toLowerCase().trim();
    // Fast in-memory lookup first (0ms)
    const memUser = dbStore.store.users.find((u) => u.email.toLowerCase() === normalized);
    if (memUser) {
      return { ...memUser };
    }

    // Fallback to database if not in memory
    try {
      const dbUser = await prisma.user.findUnique({ where: { email: normalized } });
      if (dbUser) {
        const mapped = mapPrismaUserToShared(dbUser);
        const idx = dbStore.store.users.findIndex((u) => u.id === mapped.id);
        if (idx !== -1) {
          dbStore.store.users[idx] = mapped;
        } else {
          dbStore.store.users.push(mapped);
        }
        dbStore.persist();
        return mapped;
      }
    } catch (err) {
      console.warn('[userRepository] findByEmail DB query failed:', (err as Error).message);
    }

    return null;
  }

  async findAll(filter?: { role?: UserRole; isActive?: boolean }): Promise<User[]> {
    const store = dbStore.store;

    // If store.users is populated, serve immediately from memory (0ms)
    let users = store.users;
    if (users.length === 0) {
      try {
        const where: any = {};
        if (filter?.role) where.role = filter.role;
        if (filter?.isActive !== undefined) where.isActive = filter.isActive;

        const dbUsers = await prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

        if (dbUsers.length > 0) {
          store.users = dbUsers.map((u) => mapPrismaUserToShared(u));
          dbStore.persist();
          users = store.users;
        }
      } catch (err) {
        console.warn('[userRepository] findAll DB query failed:', (err as Error).message);
      }
    }

    users = store.users;
    if (filter?.role) {
      users = users.filter((u) => u.role === filter.role);
    }
    if (filter?.isActive !== undefined) {
      users = users.filter((u) => u.isActive === filter.isActive);
    }

    // Deduplicate users by email for a clean, professional User Management roster
    const seenEmails = new Set<string>();
    const uniqueUsers: typeof users = [];
    for (const u of users) {
      const emailKey = (u.email || '').toLowerCase().trim();
      if (!seenEmails.has(emailKey)) {
        seenEmails.add(emailKey);
        uniqueUsers.push(u);
      }
    }

    const telecallerCounts = new Map<string, number>();
    const salesmanCounts = new Map<string, number>();
    for (const l of store.leads) {
      if (l.assignedTelecallerId) {
        telecallerCounts.set(l.assignedTelecallerId, (telecallerCounts.get(l.assignedTelecallerId) || 0) + 1);
        // Also map to alias ID
        const aliasId = ALIAS_MAP[l.assignedTelecallerId];
        if (aliasId) {
          telecallerCounts.set(aliasId, (telecallerCounts.get(aliasId) || 0) + 1);
        }
      }
      if (l.assignedSalesmanId) {
        salesmanCounts.set(l.assignedSalesmanId, (salesmanCounts.get(l.assignedSalesmanId) || 0) + 1);
        const aliasId = ALIAS_MAP[l.assignedSalesmanId];
        if (aliasId) {
          salesmanCounts.set(aliasId, (salesmanCounts.get(aliasId) || 0) + 1);
        }
      }
    }

    const taskCounts = new Map<string, number>();
    for (const t of store.followUpTasks) {
      if (t.assignedUserId && t.status === 'PENDING') {
        taskCounts.set(t.assignedUserId, (taskCounts.get(t.assignedUserId) || 0) + 1);
      }
    }

    return uniqueUsers.map(({ passwordHash, ...rest }) => ({
      ...rest,
      _count: {
        assignedTelecallerLeads: telecallerCounts.get(rest.id) || 0,
        assignedSalesmanLeads: salesmanCounts.get(rest.id) || 0,
        tasks: taskCounts.get(rest.id) || 0,
      },
    }));
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
    let createdId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
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
      createdId = created.id;
    } catch (err) {
      console.warn('[userRepository] Remote DB create failed, falling back to local store:', (err as Error).message);
    }

    const newUser = {
      id: createdId,
      name: data.name,
      email,
      passwordHash: data.passwordHash,
      role: data.role,
      phone: data.phone || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      mustChangePassword: data.mustChangePassword ?? false,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: null,
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dbStore.store.users.push(newUser);
    dbStore.persist();

    const { passwordHash, ...userWithoutPass } = newUser;
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
    // 1. Immediately update memory store and persist locally (0ms)
    let userWithoutPass: User | null = null;
    let index = dbStore.store.users.findIndex((u) => u.id === id);
    if (index === -1) {
      // If user is not yet in memory store, ensure they are loaded from database first
      await this.findById(id);
      index = dbStore.store.users.findIndex((u) => u.id === id);
    }
    if (index !== -1) {
      dbStore.store.users[index] = {
        ...dbStore.store.users[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      dbStore.persist();
      const { passwordHash, ...safe } = dbStore.store.users[index];
      userWithoutPass = safe;
    }

    // 2. Sync to Prisma in background without holding HTTP response
    const syncToPrisma = async () => {
      try {
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

        await prisma.user.update({
          where: { id },
          data: prismaUpdateData,
        });
      } catch (err) {
        console.warn('[userRepository] Background DB update warning:', (err as Error).message);
      }
    };
    syncToPrisma().catch(() => {});

    if (userWithoutPass) return userWithoutPass;
    const fetched = await this.findById(id);
    if (!fetched) return null;
    const { passwordHash, ...safe } = fetched;
    return safe;
  }

  async countActiveByRole(role: UserRole): Promise<number> {
    try {
      const count = await prisma.user.count({
        where: { role: role as any, isActive: true },
      });
      return count;
    } catch {
      return dbStore.store.users.filter((u) => u.role === role && u.isActive).length;
    }
  }
}

export const userRepository = new UserRepository();
