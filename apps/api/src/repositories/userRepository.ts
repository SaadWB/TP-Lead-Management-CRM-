import { User, UserRole } from '@crm/shared';
import { dbStore } from './dbStore';

export class UserRepository {
  async findById(id: string): Promise<(User & { passwordHash?: string }) | null> {
    const user = dbStore.store.users.find((u) => u.id === id);
    if (!user) return null;
    return { ...user };
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const user = dbStore.store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    return { ...user };
  }

  async findAll(filter?: { role?: UserRole; isActive?: boolean }): Promise<User[]> {
    const store = dbStore.store;
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
  }): Promise<User> {
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      phone: data.phone || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
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
    data: Partial<Omit<User, 'id' | 'createdAt'>> & { passwordHash?: string }
  ): Promise<User | null> {
    const index = dbStore.store.users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    dbStore.store.users[index] = {
      ...dbStore.store.users[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    dbStore.persist();
    const { passwordHash, ...userWithoutPass } = dbStore.store.users[index];
    return userWithoutPass;
  }

  async countActiveByRole(role: UserRole): Promise<number> {
    return dbStore.store.users.filter((u) => u.role === role && u.isActive).length;
  }
}

export const userRepository = new UserRepository();
