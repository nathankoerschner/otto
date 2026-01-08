import { getPool } from './index';
import { logger } from '../utils/logger';

/**
 * Seed script for local development
 * Adds a test tenant to the database
 */
async function seed() {
  try {
    logger.info('Starting database seed...');

    const pool = getPool();

    // Check if any tenants exist
    const existingResult = await pool.query('SELECT COUNT(*) FROM tenants');
    const count = parseInt(existingResult.rows[0].count);

    if (count > 0) {
      logger.info(`Database already has ${count} tenant(s). Skipping seed.`);
      logger.info('To re-seed, delete existing tenants first:');
      logger.info('  psql otto -c "TRUNCATE tenants, tasks, follow_ups, user_mappings CASCADE;"');
      process.exit(0);
    }

    // For local development, we'll use environment variables directly
    // instead of Secret Manager
    logger.info('Creating test tenant...');

    const testTenant = {
      name: 'Test Tenant (Local)',
      slackWorkspaceId: process.env.TEST_SLACK_WORKSPACE_ID || 'T1234567890',
      slackBotTokenSecretName: 'local-slack-token', // Will use env var in local mode
      asanaWorkspaceId: process.env.TEST_ASANA_WORKSPACE_ID || 'W9876543210',
      asanaBotUserId: process.env.TEST_ASANA_BOT_USER_ID || 'A1111111111',
      asanaApiTokenSecretName: 'local-asana-token', // Will use env var in local mode
      gsheetUrl: process.env.TEST_GSHEET_URL || 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID',
      adminSlackUserId: process.env.TEST_ADMIN_SLACK_USER_ID || 'U0987654321',
    };

    const result = await pool.query(
      `INSERT INTO tenants (
        name, slack_workspace_id, slack_bot_token_secret_name,
        asana_workspace_id, asana_bot_user_id, asana_api_token_secret_name,
        gsheet_url, admin_slack_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        testTenant.name,
        testTenant.slackWorkspaceId,
        testTenant.slackBotTokenSecretName,
        testTenant.asanaWorkspaceId,
        testTenant.asanaBotUserId,
        testTenant.asanaApiTokenSecretName,
        testTenant.gsheetUrl,
        testTenant.adminSlackUserId,
      ]
    );

    logger.info('✅ Test tenant created successfully!', { tenant: result.rows[0] });

    logger.info('\n📝 Next steps:');
    logger.info('1. Update your .env file with these test values:');
    logger.info(`   TEST_SLACK_WORKSPACE_ID=${testTenant.slackWorkspaceId}`);
    logger.info(`   TEST_ASANA_WORKSPACE_ID=${testTenant.asanaWorkspaceId}`);
    logger.info(`   TEST_ASANA_BOT_USER_ID=${testTenant.asanaBotUserId}`);
    logger.info(`   TEST_GSHEET_URL=${testTenant.gsheetUrl}`);
    logger.info(`   TEST_ADMIN_SLACK_USER_ID=${testTenant.adminSlackUserId}`);
    logger.info('\n2. For local testing without Secret Manager, add these to .env:');
    logger.info('   SLACK_BOT_TOKEN=xoxb-your-bot-token');
    logger.info('   ASANA_API_TOKEN=your-asana-personal-access-token');
    logger.info('\n3. Update tenant-manager.service.ts to use env vars in local mode');
    logger.info('\n4. Start the bot: npm run dev');

    process.exit(0);
  } catch (error) {
    logger.error('Database seed failed', { error });
    process.exit(1);
  }
}

seed();
