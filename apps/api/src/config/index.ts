import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current dir
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'tenderprocure-crm-secret-jwt-key-min-32-chars-long',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'TenderProcure CRM <notifications@tenderprocure.com>',
};
