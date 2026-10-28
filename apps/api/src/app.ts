import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';

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

export function createApp(): Application {
  const app = express();

  // Security & logging middleware
  app.use(helmet());
  app.use(
    cors({
      origin: [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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

  // REST API v1 Routing
  const apiV1 = express.Router();
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
