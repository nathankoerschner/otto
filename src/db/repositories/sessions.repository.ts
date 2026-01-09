import { query } from '../index';
import { logger } from '../../utils/logger';

export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  tenant_id: string;
  session_token: string;
  expires_at: Date;
  created_at: Date;
}

function mapRowToSession(row: unknown): Session {
  const r = row as SessionRow;
  return {
    id: r.id,
    userId: r.user_id,
    tenantId: r.tenant_id,
    sessionToken: r.session_token,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

export class SessionsRepository {
  async findByToken(sessionToken: string): Promise<Session | null> {
    try {
      const result = await query(
        'SELECT * FROM sessions WHERE session_token = $1 AND expires_at > NOW()',
        [sessionToken]
      );
      return result.rows[0] ? mapRowToSession(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find session by token', { error });
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Session[]> {
    try {
      const result = await query(
        'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId]
      );
      return result.rows.map(mapRowToSession);
    } catch (error) {
      logger.error('Failed to find sessions by user ID', { error, userId });
      throw error;
    }
  }

  async create(session: {
    userId: string;
    tenantId: string;
    sessionToken: string;
    expiresAt: Date;
  }): Promise<Session> {
    try {
      const result = await query(
        `INSERT INTO sessions (user_id, tenant_id, session_token, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [session.userId, session.tenantId, session.sessionToken, session.expiresAt]
      );
      return mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create session', { error, userId: session.userId });
      throw error;
    }
  }

  async deleteByToken(sessionToken: string): Promise<boolean> {
    try {
      const result = await query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete session', { error });
      throw error;
    }
  }

  async deleteByUserId(userId: string): Promise<number> {
    try {
      const result = await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete sessions by user ID', { error, userId });
      throw error;
    }
  }

  async deleteExpired(): Promise<number> {
    try {
      const result = await query('DELETE FROM sessions WHERE expires_at < NOW()');
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete expired sessions', { error });
      throw error;
    }
  }

  async extendSession(sessionToken: string, newExpiresAt: Date): Promise<Session | null> {
    try {
      const result = await query(
        `UPDATE sessions SET expires_at = $1 WHERE session_token = $2 AND expires_at > NOW() RETURNING *`,
        [newExpiresAt, sessionToken]
      );
      return result.rows[0] ? mapRowToSession(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to extend session', { error });
      throw error;
    }
  }
}
