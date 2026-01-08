import { query } from '../index';
import { Conversation, ConversationMessage, ConversationState } from '../../models';
import { logger } from '../../utils/logger';

interface ConversationRow {
  id: string;
  tenant_id: string;
  slack_user_id: string;
  slack_channel_id: string | null;
  state: string;
  active_task_id: string | null;
  pending_proposition_task_id: string | null;
  pending_follow_up_id: string | null;
  last_interaction_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  classified_intent: string | null;
  confidence: string | null;
  extracted_data: Record<string, unknown> | null;
  slack_message_ts: string | null;
  created_at: Date;
}

function mapRowToConversation(row: unknown): Conversation {
  const r = row as ConversationRow;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    slackUserId: r.slack_user_id,
    slackChannelId: r.slack_channel_id,
    state: r.state as ConversationState,
    activeTaskId: r.active_task_id,
    pendingPropositionTaskId: r.pending_proposition_task_id,
    pendingFollowUpId: r.pending_follow_up_id,
    lastInteractionAt: r.last_interaction_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRowToMessage(row: unknown): ConversationMessage {
  const r = row as ConversationMessageRow;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    classifiedIntent: r.classified_intent,
    confidence: r.confidence ? parseFloat(r.confidence) : null,
    extractedData: r.extracted_data,
    slackMessageTs: r.slack_message_ts,
    createdAt: r.created_at,
  };
}

export class ConversationsRepository {
  /**
   * Find a conversation by tenant and Slack user
   */
  async findByUserAndTenant(
    tenantId: string,
    slackUserId: string
  ): Promise<Conversation | null> {
    try {
      const result = await query(
        'SELECT * FROM conversations WHERE tenant_id = $1 AND slack_user_id = $2',
        [tenantId, slackUserId]
      );
      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find conversation', { error, tenantId, slackUserId });
      throw error;
    }
  }

  /**
   * Find a conversation by ID
   */
  async findById(id: string): Promise<Conversation | null> {
    try {
      const result = await query(
        'SELECT * FROM conversations WHERE id = $1',
        [id]
      );
      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find conversation by ID', { error, id });
      throw error;
    }
  }

  /**
   * Find conversation awaiting response for a specific task proposition
   */
  async findByPendingProposition(
    tenantId: string,
    taskId: string
  ): Promise<Conversation | null> {
    try {
      const result = await query(
        `SELECT * FROM conversations
         WHERE tenant_id = $1
         AND pending_proposition_task_id = $2
         AND state = $3`,
        [tenantId, taskId, ConversationState.AWAITING_PROPOSITION_RESPONSE]
      );
      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find conversation by pending proposition', { error, tenantId, taskId });
      throw error;
    }
  }

  /**
   * Find conversation awaiting response for a specific follow-up
   */
  async findByPendingFollowUp(
    tenantId: string,
    followUpId: string
  ): Promise<Conversation | null> {
    try {
      const result = await query(
        `SELECT * FROM conversations
         WHERE tenant_id = $1
         AND pending_follow_up_id = $2
         AND state = $3`,
        [tenantId, followUpId, ConversationState.AWAITING_FOLLOW_UP_RESPONSE]
      );
      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find conversation by pending follow-up', { error, tenantId, followUpId });
      throw error;
    }
  }

  /**
   * Find stale conversations that should be reset to idle
   */
  async findStaleConversations(olderThan: Date): Promise<Conversation[]> {
    try {
      const result = await query(
        `SELECT * FROM conversations
         WHERE state != $1
         AND last_interaction_at < $2`,
        [ConversationState.IDLE, olderThan]
      );
      return result.rows.map(mapRowToConversation);
    } catch (error) {
      logger.error('Failed to find stale conversations', { error, olderThan });
      throw error;
    }
  }

  /**
   * Create a new conversation
   */
  async create(conversation: {
    tenantId: string;
    slackUserId: string;
    slackChannelId?: string;
    state?: ConversationState;
    activeTaskId?: string;
    pendingPropositionTaskId?: string;
    pendingFollowUpId?: string;
  }): Promise<Conversation> {
    try {
      const result = await query(
        `INSERT INTO conversations (
          tenant_id, slack_user_id, slack_channel_id, state,
          active_task_id, pending_proposition_task_id, pending_follow_up_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          conversation.tenantId,
          conversation.slackUserId,
          conversation.slackChannelId || null,
          conversation.state || ConversationState.IDLE,
          conversation.activeTaskId || null,
          conversation.pendingPropositionTaskId || null,
          conversation.pendingFollowUpId || null,
        ]
      );
      return mapRowToConversation(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create conversation', { error, conversation });
      throw error;
    }
  }

  /**
   * Update a conversation
   */
  async update(
    id: string,
    updates: {
      state?: ConversationState;
      slackChannelId?: string;
      activeTaskId?: string | null;
      pendingPropositionTaskId?: string | null;
      pendingFollowUpId?: string | null;
      lastInteractionAt?: Date;
    }
  ): Promise<Conversation | null> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCounter = 1;

      // Always update last_interaction_at when updating
      fields.push(`last_interaction_at = $${paramCounter}`);
      values.push(updates.lastInteractionAt || new Date());
      paramCounter++;

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'lastInteractionAt') return; // Already handled
        if (value !== undefined) {
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          fields.push(`${snakeKey} = $${paramCounter}`);
          values.push(value);
          paramCounter++;
        }
      });

      values.push(id);
      const result = await query(
        `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
        values
      );

      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update conversation', { error, id, updates });
      throw error;
    }
  }

  /**
   * Reset a conversation to idle state
   */
  async resetToIdle(id: string): Promise<Conversation | null> {
    try {
      const result = await query(
        `UPDATE conversations SET
          state = $1,
          active_task_id = NULL,
          pending_proposition_task_id = NULL,
          pending_follow_up_id = NULL,
          last_interaction_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [ConversationState.IDLE, id]
      );
      return result.rows[0] ? mapRowToConversation(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to reset conversation to idle', { error, id });
      throw error;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(message: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    classifiedIntent?: string;
    confidence?: number;
    extractedData?: Record<string, unknown>;
    slackMessageTs?: string;
  }): Promise<ConversationMessage> {
    try {
      const result = await query(
        `INSERT INTO conversation_messages (
          conversation_id, role, content, classified_intent,
          confidence, extracted_data, slack_message_ts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          message.conversationId,
          message.role,
          message.content,
          message.classifiedIntent || null,
          message.confidence || null,
          message.extractedData ? JSON.stringify(message.extractedData) : null,
          message.slackMessageTs || null,
        ]
      );
      return mapRowToMessage(result.rows[0]);
    } catch (error) {
      logger.error('Failed to add conversation message', { error, message });
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    limit: number = 10
  ): Promise<ConversationMessage[]> {
    try {
      const result = await query(
        `SELECT * FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [conversationId, limit]
      );
      // Reverse to get chronological order
      return result.rows.map(mapRowToMessage).reverse();
    } catch (error) {
      logger.error('Failed to get conversation messages', { error, conversationId });
      throw error;
    }
  }

  /**
   * Delete a conversation and all its messages
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM conversations WHERE id = $1', [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete conversation', { error, id });
      throw error;
    }
  }

  /**
   * Delete messages older than a certain date
   */
  async deleteOldMessages(olderThan: Date): Promise<number> {
    try {
      const result = await query(
        'DELETE FROM conversation_messages WHERE created_at < $1',
        [olderThan]
      );
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete old messages', { error, olderThan });
      throw error;
    }
  }
}
