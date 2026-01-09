import { logger } from '../utils/logger';
import { FollowUpService } from './follow-up.service';
import { TenantManagerService } from './tenant-manager.service';

/**
 * Service for scheduling periodic jobs
 */
export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    private followUpService: FollowUpService,
    private tenantManager: TenantManagerService
  ) {}

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
}
