/**
 * Database Connection Test Script
 * Reads DATABASE_URL from apps/api/.env or root .env.
 * Never prints passwords or secrets.
 * Executes SELECT 1 through PrismaClient and outputs "Connected" or exact failure reason.
 */

const fs = require('fs');
const path = require('path');

// 1. Locate and parse apps/api/.env or root .env
const candidatePaths = [
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '../apps/api/.env'),
  path.resolve(__dirname, '../../apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
];

let envPath = candidatePaths.find((p) => fs.existsSync(p));
if (!envPath) {
  console.error('Failure: .env file not found.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split(/\r?\n/);
let databaseUrl = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    const rawVal = trimmed.slice('DATABASE_URL='.length).trim();
    // Remove surrounding quotes if present
    if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
      databaseUrl = rawVal.slice(1, -1);
    } else {
      databaseUrl = rawVal;
    }
    break;
  }
}

if (!databaseUrl) {
  console.error('Failure: DATABASE_URL not found in .env');
  process.exit(1);
}

// 2. Resolve PrismaClient
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: [], // Suppress internal logging so credentials cannot leak
});

function sanitizeError(msg) {
  if (!msg) return 'Unknown error';
  // Strip any embedded URLs with passwords e.g. mysql://user:pass@host:port/db
  return msg.replace(/mysql:\/\/[^@\s]+@[^\s\/]+/gi, 'mysql://***:***@***');
}

async function testConnection() {
  try {
    await prisma.$queryRawUnsafe('SELECT 1 as connected');
    console.log('Connected');
    process.exit(0);
  } catch (error) {
    const code = error && error.code ? String(error.code).toUpperCase() : '';
    const rawMsg = (error && error.message ? error.message : String(error)).toLowerCase();

    // 1. Wrong user or password
    if (
      code === 'P1000' ||
      rawMsg.includes('access denied for user') ||
      rawMsg.includes('authentication failed') ||
      rawMsg.includes('1045') ||
      rawMsg.includes('er_access_denied_error')
    ) {
      console.error('Failure: wrong user/password');
      process.exit(1);
    }

    // 2. Remote access not allowed
    if (
      rawMsg.includes('not allowed to connect to this mysql server') ||
      rawMsg.includes('host is not allowed') ||
      rawMsg.includes('1130') ||
      rawMsg.includes('er_host_not_privileged')
    ) {
      console.error('Failure: remote access not allowed');
      process.exit(1);
    }

    // 3. Port 3306 blocked / server unreachable / timeout
    if (
      code === 'P1001' ||
      rawMsg.includes("can't reach database server") ||
      rawMsg.includes('connection refused') ||
      rawMsg.includes('econnrefused') ||
      rawMsg.includes('etimedout') ||
      rawMsg.includes('connect timeout') ||
      rawMsg.includes('timed out') ||
      rawMsg.includes('connection closed before server greeting')
    ) {
      console.error('Failure: port 3306 blocked');
      process.exit(1);
    }

    // 4. SSL required
    if (
      code === 'P1011' ||
      rawMsg.includes('ssl required') ||
      rawMsg.includes('ssl connection required') ||
      rawMsg.includes('handshake_no_ssl_support') ||
      rawMsg.includes('tls') ||
      rawMsg.includes('certificate')
    ) {
      console.error('Failure: SSL required');
      process.exit(1);
    }

    // 5. Wrong DB name
    if (
      code === 'P1003' ||
      rawMsg.includes('unknown database') ||
      rawMsg.includes('database does not exist') ||
      rawMsg.includes('1049') ||
      rawMsg.includes('er_bad_db_error')
    ) {
      console.error('Failure: wrong DB name');
      process.exit(1);
    }

    // Generic fallback with sanitized message
    console.error(`Failure: ${sanitizeError(error.message)}`);
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

testConnection();

