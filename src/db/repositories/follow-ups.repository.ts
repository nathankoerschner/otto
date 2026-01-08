import { query } from '../index';
import { FollowUp, FollowUpType } from '../../models';
import { logger } from '../../utils/logger';

interface FollowUpRow {
  id: string;
  task_id: string;
  type: string;
  scheduled_at: Date;
  sent_at: Date | null;
  response_received: boolean;
  response_text: string | null;
  response_intent: string | null;
  response_data: Record<string, unknown> | null;
  response_at: Date | null;
  created_at: Date;
}

function mapRowToFollowUp(row: unknown): FollowUp {
  const r = row as FollowUpRow;
  return {
    id: r.id,
    taskId: r.task_id,
    type: r.type as FollowUpType,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    responseReceived: r.response_received,
    responseText: r.response_text,
    responseIntent: r.response_intent,
    responseData: r.response_data,
    responseAt: r.response_at,
    createdAt: r.created_at,
  };
}

export class FollowUpsRepository {
  async findById(id: string): Promise<FollowUp | null> {
    try {
      const result = await query(
        'SELECT * FROM follow_ups WHERE id = $1',
        [id]
      );
      return result.rows[0] ? mapRowToFollowUp(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find follow-up by ID', { error, id });
      throw error;
    }
  }

  async findByTaskId(taskId: string): Promise<FollowUp[]> {
    try {
      const result = await query(
        'SELECT * FROM follow_ups WHERE task_id = $1 ORDER BY scheduled_at ASC',
        [taskId]
      );
      return result.rows.map(mapRowToFollowUp);
    } catch (error) {
      logger.error('Failed to find follow-ups by task ID', { error, taskId });
      throw error;
    }
  }

  async findDueFollowUps(before: Date = new Date()): Promise<FollowUp[]> {
    try {
      const result = await query(
        'SELECT * FROM follow_ups WHERE scheduled_at <= $1 AND sent_at IS NULL ORDER BY scheduled_at ASC',
        [before]
      );
      return result.rows.map(mapRowToFollowUp);
    } catch (error) {
      logger.error('Failed to find due follow-ups', { error, before });
      throw error;
    }
  }

  async findUnresponsiveFollowUps(afterHours: number = 24): Promise<FollowUp[]> {
    try {
      const cutoffTime = new Date(Date.now() - afterHours * 60 * 60 * 1000);
      const result = await query(
        'SELECT * FROM follow_ups WHERE sent_at IS NOT NULL AND sent_at <= $1 AND response_received = FALSE',
        [cutoffTime]
      );
      return result.rows.map(mapRowToFollowUp);
    } catch (error) {
      logger.error('Failed to find unresponsive follow-ups', { error, afterHours });
      throw error;
    }
  }

  async create(followUp: {
    taskId: string;
    type: FollowUpType;
    scheduledAt: Date;
  }): Promise<FollowUp> {
    try {
      const result = await query(
        `INSERT INTO follow_ups (task_id, type, scheduled_at)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [followUp.taskId, followUp.type, followUp.scheduledAt]
      );
      return mapRowToFollowUp(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create follow-up', { error, followUp });
      throw error;
    }
  }

  async markAsSent(id: string, sentAt: Date = new Date()): Promise<FollowUp | null> {
    try {
      const result = await query(
        'UPDATE follow_ups SET sent_at = $1 WHERE id = $2 RETURNING *',
        [sentAt, id]
      );
      return result.rows[0] ? mapRowToFollowUp(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to mark follow-up as sent', { error, id });
      throw error;
    }
  }

  async markResponseReceived(id: string): Promise<FollowUp | null> {
    try {
      const result = await query(
        'UPDATE follow_ups SET response_received = TRUE, response_at = $1 WHERE id = $2 RETURNING *',
        [new Date(), id]
      );
      return result.rows[0] ? mapRowToFollowUp(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to mark follow-up response received', { error, id });
      throw error;
    }
  }

  async updateWithResponse(
    id: string,
    response: {
      responseText: string;
      responseIntent?: string;
      responseData?: Record<string, unknown>;
    }
  ): Promise<FollowUp | null> {
    try {
      const result = await query(
        `UPDATE follow_ups SET
          response_received = TRUE,
          response_text = $1,
          response_intent = $2,
          response_data = $3,
          response_at = $4
        WHERE id = $5
        RETURNING *`,
        [
          response.responseText,
          response.responseIntent || null,
          response.responseData ? JSON.stringify(response.responseData) : null,
          new Date(),
          id,
        ]
      );
      return result.rows[0] ? mapRowToFollowUp(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update follow-up with response', { error, id, response });
      throw error;
    }
  }

  async deleteByTaskId(taskId: string): Promise<number> {
    try {
      const result = await query('DELETE FROM follow_ups WHERE task_id = $1', [taskId]);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete follow-ups by task ID', { error, taskId });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM follow_ups WHERE id = $1', [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete follow-up', { error, id });
      throw error;
    }
  }
}
