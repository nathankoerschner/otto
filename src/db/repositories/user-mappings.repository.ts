import { query } from '../index';
import { UserMapping } from '../../models';
import { logger } from '../../utils/logger';

export class UserMappingsRepository {
  async findById(id: string): Promise<UserMapping | null> {
    try {
      const result = await query<UserMapping>(
        'SELECT * FROM user_mappings WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user mapping by ID', { error, id });
      throw error;
    }
  }

  async findBySlackUserId(tenantId: string, slackUserId: string): Promise<UserMapping | null> {
    try {
      const result = await query<UserMapping>(
        'SELECT * FROM user_mappings WHERE tenant_id = $1 AND slack_user_id = $2',
        [tenantId, slackUserId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user mapping by Slack user ID', { error, tenantId, slackUserId });
      throw error;
    }
  }

  async findByAsanaUserId(tenantId: string, asanaUserId: string): Promise<UserMapping | null> {
    try {
      const result = await query<UserMapping>(
        'SELECT * FROM user_mappings WHERE tenant_id = $1 AND asana_user_id = $2',
        [tenantId, asanaUserId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find user mapping by Asana user ID', { error, tenantId, asanaUserId });
      throw error;
    }
  }

  async findByTenantId(tenantId: string): Promise<UserMapping[]> {
    try {
      const result = await query<UserMapping>(
        'SELECT * FROM user_mappings WHERE tenant_id = $1 ORDER BY created_at DESC',
        [tenantId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to find user mappings by tenant ID', { error, tenantId });
      throw error;
    }
  }

  async create(mapping: {
    tenantId: string;
    slackUserId: string;
    asanaUserId: string;
  }): Promise<UserMapping> {
    try {
      const result = await query<UserMapping>(
        `INSERT INTO user_mappings (tenant_id, slack_user_id, asana_user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, slack_user_id)
        DO UPDATE SET asana_user_id = EXCLUDED.asana_user_id
        RETURNING *`,
        [mapping.tenantId, mapping.slackUserId, mapping.asanaUserId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user mapping', { error, mapping });
      throw error;
    }
  }

  async update(tenantId: string, slackUserId: string, asanaUserId: string): Promise<UserMapping | null> {
    try {
      const result = await query<UserMapping>(
        'UPDATE user_mappings SET asana_user_id = $1 WHERE tenant_id = $2 AND slack_user_id = $3 RETURNING *',
        [asanaUserId, tenantId, slackUserId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update user mapping', { error, tenantId, slackUserId, asanaUserId });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM user_mappings WHERE id = $1', [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete user mapping', { error, id });
      throw error;
    }
  }

  async deleteByTenant(tenantId: string, slackUserId: string): Promise<boolean> {
    try {
      const result = await query(
        'DELETE FROM user_mappings WHERE tenant_id = $1 AND slack_user_id = $2',
        [tenantId, slackUserId]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete user mapping by tenant', { error, tenantId, slackUserId });
      throw error;
    }
  }
}
