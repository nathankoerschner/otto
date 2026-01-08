import { Express, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AsanaClient } from '../integrations/asana';
import { SlackBot } from '../integrations/slack';
import { TenantManagerService } from '../services/tenant-manager.service';
import { TaskAssignmentService } from '../services/task-assignment.service';
import { UserMatchingService } from '../services/user-matching.service';
import { FollowUpService } from '../services/follow-up.service';
import { ConversationContextService } from '../services/conversation-context.service';
import { ConversationsRepository } from '../db/repositories/conversations.repository';
import { TasksRepository } from '../db/repositories/tasks.repository';
import { FollowUpsRepository } from '../db/repositories/follow-ups.repository';

/**
 * Register Asana webhook endpoints
 */
export function registerAsanaWebhookHandler(
  app: Express,
  asanaClient: AsanaClient,
  slackBot: SlackBot,
  tenantManager: TenantManagerService
): void {
  // Initialize repositories
  const conversationsRepo = new ConversationsRepository();
  const tasksRepo = new TasksRepository();
  const followUpsRepo = new FollowUpsRepository();

  // Initialize services
  const userMatchingService = new UserMatchingService(slackBot, asanaClient, tenantManager);
  const followUpService = new FollowUpService(slackBot, asanaClient, tenantManager);
  const conversationContextService = new ConversationContextService(
    conversationsRepo,
    tasksRepo,
    followUpsRepo
  );
  const taskAssignmentService = new TaskAssignmentService(
    slackBot,
    asanaClient,
    tenantManager,
    userMatchingService,
    followUpService,
    conversationContextService
  );

  // Webhook endpoint for Asana events
  app.post('/webhooks/asana', async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Asana webhook received', {
        hasSecret: !!req.headers['x-hook-secret'],
        hasSignature: !!req.headers['x-hook-signature']
      });

      // Handle webhook handshake FIRST (Asana sends x-hook-secret, we must echo it back in header)
      if (req.headers['x-hook-secret']) {
        logger.info('Asana webhook handshake received');
        res.setHeader('X-Hook-Secret', req.headers['x-hook-secret'] as string);
        res.status(200).send();
        return;
      }

      // For actual events, verify signature (skip in development for easier testing)
      const signature = req.headers['x-hook-signature'] as string;
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (process.env.NODE_ENV === 'production') {
        if (!signature) {
          logger.warn('Missing Asana webhook signature');
          res.status(401).json({ error: 'Missing signature' });
          return;
        }

        if (!rawBody) {
          logger.warn('Missing raw body for Asana webhook verification');
          res.status(400).json({ error: 'Invalid payload' });
          return;
        }

        if (!asanaClient.verifyWebhook(rawBody, signature)) {
          logger.warn('Invalid Asana webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      const { events } = req.body;

      // Process events
      for (const event of events) {
        await handleAsanaEvent(event, taskAssignmentService, tenantManager, tasksRepo);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error handling Asana webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

async function handleAsanaEvent(
  event: any,
  taskAssignmentService: TaskAssignmentService,
  tenantManager: TenantManagerService,
  tasksRepo: TasksRepository
): Promise<void> {
  try {
    const { resource, action } = event;
    const taskId = resource?.gid;
    const changeField = event.change?.field;

    logger.info('Processing Asana event', {
      action,
      taskId,
      changeField,
    });

    // We're only interested in task events
    if (resource?.resource_type !== 'task') {
      logger.debug('Ignoring non-task event', { resourceType: resource?.resource_type });
      return;
    }

    if (!taskId) {
      logger.warn('No task ID in event', { action, changeField });
      return;
    }

    const tenant = await resolveTenantForEvent(event, taskId, tenantManager, tasksRepo);

    if (!tenant) {
      logger.warn('No tenant matched for Asana event', { taskId, action, changeField });
      return;
    }

    // For assignee changes, verify this is for our bot user
    if (action === 'changed' && changeField === 'assignee') {
      const newAssigneeId = event.change?.new_value?.gid;

      // Check if task was assigned to our bot user
      if (newAssigneeId === tenant.asanaBotUserId) {
        logger.info('Task assigned to bot user, starting ownership-seeking flow', {
          taskId,
          tenantId: tenant.id,
          botUserId: tenant.asanaBotUserId,
        });

        await taskAssignmentService.seekOwnership(taskId, tenant.id);
      } else {
        logger.debug('Assignee changed but not to bot user', { newAssigneeId, botUserId: tenant.asanaBotUserId });
      }
    }

    // Handle task completion
    if (action === 'changed' && changeField === 'completed') {
      const isCompleted = event.change?.new_value === true;

      if (isCompleted) {
        logger.info('Task completed', { taskId, tenantId: tenant.id });
        await taskAssignmentService.handleTaskCompleted(taskId, tenant.id);
      }
    }
  } catch (error) {
    logger.error('Error processing Asana event', { error });
  }
}

async function resolveTenantForEvent(
  event: any,
  taskId: string,
  tenantManager: TenantManagerService,
  tasksRepo: TasksRepository
): Promise<ReturnType<TenantManagerService['getTenant']>> {
  if (event.action === 'changed' && event.change?.field === 'assignee') {
    const newAssigneeId = event.change?.new_value?.gid;
    if (newAssigneeId) {
      const tenant = tenantManager.getTenantByAsanaBotUserId(newAssigneeId);
      if (tenant) {
        return tenant;
      }
    }
  }

  const task = await tasksRepo.findByAsanaTaskIdAny(taskId);
  if (task) {
    return tenantManager.getTenant(task.tenantId);
  }

  return undefined;
}
