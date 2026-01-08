/**
 * Abstract interface for task management systems (Asana, Linear, etc.)
 * Allows for future extensibility to other task systems
 */

export interface TaskSystemUser {
  id: string;
  name: string;
  email: string;
}

export interface TaskSystemTask {
  id: string;
  url: string;
  name: string;
  description?: string;
  assignee?: TaskSystemUser;
  completed: boolean;
  dueDate?: Date;
}

export interface TaskSystemWebhookPayload {
  taskId: string;
  eventType: 'task_assigned' | 'task_completed' | 'task_updated';
  task: TaskSystemTask;
}

export interface ITaskSystemClient {
  /**
   * Get task details by ID
   */
  getTask(taskId: string, tenantId?: string): Promise<TaskSystemTask>;

  /**
   * Reassign task to a different user
   */
  reassignTask(taskId: string, userId: string, tenantId?: string): Promise<void>;

  /**
   * Add a comment to a task
   */
  addComment(taskId: string, comment: string, tenantId?: string): Promise<void>;

  /**
   * Check if task is completed
   */
  isTaskCompleted(taskId: string, tenantId?: string): Promise<boolean>;

  /**
   * Get user by email
   */
  getUserByEmail(email: string, workspaceId: string, tenantId?: string): Promise<TaskSystemUser | null>;

  /**
   * Set up webhooks for task events
   */
  setupWebhook(workspaceId: string, resource: string, callbackUrl: string, tenantId?: string): Promise<string>;

  /**
   * Verify webhook authenticity
   */
  verifyWebhook(payload: Buffer, signature: string): boolean;
}
