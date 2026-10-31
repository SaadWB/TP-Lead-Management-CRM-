import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { userRepository } from '../repositories/userRepository';
import { UserRole } from '@crm/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new UnauthorizedError('Session expired or token is invalid. Please log in again.');
    }

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    // 30-minute idle session timeout check
    const now = Date.now();
    if (user.lastActiveAt) {
      const lastActiveTime = new Date(user.lastActiveAt).getTime();
      const idleMinutes = (now - lastActiveTime) / (60 * 1000);
      if (idleMinutes > 30) {
        throw new UnauthorizedError('Session timed out due to 30 minutes of inactivity. Please log in again.');
      }
    }

    // Update lastActiveAt periodically (e.g. throttle to at most once per minute)
    const lastActiveTime = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
    if (now - lastActiveTime > 60 * 1000) {
      userRepository.update(user.id, { lastActiveAt: new Date(now).toISOString() }).catch(() => {});
    }

    // Check forced password change requirement
    // If mustChangePassword is true, block all operations except change-password, me, and logout
    if (user.mustChangePassword) {
      const path = req.path || '';
      const originalUrl = req.originalUrl || '';
      const isAllowed =
        path.includes('/change-password') ||
        path.includes('/logout') ||
        path.includes('/me') ||
        originalUrl.includes('/change-password') ||
        originalUrl.includes('/logout') ||
        originalUrl.includes('/me');

      if (!isAllowed) {
        throw new ForbiddenError('Password change required before accessing the system. Please change your password.');
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      mustChangePassword: user.mustChangePassword ?? false,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
