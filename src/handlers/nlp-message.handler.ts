import { SayFn } from '@slack/bolt';
import { ILLMService } from '../integrations/llm';
import { ConversationContextService } from '../services/conversation-context.service';
import { TaskAssignmentService } from '../services/task-assignment.service';
import { FollowUpService } from '../services/follow-up.service';
import { TasksRepository } from '../db/repositories/tasks.repository';
import { ConversationState, TaskStatus } from '../models';
import {
  IncomingMessage,
  MessageIntent,
  ConversationContext,
  TaskContext,
  ActionOutcome,
  IntentClassification,
} from '../types/nlp.types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Handler for processing messages using NLP/LLM
 */
export class NLPMessageHandler {
  constructor(
    private llmService: ILLMService,
    private contextService: ConversationContextService,
    private taskAssignmentService: TaskAssignmentService,
    private followUpService: FollowUpService,
    private tasksRepo: TasksRepository
  ) {}

  /**
   * Main entry point for handling messages with NLP
   */
  async handleMessage(message: IncomingMessage, say: SayFn): Promise<void> {
    try {
      // 1. Get or create conversation context
      const context = await this.contextService.getOrCreateContext(
        message.userId,
        message.tenantId,
        message.channelId
      );

      // 2. Add user message to history
      await this.contextService.addMessage(
        context.conversation.id,
        'user',
        message.text,
        undefined,
        undefined,
        undefined,
        message.messageTs
      );

      // 3. Get task context if applicable
      const taskContext = await this.getTaskContext(message, context);

      // 4. Classify intent first (before executing actions)
      const intent = await this.llmService.classifyIntent(
        message.text,
        context,
        taskContext || undefined
      );

      logger.info('LLM classification result', {
        intent: intent.intent,
        confidence: intent.confidence,
        userId: message.userId,
      });

      // 5. Check confidence threshold
      if (intent.confidence < config.nlp.confidenceThreshold) {
        await this.handleLowConfidence(say, message.text, context);
        return;
      }

      const useTaskDetailsFallback = this.shouldUseTaskDetailsFallback(intent, taskContext);

      // 6. Execute actions FIRST and capture outcomes
      const actionOutcome = useTaskDetailsFallback
        ? undefined
        : await this.executeActionsWithOutcome(intent, message, taskContext);

      // 7. Generate response with action outcome (so LLM knows what actually happened)
      const response = useTaskDetailsFallback
        ? {
            text:
              "I don't have the full task details here. Please check the Asana card for further detail, and let me know if you'd like to take it on.",
            suggestedActions: [],
          }
        : await this.llmService.generateResponse(
            intent,
            message.text,
            context,
            taskContext || undefined,
            actionOutcome
          );

      // 8. Send response to user
      await say({
        text: response.text,
        blocks: response.blocks,
        thread_ts: message.threadTs,
      });


      // 9. Update conversation context with assistant response
      await this.contextService.addMessage(
        context.conversation.id,
        'assistant',
        response.text,
        intent.intent,
        intent.confidence,
        intent.extractedData
      );

      // 10. Update conversation state based on intent
      await this.updateConversationState(context, intent.intent, taskContext);

    } catch (error) {
      logger.error('Error in NLP message handler', {
        error,
        userId: message.userId,
        tenantId: message.tenantId,
        channelId: message.channelId,
        messageTs: message.messageTs,
      });

      // Send a friendly error message
      await say({
        text: "I'm having trouble processing your message right now. Please try again or use the buttons on my messages.",
        thread_ts: message.threadTs,
      });
    }
  }

  /**
   * Get task context for the message
   */
  private async getTaskContext(
    message: IncomingMessage,
    _context: ConversationContext
  ): Promise<TaskContext | null> {
    // First, try to correlate from conversation context
    const correlatedTask = await this.contextService.correlateMessageToTask(
      message.userId,
      message.tenantId,
      message.text
    );

    if (!correlatedTask) {
      return null;
    }

    // Get enriched task context
    const taskContext = await this.contextService.getTaskContext(correlatedTask.id);

    return taskContext;
  }

  /**
   * Execute actions based on intent and return outcome for response generation
   * This ensures the LLM knows the actual result before generating a response
   */
  private async executeActionsWithOutcome(
    intent: { intent: MessageIntent; extractedData?: Record<string, unknown> },
    message: IncomingMessage,
    taskContext: TaskContext | null
  ): Promise<ActionOutcome | undefined> {
    const taskId = taskContext?.task.id;

    if (!taskId) {
      return undefined;
    }

    try {
      switch (intent.intent) {
        case MessageIntent.ACCEPT_TASK: {
          const outcome = await this.taskAssignmentService.claimTask(
            taskId,
            message.userId,
            message.tenantId
          );
          logger.info('Task claim attempted via NLP', { taskId, userId: message.userId, outcome });
          return outcome;
        }

        case MessageIntent.DECLINE_TASK: {
          const reason = intent.extractedData?.reason as string | undefined;
          const outcome = await this.taskAssignmentService.declineTask(
            taskId,
            message.userId,
            message.tenantId,
            reason
          );
          logger.info('Task decline attempted via NLP', { taskId, userId: message.userId, reason, outcome });
          return outcome;
        }

        case MessageIntent.REPORT_COMPLETION: {
          await this.tasksRepo.updateStatus(taskId, TaskStatus.COMPLETED);
          logger.info('Task marked complete via NLP', { taskId, userId: message.userId });
          return { action: 'update_task_status', success: true };
        }

        case MessageIntent.REPORT_BLOCKER: {
          await this.notifyAdmin(message.tenantId, taskId, { blockerDetails: intent.extractedData });
          logger.info('Admin notified of blocker via NLP', { taskId });
          return { action: 'notify_admin', success: true };
        }

        case MessageIntent.REQUEST_HELP: {
          await this.escalateTask(message.tenantId, taskId, intent.extractedData);
          logger.info('Task escalated via NLP', { taskId });
          return { action: 'escalate', success: true };
        }

        case MessageIntent.REQUEST_EXTENSION: {
          await this.notifyAdmin(message.tenantId, taskId, { extensionRequest: intent.extractedData });
          logger.info('Extension request sent to admin via NLP', { taskId });
          return { action: 'notify_admin', success: true };
        }

        default:
          // No action needed for other intents (questions, greetings, etc.)
          return undefined;
      }
    } catch (error) {
      logger.error('Failed to execute action', { error, intent: intent.intent, taskId });
      return undefined;
    }
  }

  private shouldUseTaskDetailsFallback(
    intent: IntentClassification,
    taskContext: TaskContext | null
  ): boolean {
    if (!taskContext) {
      return false;
    }

    return (
      (intent.intent === MessageIntent.ASK_QUESTION ||
        intent.intent === MessageIntent.REQUEST_MORE_INFO) &&
      !taskContext.formattedAsanaData
    );
  }


  /**
   * Handle low confidence classifications by asking for clarification
   */
  private async handleLowConfidence(
    say: SayFn,
    originalMessage: string,
    context: ConversationContext
  ): Promise<void> {
    let clarificationMessage: string;

    if (context.conversation.state === ConversationState.AWAITING_PROPOSITION_RESPONSE) {
      clarificationMessage =
        "I'm not quite sure how to interpret your response. Would you like to take on this task? " +
        "You can say 'yes' to accept, 'no' to decline, or ask me a question about the task.";
    } else if (context.conversation.state === ConversationState.AWAITING_FOLLOW_UP_RESPONSE) {
      clarificationMessage =
        "Thanks for your update! Could you clarify - how's the task going? " +
        "Let me know if you're on track, blocked, or if you've completed it.";
    } else {
      clarificationMessage =
        "I'm not sure what you're asking. You can:\n" +
        "• Ask about your tasks ('What are my tasks?')\n" +
        "• Get help ('Help')\n" +
        "• Respond to any task messages I've sent you";
    }

    await say({ text: clarificationMessage });

    // Log for improvement
    logger.info('Low confidence classification', {
      message: originalMessage,
      state: context.conversation.state,
    });
  }

  /**
   * Update conversation state based on the processed intent
   */
  private async updateConversationState(
    context: ConversationContext,
    intent: MessageIntent,
    taskContext: TaskContext | null
  ): Promise<void> {
    const conversationId = context.conversation.id;

    // Intents that complete a proposition response
    const propositionCompletingIntents = [
      MessageIntent.ACCEPT_TASK,
      MessageIntent.DECLINE_TASK,
    ];

    // Intents that complete a follow-up response
    const followUpCompletingIntents = [
      MessageIntent.STATUS_UPDATE,
      MessageIntent.REPORT_BLOCKER,
      MessageIntent.REPORT_COMPLETION,
      MessageIntent.REQUEST_HELP,
      MessageIntent.REQUEST_EXTENSION,
    ];

    if (propositionCompletingIntents.includes(intent)) {
      // Task claimed or declined - reset to idle
      await this.contextService.updateContext(conversationId, {
        state: ConversationState.IDLE,
        pendingPropositionTaskId: null,
        activeTaskId: intent === MessageIntent.ACCEPT_TASK ? taskContext?.task.id : null,
      });
    } else if (followUpCompletingIntents.includes(intent)) {
      // Follow-up response recorded
      if (taskContext?.task.id) {
        await this.followUpService.recordFollowUpResponse(
          taskContext.task.id,
          context.messages[context.messages.length - 1]?.content || ''
        );
      }

      // If task completed, reset to idle; otherwise stay in conversation
      if (intent === MessageIntent.REPORT_COMPLETION) {
        await this.contextService.updateContext(conversationId, {
          state: ConversationState.IDLE,
          pendingFollowUpId: null,
        });
      } else {
        await this.contextService.updateContext(conversationId, {
          state: ConversationState.IN_CONVERSATION,
          pendingFollowUpId: null,
        });
      }
    } else if (intent === MessageIntent.ASK_QUESTION || intent === MessageIntent.REQUEST_MORE_INFO) {
      // User asking questions - stay in current state but mark as in conversation
      // IMPORTANT: Preserve the task ID so we maintain context about which task we're discussing
      await this.contextService.updateContext(conversationId, {
        state: ConversationState.IN_CONVERSATION,
        activeTaskId: taskContext?.task.id || context.conversation.activeTaskId,
      });
    }
    // For other intents (greeting, help, unknown), don't change state
  }

  /**
   * Notify admin about an issue with a task
   */
  private async notifyAdmin(
    tenantId: string,
    taskId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const task = await this.tasksRepo.findById(taskId);
      if (!task) return;

      // Get admin user ID from tenant
      // Note: This would need to be implemented in TenantManagerService
      // For now, just log the notification
      logger.info('Admin notification queued', {
        tenantId,
        taskId,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to notify admin', { error, tenantId, taskId });
    }
  }

  /**
   * Escalate a task issue
   */
  private async escalateTask(
    tenantId: string,
    taskId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      logger.info('Task escalation queued', {
        tenantId,
        taskId,
        metadata,
      });
      // Escalation logic would be implemented here
    } catch (error) {
      logger.error('Failed to escalate task', { error, tenantId, taskId });
    }
  }
}
