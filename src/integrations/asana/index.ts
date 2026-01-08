import * as Asana from 'asana';
import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  ITaskSystemClient,
  TaskSystemTask,
  TaskSystemUser,
} from '../interfaces/task-system.interface';

/**
 * Full Asana task details including custom fields
 */
export interface AsanaTaskFull {
  id: string;
  url: string;
  name: string;
  description?: string;
  htmlDescription?: string;
  assignee?: TaskSystemUser;
  createdBy?: TaskSystemUser;
  completed: boolean;
  dueDate?: Date;
  dueAt?: Date;
  createdAt?: Date;
  modifiedAt?: Date;
  customFields?: Array<{
    name: string;
    type: string;
    value: string | number | null;
  }>;
  projects?: Array<{
    id: string;
    name: string;
  }>;
  tags?: string[];
}

// Type assertions for asana v3 SDK (no @types available for v3)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AsanaApi = Asana as any;

export class AsanaClient implements ITaskSystemClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clients: Map<string, any> = new Map();

  /**
   * Register a tenant-specific Asana client
   */
  registerTenantClient(tenantId: string, apiToken: string): void {
    const client = new AsanaApi.ApiClient();
    client.authentications.token.accessToken = apiToken;
    this.clients.set(tenantId, client);
  }

  /**
   * Get client for a specific tenant
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getClient(tenantId?: string): any {
    if (!tenantId) {
      throw new Error('Tenant ID required for Asana operations');
    }
    const client = this.clients.get(tenantId);
    if (!client) {
      throw new Error(`No Asana client found for tenant ${tenantId}`);
    }
    return client;
  }

  async getTask(taskId: string, tenantId?: string): Promise<TaskSystemTask> {
    const client = this.getClient(tenantId);
    const tasksApi = new AsanaApi.TasksApi(client);

    try {
      const result = await tasksApi.getTask(taskId, {});
      const task = result.data;

      return {
        id: task.gid || '',
        url: task.permalink_url || `https://app.asana.com/0/0/${task.gid}`,
        name: task.name || '',
        description: task.notes,
        assignee: task.assignee
          ? {
              id: task.assignee.gid || '',
              name: task.assignee.name || '',
              email: task.assignee.email || '',
            }
          : undefined,
        completed: task.completed || false,
        dueDate: task.due_on ? new Date(task.due_on) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get Asana task', { error, taskId, tenantId });
      throw error;
    }
  }

  /**
   * Get full task details including custom fields for LLM context
   */
  async getTaskFull(taskId: string, tenantId?: string): Promise<AsanaTaskFull> {
    const client = this.getClient(tenantId);
    const tasksApi = new AsanaApi.TasksApi(client);

    try {
      // Fetch with all relevant fields
      const result = await tasksApi.getTask(taskId, {
        opt_fields: 'name,notes,html_notes,due_on,due_at,assignee,assignee.name,assignee.email,completed,created_at,modified_at,permalink_url,custom_fields,custom_fields.name,custom_fields.type,custom_fields.display_value,custom_fields.number_value,custom_fields.text_value,memberships.project.name,tags.name,created_by,created_by.name,created_by.email'
      });
      const task = result.data;

      // Process custom fields (Asana SDK lacks types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customFields = task.custom_fields?.map((cf: any) => ({
        name: cf.name || '',
        type: cf.type || '',
        value: cf.display_value || cf.text_value || cf.number_value || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).filter((cf: any) => cf.value !== null) || [];

      // Process projects (Asana SDK lacks types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projects = task.memberships?.map((m: any) => ({
        id: m.project?.gid || '',
        name: m.project?.name || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })).filter((p: any) => p.name) || [];

      // Process tags (Asana SDK lacks types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tags = task.tags?.map((t: any) => t.name).filter(Boolean) || [];

      return {
        id: task.gid || '',
        url: task.permalink_url || `https://app.asana.com/0/0/${task.gid}`,
        name: task.name || '',
        description: task.notes || undefined,
        htmlDescription: task.html_notes || undefined,
        assignee: task.assignee
          ? {
              id: task.assignee.gid || '',
              name: task.assignee.name || '',
              email: task.assignee.email || '',
            }
          : undefined,
        createdBy: task.created_by
          ? {
              id: task.created_by.gid || '',
              name: task.created_by.name || '',
              email: task.created_by.email || '',
            }
          : undefined,
        completed: task.completed || false,
        dueDate: task.due_on ? new Date(task.due_on) : undefined,
        dueAt: task.due_at ? new Date(task.due_at) : undefined,
        createdAt: task.created_at ? new Date(task.created_at) : undefined,
        modifiedAt: task.modified_at ? new Date(task.modified_at) : undefined,
        customFields,
        projects,
        tags,
      };
    } catch (error) {
      logger.error('Failed to get full Asana task', { error, taskId, tenantId });
      throw error;
    }
  }

  async reassignTask(taskId: string, userId: string, tenantId?: string): Promise<void> {
    const client = this.getClient(tenantId);
    const tasksApi = new AsanaApi.TasksApi(client);

    logger.debug('Attempting to reassign task', { taskId, userId, tenantId });

    try {
      // Asana SDK: updateTask(body, task_gid, opts)
      const body = { data: { assignee: userId } };
      await tasksApi.updateTask(body, taskId, {});
      logger.info('Task reassigned in Asana', { taskId, userId, tenantId });
    } catch (error: unknown) {
      const err = error as { response?: { body?: unknown }; message?: string };
      const errorDetails = err?.response?.body || err?.message || error;
      logger.error('Failed to reassign Asana task', { error: errorDetails, taskId, userId, tenantId });
      throw error;
    }
  }

  async addComment(taskId: string, comment: string, tenantId?: string): Promise<void> {
    const client = this.getClient(tenantId);
    const storiesApi = new AsanaApi.StoriesApi(client);

    try {
      await storiesApi.createStoryForTask({ data: { text: comment } }, taskId, {});
      logger.info('Comment added to Asana task', { taskId, tenantId });
    } catch (error) {
      logger.error('Failed to add comment to Asana task', { error, taskId, tenantId });
      throw error;
    }
  }

  async isTaskCompleted(taskId: string, tenantId?: string): Promise<boolean> {
    const client = this.getClient(tenantId);
    const tasksApi = new AsanaApi.TasksApi(client);

    try {
      const result = await tasksApi.getTask(taskId, {});
      return result.data.completed || false;
    } catch (error) {
      logger.error('Failed to check Asana task completion', { error, taskId, tenantId });
      throw error;
    }
  }

  async getUserByEmail(email: string, workspaceId: string, tenantId?: string): Promise<TaskSystemUser | null> {
    const client = this.getClient(tenantId);
    const usersApi = new AsanaApi.UsersApi(client);

    try {
      // Asana API v3: get users for workspace
      const result = await usersApi.getUsersForWorkspace(workspaceId, {});
      const users = result.data;

      for (const user of users) {
        if (user.email?.toLowerCase() === email.toLowerCase()) {
          return {
            id: user.gid || '',
            name: user.name || '',
            email: user.email || '',
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get Asana user by email', { error, email, tenantId });
      return null;
    }
  }

  async getUserByName(name: string, workspaceId: string, tenantId?: string): Promise<TaskSystemUser | null> {
    const client = this.getClient(tenantId);
    const usersApi = new AsanaApi.UsersApi(client);

    try {
      const result = await usersApi.getUsersForWorkspace(workspaceId, {});
      const users = result.data;

      // Normalize the search name
      const normalizedSearch = name.trim().toLowerCase();

      for (const user of users) {
        const userName = user.name?.trim().toLowerCase() || '';
        // Exact match or close match (handles "Nathan Koerschner" vs "Nathan Koerschner")
        if (userName === normalizedSearch) {
          logger.info('Found Asana user by exact name match', { searchName: name, foundUser: user.name });
          return {
            id: user.gid || '',
            name: user.name || '',
            email: user.email || '',
          };
        }
      }

      // Try partial matching (first name + last name variations)
      for (const user of users) {
        const userName = user.name?.trim().toLowerCase() || '';
        // Check if names contain each other (handles partial matches)
        if (userName.includes(normalizedSearch) || normalizedSearch.includes(userName)) {
          logger.info('Found Asana user by partial name match', { searchName: name, foundUser: user.name });
          return {
            id: user.gid || '',
            name: user.name || '',
            email: user.email || '',
          };
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.debug('No Asana user found by name', { searchName: name, availableUsers: users.map((u: any) => u.name) });
      return null;
    } catch (error) {
      logger.error('Failed to get Asana user by name', { error, name, tenantId });
      return null;
    }
  }

  async setupWebhook(_workspaceId: string, resource: string, callbackUrl: string, tenantId?: string): Promise<string> {
    const client = this.getClient(tenantId);
    const webhooksApi = new AsanaApi.WebhooksApi(client);

    try {
      const result = await webhooksApi.createWebhook({
        resource,
        target: callbackUrl,
        filters: []
      }, {});
      const webhook = result.data;

      logger.info('Asana webhook created', { webhookId: webhook.gid, resource, tenantId });
      return webhook.gid || '';
    } catch (error) {
      logger.error('Failed to create Asana webhook', { error, resource, tenantId });
      throw error;
    }
  }

  verifyWebhook(payload: Buffer, signature: string): boolean {
    const secret = config.asana.webhookSecret;
    if (!secret) {
      logger.warn('Asana webhook secret is not configured');
      return false;
    }

    if (!signature || !/^[a-f0-9]+$/i.test(signature)) {
      return false;
    }

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  }
}
