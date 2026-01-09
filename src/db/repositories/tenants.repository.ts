import { query } from '../index';
import { Tenant } from '../../models';
import { logger } from '../../utils/logger';

interface TenantRow {
  id: string;
  name: string;
  slack_workspace_id: string;
  slack_bot_token_secret_name: string;
  asana_workspace_id: string;
  asana_bot_user_id: string;
  asana_api_token_secret_name: string;
  asana_project_id: string | null;
  gsheet_url: string;
  admin_slack_user_id: string;
  admin_email: string | null;
  admin_firebase_uid: string | null;
  setup_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

// Map database row (snake_case) to Tenant model (camelCase)
function mapRowToTenant(row: unknown): Tenant {
  const r = row as TenantRow;
  return {
    id: r.id,
    name: r.name,
    slackWorkspaceId: r.slack_workspace_id,
    slackBotTokenSecretName: r.slack_bot_token_secret_name,
    asanaWorkspaceId: r.asana_workspace_id,
    asanaBotUserId: r.asana_bot_user_id,
    asanaApiTokenSecretName: r.asana_api_token_secret_name,
    asanaProjectId: r.asana_project_id,
    gsheetUrl: r.gsheet_url,
    adminSlackUserId: r.admin_slack_user_id,
    adminEmail: r.admin_email,
    adminFirebaseUid: r.admin_firebase_uid,
    setupCompleted: r.setup_completed ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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

  async findByFirebaseUid(firebaseUid: string): Promise<Tenant | null> {
    try {
      const result = await query(
        'SELECT * FROM tenants WHERE admin_firebase_uid = $1',
        [firebaseUid]
      );
      return result.rows[0] ? mapRowToTenant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by Firebase UID', { error, firebaseUid });
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

  async createForSetup(tenant: {
    name: string;
    adminEmail: string;
    adminFirebaseUid: string;
  }): Promise<Tenant> {
    try {
      const result = await query(
        `INSERT INTO tenants (
          name, admin_email, admin_firebase_uid, setup_completed,
          slack_workspace_id, slack_bot_token_secret_name,
          asana_workspace_id, asana_bot_user_id, asana_api_token_secret_name,
          gsheet_url, admin_slack_user_id
        ) VALUES ($1, $2, $3, false, '', '', '', '', '', '', '')
        RETURNING *`,
        [tenant.name, tenant.adminEmail, tenant.adminFirebaseUid]
      );
      return mapRowToTenant(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create tenant for setup', { error, tenant });
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
    asanaProjectId?: string;
    gsheetUrl?: string;
    adminSlackUserId?: string;
    adminEmail?: string;
    adminFirebaseUid?: string;
    setupCompleted?: boolean;
  }): Promise<Tenant | null> {
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
