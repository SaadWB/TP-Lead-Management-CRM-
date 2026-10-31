import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, changePasswordSchema } from '@crm/shared';
import { userRepository } from '../../repositories/userRepository';
import { config } from '../../config';
import { UnauthorizedError, BadRequestError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllUserRefreshTokens,
  revokeSingleRefreshToken,
} from '../../utils/tokens';
import { dbStore } from '../../repositories/dbStore';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const userWithPass = await userRepository.findByEmail(email);
    if (!userWithPass) {
      // Intentionally generic message to prevent account enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!userWithPass.isActive) {
      throw new UnauthorizedError('Account is deactivated. Please contact your CRM administrator.');
    }

    // Account lockout check: 5 failed attempts = 15 minute lockout
    if (userWithPass.lockoutUntil && new Date(userWithPass.lockoutUntil) > new Date()) {
      // Intentionally generic message
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, userWithPass.passwordHash);
    if (!isMatch) {
      const attempts = (userWithPass.failedLoginAttempts || 0) + 1;
      let lockoutUntil: string | null = null;
      if (attempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
        await dbStore.syncAuditLogToDatabase({
          id: `audit_lock_${Date.now()}`,
          userId: userWithPass.id,
          action: 'ACCOUNT_LOCKOUT',
          entity: 'User',
          entityId: userWithPass.id,
          details: { email: userWithPass.email, reason: '5 consecutive failed logins' },
          createdAt: new Date().toISOString(),
        });
      }

      await userRepository.update(userWithPass.id, {
        failedLoginAttempts: attempts,
        lockoutUntil,
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Successful login: reset failed attempts & lockout, update lastLoginAt and lastActiveAt
    const nowIso = new Date().toISOString();
    await userRepository.update(userWithPass.id, {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: nowIso,
      lastActiveAt: nowIso,
    });

    const token = generateAccessToken({
      id: userWithPass.id,
      email: userWithPass.email,
      role: userWithPass.role,
      name: userWithPass.name,
    });

    const refreshToken = await createRefreshToken(userWithPass.id);

    const { passwordHash, ...user } = userWithPass;

    // Set secure HTTP-only cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await dbStore.syncAuditLogToDatabase({
      id: `audit_login_${Date.now()}`,
      userId: userWithPass.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: userWithPass.id,
      details: { email: userWithPass.email, role: userWithPass.role },
      createdAt: nowIso,
    });

    sendSuccess(
      res,
      {
        user: {
          ...user,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          lastLoginAt: nowIso,
          lastActiveAt: nowIso,
        },
        token,
        refreshToken,
        mustChangePassword: userWithPass.mustChangePassword ?? false,
      },
      'Logged in successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function refreshTokenHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken) {
      throw new UnauthorizedError('Refresh token missing');
    }

    const rotated = await rotateRefreshToken(rawToken);
    if (!rotated) {
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      throw new UnauthorizedError('Invalid or expired refresh token. Please log in again.');
    }

    const user = await userRepository.findById(rotated.userId);
    if (!user || !user.isActive) {
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      throw new UnauthorizedError('User account not found or deactivated');
    }

    const newAccessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', rotated.newRefreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, {
      token: newAccessToken,
      refreshToken: rotated.newRefreshToken,
    }, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const userWithPass = await userRepository.findById(req.user.id);
    if (!userWithPass || !userWithPass.passwordHash) {
      throw new UnauthorizedError('User not found');
    }

    // If currentPassword is provided or required, verify it
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, userWithPass.passwordHash);
      if (!isMatch) {
        throw new BadRequestError('Current password is incorrect');
      }
    }

    // Ensure new password is not identical to current
    const isSame = await bcrypt.compare(newPassword, userWithPass.passwordHash);
    if (isSame) {
      throw new BadRequestError('New password must be different from current password');
    }

    // Hash with cost 12
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await userRepository.update(req.user.id, {
      passwordHash,
      mustChangePassword: false,
    });

    // Revoke all existing refresh tokens for security
    await revokeAllUserRefreshTokens(req.user.id);

    // Issue fresh tokens
    const token = generateAccessToken({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
    });
    const refreshToken = await createRefreshToken(req.user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await dbStore.syncAuditLogToDatabase({
      id: `audit_pwd_${Date.now()}`,
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: req.user.id,
      details: { email: req.user.email },
      createdAt: new Date().toISOString(),
    });

    const updated = await userRepository.findById(req.user.id);
    const { passwordHash: _, ...safeUser } = updated || userWithPass;

    sendSuccess(
      res,
      {
        user: safeUser,
        token,
        refreshToken,
      },
      'Password changed successfully'
    );
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    const { passwordHash, ...safeUser } = user;
    sendSuccess(res, safeUser);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (rawToken) {
    await revokeSingleRefreshToken(rawToken);
  }

  if (req.user?.id) {
    await dbStore.syncAuditLogToDatabase({
      id: `audit_logout_${Date.now()}`,
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      details: { email: req.user.email },
      createdAt: new Date().toISOString(),
    });
  }

  res.clearCookie('token');
  res.clearCookie('refreshToken');
  sendSuccess(res, { message: 'Logged out successfully' });
}
