import { ConversationsRepository } from '../db/repositories/conversations.repository';
import { TasksRepository } from '../db/repositories/tasks.repository';
import { FollowUpsRepository } from '../db/repositories/follow-ups.repository';
import {
  Conversation,
  ConversationMessage,
  ConversationState,
  Task,
  FollowUp,
} from '../models';
import { ConversationContext, TaskContext } from '../types/nlp.types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Service for managing conversation context and correlating messages to tasks
 */
export class ConversationContextService {
  constructor(
    private conversationsRepo: ConversationsRepository,
    private tasksRepo: TasksRepository,
    private followUpsRepo: FollowUpsRepository
  ) {}

  /**
   * Get or create a conversation context for a user
   */
  async getOrCreateContext(
    slackUserId: string,
    tenantId: string,
    slackChannelId?: string
  ): Promise<ConversationContext> {
    let conversation = await this.conversationsRepo.findByUserAndTenant(
      tenantId,
      slackUserId
    );

    if (!conversation) {
      conversation = await this.conversationsRepo.create({
        tenantId,
        slackUserId,
        slackChannelId,
        state: ConversationState.IDLE,
      });
    }

    // Get recent messages for context
    const messages = await this.conversationsRepo.getMessages(
      conversation.id,
      config.nlp.maxConversationHistory
    );

    // Get active task if set
    let activeTask: Task | undefined;
    if (conversation.activeTaskId) {
      activeTask = (await this.tasksRepo.findById(conversation.activeTaskId)) || undefined;
    }

    // Get pending follow-up if set
    let pendingFollowUp: FollowUp | undefined;
    if (conversation.pendingFollowUpId) {
      const followUps = await this.followUpsRepo.findByTaskId(
        conversation.activeTaskId || ''
      );
      pendingFollowUp = followUps.find(f => f.id === conversation.pendingFollowUpId);
    }

    return {
      conversation,
      messages,
      activeTask,
      pendingFollowUp,
    };
  }

  /**
   * Update conversation state and context
   */
  async updateContext(
    conversationId: string,
    updates: Partial<{
      state: ConversationState;
      activeTaskId: string | null;
      pendingPropositionTaskId: string | null;
      pendingFollowUpId: string | null;
    }>
  ): Promise<Conversation | null> {
    return this.conversationsRepo.update(conversationId, {
      ...updates,
      lastInteractionAt: new Date(),
    });
  }

  /**
   * Add a message to the conversation history
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    classifiedIntent?: string,
    confidence?: number,
    extractedData?: Record<string, unknown>,
    slackMessageTs?: string
  ): Promise<ConversationMessage> {
    // Update last interaction time
    await this.conversationsRepo.update(conversationId, {
      lastInteractionAt: new Date(),
    });

    return this.conversationsRepo.addMessage({
      conversationId,
      role,
      content,
      classifiedIntent,
      confidence,
      extractedData,
      slackMessageTs,
    });
  }

  /**
   * Correlate a message to a task based on conversation context
   *
   * Priority:
   * 1. If there's a pending proposition, use that task
   * 2. If there's an active task from a follow-up, use that
   * 3. If user has only one active task, use that
   * 4. Otherwise, return null (ambiguous)
   */
  async correlateMessageToTask(
    slackUserId: string,
    tenantId: string,
    _message: string // Could be used for task name matching in future
  ): Promise<Task | null> {
    const conversation = await this.conversationsRepo.findByUserAndTenant(
      tenantId,
      slackUserId
    );

    if (!conversation) {
      return null;
    }

    // 1. Check for pending proposition
    if (
      conversation.state === ConversationState.AWAITING_PROPOSITION_RESPONSE &&
      conversation.pendingPropositionTaskId
    ) {
      return this.tasksRepo.findById(conversation.pendingPropositionTaskId);
    }

    // 2. Check for active task from follow-up
    if (
      conversation.state === ConversationState.AWAITING_FOLLOW_UP_RESPONSE &&
      conversation.activeTaskId
    ) {
      return this.tasksRepo.findById(conversation.activeTaskId);
    }

    // 3. Check for active task when in conversation (preserves context during Q&A)
    if (
      conversation.state === ConversationState.IN_CONVERSATION &&
      conversation.activeTaskId
    ) {
      return this.tasksRepo.findById(conversation.activeTaskId);
    }

    // 4. Check if user has only one active task
    const userTasks = await this.tasksRepo.findByOwner(tenantId, slackUserId);
    if (userTasks.length === 1) {
      return userTasks[0];
    }

    // 5. Ambiguous - user has multiple tasks or no tasks
    return null;
  }

  /**
   * Get enriched task context for LLM processing
   */
  async getTaskContext(taskId: string): Promise<TaskContext | null> {
    const task = await this.tasksRepo.findById(taskId);
    if (!task) {
      return null;
    }

    const followUps = await this.followUpsRepo.findByTaskId(taskId);
    const lastFollowUpSent = followUps
      .filter(f => f.sentAt)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))[0];

    return {
      task,
      asanaTaskName: '', // Will be populated by the handler with Asana data
      asanaTaskUrl: task.asanaTaskUrl,
      followUps,
      lastFollowUpSent,
    };
  }

  /**
   * Set conversation to await proposition response
   */
  async setAwaitingPropositionResponse(
    tenantId: string,
    slackUserId: string,
    taskId: string
  ): Promise<Conversation | null> {
    let conversation = await this.conversationsRepo.findByUserAndTenant(
      tenantId,
      slackUserId
    );

    if (!conversation) {
      conversation = await this.conversationsRepo.create({
        tenantId,
        slackUserId,
        state: ConversationState.AWAITING_PROPOSITION_RESPONSE,
        pendingPropositionTaskId: taskId,
        activeTaskId: taskId,
      });
      return conversation;
    }

    return this.conversationsRepo.update(conversation.id, {
      state: ConversationState.AWAITING_PROPOSITION_RESPONSE,
      pendingPropositionTaskId: taskId,
      activeTaskId: taskId,
    });
  }

  /**
   * Set conversation to await follow-up response
   */
  async setAwaitingFollowUpResponse(
    tenantId: string,
    slackUserId: string,
    taskId: string,
    followUpId: string
  ): Promise<Conversation | null> {
    let conversation = await this.conversationsRepo.findByUserAndTenant(
      tenantId,
      slackUserId
    );

    if (!conversation) {
      conversation = await this.conversationsRepo.create({
        tenantId,
        slackUserId,
        state: ConversationState.AWAITING_FOLLOW_UP_RESPONSE,
        activeTaskId: taskId,
        pendingFollowUpId: followUpId,
      });
      return conversation;
    }

    return this.conversationsRepo.update(conversation.id, {
      state: ConversationState.AWAITING_FOLLOW_UP_RESPONSE,
      activeTaskId: taskId,
      pendingFollowUpId: followUpId,
    });
  }

  /**
   * Reset conversation to idle state
   */
  async resetToIdle(conversationId: string): Promise<Conversation | null> {
    return this.conversationsRepo.resetToIdle(conversationId);
  }

  /**
   * Expire stale conversations for a specific tenant that haven't had interaction within TTL
   */
  async expireStaleContexts(tenantId: string): Promise<number> {
    const ttlHours = config.nlp.conversationTtlHours;
    const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

    const staleConversations = await this.conversationsRepo.findStaleConversations(tenantId, cutoff);

    let resetCount = 0;
    for (const conversation of staleConversations) {
      try {
        await this.conversationsRepo.resetToIdle(conversation.id);
        resetCount++;
      } catch (error) {
        logger.error('Failed to reset stale conversation', {
          error,
          conversationId: conversation.id,
          tenantId,
        });
      }
    }

    if (resetCount > 0) {
      logger.info('Reset stale conversations', { count: resetCount, tenantId });
    }

    return resetCount;
  }
}
