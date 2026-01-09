import { getPool } from './index';
import { logger } from '../utils/logger';

interface TenantConfig {
  name: string;
  slackWorkspaceId: string;
  slackBotTokenSecretName: string;
  asanaWorkspaceId: string;
  asanaBotUserId: string;
  asanaApiTokenSecretName: string;
  gsheetUrl: string;
  adminSlackUserId: string;
}

/**
 * Load tenant configuration based on environment
 * Production: uses TENANT_* env vars with GCP Secret Manager secret names
 * Development: uses TEST_* env vars with local secret placeholders
 */
function loadTenantConfig(): TenantConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production mode: require TENANT_* env vars, use GCP secret names
    const required = [
      'TENANT_SLACK_WORKSPACE_ID',
      'TENANT_ASANA_WORKSPACE_ID',
      'TENANT_ASANA_BOT_USER_ID',
      'TENANT_GSHEET_URL',
      'TENANT_ADMIN_SLACK_USER_ID',
    ];

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
    }

    return {
      name: process.env.TENANT_NAME || 'Otto Production',
      slackWorkspaceId: process.env.TENANT_SLACK_WORKSPACE_ID!,
      slackBotTokenSecretName: process.env.TENANT_SLACK_BOT_TOKEN_SECRET_NAME || 'slack-bot-token',
      asanaWorkspaceId: process.env.TENANT_ASANA_WORKSPACE_ID!,
      asanaBotUserId: process.env.TENANT_ASANA_BOT_USER_ID!,
      asanaApiTokenSecretName: process.env.TENANT_ASANA_API_TOKEN_SECRET_NAME || 'asana-api-token',
      gsheetUrl: process.env.TENANT_GSHEET_URL!,
      adminSlackUserId: process.env.TENANT_ADMIN_SLACK_USER_ID!,
    };
  }

  // Development mode: use TEST_* env vars with defaults
  return {
    name: 'Test Tenant (Local)',
    slackWorkspaceId: process.env.TEST_SLACK_WORKSPACE_ID || 'T1234567890',
    slackBotTokenSecretName: 'local-slack-token',
    asanaWorkspaceId: process.env.TEST_ASANA_WORKSPACE_ID || 'W9876543210',
    asanaBotUserId: process.env.TEST_ASANA_BOT_USER_ID || 'A1111111111',
    asanaApiTokenSecretName: 'local-asana-token',
    gsheetUrl: process.env.TEST_GSHEET_URL || 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID',
    adminSlackUserId: process.env.TEST_ADMIN_SLACK_USER_ID || 'U0987654321',
  };
}

/**
 * Upsert tenant - insert if not exists, update if exists
 * Uses slack_workspace_id as the unique key
 */
async function upsertTenant(pool: ReturnType<typeof getPool>, config: TenantConfig) {
  // Check for existing tenant
  const existing = await pool.query('SELECT id FROM tenants WHERE slack_workspace_id = $1', [
    config.slackWorkspaceId,
  ]);

  if (existing.rows.length > 0) {
    // Update existing tenant
    const tenantId = existing.rows[0].id;
    logger.info('Updating existing tenant...', { tenantId, slackWorkspaceId: config.slackWorkspaceId });

    const result = await pool.query(
      `UPDATE tenants SET
        name = $1,
        slack_bot_token_secret_name = $2,
        asana_workspace_id = $3,
        asana_bot_user_id = $4,
        asana_api_token_secret_name = $5,
        gsheet_url = $6,
        admin_slack_user_id = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *`,
      [
        config.name,
        config.slackBotTokenSecretName,
        config.asanaWorkspaceId,
        config.asanaBotUserId,
        config.asanaApiTokenSecretName,
        config.gsheetUrl,
        config.adminSlackUserId,
        tenantId,
      ]
    );

    return { action: 'updated', tenant: result.rows[0] };
  }

  // Insert new tenant
  logger.info('Creating new tenant...', { slackWorkspaceId: config.slackWorkspaceId });

  const result = await pool.query(
    `INSERT INTO tenants (
      name, slack_workspace_id, slack_bot_token_secret_name,
      asana_workspace_id, asana_bot_user_id, asana_api_token_secret_name,
      gsheet_url, admin_slack_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      config.name,
      config.slackWorkspaceId,
      config.slackBotTokenSecretName,
      config.asanaWorkspaceId,
      config.asanaBotUserId,
      config.asanaApiTokenSecretName,
      config.gsheetUrl,
      config.adminSlackUserId,
    ]
  );

  return { action: 'created', tenant: result.rows[0] };
}

/**
 * Seed script for tenant setup
 * Supports both local development and production environments
 */
async function seed() {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    logger.info('Starting database seed...', { environment: isProduction ? 'production' : 'development' });

    const config = loadTenantConfig();
    logger.info('Loaded tenant configuration', {
      name: config.name,
      slackWorkspaceId: config.slackWorkspaceId,
      asanaWorkspaceId: config.asanaWorkspaceId,
      slackSecretName: config.slackBotTokenSecretName,
      asanaSecretName: config.asanaApiTokenSecretName,
    });

    const pool = getPool();
    const { action, tenant } = await upsertTenant(pool, config);

    logger.info(`Tenant ${action} successfully!`, {
      id: tenant.id,
      name: tenant.name,
      slackWorkspaceId: tenant.slack_workspace_id,
    });

    if (!isProduction) {
      logger.info('\nNext steps for local development:');
      logger.info('1. Ensure SLACK_BOT_TOKEN and ASANA_API_TOKEN are set in .env');
      logger.info('2. Start the bot: bun run dev');
    } else {
      logger.info('\nProduction tenant configured.');
      logger.info('Secrets will be resolved from GCP Secret Manager at runtime.');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Database seed failed', { error });
    process.exit(1);
  }
}

seed();
