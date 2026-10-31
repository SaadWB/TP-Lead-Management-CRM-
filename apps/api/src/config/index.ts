import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';

const INSECURE_DEFAULT_SECRETS = [
  'tenderprocure-crm-secret-jwt-key-min-32-chars-long',
  'super-secret-jwt-key-replace-in-production-min-32-chars-long',
  'secret',
  'jwtsecret',
  '1234567890',
];

// In production or test staging, enforce JWT secrets are not empty and not default
if (nodeEnv === 'production') {
  if (!jwtSecret || jwtSecret.length < 32 || INSECURE_DEFAULT_SECRETS.includes(jwtSecret)) {
    throw new Error(
      '[FATAL SECURITY ERROR] JWT_SECRET environment variable is missing, shorter than 32 characters, ' +
      'or set to an insecure default value. Server startup halted.'
    );
  }
} else if (!jwtSecret || INSECURE_DEFAULT_SECRETS.includes(jwtSecret)) {
  console.warn(
    '[SECURITY WARNING] JWT_SECRET is currently using a default development secret. ' +
    'Please configure a random 64-char key in .env before deploying to production.'
  );
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  jwtSecret: jwtSecret || 'dev-fallback-secret-key-tenderprocure-at-least-32-chars',
  jwtRefreshSecret: jwtRefreshSecret || jwtSecret || 'dev-fallback-refresh-secret-key-tenderprocure-32-chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'TenderProcure CRM <notifications@tenderprocure.com>',
};
