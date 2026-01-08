/**
 * Tests for LLM prompt generation
 */
import {
  formatAsanaTaskForLLM,
  buildIntentClassificationPrompt,
  buildResponseGenerationPrompt,
  RESPONSE_GENERATION_PROMPTS,
} from '../integrations/llm/prompts';
import { MessageIntent } from '../types/nlp.types';
import { ConversationState } from '../models';
import { AsanaTaskFull } from '../integrations/asana';

describe('formatAsanaTaskForLLM', () => {
  it('should format basic task details', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('TASK DETAILS:');
    expect(result).toContain('Name: Test Task');
    expect(result).toContain('URL: https://app.asana.com/task/123');
  });

  it('should include description when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      description: 'This is a detailed description',
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Description: This is a detailed description');
  });

  it('should include due date when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      dueDate: new Date('2024-12-31'),
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Due date:');
  });

  it('should include assignee when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      assignee: { id: 'user1', name: 'John Doe', email: 'john@example.com' },
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Currently assigned to: John Doe');
  });

  it('should include createdBy when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      createdBy: { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Created by: Jane Smith');
  });

  it('should include custom fields when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      customFields: [
        { name: 'Priority', type: 'enum', value: 'High' },
        { name: 'Estimated Hours', type: 'number', value: 8 },
      ],
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Custom fields:');
    expect(result).toContain('Priority: High');
    expect(result).toContain('Estimated Hours: 8');
  });

  it('should include projects when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      projects: [
        { id: 'proj1', name: 'Project Alpha' },
        { id: 'proj2', name: 'Project Beta' },
      ],
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Projects: Project Alpha, Project Beta');
  });

  it('should include tags when present', () => {
    const task: AsanaTaskFull = {
      id: '123',
      url: 'https://app.asana.com/task/123',
      name: 'Test Task',
      tags: ['urgent', 'frontend'],
      completed: false,
    };

    const result = formatAsanaTaskForLLM(task);

    expect(result).toContain('Tags: urgent, frontend');
  });
});

describe('buildIntentClassificationPrompt', () => {
  it('should include user message', () => {
    const result = buildIntentClassificationPrompt(
      'Yes, I can take this task',
      ConversationState.AWAITING_PROPOSITION_RESPONSE
    );

    expect(result).toContain('MESSAGE: "Yes, I can take this task"');
  });

  it('should include conversation state', () => {
    const result = buildIntentClassificationPrompt(
      'Test message',
      ConversationState.AWAITING_PROPOSITION_RESPONSE
    );

    expect(result).toContain('Conversation state: awaiting_proposition_response');
  });

  it('should include task data when provided', () => {
    const taskData = 'TASK DETAILS:\n- Name: Test Task\n- URL: https://example.com';

    const result = buildIntentClassificationPrompt(
      'Test message',
      ConversationState.IDLE,
      taskData
    );

    expect(result).toContain('TASK DETAILS:');
    expect(result).toContain('Name: Test Task');
  });

  it('should include recent messages when provided', () => {
    const recentMessages = [
      { role: 'assistant', content: 'Would you like to take this task?' },
      { role: 'user', content: 'Tell me more about it' },
    ];

    const result = buildIntentClassificationPrompt(
      'Current message',
      ConversationState.IN_CONVERSATION,
      undefined,
      recentMessages
    );

    expect(result).toContain('RECENT CONVERSATION:');
    expect(result).toContain('assistant: Would you like to take this task?');
    expect(result).toContain('user: Tell me more about it');
  });

  it('should request JSON response format', () => {
    const result = buildIntentClassificationPrompt(
      'Test message',
      ConversationState.IDLE
    );

    expect(result).toContain('Respond with JSON');
    expect(result).toContain('"intent"');
    expect(result).toContain('"confidence"');
    expect(result).toContain('"extractedData"');
  });
});

describe('buildResponseGenerationPrompt', () => {
  it('should include base prompt for intent', () => {
    const result = buildResponseGenerationPrompt(
      MessageIntent.ACCEPT_TASK,
      'Yes, I will do it'
    );

    expect(result).toContain(RESPONSE_GENERATION_PROMPTS[MessageIntent.ACCEPT_TASK]);
  });

  it('should include user question prominently', () => {
    const result = buildResponseGenerationPrompt(
      MessageIntent.ASK_QUESTION,
      'Who created this task?'
    );

    expect(result).toContain('USER\'S QUESTION: "Who created this task?"');
  });

  it('should include task data before user question', () => {
    const taskData = 'TASK DETAILS:\n- Name: Test Task';

    const result = buildResponseGenerationPrompt(
      MessageIntent.ASK_QUESTION,
      'Who created this task?',
      taskData
    );

    // Task data should come before the question
    const taskDataIndex = result.indexOf('TASK DETAILS:');
    const questionIndex = result.indexOf('USER\'S QUESTION:');

    expect(taskDataIndex).toBeLessThan(questionIndex);
  });

  it('should include additional context when provided', () => {
    const result = buildResponseGenerationPrompt(
      MessageIntent.DECLINE_TASK,
      'Sorry, too busy',
      undefined,
      'User\'s reason: workload'
    );

    expect(result).toContain('Additional context: User\'s reason: workload');
  });

  it('should instruct to answer the user question', () => {
    const result = buildResponseGenerationPrompt(
      MessageIntent.ASK_QUESTION,
      'What is the deadline?'
    );

    expect(result).toContain('directly answers the user\'s question');
  });
});

describe('RESPONSE_GENERATION_PROMPTS', () => {
  it('should have prompts for all message intents', () => {
    const intents = Object.values(MessageIntent);

    for (const intent of intents) {
      expect(RESPONSE_GENERATION_PROMPTS[intent]).toBeDefined();
      expect(typeof RESPONSE_GENERATION_PROMPTS[intent]).toBe('string');
      expect(RESPONSE_GENERATION_PROMPTS[intent].length).toBeGreaterThan(0);
    }
  });

  it('ASK_QUESTION prompt should mention using task details', () => {
    const prompt = RESPONSE_GENERATION_PROMPTS[MessageIntent.ASK_QUESTION];

    expect(prompt).toContain('TASK DETAILS');
  });

  it('ASK_QUESTION prompt should guide toward decision', () => {
    const prompt = RESPONSE_GENERATION_PROMPTS[MessageIntent.ASK_QUESTION];

    expect(prompt.toLowerCase()).toContain('take on the task');
  });
});
