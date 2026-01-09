/**
 * Mock database repositories for testing
 */
import { Task, TaskStatus, Tenant, Conversation, ConversationMessage, ConversationState, TaskLLMContext } from '../../models';

// Helper to generate UUIDs
const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

export const createMockTasksRepo = () => {
  const tasks = new Map<string, Task>();

  return {
    tasks,

    findById: jest.fn(async (id: string) => tasks.get(id) || null),

    findByAsanaTaskId: jest.fn(async (tenantId: string, asanaTaskId: string) => {
      for (const task of tasks.values()) {
        if (task.tenantId === tenantId && task.asanaTaskId === asanaTaskId) {
          return task;
        }
      }
      return null;
    }),

    findByAsanaTaskIdAny: jest.fn(async (asanaTaskId: string) => {
      for (const task of tasks.values()) {
        if (task.asanaTaskId === asanaTaskId) {
          return task;
        }
      }
      return null;
    }),

    findByOwner: jest.fn(async (tenantId: string, ownerSlackUserId: string) => {
      return Array.from(tasks.values()).filter(
        t => t.tenantId === tenantId && t.ownerSlackUserId === ownerSlackUserId
      );
    }),

    create: jest.fn(async (data: Partial<Task>) => {
      const task: Task = {
        id: generateId(),
        tenantId: data.tenantId || 'test-tenant',
        asanaTaskId: data.asanaTaskId || '',
        asanaTaskUrl: data.asanaTaskUrl || '',
        status: data.status || TaskStatus.PENDING_OWNER,
        ownerSlackUserId: data.ownerSlackUserId ?? null,
        ownerAsanaUserId: data.ownerAsanaUserId ?? null,
        dueDate: data.dueDate ?? null,
        propositionMessageTs: data.propositionMessageTs ?? null,
        propositionSentAt: data.propositionSentAt ?? null,
        claimedAt: data.claimedAt ?? null,
        context: data.context ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tasks.set(task.id, task);
      return task;
    }),

    update: jest.fn(async (id: string, data: Partial<Task>) => {
      const task = tasks.get(id);
      if (!task) return null;
      const updated = { ...task, ...data, updatedAt: new Date() };
      tasks.set(id, updated);
      return updated;
    }),

    updateStatus: jest.fn(async (id: string, status: TaskStatus) => {
      const task = tasks.get(id);
      if (!task) return null;
      task.status = status;
      task.updatedAt = new Date();
      return task;
    }),

    updateContext: jest.fn(async (id: string, context: TaskLLMContext) => {
      const task = tasks.get(id);
      if (!task) return null;
      task.context = context;
      task.updatedAt = new Date();
      return task;
    }),

    reset() {
      tasks.clear();
      jest.clearAllMocks();
    },
  };
};

export const createMockTenantsRepo = () => {
  const tenants = new Map<string, Tenant>();

  return {
    tenants,

    addTenant(tenant: Tenant) {
      tenants.set(tenant.id, tenant);
    },

    findById: jest.fn(async (id: string) => tenants.get(id) || null),

    findBySlackWorkspaceId: jest.fn(async (workspaceId: string) => {
      for (const tenant of tenants.values()) {
        if (tenant.slackWorkspaceId === workspaceId) {
          return tenant;
        }
      }
      return null;
    }),

    findAll: jest.fn(async () => Array.from(tenants.values())),

    reset() {
      tenants.clear();
      jest.clearAllMocks();
    },
  };
};

export const createMockConversationsRepo = () => {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, ConversationMessage[]>();

  return {
    conversations,
    messages,

    findByUserAndTenant: jest.fn(async (tenantId: string, slackUserId: string) => {
      for (const conv of conversations.values()) {
        if (conv.tenantId === tenantId && conv.slackUserId === slackUserId) {
          return conv;
        }
      }
      return null;
    }),

    create: jest.fn(async (data: Partial<Conversation>) => {
      const conv: Conversation = {
        id: generateId(),
        tenantId: data.tenantId || 'test-tenant',
        slackUserId: data.slackUserId || '',
        slackChannelId: data.slackChannelId ?? null,
        state: data.state || ConversationState.IDLE,
        activeTaskId: data.activeTaskId ?? null,
        pendingPropositionTaskId: data.pendingPropositionTaskId ?? null,
        lastInteractionAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.set(conv.id, conv);
      messages.set(conv.id, []);
      return conv;
    }),

    update: jest.fn(async (id: string, data: Partial<Conversation>) => {
      const conv = conversations.get(id);
      if (!conv) return null;
      const updated = { ...conv, ...data, updatedAt: new Date() };
      conversations.set(id, updated);
      return updated;
    }),

    getMessages: jest.fn(async (conversationId: string, _limit?: number) => {
      return messages.get(conversationId) || [];
    }),

    addMessage: jest.fn(async (data: Partial<ConversationMessage>) => {
      const msg: ConversationMessage = {
        id: generateId(),
        conversationId: data.conversationId || '',
        role: data.role || 'user',
        content: data.content || '',
        classifiedIntent: data.classifiedIntent ?? null,
        confidence: data.confidence ?? null,
        extractedData: data.extractedData ?? null,
        slackMessageTs: data.slackMessageTs ?? null,
        createdAt: new Date(),
      };
      const convMessages = messages.get(data.conversationId || '') || [];
      convMessages.push(msg);
      messages.set(data.conversationId || '', convMessages);
      return msg;
    }),

    resetToIdle: jest.fn(async (id: string) => {
      const conv = conversations.get(id);
      if (!conv) return null;
      conv.state = ConversationState.IDLE;
      conv.pendingPropositionTaskId = null;
      return conv;
    }),

    reset() {
      conversations.clear();
      messages.clear();
      jest.clearAllMocks();
    },
  };
};

export type MockTasksRepo = ReturnType<typeof createMockTasksRepo>;
export type MockTenantsRepo = ReturnType<typeof createMockTenantsRepo>;
export type MockConversationsRepo = ReturnType<typeof createMockConversationsRepo>;
