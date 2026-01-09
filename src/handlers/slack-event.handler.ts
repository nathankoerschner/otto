import { SlackBot } from '../integrations/slack';
import { AsanaClient } from '../integrations/asana';
import { ILLMService } from '../integrations/llm';
import { TenantManagerService } from '../services/tenant-manager.service';
import { TaskAssignmentService } from '../services/task-assignment.service';
import { UserMatchingService } from '../services/user-matching.service';
import { ConversationContextService } from '../services/conversation-context.service';
import { NLPMessageHandler } from './nlp-message.handler';
import { ConversationsRepository } from '../db/repositories/conversations.repository';
import { TasksRepository } from '../db/repositories/tasks.repository';
import { logger } from '../utils/logger';

/**
 * Register Slack event handlers
 */
export function registerSlackEventHandlers(
  slackBot: SlackBot,
  asanaClient: AsanaClient,
  tenantManager: TenantManagerService,
  llmService: ILLMService
): void {
  const app = slackBot.getApp();

  // Initialize repositories
  const conversationsRepo = new ConversationsRepository();
  const tasksRepo = new TasksRepository();

  // Initialize services
  const userMatchingService = new UserMatchingService(slackBot, asanaClient, tenantManager);
  const conversationContextService = new ConversationContextService(
    conversationsRepo,
    tasksRepo
  );
  const taskAssignmentService = new TaskAssignmentService(
    slackBot,
    asanaClient,
    tenantManager,
    userMatchingService,
    conversationContextService
  );

  // Initialize NLP handler
  const nlpMessageHandler = new NLPMessageHandler(
    llmService,
    conversationContextService,
    taskAssignmentService
  );
  logger.info('NLP message handler initialized');

  // Handle direct messages to the bot
  app.message(async ({ message, say }) => {
    try {
      logger.info('Received Slack message', {
        userId: 'user' in message ? message.user : undefined,
        channelId: message.channel,
        messageTs: message.ts,
        subtype: 'subtype' in message ? message.subtype : undefined,
      });

      if (!('text' in message) || !message.text) {
        return;
      }

      // Get tenant from message
      const teamId = 'team' in message ? (message.team as string) : undefined;
      if (!teamId) {
        return;
      }

      const tenant = tenantManager.getTenantBySlackWorkspace(teamId);
      if (!tenant) {
        logger.warn('Tenant not found for message', { teamId });
        return;
      }

      // Handle message with NLP
      await nlpMessageHandler.handleMessage(
        {
          text: message.text,
          userId: message.user as string,
          tenantId: tenant.id,
          channelId: message.channel,
          threadTs: 'thread_ts' in message ? (message.thread_ts as string) : undefined,
          messageTs: message.ts,
        },
        say
      );
    } catch (error) {
      logger.error('Error handling Slack message', { error });
    }
  });
}
