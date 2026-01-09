import { logger } from '../utils/logger';
import { FollowUpService } from './follow-up.service';
import { TenantManagerService } from './tenant-manager.service';
import { TasksRepository } from '../db/repositories';
import { AsanaClient } from '../integrations/asana';
import { TaskStatus } from '../models';

/**
 * Service for scheduling periodic jobs
 */
export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private tasksRepo: TasksRepository;

  constructor(
    private followUpService: FollowUpService,
    private asanaClient: AsanaClient,
    private tenantManager: TenantManagerService
  ) {
    this.tasksRepo = new TasksRepository();
  }

  /**
   * Start all periodic jobs
   */
  start(): void {
    logger.info('Starting scheduler service...');

    // Process due follow-ups every 5 minutes
    this.scheduleJob(
      'process-follow-ups',
      () => this.processFollowUps(),
      5 * 60 * 1000 // 5 minutes
    );

    // Check for completed tasks every 10 minutes
    this.scheduleJob(
      'check-completed-tasks',
      () => this.checkCompletedTasks(),
      10 * 60 * 1000 // 10 minutes
    );

    logger.info('Scheduler service started');
  }

  /**
   * Stop all periodic jobs
   */
  stop(): void {
    logger.info('Stopping scheduler service...');

    for (const interval of this.intervals) {
      clearInterval(interval);
    }

    this.intervals = [];
    logger.info('Scheduler service stopped');
  }

  /**
   * Schedule a recurring job
   */
  private scheduleJob(name: string, task: () => Promise<void>, intervalMs: number): void {
    logger.info(`Scheduling job: ${name} (every ${intervalMs / 1000}s)`);

    // Run immediately on startup
    task().catch((error) => {
      logger.error(`Error in initial run of ${name}`, { error });
    });

    // Then run periodically
    const interval = setInterval(async () => {
      try {
        await task();
      } catch (error) {
        logger.error(`Error in scheduled job: ${name}`, { error });
      }
    }, intervalMs);

    this.intervals.push(interval);
  }

  /**
   * Process due follow-ups for all tenants
   */
  private async processFollowUps(): Promise<void> {
    try {
      logger.info('Running scheduled job: process-follow-ups');

      const tenants = this.tenantManager.getAllTenants();
      for (const tenant of tenants) {
        try {
          await this.followUpService.processDueFollowUps(tenant.id);
        } catch (error) {
          logger.error('Error processing follow-ups for tenant', { error, tenantId: tenant.id });
        }
      }

      logger.info('Completed scheduled job: process-follow-ups');
    } catch (error) {
      logger.error('Error processing follow-ups', { error });
    }
  }

  /**
   * Check for completed tasks and update their status for all tenants
   */
  private async checkCompletedTasks(): Promise<void> {
    try {
      logger.info('Running scheduled job: check-completed-tasks');

      const tenants = this.tenantManager.getAllTenants();
      let totalCheckedCount = 0;
      let totalCompletedCount = 0;

      for (const tenant of tenants) {
        try {
          // Get owned tasks for this tenant
          const tenantTasks = await this.tasksRepo.findAllByTenant(tenant.id);
          const ownedTasks = tenantTasks.filter(task => task.status === TaskStatus.OWNED);

          // Check each task's completion status in Asana
          for (const task of ownedTasks) {
            try {
              const isCompleted = await this.asanaClient.isTaskCompleted(
                task.asanaTaskId,
                task.tenantId
              );

              totalCheckedCount++;

              if (isCompleted && task.status !== TaskStatus.COMPLETED) {
                await this.tasksRepo.updateStatus(task.id, TaskStatus.COMPLETED);
                totalCompletedCount++;
                logger.info('Task marked as completed', {
                  taskId: task.id,
                  asanaTaskId: task.asanaTaskId,
                  tenantId: tenant.id,
                });
              }
            } catch (error) {
              logger.error('Error checking task completion', {
                error,
                taskId: task.id,
                asanaTaskId: task.asanaTaskId,
                tenantId: tenant.id,
              });
            }
          }
        } catch (error) {
          logger.error('Error checking completed tasks for tenant', { error, tenantId: tenant.id });
        }
      }

      logger.info('Completed scheduled job: check-completed-tasks', {
        checkedCount: totalCheckedCount,
        completedCount: totalCompletedCount,
      });
    } catch (error) {
      logger.error('Error checking completed tasks', { error });
    }
  }
}
