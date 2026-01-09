import { query } from '../index';
import { Task, TaskStatus } from '../../models';
import { logger } from '../../utils/logger';

interface TaskRow {
  id: string;
  tenant_id: string;
  asana_task_id: string;
  asana_task_url: string;
  status: TaskStatus;
  owner_slack_user_id: string | null;
  owner_asana_user_id: string | null;
  due_date: Date | null;
  claimed_at: Date | null;
  proposition_message_ts: string | null;
  proposition_sent_at: Date | null;
  context: unknown | null;
  created_at: Date;
  updated_at: Date;
}

function mapRowToTask(row: unknown): Task {
  const r = row as TaskRow;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    asanaTaskId: r.asana_task_id,
    asanaTaskUrl: r.asana_task_url,
    status: r.status,
    ownerSlackUserId: r.owner_slack_user_id,
    ownerAsanaUserId: r.owner_asana_user_id,
    dueDate: r.due_date,
    claimedAt: r.claimed_at,
    propositionMessageTs: r.proposition_message_ts,
    propositionSentAt: r.proposition_sent_at,
    context: r.context as Task['context'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class TasksRepository {
  async findById(id: string): Promise<Task | null> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE id = $1',
        [id]
      );
      return result.rows[0] ? mapRowToTask(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find task by ID', { error, id });
      throw error;
    }
  }

  async findByAsanaTaskId(tenantId: string, asanaTaskId: string): Promise<Task | null> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 AND asana_task_id = $2',
        [tenantId, asanaTaskId]
      );
      return result.rows[0] ? mapRowToTask(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find task by Asana task ID', { error, tenantId, asanaTaskId });
      throw error;
    }
  }

  async findByAsanaTaskIdAny(asanaTaskId: string): Promise<Task | null> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE asana_task_id = $1 LIMIT 1',
        [asanaTaskId]
      );
      return result.rows[0] ? mapRowToTask(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find task by Asana task ID (any tenant)', { error, asanaTaskId });
      throw error;
    }
  }

  async findByTenantId(tenantId: string, status?: TaskStatus): Promise<Task[]> {
    try {
      let queryText = 'SELECT * FROM tasks WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];

      if (status) {
        queryText += ' AND status = $2';
        params.push(status);
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await query(queryText, params);
      return result.rows.map(mapRowToTask);
    } catch (error) {
      logger.error('Failed to find tasks by tenant ID', { error, tenantId, status });
      throw error;
    }
  }

  async findByOwner(tenantId: string, ownerSlackUserId: string): Promise<Task[]> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 AND owner_slack_user_id = $2 AND status != $3 ORDER BY created_at DESC',
        [tenantId, ownerSlackUserId, 'completed']
      );
      return result.rows.map(mapRowToTask);
    } catch (error) {
      logger.error('Failed to find tasks by owner', { error, tenantId, ownerSlackUserId });
      throw error;
    }
  }

  async findPendingOwnerTasks(tenantId: string): Promise<Task[]> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 AND status = $2 ORDER BY created_at ASC',
        [tenantId, 'pending_owner']
      );
      return result.rows.map(mapRowToTask);
    } catch (error) {
      logger.error('Failed to find pending owner tasks', { error, tenantId });
      throw error;
    }
  }

  async findAllByTenant(tenantId: string): Promise<Task[]> {
    try {
      const result = await query(
        'SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId]
      );
      return result.rows.map(mapRowToTask);
    } catch (error) {
      logger.error('Failed to find all tasks for tenant', { error, tenantId });
      throw error;
    }
  }

  async create(task: {
    tenantId: string;
    asanaTaskId: string;
    asanaTaskUrl: string;
    status: TaskStatus;
    ownerSlackUserId?: string;
    ownerAsanaUserId?: string;
    dueDate?: Date;
    claimedAt?: Date;
  }): Promise<Task> {
    try {
      const result = await query(
        `INSERT INTO tasks (
          tenant_id, asana_task_id, asana_task_url, status,
          owner_slack_user_id, owner_asana_user_id, due_date, claimed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          task.tenantId,
          task.asanaTaskId,
          task.asanaTaskUrl,
          task.status,
          task.ownerSlackUserId || null,
          task.ownerAsanaUserId || null,
          task.dueDate || null,
          task.claimedAt || null,
        ]
      );
      return mapRowToTask(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create task', { error, task });
      throw error;
    }
  }

  async update(id: string, updates: {
    status?: TaskStatus;
    ownerSlackUserId?: string;
    ownerAsanaUserId?: string;
    dueDate?: Date;
    claimedAt?: Date;
    propositionMessageTs?: string;
    propositionSentAt?: Date;
  }): Promise<Task | null> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCounter = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convert camelCase to snake_case
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          fields.push(`${snakeKey} = $${paramCounter}`);
          values.push(value);
          paramCounter++;
        }
      });

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const result = await query(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
        values
      );

      return result.rows[0] ? mapRowToTask(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update task', { error, id, updates });
      throw error;
    }
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    try {
      const result = await query(
        'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      return result.rows[0] ? mapRowToTask(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update task status', { error, id, status });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM tasks WHERE id = $1', [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete task', { error, id });
      throw error;
    }
  }
}
