import { TenantsRepository } from '../db/repositories';
import { SlackBot } from '../integrations/slack';
import { AsanaClient } from '../integrations/asana';
import { getCachedSecret } from '../utils/secrets';
import { logger } from '../utils/logger';
import { Tenant } from '../models';

export class TenantManagerService {
  private tenantsRepo: TenantsRepository;
  private tenants: Map<string, Tenant> = new Map();

  constructor(
    private slackBot: SlackBot,
    private asanaClient: AsanaClient
  ) {
    this.tenantsRepo = new TenantsRepository();
  }

  /**
   * Load all tenants from database and initialize their clients
   */
  async initializeTenants(): Promise<void> {
    try {
      logger.info('Initializing tenants...');

      const tenants = await this.tenantsRepo.findAll();

      if (tenants.length === 0) {
        logger.warn('No tenants found in database');
        return;
      }

      for (const tenant of tenants) {
        try {
          await this.initializeTenant(tenant);
        } catch (error) {
          logger.error('Failed to initialize tenant', {
            error,
            tenantId: tenant.id,
            tenantName: tenant.name
          });
          // Continue with other tenants even if one fails
        }
      }

      logger.info(`Successfully initialized ${this.tenants.size}/${tenants.length} tenants`);
    } catch (error) {
      logger.error('Failed to initialize tenants', { error });
      throw error;
    }
  }

  /**
   * Initialize a single tenant (load secrets and register clients)
   */
  private async initializeTenant(tenant: Tenant): Promise<void> {
    logger.info('Initializing tenant', { tenantId: tenant.id, tenantName: tenant.name });

    try {
      let slackBotToken: string;
      let asanaApiToken: string;

      // In local development mode, use environment variables instead of Secret Manager
      const isLocalDev = process.env.NODE_ENV === 'development' &&
                         process.env.GCP_SECRET_MANAGER_ENABLED !== 'true';

      if (isLocalDev) {
        logger.info('Local development mode: using environment variables', { tenantId: tenant.id });

        slackBotToken = process.env.SLACK_BOT_TOKEN || process.env.SLACK_APP_TOKEN || '';
        asanaApiToken = process.env.ASANA_API_TOKEN || '';

        if (!slackBotToken || !asanaApiToken) {
          throw new Error(
            'Local dev mode requires SLACK_BOT_TOKEN and ASANA_API_TOKEN in .env file'
          );
        }

        logger.debug('Using local environment variables for tokens');
      } else {
        // Production mode: retrieve secrets from GCP Secret Manager
        logger.debug('Production mode: retrieving secrets from GCP Secret Manager');

        [slackBotToken, asanaApiToken] = await Promise.all([
          getCachedSecret(tenant.slackBotTokenSecretName),
          getCachedSecret(tenant.asanaApiTokenSecretName),
        ]);
      }

      // Register Slack client for this tenant
      this.slackBot.registerTenantClient(tenant.id, slackBotToken);
      logger.debug('Registered Slack client for tenant', { tenantId: tenant.id });

      // Register Asana client for this tenant
      this.asanaClient.registerTenantClient(tenant.id, asanaApiToken);
      logger.debug('Registered Asana client for tenant', { tenantId: tenant.id });

      // Store tenant in memory
      this.tenants.set(tenant.id, tenant);

      logger.info('Tenant initialized successfully', {
        tenantId: tenant.id,
        tenantName: tenant.name
      });
    } catch (error) {
      logger.error('Failed to initialize tenant', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        tenantId: tenant.id,
        tenantName: tenant.name
      });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * Get tenant by Slack workspace ID
   */
  getTenantBySlackWorkspace(workspaceId: string): Tenant | undefined {
    const allTenants = Array.from(this.tenants.values());
    logger.debug('Looking up tenant by Slack workspace', {
      searchingFor: workspaceId,
      tenantsInMemory: allTenants.map(t => ({ id: t.id, slackWorkspaceId: t.slackWorkspaceId }))
    });
    return allTenants.find(
      (t) => t.slackWorkspaceId === workspaceId
    );
  }

  /**
   * Get tenant by Asana workspace ID
   */
  getTenantByAsanaWorkspace(workspaceId: string): Tenant | undefined {
    return Array.from(this.tenants.values()).find(
      (t) => t.asanaWorkspaceId === workspaceId
    );
  }

  /**
   * Get tenant by Asana bot user ID
   */
  getTenantByAsanaBotUserId(botUserId: string): Tenant | undefined {
    return Array.from(this.tenants.values()).find(
      (t) => t.asanaBotUserId === botUserId
    );
  }

  /**
   * Get all tenants
   */
  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  /**
   * Reload a specific tenant (useful when tenant config changes)
   */
  async reloadTenant(tenantId: string): Promise<void> {
    try {
      logger.info('Reloading tenant', { tenantId });

      const tenant = await this.tenantsRepo.findById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      await this.initializeTenant(tenant);
      logger.info('Tenant reloaded successfully', { tenantId });
    } catch (error) {
      logger.error('Failed to reload tenant', { error, tenantId });
      throw error;
    }
  }

  /**
   * Add a new tenant at runtime
   */
  async addTenant(tenantData: {
    name: string;
    slackWorkspaceId: string;
    slackBotTokenSecretName: string;
    asanaWorkspaceId: string;
    asanaBotUserId: string;
    asanaApiTokenSecretName: string;
    gsheetUrl: string;
    adminSlackUserId: string;
  }): Promise<Tenant> {
    try {
      logger.info('Adding new tenant', { name: tenantData.name });

      // Create tenant in database
      const tenant = await this.tenantsRepo.create(tenantData);

      // Initialize the tenant
      await this.initializeTenant(tenant);

      logger.info('New tenant added successfully', { tenantId: tenant.id });
      return tenant;
    } catch (error) {
      logger.error('Failed to add new tenant', { error, tenantData });
      throw error;
    }
  }

  /**
   * Remove a tenant
   */
  async removeTenant(tenantId: string): Promise<void> {
    try {
      logger.info('Removing tenant', { tenantId });

      // Remove from database
      await this.tenantsRepo.delete(tenantId);

      // Remove from memory
      this.tenants.delete(tenantId);

      logger.info('Tenant removed successfully', { tenantId });
    } catch (error) {
      logger.error('Failed to remove tenant', { error, tenantId });
      throw error;
    }
  }
}
