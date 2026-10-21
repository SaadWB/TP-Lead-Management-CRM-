import { app } from './app';
import { config } from './config';
import { dbStore } from './repositories/dbStore';

// Periodic runner for automatic follow-up and return-to-fresh rules (runs every 60s)
const autoRuleInterval = setInterval(() => {
  try {
    dbStore.processAutomaticRules();
  } catch (err) {
    console.error('Error running automatic rules:', err);
  }
}, 60000);
if (autoRuleInterval.unref) {
  autoRuleInterval.unref();
}

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TenderProcure Leads CRM API is live!`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`⚡ Environment: ${config.nodeEnv}`);
  console.log(`🔒 Health Check: http://localhost:${config.port}/health`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  clearInterval(autoRuleInterval);
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
