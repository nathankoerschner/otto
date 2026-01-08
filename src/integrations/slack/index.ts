import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { IMessagingClient, MessagingUser, MessagingMessage } from '../interfaces/messaging.interface';

export class SlackBot implements IMessagingClient {
  private app: App;
  private clients: Map<string, WebClient> = new Map();

  constructor() {
    // For local development with a single workspace, we need to provide a token
    const isLocalDev = process.env.NODE_ENV === 'development' && process.env.SLACK_BOT_TOKEN;

    this.app = new App({
      token: isLocalDev ? process.env.SLACK_BOT_TOKEN : undefined,
      signingSecret: config.slack.signingSecret,
      appToken: config.slack.appToken,
      socketMode: true,
      logLevel: config.nodeEnv === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    });
  }

  /**
   * Register a tenant-specific Slack client
   */
  registerTenantClient(tenantId: string, botToken: string): void {
    this.clients.set(tenantId, new WebClient(botToken));
  }

  /**
   * Get client for a specific tenant
   */
  private getClient(tenantId?: string): WebClient {
    if (!tenantId) {
      throw new Error('Tenant ID required for Slack operations');
    }
    const client = this.clients.get(tenantId);
    if (!client) {
      throw new Error(`No Slack client found for tenant ${tenantId}`);
    }
    return client;
  }

  async sendDirectMessage(userId: string, message: MessagingMessage, tenantId?: string): Promise<string> {
    const client = this.getClient(tenantId);

    try {
      const result = await client.chat.postMessage({
        channel: userId,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.threadTs,
      });

      return result.ts || '';
    } catch (error) {
      logger.error('Failed to send Slack DM', { error, userId, tenantId });
      throw error;
    }
  }

  async sendChannelMessage(channelId: string, message: MessagingMessage, tenantId?: string): Promise<string> {
    const client = this.getClient(tenantId);

    try {
      const result = await client.chat.postMessage({
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.threadTs,
      });

      return result.ts || '';
    } catch (error) {
      logger.error('Failed to send Slack channel message', { error, channelId, tenantId });
      throw error;
    }
  }

  async getUserById(userId: string, tenantId?: string): Promise<MessagingUser | null> {
    const client = this.getClient(tenantId);

    try {
      const result = await client.users.info({ user: userId });

      if (!result.user) {
        return null;
      }

      return {
        id: result.user.id!,
        name: result.user.real_name || result.user.name || '',
        email: result.user.profile?.email,
      };
    } catch (error) {
      logger.error('Failed to get Slack user by ID', { error, userId, tenantId });
      return null;
    }
  }

  async getUserByName(name: string, tenantId?: string): Promise<MessagingUser | null> {
    const client = this.getClient(tenantId);

    try {
      const result = await client.users.list({});

      if (!result.members) {
        return null;
      }

      const user = result.members.find(
        (member) =>
          member.real_name?.toLowerCase() === name.toLowerCase() ||
          member.name?.toLowerCase() === name.toLowerCase()
      );

      if (!user) {
        return null;
      }

      return {
        id: user.id!,
        name: user.real_name || user.name || '',
        email: user.profile?.email,
      };
    } catch (error) {
      logger.error('Failed to get Slack user by name', { error, name, tenantId });
      return null;
    }
  }

  onMessage(handler: (event: any) => Promise<void>): void {
    this.app.message(async (args) => {
      try {
        await handler(args);
      } catch (error) {
        logger.error('Error handling Slack message', { error });
      }
    });
  }

  async start(): Promise<void> {
    // Log all incoming events for debugging
    this.app.use(async (args) => {
      const { payload, next } = args;
      const event = (args as any).event;
      logger.info('Slack event received', {
        type: payload?.type || event?.type || 'unknown',
        subtype: (payload as any)?.subtype || event?.subtype,
      });
      await next();
    });

    await this.app.start();
    logger.info('Slack bot started');
  }

  async stop(): Promise<void> {
    await this.app.stop();
    logger.info('Slack bot stopped');
  }

  getApp(): App {
    return this.app;
  }
}
