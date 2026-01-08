/**
 * Mock Asana client for testing
 */
import { TaskSystemTask, TaskSystemUser } from '../../integrations/interfaces/task-system.interface';
import { AsanaTaskFull } from '../../integrations/asana';

export const createMockAsanaClient = () => {
  const tasks = new Map<string, AsanaTaskFull>();
  const users = new Map<string, TaskSystemUser>();
  const comments: Array<{ taskId: string; comment: string }> = [];
  const reassignments: Array<{ taskId: string; userId: string }> = [];

  return {
    // Storage for assertions
    tasks,
    users,
    comments,
    reassignments,

    // Add test data
    addTask(task: AsanaTaskFull) {
      tasks.set(task.id, task);
    },

    addUser(user: TaskSystemUser) {
      users.set(user.id, user);
    },

    // Mock methods
    getTask: jest.fn(async (taskId: string, _tenantId?: string): Promise<TaskSystemTask> => {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      return {
        id: task.id,
        url: task.url,
        name: task.name,
        description: task.description,
        assignee: task.assignee,
        completed: task.completed,
        dueDate: task.dueDate,
      };
    }),

    getTaskFull: jest.fn(async (taskId: string, _tenantId?: string): Promise<AsanaTaskFull> => {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      return task;
    }),

    reassignTask: jest.fn(async (taskId: string, userId: string, _tenantId?: string) => {
      reassignments.push({ taskId, userId });
    }),

    addComment: jest.fn(async (taskId: string, comment: string, _tenantId?: string) => {
      comments.push({ taskId, comment });
    }),

    isTaskCompleted: jest.fn(async (taskId: string, _tenantId?: string) => {
      const task = tasks.get(taskId);
      return task?.completed || false;
    }),

    getUserByEmail: jest.fn(async (email: string, _workspaceId: string, _tenantId?: string) => {
      for (const user of users.values()) {
        if (user.email.toLowerCase() === email.toLowerCase()) {
          return user;
        }
      }
      return null;
    }),

    getUserByName: jest.fn(async (name: string, _workspaceId: string, _tenantId?: string) => {
      for (const user of users.values()) {
        if (user.name.toLowerCase() === name.toLowerCase()) {
          return user;
        }
      }
      return null;
    }),

    registerTenantClient: jest.fn(),

    setupWebhook: jest.fn(async () => 'webhook-123'),

    verifyWebhook: jest.fn(() => true),

    // Reset for clean tests
    reset() {
      tasks.clear();
      users.clear();
      comments.length = 0;
      reassignments.length = 0;
      jest.clearAllMocks();
    },
  };
};

export type MockAsanaClient = ReturnType<typeof createMockAsanaClient>;
