import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SetupService } from '../services/setup.service';
import { requireAuth } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const setupService = new SetupService();

const validateSlackSchema = z.object({
  token: z.string().min(1),
});

const validateAsanaSchema = z.object({
  token: z.string().min(1),
});

const completeSetupSchema = z.object({
  slackToken: z.string().min(1),
  asanaToken: z.string().min(1),
  asanaProjectId: z.string().min(1),
  adminSlackUserId: z.string().min(1),
});

export function createSetupRouter(): Router {
  const router = Router();

  // All setup routes require authentication
  router.use(requireAuth);

  // Validate Slack token
  router.post('/validate-slack', async (req: Request, res: Response) => {
    try {
      const parsed = validateSlackSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const result = await setupService.validateSlackToken(parsed.data.token);

      if (!result.valid) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        valid: true,
        workspace: {
          id: result.workspaceId,
          name: result.workspaceName,
        },
      });
    } catch (error) {
      logger.error('Slack validation failed', { error });
      res.status(500).json({ error: 'Failed to validate Slack token' });
    }
  });

  // Validate Asana token and get projects
  router.post('/validate-asana', async (req: Request, res: Response) => {
    try {
      const parsed = validateAsanaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const result = await setupService.validateAsanaToken(parsed.data.token);

      if (!result.valid) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        valid: true,
        workspace: {
          id: result.workspaceId,
          name: result.workspaceName,
        },
        user: {
          id: result.userId,
          name: result.userName,
        },
        projects: result.projects,
      });
    } catch (error) {
      logger.error('Asana validation failed', { error });
      res.status(500).json({ error: 'Failed to validate Asana token' });
    }
  });

  // Complete setup (save tokens and mark setup complete)
  router.post('/complete', async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      if (user.tenant.setupCompleted) {
        res.status(400).json({ error: 'Setup already completed' });
        return;
      }

      const parsed = completeSetupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const { slackToken, asanaToken, asanaProjectId, adminSlackUserId } = parsed.data;

      const result = await setupService.completeSetup(
        user.tenant.id,
        slackToken,
        asanaToken,
        asanaProjectId,
        adminSlackUserId
      );

      res.json({
        success: true,
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          setupCompleted: result.tenant.setupCompleted,
        },
        slackWorkspaceId: result.slackWorkspaceId,
        asanaWorkspaceId: result.asanaWorkspaceId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Setup failed';
      logger.error('Setup completion failed', { error });
      res.status(400).json({ error: message });
    }
  });

  return router;
}
