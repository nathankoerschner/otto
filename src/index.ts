import express from 'express';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { initializeDatabase } from './db';
import { SlackBot } from './integrations/slack';
import { AsanaClient } from './integrations/asana';
import { createLLMService, validateLLMConfig } from './integrations/llm';
import { TenantManagerService } from './services/tenant-manager.service';
import { FollowUpService } from './services/follow-up.service';
import { SchedulerService } from './services/scheduler.service';
import { registerAsanaWebhookHandler } from './handlers/asana-webhook.handler';
import { registerSlackEventHandlers } from './handlers/slack-event.handler';

async function main() {
  try {
    logger.info('Starting Otto bot...');

    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize Slack bot
    const slackBot = new SlackBot();
    await slackBot.start();
    logger.info('Slack bot started');

    // Initialize Asana client
    const asanaClient = new AsanaClient();
    logger.info('Asana client initialized');

    // Initialize tenants (load from DB and register their clients)
    const tenantManager = new TenantManagerService(slackBot, asanaClient);
    await tenantManager.initializeTenants();
    logger.info('Tenants initialized');

    // Initialize LLM service (required)
    if (!config.llm.apiKey) {
      throw new Error('LLM_API_KEY environment variable is required');
    }
    validateLLMConfig(config.llm);
    const llmService = createLLMService(config.llm);
    logger.info('LLM service initialized', { provider: config.llm.provider });

    // Initialize services
    const followUpService = new FollowUpService(slackBot, asanaClient, tenantManager);
    logger.info('Services initialized');

    // Initialize and start scheduler for periodic jobs
    const scheduler = new SchedulerService(followUpService, tenantManager);
    scheduler.start();
    logger.info('Scheduler started');

    // Initialize Express app for webhooks
    const app = express();
    app.use(express.json({
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }));

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        llmProvider: config.llm.provider,
      });
    });

    // Register webhook handlers
    registerAsanaWebhookHandler(app, asanaClient, slackBot, tenantManager);
    registerSlackEventHandlers(slackBot, asanaClient, tenantManager, llmService);

    // Serve frontend static files
    const publicPath = path.join(__dirname, '../public');
    app.use(express.static(publicPath));

    // SPA fallback - serve index.html for client-side routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });

    // Start server
    const port = config.port;
    app.listen(port, () => {
      logger.info(`Otto bot listening on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      scheduler.stop();
      await slackBot.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      scheduler.stop();
      await slackBot.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Otto bot', { error });
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();
