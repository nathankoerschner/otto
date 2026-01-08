import { logger } from '../utils/logger';
import { SlackBot } from '../integrations/slack';
import { AsanaClient } from '../integrations/asana';
import { TenantManagerService } from './tenant-manager.service';

/**
 * Service for matching users between Slack and Asana
 */
export class UserMatchingService {
  constructor(
    private slackBot: SlackBot,
    private asanaClient: AsanaClient,
    private tenantManager: TenantManagerService
  ) {}

  /**
   * Match a Slack user to their Asana counterpart
   * Returns Asana user ID or null if no match found
   */
  async matchUser(
    slackUserId: string,
    tenantId: string,
    workspaceId: string
  ): Promise<string | null> {
    try {
      logger.info('=== USER MATCHING START ===', { slackUserId, tenantId, workspaceId });

      // 1. Get Slack user info
      const slackUser = await this.slackBot.getUserById(slackUserId, tenantId);
      if (!slackUser) {
        logger.warn('USER MATCHING FAILED: Slack user not found', { slackUserId });
        return null;
      }
      logger.info('Slack user found', { slackUserId, name: slackUser.name, email: slackUser.email });

      // 2. Try to match by name (primary method)
      if (slackUser.name) {
        logger.debug('Looking up Asana user by name', { name: slackUser.name });
        const asanaUser = await this.asanaClient.getUserByName(
          slackUser.name,
          workspaceId,
          tenantId
        );

        if (asanaUser) {
          logger.info('USER MATCHING SUCCESS: Matched by name', {
            slackUserId,
            asanaUserId: asanaUser.id,
            slackName: slackUser.name,
            asanaName: asanaUser.name
          });
          return asanaUser.id;
        }
        logger.debug('No Asana user found by name', { searchedName: slackUser.name });
      }

      // 3. Fallback: Try to match by email
      if (slackUser.email) {
        logger.debug('Trying fallback: match by email', { email: slackUser.email });
        const asanaUser = await this.asanaClient.getUserByEmail(
          slackUser.email,
          workspaceId,
          tenantId
        );

        if (asanaUser) {
          logger.info('USER MATCHING SUCCESS: Matched by email', {
            slackUserId,
            asanaUserId: asanaUser.id,
            email: slackUser.email
          });
          return asanaUser.id;
        }
        logger.debug('No Asana user found by email');
      }

      // No match found
      logger.warn('=== USER MATCHING FAILED: No match found ===', {
        slackUserId,
        slackUserName: slackUser.name,
        slackUserEmail: slackUser.email
      });
      return null;
    } catch (error) {
      logger.error('=== USER MATCHING FAILED WITH EXCEPTION ===', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        slackUserId,
        tenantId
      });
      return null;
    }
  }

  /**
   * Alert admin that user matching failed
   */
  async alertAdminAboutFailedMatch(tenantId: string, userName: string, slackUserId: string): Promise<void> {
    try {
      logger.info('Alerting admin about failed user match', { tenantId, userName, slackUserId });

      const tenant = this.tenantManager.getTenant(tenantId);
      if (!tenant) {
        logger.error('Cannot alert admin - tenant not found', { tenantId });
        return;
      }

      const message = {
        text: `User matching failed for *${userName}* (${slackUserId})`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*User Matching Failed*\n\nI couldn't find an Asana user that matches *${userName}* (Slack ID: \`${slackUserId}\`).\n\nPlease ensure this user's display name matches between Slack and Asana, or contact support to add a manual mapping.`,
            },
          },
        ],
      };

      await this.slackBot.sendDirectMessage(tenant.adminSlackUserId, message, tenantId);
      logger.info('Admin alerted about failed user match', { tenantId, userName });
    } catch (error) {
      logger.error('Failed to alert admin about failed user match', { error, tenantId, userName });
    }
  }
}
