/**
 * Mock Google Sheets client for testing
 */
export interface SheetTaskAssignment {
  assignee: string;
  taskName: string;
  priority?: string;
  estimatedHours?: number;
}

export const createMockSheetsClient = () => {
  const taskAssignments = new Map<string, SheetTaskAssignment>();

  return {
    // Storage for test data
    taskAssignments,

    // Add test data
    addTaskAssignment(taskName: string, assignment: SheetTaskAssignment) {
      // Store by normalized name for lookup
      taskAssignments.set(taskName.toLowerCase().trim(), assignment);
    },

    // Mock methods
    getTaskAssignment: jest.fn(async (taskName: string, _sheetUrl: string) => {
      const normalizedName = taskName.toLowerCase().trim();
      return taskAssignments.get(normalizedName) || null;
    }),

    // Reset for clean tests
    reset() {
      taskAssignments.clear();
      jest.clearAllMocks();
    },
  };
};

export type MockSheetsClient = ReturnType<typeof createMockSheetsClient>;
