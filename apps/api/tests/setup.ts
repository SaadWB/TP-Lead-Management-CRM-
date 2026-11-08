import dotenv from 'dotenv';
import path from 'path';

// Force test environment
process.env.NODE_ENV = 'test';

// Set generous timeout for remote MySQL network calls (30s)
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Load apps/api/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
