import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SetupService } from '../services/setup.service';
import { requireAuth, requireSetupComplete } from '../middleware/auth.middleware';
import { TasksRepository } from '../db/repositories/tasks.repository';
import { logger } from '../utils/logger';

const setupService = new SetupService();
const tasksRepository = new TasksRepository();

const updateTokenSchema = z.object({
  token: z.string().min(1),
});

export function createDashboardRouter(): Router {
  const router = Router();

  // All dashboard routes require authentication and completed setup
  router.use(requireAuth);
  router.use(requireSetupComplete);

  // Get dashboard status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const tenant = user.tenant;

      // Get task counts for basic stats
      const tasks = await tasksRepository.findByTenantId(tenant.id);
      const pendingTasks = tasks.filter(t => t.status === 'pending_owner');
      const ownedTasks = tasks.filter(t => t.status === 'owned');
      const completedTasks = tasks.filter(t => t.status === 'completed');

      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
        },
        integrations: {
          slack: {
            connected: !!tenant.slackWorkspaceId,
            workspaceId: tenant.slackWorkspaceId || null,
          },
          asana: {
            connected: !!tenant.asanaWorkspaceId,
            workspaceId: tenant.asanaWorkspaceId || null,
            projectId: tenant.asanaProjectId || null,
          },
        },
        stats: {
          pendingTasks: pendingTasks.length,
          ownedTasks: ownedTasks.length,
          completedTasks: completedTasks.length,
          totalTasks: tasks.length,
        },
        lastUpdated: tenant.updatedAt,
      });
    } catch (error) {
      logger.error('Failed to get dashboard status', { error });
      res.status(500).json({ error: 'Failed to get dashboard status' });
    }
  });

  // Update Slack token
  router.put('/tokens/slack', async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      const parsed = updateTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const result = await setupService.updateSlackToken(user.tenant.id, parsed.data.token);

      if (!result.valid) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        workspace: {
          id: result.workspaceId,
          name: result.workspaceName,
        },
      });
    } catch (error) {
      logger.error('Failed to update Slack token', { error });
      res.status(500).json({ error: 'Failed to update Slack token' });
    }
  });

  // Update Asana token
  router.put('/tokens/asana', async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      const parsed = updateTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
        return;
      }

      const result = await setupService.updateAsanaToken(user.tenant.id, parsed.data.token);

      if (!result.valid) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        workspace: {
          id: result.workspaceId,
          name: result.workspaceName,
        },
        projects: result.projects,
      });
    } catch (error) {
      logger.error('Failed to update Asana token', { error });
      res.status(500).json({ error: 'Failed to update Asana token' });
    }
  });

  return router;
}
