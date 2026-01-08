import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './index';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    logger.info('Starting database migration...');

    const pool = getPool();

    // Read the schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await pool.query(schemaSql);

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', { error });
    process.exit(1);
  }
}

runMigration();
