/**
 * Mock Slack client for testing
 */
export const createMockSlackBot = () => {
  const sentMessages: Array<{ userId: string; message: any }> = [];
  const users = new Map<string, { id: string; name: string; email: string }>();

  return {
    // Track sent messages for assertions
    sentMessages,
    users,

    // Add a user to the mock
    addUser(id: string, name: string, email: string) {
      users.set(name.toLowerCase(), { id, name, email });
    },

    // Mock methods
    sendDirectMessage: jest.fn(async (userId: string, message: any, _tenantId: string) => {
      const ts = `${Date.now()}.${Math.random().toString(36).substring(7)}`;
      sentMessages.push({ userId, message });
      return ts;
    }),

    getUserByName: jest.fn(async (name: string, _tenantId: string) => {
      return users.get(name.toLowerCase()) || null;
    }),

    getUserByEmail: jest.fn(async (email: string, _tenantId: string) => {
      for (const user of users.values()) {
        if (user.email.toLowerCase() === email.toLowerCase()) {
          return user;
        }
      }
      return null;
    }),

    registerTenantClient: jest.fn(),

    // Reset for clean tests
    reset() {
      sentMessages.length = 0;
      users.clear();
      this.sendDirectMessage.mockClear();
      this.getUserByName.mockClear();
      this.getUserByEmail.mockClear();
    },
  };
};

export type MockSlackBot = ReturnType<typeof createMockSlackBot>;
