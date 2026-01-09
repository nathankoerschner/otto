import { WebClient } from '@slack/web-api';
import * as Asana from 'asana';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TenantsRepository } from '../db/repositories/tenants.repository';
import { upsertSecret } from '../utils/secrets';
import { Tenant } from '../models';

// Type assertion for Asana v3 SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AsanaApi = Asana as any;

export interface SlackValidationResult {
  valid: boolean;
  workspaceId?: string;
  workspaceName?: string;
  teamName?: string;
  error?: string;
}

export interface AsanaValidationResult {
  valid: boolean;
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userName?: string;
  projects?: Array<{ id: string; name: string }>;
  error?: string;
}

export interface SetupCompleteResult {
  tenant: Tenant;
  slackWorkspaceId: string;
  asanaWorkspaceId: string;
}

export class SetupService {
  private tenantsRepository: TenantsRepository;

  constructor() {
    this.tenantsRepository = new TenantsRepository();
  }

  async validateSlackToken(token: string): Promise<SlackValidationResult> {
    if (!token.startsWith('xoxb-')) {
      return { valid: false, error: 'Token must be a bot token starting with xoxb-' };
    }

    try {
      const client = new WebClient(token);

      // Test the token with auth.test
      const authResult = await client.auth.test();

      if (!authResult.ok) {
        return { valid: false, error: 'Token validation failed' };
      }

      return {
        valid: true,
        workspaceId: authResult.team_id as string,
        workspaceName: authResult.team as string,
        teamName: authResult.team as string,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Slack token validation failed', { error });
      return { valid: false, error: `Failed to validate Slack token: ${message}` };
    }
  }

  async validateAsanaToken(token: string): Promise<AsanaValidationResult> {
    try {
      const client = new AsanaApi.ApiClient();
      client.authentications.token.accessToken = token;

      const usersApi = new AsanaApi.UsersApi(client);
      const workspacesApi = new AsanaApi.WorkspacesApi(client);
      const projectsApi = new AsanaApi.ProjectsApi(client);

      // Get the authenticated user
      const meResult = await usersApi.getUser('me', {});
      const user = meResult.data;

      if (!user) {
        return { valid: false, error: 'Failed to get user info' };
      }

      // Get workspaces
      const workspacesResult = await workspacesApi.getWorkspaces({});
      const workspaces = workspacesResult.data || [];

      if (workspaces.length === 0) {
        return { valid: false, error: 'No workspaces found for this token' };
      }

      // Use the first workspace
      const workspace = workspaces[0];

      // Get projects in the workspace
      const projectsResult = await projectsApi.getProjects({
        workspace: workspace.gid,
        limit: 100,
      });
      const projects = (projectsResult.data || []).map((p: { gid: string; name: string }) => ({
        id: p.gid,
        name: p.name,
      }));

      return {
        valid: true,
        workspaceId: workspace.gid,
        workspaceName: workspace.name,
        userId: user.gid,
        userName: user.name,
        projects,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Asana token validation failed', { error });
      return { valid: false, error: `Failed to validate Asana token: ${message}` };
    }
  }

  async completeSetup(
    tenantId: string,
    slackToken: string,
    asanaToken: string,
    asanaProjectId: string,
    adminSlackUserId: string
  ): Promise<SetupCompleteResult> {
    // Validate both tokens again
    const slackResult = await this.validateSlackToken(slackToken);
    if (!slackResult.valid) {
      throw new Error(slackResult.error || 'Invalid Slack token');
    }

    const asanaResult = await this.validateAsanaToken(asanaToken);
    if (!asanaResult.valid) {
      throw new Error(asanaResult.error || 'Invalid Asana token');
    }

    // Check for duplicate workspace
    const existingBySlack = await this.tenantsRepository.findBySlackWorkspaceId(slackResult.workspaceId!);
    if (existingBySlack && existingBySlack.id !== tenantId) {
      throw new Error('This Slack workspace is already registered');
    }

    // Generate secret names
    const slackSecretName = `${tenantId}-slack-token`;
    const asanaSecretName = `${tenantId}-asana-token`;

    // Store tokens in GCP Secret Manager (or env in dev)
    if (config.gcp.secretManagerEnabled) {
      await upsertSecret(slackSecretName, slackToken);
      await upsertSecret(asanaSecretName, asanaToken);
      logger.info('Tokens stored in GCP Secret Manager', { tenantId });
    } else {
      // In dev mode, just log that we would store them
      logger.warn('GCP Secret Manager not enabled, tokens not persisted to secrets', { tenantId });
    }

    // Update tenant with integration info
    const tenant = await this.tenantsRepository.update(tenantId, {
      slackWorkspaceId: slackResult.workspaceId!,
      slackBotTokenSecretName: slackSecretName,
      asanaWorkspaceId: asanaResult.workspaceId!,
      asanaBotUserId: asanaResult.userId!,
      asanaApiTokenSecretName: asanaSecretName,
      asanaProjectId,
      adminSlackUserId,
      setupCompleted: true,
    });

    if (!tenant) {
      throw new Error('Failed to update tenant');
    }

    logger.info('Setup completed', {
      tenantId,
      slackWorkspaceId: slackResult.workspaceId,
      asanaWorkspaceId: asanaResult.workspaceId,
    });

    return {
      tenant,
      slackWorkspaceId: slackResult.workspaceId!,
      asanaWorkspaceId: asanaResult.workspaceId!,
    };
  }

  async updateSlackToken(tenantId: string, slackToken: string): Promise<SlackValidationResult> {
    const result = await this.validateSlackToken(slackToken);
    if (!result.valid) {
      return result;
    }

    const tenant = await this.tenantsRepository.findById(tenantId);
    if (!tenant) {
      return { valid: false, error: 'Tenant not found' };
    }

    // Check workspace ID matches (can't switch workspaces)
    if (tenant.slackWorkspaceId && tenant.slackWorkspaceId !== result.workspaceId) {
      return { valid: false, error: 'Token is for a different Slack workspace' };
    }

    // Update secret
    if (config.gcp.secretManagerEnabled) {
      await upsertSecret(tenant.slackBotTokenSecretName, slackToken);
    }

    return result;
  }

  async updateAsanaToken(tenantId: string, asanaToken: string): Promise<AsanaValidationResult> {
    const result = await this.validateAsanaToken(asanaToken);
    if (!result.valid) {
      return result;
    }

    const tenant = await this.tenantsRepository.findById(tenantId);
    if (!tenant) {
      return { valid: false, error: 'Tenant not found' };
    }

    // Check workspace ID matches (can't switch workspaces)
    if (tenant.asanaWorkspaceId && tenant.asanaWorkspaceId !== result.workspaceId) {
      return { valid: false, error: 'Token is for a different Asana workspace' };
    }

    // Update secret
    if (config.gcp.secretManagerEnabled) {
      await upsertSecret(tenant.asanaApiTokenSecretName, asanaToken);
    }

    return result;
  }
}
