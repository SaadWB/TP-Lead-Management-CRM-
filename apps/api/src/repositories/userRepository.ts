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

export class UserRepository {
  async findById(id: string): Promise<(User & { passwordHash?: string }) | null> {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id } });
      if (dbUser) {
        return mapPrismaUserToShared(dbUser);
      }
    } catch {
      // Fallback to store
    }

    const user = dbStore.store.users.find((u) => u.id === id);
    if (!user) return null;
    return { ...user };
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const normalized = email.toLowerCase().trim();
    try {
      const dbUser = await prisma.user.findUnique({ where: { email: normalized } });
      if (dbUser) {
        return mapPrismaUserToShared(dbUser);
      }
    } catch {
      // Fallback to store
    }

    const user = dbStore.store.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) return null;
    return { ...user };
  }

  async findAll(filter?: { role?: UserRole; isActive?: boolean }): Promise<User[]> {
    const store = dbStore.store;

    // Try fetching from database first
    try {
      const where: any = {};
      if (filter?.role) where.role = filter.role;
      if (filter?.isActive !== undefined) where.isActive = filter.isActive;

      const dbUsers = await prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      if (dbUsers.length > 0) {
        return dbUsers.map((u) => {
          const { passwordHash, ...safe } = mapPrismaUserToShared(u);
          return safe;
        });
      }
    } catch {
      // Fallback to store
    }

    let users = store.users;
    if (filter?.role) {
      users = users.filter((u) => u.role === filter.role);
    }
    if (filter?.isActive !== undefined) {
      users = users.filter((u) => u.isActive === filter.isActive);
    }

    const telecallerCounts = new Map<string, number>();
    const salesmanCounts = new Map<string, number>();
    for (const l of store.leads) {
      if (l.assignedTelecallerId) {
        telecallerCounts.set(l.assignedTelecallerId, (telecallerCounts.get(l.assignedTelecallerId) || 0) + 1);
      }
      if (l.assignedSalesmanId) {
        salesmanCounts.set(l.assignedSalesmanId, (salesmanCounts.get(l.assignedSalesmanId) || 0) + 1);
      }
    }

    const taskCounts = new Map<string, number>();
    for (const t of store.followUpTasks) {
      if (t.assignedUserId && t.status === 'PENDING') {
        taskCounts.set(t.assignedUserId, (taskCounts.get(t.assignedUserId) || 0) + 1);
      }
    }

    return users.map(({ passwordHash, ...rest }) => ({
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
      console.warn('[userRepository] Remote DB update failed, falling back to local store:', (err as Error).message);
    }

    const index = dbStore.store.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      dbStore.store.users[index] = {
        ...dbStore.store.users[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      dbStore.persist();
      const { passwordHash, ...userWithoutPass } = dbStore.store.users[index];
      return userWithoutPass;
    }

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
