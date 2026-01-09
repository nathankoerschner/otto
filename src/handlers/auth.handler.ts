import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { requireAuth } from '../middleware/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

const authService = new AuthService();

const registerSchema = z.object({
  firebaseIdToken: z.string(),
  workspaceName: z.string().min(1).max(255),
});

const loginSchema = z.object({
  firebaseIdToken: z.string(),
});

export function createAuthRouter(): Router {
  const router = Router();

  // Register a new workspace/user
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const { firebaseIdToken, workspaceName } = parsed.data;
      const { session, tenant, sessionToken } = await authService.register(
        firebaseIdToken,
        workspaceName
      );

      setSessionCookie(res, sessionToken);

      res.status(201).json({
        user: {
          id: session.userId,
          email: tenant.adminEmail,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          setupCompleted: tenant.setupCompleted,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      logger.error('Registration failed', { error });
      res.status(400).json({ error: message });
    }
  });

  // Login with Firebase token
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const { firebaseIdToken } = parsed.data;
      const { session, tenant, sessionToken } = await authService.login(firebaseIdToken);

      setSessionCookie(res, sessionToken);

      res.json({
        user: {
          id: session.userId,
          email: tenant.adminEmail,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          setupCompleted: tenant.setupCompleted,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      logger.error('Login failed', { error });
      res.status(401).json({ error: message });
    }
  });

  // Logout
  router.post('/logout', requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.user) {
        await authService.logout(req.user.session.sessionToken);
      }
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      logger.error('Logout failed', { error });
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Get current user info
  router.get('/me', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      res.json({
        user: {
          id: user.userId,
          email: user.email,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          setupCompleted: user.tenant.setupCompleted,
        },
      });
    } catch (error) {
      logger.error('Get user failed', { error });
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  return router;
}

function setSessionCookie(res: Response, sessionToken: string): void {
  res.cookie(config.session.cookieName, sessionToken, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: 'strict',
    maxAge: config.session.maxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: 'strict',
    path: '/',
  });
}
