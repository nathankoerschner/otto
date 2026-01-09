import { SayFn } from '@slack/bolt';
import { ILLMService } from '../integrations/llm';
import { ConversationContextService } from '../services/conversation-context.service';
import { TaskAssignmentService } from '../services/task-assignment.service';
import { ConversationState } from '../models';
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
    private taskAssignmentService: TaskAssignmentService
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
        text: "I'm having trouble processing your message right now. Please hold.",
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

    if (propositionCompletingIntents.includes(intent)) {
      // Task claimed or declined - reset to idle
      await this.contextService.updateContext(conversationId, {
        state: ConversationState.IDLE,
        pendingPropositionTaskId: null,
        activeTaskId: intent === MessageIntent.ACCEPT_TASK ? taskContext?.task.id : null,
      });
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
}
