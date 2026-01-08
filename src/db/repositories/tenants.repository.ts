import { query } from '../index';
import { Tenant } from '../../models';
import { logger } from '../../utils/logger';

// Map database row (snake_case) to Tenant model (camelCase)
function mapRowToTenant(row: any): Tenant {
  return {
    id: row.id,
    name: row.name,
    slackWorkspaceId: row.slack_workspace_id,
    slackBotTokenSecretName: row.slack_bot_token_secret_name,
    asanaWorkspaceId: row.asana_workspace_id,
    asanaBotUserId: row.asana_bot_user_id,
    asanaApiTokenSecretName: row.asana_api_token_secret_name,
    gsheetUrl: row.gsheet_url,
    adminSlackUserId: row.admin_slack_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TenantsRepository {
  async findById(id: string): Promise<Tenant | null> {
    try {
      const result = await query(
        'SELECT * FROM tenants WHERE id = $1',
        [id]
      );
      return result.rows[0] ? mapRowToTenant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by ID', { error, id });
      throw error;
    }
  }

  async findBySlackWorkspaceId(workspaceId: string): Promise<Tenant | null> {
    try {
      const result = await query(
        'SELECT * FROM tenants WHERE slack_workspace_id = $1',
        [workspaceId]
      );
      return result.rows[0] ? mapRowToTenant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by Slack workspace ID', { error, workspaceId });
      throw error;
    }
  }

  async findByAsanaWorkspaceId(workspaceId: string): Promise<Tenant | null> {
    try {
      const result = await query(
        'SELECT * FROM tenants WHERE asana_workspace_id = $1',
        [workspaceId]
      );
      return result.rows[0] ? mapRowToTenant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by Asana workspace ID', { error, workspaceId });
      throw error;
    }
  }

  async findAll(): Promise<Tenant[]> {
    try {
      const result = await query('SELECT * FROM tenants ORDER BY created_at DESC');
      return result.rows.map(mapRowToTenant);
    } catch (error) {
      logger.error('Failed to fetch all tenants', { error });
      throw error;
    }
  }

  async create(tenant: {
    name: string;
    slackWorkspaceId: string;
    slackBotTokenSecretName: string;
    asanaWorkspaceId: string;
    asanaBotUserId: string;
    asanaApiTokenSecretName: string;
    gsheetUrl: string;
    adminSlackUserId: string;
  }): Promise<Tenant> {
    try {
      const result = await query(
        `INSERT INTO tenants (
          name, slack_workspace_id, slack_bot_token_secret_name,
          asana_workspace_id, asana_bot_user_id, asana_api_token_secret_name,
          gsheet_url, admin_slack_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          tenant.name,
          tenant.slackWorkspaceId,
          tenant.slackBotTokenSecretName,
          tenant.asanaWorkspaceId,
          tenant.asanaBotUserId,
          tenant.asanaApiTokenSecretName,
          tenant.gsheetUrl,
          tenant.adminSlackUserId,
        ]
      );
      return mapRowToTenant(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create tenant', { error, tenant });
      throw error;
    }
  }

  async update(id: string, updates: {
    name?: string;
    slackWorkspaceId?: string;
    slackBotTokenSecretName?: string;
    asanaWorkspaceId?: string;
    asanaBotUserId?: string;
    asanaApiTokenSecretName?: string;
    gsheetUrl?: string;
    adminSlackUserId?: string;
  }): Promise<Tenant | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
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
        `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${paramCounter} RETURNING *`,
        values
      );

      return result.rows[0] ? mapRowToTenant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update tenant', { error, id, updates });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM tenants WHERE id = $1', [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete tenant', { error, id });
      throw error;
    }
  }
}
