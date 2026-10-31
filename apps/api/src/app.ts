import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';
import { apiRateLimiter } from './middleware/rateLimiter';
import { csrfProtection } from './middleware/csrf';

// Module routes
import authRoutes from './modules/auth/authRoutes';
import userRoutes from './modules/users/userRoutes';
import leadRoutes from './modules/leads/leadRoutes';
import assignmentRoutes from './modules/assignments/assignmentRoutes';
import callRoutes from './modules/calls/callRoutes';
import taskRoutes from './modules/tasks/taskRoutes';
import importRoutes from './modules/imports/importRoutes';
import notificationRoutes from './modules/notifications/notificationRoutes';
import reportRoutes from './modules/reports/reportRoutes';
import activityRoutes from './modules/activities/activityRoutes';
import optionRoutes from './modules/options/optionRoutes';

// Lightweight secure cookie parser middleware
function parseCookies(req: Request, _res: Response, next: NextFunction): void {
  const cookieHeader = req.headers.cookie;
  (req as any).cookies = {};
  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        try {
          (req as any).cookies[key] = decodeURIComponent(val);
        } catch {
          (req as any).cookies[key] = val;
        }
      }
    }
  }
  next();
}

export function createApp(): Application {
  const app = express();

  // Explicitly remove fingerprinting header
  app.disable('x-powered-by');

  // Hardened Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", config.corsOrigin],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
        },
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'same-origin' },
      hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    })
  );

  // Exact CORS origins
  const allowedOrigins = [
    config.corsOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Parse cookies before routes
  app.use(parseCookies);

  // Body parser with caps
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get(['/health', '/api/health', '/api/v1/health'], (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'TenderProcure Leads CRM API',
      version: '1.0.0',
    });
  });

  // REST API v1 Routing with CSRF & Rate Limiting
  const apiV1 = express.Router();
  apiV1.use(apiRateLimiter.middleware());
  apiV1.use(csrfProtection);

  apiV1.use('/auth', authRoutes);
  apiV1.use('/users', userRoutes);
  apiV1.use('/leads', leadRoutes);
  apiV1.use('/assignments', assignmentRoutes);
  apiV1.use('/calls', callRoutes);
  apiV1.use('/tasks', taskRoutes);
  apiV1.use('/imports', importRoutes);
  apiV1.use('/notifications', notificationRoutes);
  apiV1.use('/reports', reportRoutes);
  apiV1.use('/activities', activityRoutes);
  apiV1.use('/options', optionRoutes);

  app.use('/api/v1', apiV1);

  // Catch-all 404 handler
  app.use((_req: Request, _res: Response, next) => {
    next(new NotFoundError('The requested endpoint was not found on this server.'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
