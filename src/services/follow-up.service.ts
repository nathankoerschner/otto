import { logger } from '../utils/logger';
import { Task, FollowUpType } from '../models';
import { SlackBot } from '../integrations/slack';
import { AsanaClient } from '../integrations/asana';
import { TenantManagerService } from './tenant-manager.service';
import { ConversationContextService } from './conversation-context.service';
import { FollowUpsRepository, TasksRepository } from '../db/repositories';

/**
 * Service for managing task follow-ups
 */
export class FollowUpService {
  private followUpsRepo: FollowUpsRepository;
  private tasksRepo: TasksRepository;
  private conversationContextService?: ConversationContextService;

  constructor(
    private slackBot: SlackBot,
    private asanaClient: AsanaClient,
    _tenantManager: TenantManagerService,
    conversationContextService?: ConversationContextService
  ) {
    this.followUpsRepo = new FollowUpsRepository();
    this.tasksRepo = new TasksRepository();
    this.conversationContextService = conversationContextService;
  }

  /**
   * Schedule follow-ups for a task based on due date
   */
  async scheduleFollowUps(task: Task): Promise<void> {
    try {
      logger.info('Scheduling follow-ups', { taskId: task.id });

      if (!task.dueDate || !task.claimedAt) {
        logger.warn('Cannot schedule follow-ups without due date or claimed date', { taskId: task.id });
        return;
      }

      const claimedTime = task.claimedAt.getTime();
      const dueTime = task.dueDate.getTime();
      const duration = dueTime - claimedTime;

      if (duration <= 0) {
        logger.warn('Due date is in the past', { taskId: task.id, dueDate: task.dueDate });
        return;
      }

      // 1. Schedule half-time check-in (at 50% of time until due date)
      const halfTimeDate = new Date(claimedTime + duration * 0.5);
      if (halfTimeDate.getTime() > Date.now()) {
        await this.followUpsRepo.create({
          taskId: task.id,
          type: FollowUpType.HALF_TIME,
          scheduledAt: halfTimeDate,
        });
        logger.info('Half-time follow-up scheduled', { taskId: task.id, scheduledAt: halfTimeDate });
      }

      // 2. Schedule near-deadline reminder (24 hours before due date)
      const nearDeadlineDate = new Date(dueTime - 24 * 60 * 60 * 1000);
      if (nearDeadlineDate.getTime() > Date.now()) {
        await this.followUpsRepo.create({
          taskId: task.id,
          type: FollowUpType.NEAR_DEADLINE,
          scheduledAt: nearDeadlineDate,
        });
        logger.info('Near-deadline follow-up scheduled', { taskId: task.id, scheduledAt: nearDeadlineDate });
      }
    } catch (error) {
      logger.error('Error scheduling follow-ups', { error, taskId: task.id });
      throw error;
    }
  }

  /**
   * Process due follow-ups (run periodically)
   */
  async processDueFollowUps(): Promise<void> {
    try {
      logger.info('Processing due follow-ups');

      // 1. Query follow-ups that are due
      const dueFollowUps = await this.followUpsRepo.findDueFollowUps();

      if (dueFollowUps.length === 0) {
        logger.debug('No follow-ups due');
        return;
      }

      logger.info(`Found ${dueFollowUps.length} due follow-ups`);

      // 2. Send follow-up messages
      for (const followUp of dueFollowUps) {
        try {
          await this.sendFollowUp(followUp.taskId, followUp.type);
          await this.followUpsRepo.markAsSent(followUp.id);
        } catch (error) {
          logger.error('Error sending follow-up', { error, followUpId: followUp.id });
        }
      }
    } catch (error) {
      logger.error('Error processing due follow-ups', { error });
    }
  }

  /**
   * Send a follow-up message to task owner
   */
  async sendFollowUp(taskId: string, type: FollowUpType): Promise<void> {
    try {
      logger.info('Sending follow-up', { taskId, type });

      // 1. Get task and owner info
      const task = await this.tasksRepo.findById(taskId);
      if (!task || !task.ownerSlackUserId) {
        logger.warn('Cannot send follow-up - no task or owner', { taskId });
        return;
      }

      // Check if task is already completed
      const isCompleted = await this.asanaClient.isTaskCompleted(task.asanaTaskId, task.tenantId);
      if (isCompleted) {
        logger.info('Task already completed, skipping follow-up', { taskId });
        return;
      }

      // 2. Send conversational follow-up message
      const messageText = type === FollowUpType.HALF_TIME
        ? "Hey! How's it going with your task? Just checking in to see if you need any help."
        : "Hi! Just a friendly reminder that your task is due soon. How's the progress?";

      const asanaTask = await this.asanaClient.getTask(task.asanaTaskId, task.tenantId);

      const message = {
        text: messageText,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${messageText}\n\n*Task:* ${asanaTask.name}\nDue: ${task.dueDate ? task.dueDate.toLocaleDateString() : 'No due date'}\n<${asanaTask.url}|View in Asana>`,
            },
          },
        ],
      };

      await this.slackBot.sendDirectMessage(task.ownerSlackUserId, message, task.tenantId);
      logger.info('Follow-up sent', { taskId, ownerId: task.ownerSlackUserId, type });

      // Update conversation context if NLP is enabled
      const followUps = await this.followUpsRepo.findByTaskId(taskId);
      const currentFollowUp = followUps.find(f => f.type === type && !f.responseReceived);

      if (this.conversationContextService && currentFollowUp) {
        await this.conversationContextService.setAwaitingFollowUpResponse(
          task.tenantId,
          task.ownerSlackUserId,
          taskId,
          currentFollowUp.id
        );
        logger.debug('Updated conversation context for follow-up', {
          taskId,
          followUpId: currentFollowUp.id,
        });
      }
    } catch (error) {
      logger.error('Error sending follow-up', { error, taskId, type });
      throw error;
    }
  }

  /**
   * Handle follow-up response (basic - just marks as received)
   */
  async recordFollowUpResponse(taskId: string, response: string): Promise<void> {
    try {
      logger.info('Recording follow-up response', { taskId });

      // Find the most recent sent follow-up for this task that hasn't received a response
      const followUps = await this.followUpsRepo.findByTaskId(taskId);
      const sentFollowUps = followUps.filter(f => f.sentAt && !f.responseReceived);

      if (sentFollowUps.length > 0) {
        // Mark the most recent one as having received a response with basic text
        await this.followUpsRepo.updateWithResponse(sentFollowUps[0].id, {
          responseText: response,
        });
        logger.info('Follow-up response recorded', { taskId, followUpId: sentFollowUps[0].id });
      }
    } catch (error) {
      logger.error('Error recording follow-up response', { error, taskId });
    }
  }

  /**
   * Handle follow-up response with NLP analysis (enhanced)
   */
  async recordFollowUpResponseWithAnalysis(
    taskId: string,
    response: string,
    intent?: string,
    extractedData?: Record<string, unknown>
  ): Promise<void> {
    try {
      logger.info('Recording follow-up response with analysis', { taskId, intent });

      // Find the most recent sent follow-up for this task that hasn't received a response
      const followUps = await this.followUpsRepo.findByTaskId(taskId);
      const sentFollowUps = followUps.filter(f => f.sentAt && !f.responseReceived);

      if (sentFollowUps.length > 0) {
        await this.followUpsRepo.updateWithResponse(sentFollowUps[0].id, {
          responseText: response,
          responseIntent: intent,
          responseData: extractedData,
        });
        logger.info('Follow-up response recorded with analysis', {
          taskId,
          followUpId: sentFollowUps[0].id,
          intent,
        });
      }
    } catch (error) {
      logger.error('Error recording follow-up response with analysis', { error, taskId });
    }
  }
}
