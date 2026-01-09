import { logger } from '../utils/logger';
import { TaskStatus, Tenant } from '../models';
import { SlackBot } from '../integrations/slack';
import { AsanaClient } from '../integrations/asana';
import { TaskSystemTask } from '../integrations/interfaces/task-system.interface';
import { GoogleSheetsClient } from '../integrations/sheets';
import { TasksRepository } from '../db/repositories';
import { TenantManagerService } from './tenant-manager.service';
import { UserMatchingService } from './user-matching.service';
import { ConversationContextService } from './conversation-context.service';
import { config } from '../config';
import { ClaimTaskOutcome, DeclineTaskOutcome } from '../types/nlp.types';

/**
 * Service for handling task assignment flow
 */
export class TaskAssignmentService {
  private tasksRepo: TasksRepository;
  private sheetsClient: GoogleSheetsClient;
  private conversationContextService?: ConversationContextService;

  constructor(
    private slackBot: SlackBot,
    private asanaClient: AsanaClient,
    private tenantManager: TenantManagerService,
    private userMatchingService: UserMatchingService,
    conversationContextService?: ConversationContextService
  ) {
    this.tasksRepo = new TasksRepository();
    this.sheetsClient = new GoogleSheetsClient();
    this.conversationContextService = conversationContextService;
  }
  /**
   * Start the ownership-seeking flow for a new task
   */
  async seekOwnership(asanaTaskId: string, tenantId: string): Promise<void> {
    try {
      logger.info('Starting ownership-seeking flow', { asanaTaskId, tenantId });

      const tenant = this.tenantManager.getTenant(tenantId);
      if (!tenant) {
        logger.error('Tenant not found', { tenantId });
        return;
      }

      // 1. Get task details from Asana
      const asanaTask = await this.asanaClient.getTask(asanaTaskId, tenantId);
      logger.debug('Retrieved Asana task', { asanaTask });

      // 2. Check if task already exists in our database
      let task = await this.tasksRepo.findByAsanaTaskId(tenantId, asanaTaskId);
      if (task && task.status !== TaskStatus.PENDING_OWNER) {
        logger.info('Task already being processed', { taskId: task.id, status: task.status });
        return;
      }

      // 3. Create task record if it doesn't exist
      if (!task) {
        task = await this.tasksRepo.create({
          tenantId,
          asanaTaskId,
          asanaTaskUrl: asanaTask.url,
          status: TaskStatus.PENDING_OWNER,
          dueDate: asanaTask.dueDate,
        });
        logger.info('Created task record', { taskId: task.id });
      }

      // 4. Look up task in Google Sheet by task name
      const sheetRow = await this.sheetsClient.getTaskAssignment(tenant.gsheetUrl, asanaTask.name);

      if (!sheetRow) {
        logger.warn('Task not found in Google Sheet, escalating to admin', {
          taskId: task.id,
          taskName: asanaTask.name,
        });
        await this.escalateToAdmin(task.id, tenant, asanaTask, 'Task not found in Google Sheet');
        return;
      }

      logger.info('Found task assignment in sheet', { assignee: sheetRow.assignee });

      // 5. Find the Slack user for the assignee
      const slackUser = await this.slackBot.getUserByName(sheetRow.assignee, tenantId);

      if (!slackUser) {
        logger.warn('Could not find Slack user for assignee', {
          assignee: sheetRow.assignee,
          taskId: task.id,
        });
        await this.escalateToAdmin(task.id, tenant, asanaTask, `Could not find Slack user: ${sheetRow.assignee}`);
        return;
      }

      // 6. Send DM to designated assignee
      let dueDateText = '(no due date)';
      if (asanaTask.dueDate) {
        const now = new Date();
        const dueDate = new Date(asanaTask.dueDate);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          dueDateText = `(overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''})`;
        } else if (diffDays === 0) {
          dueDateText = '(due today)';
        } else if (diffDays === 1) {
          dueDateText = '(due tomorrow)';
        } else {
          dueDateText = `(due in ${diffDays} days)`;
        }
      }
      const message = {
        text: `New task: ${asanaTask.name}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hi there! Based on your expertise and the team's current workload, I thought you'd be a good fit for this task:\n\n<${asanaTask.url}|${asanaTask.name} ${dueDateText}>`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Would you be able to take this one on?`,
            },
          },
        ],
      };

      const messageTs = await this.slackBot.sendDirectMessage(slackUser.id, message, tenantId);
      logger.info('Sent task claim request to user', {
        taskId: task.id,
        userId: slackUser.id,
        messageTs,
      });

      // 7. Track proposition message for NLP correlation
      if (messageTs) {
        await this.tasksRepo.update(task.id, {
          propositionMessageTs: messageTs,
          propositionSentAt: new Date(),
        });
      }

      // 8. Update conversation context if NLP is enabled
      if (this.conversationContextService) {
        await this.conversationContextService.setAwaitingPropositionResponse(
          tenantId,
          slackUser.id,
          task.id
        );
        logger.debug('Updated conversation context for proposition', {
          taskId: task.id,
          userId: slackUser.id,
        });
      }

      // 9. Schedule escalation if no one claims within timeout
      this.scheduleEscalation(task.id, tenant);
    } catch (error) {
      logger.error('Error in seekOwnership', { error, asanaTaskId, tenantId });
      throw error;
    }
  }

  /**
   * Handle task claim by a user
   * Returns structured outcome for AI response generation
   */
  async claimTask(taskId: string, slackUserId: string, tenantId: string): Promise<ClaimTaskOutcome> {
    try {
      logger.info('=== CLAIM TASK START ===', { taskId, slackUserId, tenantId });

      // 1. Get task from database
      logger.debug('Step 1: Looking up task in database', { taskId });
      const task = await this.tasksRepo.findById(taskId);
      if (!task) {
        logger.error('CLAIM FAILED: Task not found in database', { taskId });
        return { action: 'claim_task', success: false, failureReason: 'task_not_found' };
      }
      logger.debug('Step 1 SUCCESS: Task found', { taskId, status: task.status, asanaTaskId: task.asanaTaskId });

      // 2. Check if task already claimed (race condition handling)
      logger.debug('Step 2: Checking if task already claimed', { currentStatus: task.status });
      if (task.status === TaskStatus.OWNED) {
        // If the same user is trying to claim again (double-click), return success (idempotent)
        if (task.ownerSlackUserId === slackUserId) {
          logger.info('Task already claimed by same user, returning success (idempotent)', { taskId, slackUserId });
          return { action: 'claim_task', success: true };
        }

        logger.warn('CLAIM FAILED: Task already claimed by another user', { taskId, currentOwner: task.ownerSlackUserId });

        // Get the name of who claimed it for the AI response
        const ownerUser = task.ownerSlackUserId
          ? await this.slackBot.getUserById(task.ownerSlackUserId, tenantId)
          : null;

        return {
          action: 'claim_task',
          success: false,
          failureReason: 'already_claimed',
          claimedByName: ownerUser?.name || 'someone else'
        };
      }
      logger.debug('Step 2 SUCCESS: Task not yet claimed');

      // 3. Match Slack user to Asana user
      logger.debug('Step 3: Getting tenant', { tenantId });
      const tenant = this.tenantManager.getTenant(tenantId);
      if (!tenant) {
        logger.error('CLAIM FAILED: Tenant not found', { tenantId });
        return { action: 'claim_task', success: false, failureReason: 'error' };
      }
      logger.debug('Step 3 SUCCESS: Tenant found', { tenantName: tenant.name });

      logger.debug('Step 4: Matching Slack user to Asana user', { slackUserId, asanaWorkspaceId: tenant.asanaWorkspaceId });
      const asanaUserId = await this.userMatchingService.matchUser(
        slackUserId,
        tenantId,
        tenant.asanaWorkspaceId
      );

      if (!asanaUserId) {
        logger.warn('CLAIM FAILED: Could not match user to Asana', { slackUserId, tenantId });

        const slackUser = await this.slackBot.getUserById(slackUserId, tenantId);
        await this.userMatchingService.alertAdminAboutFailedMatch(
          tenantId,
          slackUser?.name || slackUserId,
          slackUserId
        );

        return { action: 'claim_task', success: false, failureReason: 'asana_match_failed' };
      }
      logger.debug('Step 4 SUCCESS: User matched to Asana', { slackUserId, asanaUserId });

      // 5. Update task in database
      logger.debug('Step 5: Updating task in database', { taskId });
      const claimedAt = new Date();
      await this.tasksRepo.update(taskId, {
        status: TaskStatus.OWNED,
        ownerSlackUserId: slackUserId,
        ownerAsanaUserId: asanaUserId,
        claimedAt,
        dueDate: task.dueDate || new Date(Date.now() + config.bot.defaultDueDateDays * 24 * 60 * 60 * 1000),
      });
      logger.debug('Step 5 SUCCESS: Task updated in database', { taskId, slackUserId, asanaUserId });

      // 6. Reassign task in Asana
      logger.debug('Step 6: Reassigning task in Asana', { asanaTaskId: task.asanaTaskId, asanaUserId });
      await this.asanaClient.reassignTask(task.asanaTaskId, asanaUserId, tenantId);
      logger.info('Step 6 SUCCESS: Task reassigned in Asana', { taskId, asanaUserId });

      // 7. Add comment to Asana
      logger.debug('Step 7: Adding comment to Asana task');
      const slackUser = await this.slackBot.getUserById(slackUserId, tenantId);
      const comment = `Assigned to ${slackUser?.name || slackUserId} via Otto on ${new Date().toLocaleString()}`;
      await this.asanaClient.addComment(task.asanaTaskId, comment, tenantId);
      logger.debug('Step 7 SUCCESS: Comment added');

      logger.info('=== CLAIM TASK COMPLETE SUCCESS ===', { taskId, slackUserId, asanaUserId });
      return { action: 'claim_task', success: true };
    } catch (error) {
      logger.error('=== CLAIM TASK FAILED WITH EXCEPTION ===', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        taskId,
        slackUserId,
        tenantId
      });
      return { action: 'claim_task', success: false, failureReason: 'error' };
    }
  }

  /**
   * Handle task decline
   * Returns structured outcome for AI response generation
   */
  async declineTask(taskId: string, slackUserId: string, tenantId: string, reason?: string): Promise<DeclineTaskOutcome> {
    try {
      logger.info('User declining task', { taskId, slackUserId, tenantId, reason });

      const task = await this.tasksRepo.findById(taskId);
      if (!task) {
        logger.error('Task not found', { taskId });
        return { action: 'decline_task', success: false, failureReason: 'task_not_found' };
      }

      const tenant = this.tenantManager.getTenant(tenantId);
      if (!tenant) {
        logger.error('Tenant not found', { tenantId });
        return { action: 'decline_task', success: false, failureReason: 'error' };
      }

      // Get task details
      const asanaTask = await this.asanaClient.getTask(task.asanaTaskId, tenantId);

      // Escalate to admin - AI will handle the user-facing response
      await this.escalateToAdmin(
        taskId,
        tenant,
        asanaTask,
        `User ${slackUserId} declined the task${reason ? `: ${reason}` : ''}`
      );

      return { action: 'decline_task', success: true };
    } catch (error) {
      logger.error('Error declining task', { error, taskId, slackUserId, tenantId });
      return { action: 'decline_task', success: false, failureReason: 'error' };
    }
  }

  /**
   * Escalate task when no one claims within timeout
   */
  async escalateUnclaimedTask(taskId: string): Promise<void> {
    try {
      logger.info('Escalating unclaimed task', { taskId });

      const task = await this.tasksRepo.findById(taskId);
      if (!task || task.status !== TaskStatus.PENDING_OWNER) {
        logger.info('Task no longer pending, skipping escalation', { taskId, status: task?.status });
        return;
      }

      const tenant = this.tenantManager.getTenant(task.tenantId);
      if (!tenant) {
        logger.error('Tenant not found', { tenantId: task.tenantId });
        return;
      }

      const asanaTask = await this.asanaClient.getTask(task.asanaTaskId, task.tenantId);

      await this.escalateToAdmin(
        taskId,
        tenant,
        asanaTask,
        `No one claimed this task within ${config.bot.claimTimeoutHours} hours`
      );

      // Update task status
      await this.tasksRepo.updateStatus(taskId, TaskStatus.ESCALATED);
      logger.info('Task escalated and status updated', { taskId });
    } catch (error) {
      logger.error('Error escalating unclaimed task', { error, taskId });
    }
  }

  /**
   * Handle task completion
   */
  async handleTaskCompleted(asanaTaskId: string, tenantId: string): Promise<void> {
    try {
      logger.info('Handling task completion', { asanaTaskId, tenantId });

      const task = await this.tasksRepo.findByAsanaTaskId(tenantId, asanaTaskId);
      if (!task) {
        logger.warn('Task not found in database', { asanaTaskId, tenantId });
        return;
      }

      // Update task status to completed
      await this.tasksRepo.updateStatus(task.id, TaskStatus.COMPLETED);
      logger.info('Task marked as completed', { taskId: task.id });

      // Optionally send congrats message to owner
      if (task.ownerSlackUserId) {
        await this.slackBot.sendDirectMessage(task.ownerSlackUserId, {
          text: `Great job completing the task! It's been marked as done in Asana.`,
        }, tenantId);
      }
    } catch (error) {
      logger.error('Error handling task completion', { error, asanaTaskId, tenantId });
    }
  }

  /**
   * Helper: Escalate to admin
   */
  private async escalateToAdmin(
    taskId: string,
    tenant: Tenant,
    asanaTask: TaskSystemTask,
    reason: string
  ): Promise<void> {
    try {
      logger.info('Escalating to admin', { taskId, reason });

      const message = {
        text: `Task escalation: ${asanaTask.name}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Task Escalation*\n\n*Task:* ${asanaTask.name}\n*Reason:* ${reason}\n\n<${asanaTask.url}|View in Asana>`,
            },
          },
        ],
      };

      await this.slackBot.sendDirectMessage(tenant.adminSlackUserId, message, tenant.id);
      await this.tasksRepo.updateStatus(taskId, TaskStatus.ESCALATED);

      logger.info('Admin notified of escalation', { taskId });
    } catch (error) {
      logger.error('Failed to escalate to admin', { error, taskId });
    }
  }

  /**
   * Helper: Schedule escalation timeout
   */
  private scheduleEscalation(taskId: string, _tenant: Tenant): void {
    const timeoutMs = config.bot.claimTimeoutHours * 60 * 60 * 1000;

    setTimeout(async () => {
      try {
        await this.escalateUnclaimedTask(taskId);
      } catch (error) {
        logger.error('Error in scheduled escalation', { error, taskId });
      }
    }, timeoutMs);

    logger.info('Escalation scheduled', { taskId, timeoutHours: config.bot.claimTimeoutHours });
  }
}
