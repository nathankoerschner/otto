import { logger } from '../utils/logger';
import { FollowUpService } from './follow-up.service';
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
    private asanaClient: AsanaClient
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
   * Process due follow-ups
   */
  private async processFollowUps(): Promise<void> {
    try {
      logger.info('Running scheduled job: process-follow-ups');
      await this.followUpService.processDueFollowUps();
      logger.info('Completed scheduled job: process-follow-ups');
    } catch (error) {
      logger.error('Error processing follow-ups', { error });
    }
  }

  /**
   * Check for completed tasks and update their status
   */
  private async checkCompletedTasks(): Promise<void> {
    try {
      logger.info('Running scheduled job: check-completed-tasks');

      // Get all owned tasks (not completed, not escalated)
      const allTasks = await this.tasksRepo.findAll();

      // Filter to only owned tasks
      const ownedTasks = allTasks.filter(task => task.status === TaskStatus.OWNED);

      let checkedCount = 0;
      let completedCount = 0;

      // Check each task's completion status in Asana
      for (const task of ownedTasks) {
        try {
          const isCompleted = await this.asanaClient.isTaskCompleted(
            task.asanaTaskId,
            task.tenantId
          );

          checkedCount++;

          if (isCompleted && task.status !== TaskStatus.COMPLETED) {
            await this.tasksRepo.updateStatus(task.id, TaskStatus.COMPLETED);
            completedCount++;
            logger.info('Task marked as completed', {
              taskId: task.id,
              asanaTaskId: task.asanaTaskId,
            });
          }
        } catch (error) {
          logger.error('Error checking task completion', {
            error,
            taskId: task.id,
            asanaTaskId: task.asanaTaskId,
          });
        }
      }

      logger.info('Completed scheduled job: check-completed-tasks', {
        checkedCount,
        completedCount,
      });
    } catch (error) {
      logger.error('Error checking completed tasks', { error });
    }
  }
}
