/**
 * Integration test for the full task assignment flow
 * Tests: Asana webhook → Sheet lookup → Slack user match → DM sent to user
 */
import { Tenant, TaskStatus } from '../models';
import {
  createMockSlackBot,
  createMockAsanaClient,
  createMockTenantManager,
} from './mocks';

// Store mock implementations in module-scoped objects that jest.mock can access
const mockSheetsFns = {
  getTaskAssignment: jest.fn(),
};

const mockTasksRepoFns = {
  findById: jest.fn(),
  findByAsanaTaskId: jest.fn(),
  findByAsanaTaskIdAny: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
};

const mockConversationsRepoFns = {
  findByUserAndTenant: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  getMessages: jest.fn(),
  addMessage: jest.fn(),
  resetToIdle: jest.fn(),
};

const mockFollowUpsRepoFns = {
  findById: jest.fn(),
  findByTaskId: jest.fn(),
  create: jest.fn(),
};

// Mock modules with module-scoped objects
jest.mock('../integrations/sheets', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => mockSheetsFns),
}));

jest.mock('../db/repositories/tasks.repository', () => ({
  TasksRepository: jest.fn().mockImplementation(() => mockTasksRepoFns),
}));

jest.mock('../db/repositories/conversations.repository', () => ({
  ConversationsRepository: jest.fn().mockImplementation(() => mockConversationsRepoFns),
}));

jest.mock('../db/repositories/follow-ups.repository', () => ({
  FollowUpsRepository: jest.fn().mockImplementation(() => mockFollowUpsRepoFns),
}));

// Import AFTER mocking
import { TaskAssignmentService } from '../services/task-assignment.service';
import { UserMatchingService } from '../services/user-matching.service';
import { FollowUpService } from '../services/follow-up.service';
import { ConversationContextService } from '../services/conversation-context.service';

describe('Task Assignment Flow Integration', () => {
  // Test tenant configuration
  const testTenant: Tenant = {
    id: 'tenant-123',
    name: 'Test Company',
    slackWorkspaceId: 'T12345',
    slackBotTokenSecretName: 'test-slack-token',
    asanaWorkspaceId: 'workspace-456',
    asanaBotUserId: 'bot-user-789',
    asanaApiTokenSecretName: 'test-asana-token',
    gsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet',
    adminSlackUserId: 'admin-user-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Test Asana task
  const testAsanaTask = {
    id: 'task-abc',
    url: 'https://app.asana.com/0/task-abc',
    name: 'Review quarterly report',
    description: 'Please review Q4 financials',
    completed: false,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    assignee: { id: 'bot-user-789', name: 'Otto Bot', email: 'otto@test.com' },
    createdBy: { id: 'creator-123', name: 'Alice Johnson', email: 'alice@test.com' },
  };

  // Test Slack user (the designated assignee)
  const testSlackUser = {
    id: 'slack-user-123',
    name: 'Bob Smith',
    email: 'bob@test.com',
  };

  // Test sheet assignment
  const testSheetAssignment = {
    assignee: 'Bob Smith',
    taskName: 'Review quarterly report',
    priority: 'High',
    estimatedHours: 4,
  };

  // Create mocks
  const mockSlackBot = createMockSlackBot();
  const mockAsanaClient = createMockAsanaClient();
  const mockTenantManager = createMockTenantManager();

  // Task storage for mocked repo
  const tasksStorage = new Map<string, any>();
  let taskIdCounter = 0;

  let taskAssignmentService: TaskAssignmentService;
  let conversationContextService: ConversationContextService;
  let userMatchingService: UserMatchingService;
  let followUpService: FollowUpService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockSlackBot.reset();
    mockAsanaClient.reset();
    mockTenantManager.reset();
    tasksStorage.clear();
    taskIdCounter = 0;

    // Set up test data
    mockTenantManager.addTenant(testTenant);
    mockAsanaClient.addTask(testAsanaTask);
    mockSlackBot.addUser(testSlackUser.id, testSlackUser.name, testSlackUser.email);

    // Set up Asana user for user matching
    mockAsanaClient.addUser({
      id: 'asana-bob-123',
      name: 'Bob Smith',
      email: 'bob@test.com',
    });

    // Configure mock sheets client
    mockSheetsFns.getTaskAssignment.mockImplementation(async (_sheetUrl: string, taskName: string) => {
      if (taskName.toLowerCase().includes('review quarterly report')) {
        return testSheetAssignment;
      }
      return null;
    });

    // Configure mock tasks repo
    mockTasksRepoFns.findById.mockImplementation(async (id: string) => tasksStorage.get(id) || null);
    mockTasksRepoFns.findByAsanaTaskId.mockImplementation(async (tenantId: string, asanaTaskId: string) => {
      for (const task of tasksStorage.values()) {
        if (task.tenantId === tenantId && task.asanaTaskId === asanaTaskId) {
          return task;
        }
      }
      return null;
    });
    mockTasksRepoFns.findByAsanaTaskIdAny.mockImplementation(async (asanaTaskId: string) => {
      for (const task of tasksStorage.values()) {
        if (task.asanaTaskId === asanaTaskId) {
          return task;
        }
      }
      return null;
    });
    mockTasksRepoFns.create.mockImplementation(async (data: any) => {
      const task = {
        id: `task-${++taskIdCounter}`,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tasksStorage.set(task.id, task);
      return task;
    });
    mockTasksRepoFns.update.mockImplementation(async (id: string, data: any) => {
      const task = tasksStorage.get(id);
      if (!task) return null;
      const updated = { ...task, ...data, updatedAt: new Date() };
      tasksStorage.set(id, updated);
      return updated;
    });
    mockTasksRepoFns.updateStatus.mockImplementation(async (id: string, status: TaskStatus) => {
      const task = tasksStorage.get(id);
      if (!task) return null;
      task.status = status;
      task.updatedAt = new Date();
      return task;
    });

    // Configure mock conversations repo
    mockConversationsRepoFns.findByUserAndTenant.mockResolvedValue(null);
    mockConversationsRepoFns.create.mockImplementation(async (data: any) => ({
      id: `conv-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockConversationsRepoFns.update.mockResolvedValue(null);
    mockConversationsRepoFns.getMessages.mockResolvedValue([]);
    mockConversationsRepoFns.addMessage.mockResolvedValue({});
    mockConversationsRepoFns.resetToIdle.mockResolvedValue(null);

    // Configure mock follow-ups repo
    mockFollowUpsRepoFns.findById.mockResolvedValue(null);
    mockFollowUpsRepoFns.findByTaskId.mockResolvedValue([]);
    mockFollowUpsRepoFns.create.mockImplementation(async (data: any) => ({
      id: `followup-${Date.now()}`,
      ...data,
      createdAt: new Date(),
    }));

    // Initialize services with mocks
    conversationContextService = new ConversationContextService(
      mockConversationsRepoFns as any,
      mockTasksRepoFns as any,
      mockFollowUpsRepoFns as any
    );

    userMatchingService = new UserMatchingService(
      mockSlackBot as any,
      mockAsanaClient as any,
      mockTenantManager as any
    );

    followUpService = new FollowUpService(
      mockSlackBot as any,
      mockAsanaClient as any,
      mockTenantManager as any
    );

    taskAssignmentService = new TaskAssignmentService(
      mockSlackBot as any,
      mockAsanaClient as any,
      mockTenantManager as any,
      userMatchingService,
      followUpService,
      conversationContextService
    );
  });

  describe('seekOwnership - Full Flow', () => {
    it('should send DM to correct user when task is assigned to bot', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Assert: Verify DM was sent to the correct user
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          text: expect.stringContaining(testAsanaTask.name),
        }),
        testTenant.id
      );
    });

    it('should fetch task from Asana', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      expect(mockAsanaClient.getTask).toHaveBeenCalledWith(testAsanaTask.id, testTenant.id);
    });

    it('should look up task assignment in Google Sheet', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      expect(mockSheetsFns.getTaskAssignment).toHaveBeenCalledWith(
        testTenant.gsheetUrl,
        testAsanaTask.name
      );
    });

    it('should find Slack user by name from sheet assignment', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      expect(mockSlackBot.getUserByName).toHaveBeenCalledWith(
        testSheetAssignment.assignee,
        testTenant.id
      );
    });

    it('should create task record in database', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      expect(mockTasksRepoFns.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: testTenant.id,
          asanaTaskId: testAsanaTask.id,
          asanaTaskUrl: testAsanaTask.url,
          status: TaskStatus.PENDING_OWNER,
        })
      );
    });

    it('should update conversation context for NLP tracking', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Verify conversation was created for the user
      expect(mockConversationsRepoFns.create).toHaveBeenCalled();
    });

    it('should include due date info in message', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // The message should mention due date
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: expect.stringMatching(/due in \d+ days/),
              }),
            }),
          ]),
        }),
        testTenant.id
      );
    });

    it('should include task URL in message', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: expect.stringContaining(testAsanaTask.url),
              }),
            }),
          ]),
        }),
        testTenant.id
      );
    });
  });

  describe('seekOwnership - Error Cases', () => {
    it('should escalate to admin when task not found in Google Sheet', async () => {
      // Override mock to return null
      mockSheetsFns.getTaskAssignment.mockResolvedValueOnce(null);

      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Verify admin was notified
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testTenant.adminSlackUserId,
        expect.objectContaining({
          text: expect.stringContaining('escalation'),
        }),
        testTenant.id
      );
    });

    it('should escalate to admin when Slack user not found', async () => {
      // Override mock to return null for user lookup
      mockSlackBot.getUserByName.mockResolvedValueOnce(null);

      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Verify admin was notified
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testTenant.adminSlackUserId,
        expect.objectContaining({
          text: expect.stringContaining('escalation'),
        }),
        testTenant.id
      );
    });

    it('should not process task if already being processed', async () => {
      // Create existing task with OWNED status
      const existingTask = {
        id: 'existing-task-1',
        tenantId: testTenant.id,
        asanaTaskId: testAsanaTask.id,
        asanaTaskUrl: testAsanaTask.url,
        status: TaskStatus.OWNED,
        ownerSlackUserId: 'someone-else',
      };
      tasksStorage.set(existingTask.id, existingTask);
      mockTasksRepoFns.findByAsanaTaskId.mockResolvedValueOnce(existingTask);

      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Should not send DM to anyone (task already claimed)
      expect(mockSlackBot.sendDirectMessage).not.toHaveBeenCalled();
    });
  });

  describe('claimTask - User Accepts', () => {
    it('should reassign task in Asana when user claims', async () => {
      // First, trigger the ownership flow to create the task
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);

      // Get the created task
      const createdTask = Array.from(tasksStorage.values())[0];

      // Mock getUserById for claim flow
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);

      // Now user claims the task
      const result = await taskAssignmentService.claimTask(
        createdTask.id,
        testSlackUser.id,
        testTenant.id
      );

      expect(result).toBe(true);
      expect(mockAsanaClient.reassignTask).toHaveBeenCalledWith(
        testAsanaTask.id,
        'asana-bob-123',
        testTenant.id
      );
    });

    it('should add comment to Asana task when claimed', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);

      await taskAssignmentService.claimTask(createdTask.id, testSlackUser.id, testTenant.id);

      expect(mockAsanaClient.addComment).toHaveBeenCalledWith(
        testAsanaTask.id,
        expect.stringContaining('Bob Smith'),
        testTenant.id
      );
    });

    it('should update task status to OWNED', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);

      await taskAssignmentService.claimTask(createdTask.id, testSlackUser.id, testTenant.id);

      expect(mockTasksRepoFns.update).toHaveBeenCalledWith(
        createdTask.id,
        expect.objectContaining({
          status: TaskStatus.OWNED,
          ownerSlackUserId: testSlackUser.id,
        })
      );
    });

    it('should send confirmation message to user', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);

      // Reset call count after seekOwnership sent first message
      mockSlackBot.sendDirectMessage.mockClear();

      await taskAssignmentService.claimTask(createdTask.id, testSlackUser.id, testTenant.id);

      // Should send confirmation
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          text: expect.stringContaining('assigned to you'),
        }),
        testTenant.id
      );
    });
  });

  describe('declineTask - User Declines', () => {
    it('should escalate to admin when user declines', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];

      mockSlackBot.sendDirectMessage.mockClear();

      await taskAssignmentService.declineTask(
        createdTask.id,
        testSlackUser.id,
        testTenant.id,
        'Too busy this week'
      );

      // Admin should receive escalation
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testTenant.adminSlackUserId,
        expect.objectContaining({
          text: expect.stringContaining('escalation'),
        }),
        testTenant.id
      );
    });

    it('should acknowledge decline to user', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];

      mockSlackBot.sendDirectMessage.mockClear();

      await taskAssignmentService.declineTask(
        createdTask.id,
        testSlackUser.id,
        testTenant.id
      );

      // User should receive acknowledgment
      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          text: expect.stringContaining('Thanks for letting me know'),
        }),
        testTenant.id
      );
    });
  });

  describe('handleTaskCompleted - Task Marked Done', () => {
    it('should update task status to COMPLETED', async () => {
      // Create and claim a task first
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);
      await taskAssignmentService.claimTask(createdTask.id, testSlackUser.id, testTenant.id);

      // Now complete the task
      await taskAssignmentService.handleTaskCompleted(testAsanaTask.id, testTenant.id);

      expect(mockTasksRepoFns.updateStatus).toHaveBeenCalledWith(
        createdTask.id,
        TaskStatus.COMPLETED
      );
    });

    it('should send congratulations to task owner', async () => {
      await taskAssignmentService.seekOwnership(testAsanaTask.id, testTenant.id);
      const createdTask = Array.from(tasksStorage.values())[0];
      (mockSlackBot as any).getUserById = jest.fn().mockResolvedValue(testSlackUser);
      await taskAssignmentService.claimTask(createdTask.id, testSlackUser.id, testTenant.id);

      mockSlackBot.sendDirectMessage.mockClear();

      await taskAssignmentService.handleTaskCompleted(testAsanaTask.id, testTenant.id);

      expect(mockSlackBot.sendDirectMessage).toHaveBeenCalledWith(
        testSlackUser.id,
        expect.objectContaining({
          text: expect.stringContaining('Great job'),
        }),
        testTenant.id
      );
    });
  });
});
