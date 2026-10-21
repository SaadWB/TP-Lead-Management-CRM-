import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { createUserSchema, updateUserSchema, UserRole } from '@crm/shared';
import { userRepository } from '../../repositories/userRepository';
import { leadRepository } from '../../repositories/leadRepository';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.query.role as UserRole | undefined;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const users = await userRepository.findAll({ role, isActive });
    sendSuccess(res, users);
  } catch (error) {
    next(error);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const { passwordHash, ...safeUser } = user;
    sendSuccess(res, safeUser);
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new BadRequestError('User with this email already exists');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const createdUser = await userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      phone: data.phone,
      isActive: data.isActive,
    });

    sendSuccess(res, createdUser, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateUserSchema.parse(req.body);
    const userId = req.params.id;

    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (data.email && data.email !== existing.email) {
      const emailTaken = await userRepository.findByEmail(data.email);
      if (emailTaken) {
        throw new BadRequestError('Email address is already in use by another account');
      }
    }

    const updatePayload: any = { ...data };
    if (data.password) {
      updatePayload.passwordHash = bcrypt.hashSync(data.password, 10);
      delete updatePayload.password;
    }

    const updated = await userRepository.update(userId, updatePayload);
    sendSuccess(res, updated, 'User updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id;
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const newStatus = !existing.isActive;

    // Check active leads if deactivating
    if (!newStatus) {
      const { total } = await leadRepository.findMany({
        assignedTelecallerId: existing.role === 'TELECALLER' ? userId : undefined,
        assignedSalesmanId: existing.role === 'SALESMAN' ? userId : undefined,
      });

      if (total > 0 && req.query.force !== 'true') {
        // Return informative warning with lead count
        sendSuccess(res, {
          user: existing,
          requiresReassignment: true,
          activeLeadsCount: total,
          message: `This user has ${total} active assigned lead(s). Please confirm or reassign before deactivating.`,
        });
        return;
      }
    }

    const updated = await userRepository.update(userId, { isActive: newStatus });
    sendSuccess(res, updated, `User account ${newStatus ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    next(error);
  }
}
