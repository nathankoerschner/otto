import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthUser } from '../services/auth.service';
import { config } from '../config';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authService = new AuthService();

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = getSessionToken(req);
    if (!sessionToken) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await authService.validateSession(sessionToken);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ error: 'Authentication error' });
  }
}

export async function requireSetupComplete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.tenant.setupCompleted) {
    res.status(403).json({ error: 'Setup not complete', code: 'SETUP_REQUIRED' });
    return;
  }

  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = getSessionToken(req);
    if (sessionToken) {
      const user = await authService.validateSession(sessionToken);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Don't fail on optional auth errors, just proceed without user
    logger.debug('Optional auth failed', { error });
    next();
  }
}

function getSessionToken(req: Request): string | null {
  // Check cookie first
  const cookieName = config.session.cookieName;
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  // Check Authorization header as fallback
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
