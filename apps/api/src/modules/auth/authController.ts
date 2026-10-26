import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '@crm/shared';
import { userRepository } from '../../repositories/userRepository';
import { config } from '../../config';
import { UnauthorizedError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const userWithPass = await userRepository.findByEmail(email);
    if (!userWithPass) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!userWithPass.isActive) {
      throw new UnauthorizedError('Account is deactivated. Please contact your CRM administrator.');
    }

    const isMatch = await bcrypt.compare(password, userWithPass.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = jwt.sign(
      {
        id: userWithPass.id,
        email: userWithPass.email,
        role: userWithPass.role,
        name: userWithPass.name,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const { passwordHash, ...user } = userWithPass;

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, { user, token }, 'Logged in successfully');
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

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token');
  sendSuccess(res, { message: 'Logged out successfully' });
}
