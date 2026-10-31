import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { config } from '../config';
import { UserRole } from '@crm/shared';

export interface TokenUserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export function generateAccessToken(user: TokenUserPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: '15m' } // 15-minute access token
  );
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent ? options.userAgent.substring(0, 255) : null,
      },
    });
  } catch (err) {
    console.error('[Tokens] Failed to store refresh token in DB:', (err as Error).message);
  }

  return rawToken;
}

export async function rotateRefreshToken(
  rawToken: string,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<{ newRefreshToken: string; userId: string } | null> {
  try {
    const tokenHash = hashToken(rawToken);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      return null;
    }

    // Token reuse detection: If token was already revoked, someone is attempting to reuse it!
    // As a critical security measure, revoke all refresh tokens for this user immediately!
    if (existing.revokedAt !== null) {
      console.warn(`[Tokens] Revoked refresh token reused for user ${existing.userId}. Revoking all tokens.`);
      await prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // Check expiration
    if (new Date() > existing.expiresAt) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // Generate new rotated token
    const newRawToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Mark current token as revoked and track replacement
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenHash: newTokenHash,
      },
    });

    // Save new token
    await prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: existing.userId,
        expiresAt: newExpiresAt,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent ? options.userAgent.substring(0, 255) : null,
      },
    });

    return { newRefreshToken: newRawToken, userId: existing.userId };
  } catch (err) {
    console.error('[Tokens] Error during refresh token rotation:', (err as Error).message);
    return null;
  }
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    console.error('[Tokens] Failed to revoke user tokens:', (err as Error).message);
  }
}

export async function revokeSingleRefreshToken(rawToken: string): Promise<void> {
  try {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    console.error('[Tokens] Failed to revoke single token:', (err as Error).message);
  }
}
