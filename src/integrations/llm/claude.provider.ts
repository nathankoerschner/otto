import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './llm.interface';
import {
  INTENT_CLASSIFICATION_SYSTEM_PROMPT,
  buildIntentClassificationPrompt,
  buildResponseGenerationPrompt,
} from './prompts';
import {
  ConversationContext,
  TaskContext,
  IntentClassification,
  GeneratedResponse,
  MessageIntent,
  LLMConfig,
  SuggestedAction,
  SuggestedActionType,
  ActionOutcome,
  ClaimTaskOutcome,
  DeclineTaskOutcome,
} from '../../types/nlp.types';
import { ConversationState, TaskLLMContext } from '../../models';
import { logger } from '../../utils/logger';

const CONTEXT_UPDATE_SYSTEM_PROMPT = `You are a context summarization assistant. Your job is to maintain an accurate, cumulative context JSON for a task based on conversation exchanges.

The context JSON has this structure:
{
  "keyPoints": [{ "timestamp": "ISO string", "slackUserId": "user ID", "summary": "brief summary of exchange" }],
  "currentUnderstanding": "current status/state of the task",
  "openQuestions": ["questions that remain unanswered"],
  "commitmentsMade": ["things users have committed to"]
}

Guidelines:
- Add a new keyPoint only for substantive exchanges (skip greetings, simple acknowledgments)
- Keep keyPoint summaries concise (under 100 chars)
- Update currentUnderstanding to reflect the latest task state
- Remove questions from openQuestions when answered
- Add to commitmentsMade when users make concrete promises (deadlines, deliverables)
- Preserve historical keyPoints - they form an audit trail
- Return ONLY valid JSON, no markdown formatting or explanation`;

/**
 * Claude/Anthropic implementation of the LLM service
 */
export class ClaudeProvider extends BaseLLMProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    super();
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 1024;
  }

  async classifyIntent(
    message: string,
    context: ConversationContext,
    taskContext?: TaskContext
  ): Promise<IntentClassification> {
    return this.withRetry(async () => {
      const recentMessages = context.messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const userPrompt = buildIntentClassificationPrompt(
        message,
        context.conversation.state,
        taskContext?.formattedAsanaData,
        recentMessages
      );

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: INTENT_CLASSIFICATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const parsed = this.parseJsonResponse(content.text);

      return {
        intent: parsed.intent as MessageIntent,
        confidence: parsed.confidence,
        extractedData: parsed.extractedData || {},
        reasoning: parsed.reasoning,
      };
    }, 'classifyIntent');
  }

  async generateResponse(
    intent: IntentClassification,
    userMessage: string,
    context: ConversationContext,
    taskContext?: TaskContext,
    actionOutcome?: ActionOutcome
  ): Promise<GeneratedResponse> {
    return this.withRetry(async () => {
      const additionalContext = this.buildAdditionalContext(intent, context, actionOutcome);
      const userPrompt = buildResponseGenerationPrompt(
        intent.intent,
        userMessage,
        taskContext?.formattedAsanaData,
        additionalContext
      );

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: 'You are Otto, a friendly task assignment assistant. Generate natural, conversational responses. Be helpful and concise.',
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const suggestedActions = this.determineSuggestedActions(intent, taskContext);
      const responseText = content.text.trim();

      // Generate updated task context if we have a task
      let updatedTaskContext: TaskLLMContext | undefined;
      if (taskContext) {
        updatedTaskContext = await this.generateContextUpdate(
          taskContext.task.context,
          userMessage,
          responseText,
          intent,
          context.conversation.slackUserId,
          actionOutcome
        );
      }

      return {
        text: responseText,
        suggestedActions,
        updatedTaskContext,
      };
    }, 'generateResponse');
  }

  /**
   * Generate updated task context after an exchange
   */
  private async generateContextUpdate(
    currentContext: TaskLLMContext | null,
    userMessage: string,
    assistantResponse: string,
    intent: IntentClassification,
    slackUserId: string,
    actionOutcome?: ActionOutcome
  ): Promise<TaskLLMContext> {
    const existingContext = currentContext || {
      keyPoints: [],
      currentUnderstanding: '',
      openQuestions: [],
      commitmentsMade: [],
    };

    const contextPrompt = this.buildContextUpdatePrompt(
      existingContext,
      userMessage,
      assistantResponse,
      intent,
      slackUserId,
      actionOutcome
    );

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: CONTEXT_UPDATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const parsed = this.parseContextResponse(content.text, existingContext, slackUserId, userMessage);
      return parsed;
    } catch (error) {
      logger.warn('Failed to generate context update, keeping existing context', { error });
      return existingContext;
    }
  }

  /**
   * Build prompt for context update
   */
  private buildContextUpdatePrompt(
    existingContext: TaskLLMContext,
    userMessage: string,
    assistantResponse: string,
    intent: IntentClassification,
    slackUserId: string,
    actionOutcome?: ActionOutcome
  ): string {
    const parts: string[] = [];

    parts.push('## Current Task Context');
    parts.push(JSON.stringify(existingContext, null, 2));

    parts.push('\n## Latest Exchange');
    parts.push(`User (${slackUserId}): ${userMessage}`);
    parts.push(`Assistant: ${assistantResponse}`);
    parts.push(`Classified Intent: ${intent.intent} (confidence: ${intent.confidence})`);

    if (actionOutcome) {
      parts.push(`\nAction Taken: ${actionOutcome.action} - ${actionOutcome.success ? 'Success' : 'Failed'}`);
    }

    parts.push('\n## Instructions');
    parts.push('Based on the exchange above, provide an updated context JSON. Include:');
    parts.push('1. A new key point summarizing this exchange (if substantive)');
    parts.push('2. Updated currentUnderstanding of task status');
    parts.push('3. Any new open questions or resolved ones');
    parts.push('4. Any commitments made by the user');
    parts.push('\nRespond with ONLY the JSON object, no markdown formatting.');

    return parts.join('\n');
  }

  /**
   * Parse context update response from LLM
   */
  private parseContextResponse(
    text: string,
    fallback: TaskLLMContext,
    slackUserId: string,
    userMessage: string
  ): TaskLLMContext {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      const parsed = JSON.parse(jsonText.trim()) as TaskLLMContext;

      // Validate structure
      if (!Array.isArray(parsed.keyPoints)) parsed.keyPoints = fallback.keyPoints;
      if (typeof parsed.currentUnderstanding !== 'string') parsed.currentUnderstanding = fallback.currentUnderstanding;
      if (!Array.isArray(parsed.openQuestions)) parsed.openQuestions = fallback.openQuestions;
      if (!Array.isArray(parsed.commitmentsMade)) parsed.commitmentsMade = fallback.commitmentsMade;

      return parsed;
    } catch (error) {
      logger.warn('Failed to parse context response, adding simple key point', { error });

      // Fallback: just add a simple key point
      return {
        ...fallback,
        keyPoints: [
          ...fallback.keyPoints,
          {
            timestamp: new Date().toISOString(),
            slackUserId,
            summary: userMessage.substring(0, 100),
          },
        ],
      };
    }
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks
   */
  private parseJsonResponse(text: string): {
    intent: string;
    confidence: number;
    extractedData: Record<string, unknown>;
    reasoning?: string;
  } {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      return JSON.parse(jsonText.trim());
    } catch (error) {
      logger.warn('Failed to parse JSON response from Claude', { text, error });

      // Return a fallback classification
      return {
        intent: MessageIntent.UNKNOWN,
        confidence: 0.5,
        extractedData: {},
        reasoning: 'Failed to parse LLM response',
      };
    }
  }

  /**
   * Build additional context string for response generation
   */
  private buildAdditionalContext(
    intent: IntentClassification,
    context: ConversationContext,
    actionOutcome?: ActionOutcome
  ): string {
    const parts: string[] = [];

    // Add action outcome context - this is critical for generating accurate responses
    if (actionOutcome) {
      parts.push(this.buildOutcomeContext(actionOutcome));
    }

    if (intent.extractedData) {
      const data = intent.extractedData;
      if ('reason' in data && data.reason) {
        parts.push(`User's reason: ${data.reason}`);
      }
      if ('progressPercentage' in data && data.progressPercentage) {
        parts.push(`Progress: ${data.progressPercentage}%`);
      }
      if ('description' in data && data.description) {
        parts.push(`Details: ${data.description}`);
      }
    }

    if (context.conversation.state === ConversationState.AWAITING_PROPOSITION_RESPONSE) {
      parts.push('User is responding to a task assignment request.');
    } else if (context.conversation.state === ConversationState.AWAITING_FOLLOW_UP_RESPONSE) {
      parts.push('User is responding to a progress check-in.');
    }

    return parts.join(' ');
  }

  /**
   * Build context string describing action outcome for LLM
   */
  private buildOutcomeContext(outcome: ActionOutcome): string {
    if (outcome.action === 'claim_task') {
      const claimOutcome = outcome as ClaimTaskOutcome;
      if (claimOutcome.success) {
        return 'ACTION RESULT: Task was successfully assigned to the user in Asana. Confirm the assignment and let them know you will check in as the due date approaches.';
      } else {
        switch (claimOutcome.failureReason) {
          case 'already_claimed':
            return `ACTION RESULT: Task assignment FAILED because it was already claimed by ${claimOutcome.claimedByName}. Apologize and let the user know someone else is already handling this task.`;
          case 'asana_match_failed':
            return 'ACTION RESULT: Task assignment FAILED because we could not find the user\'s Asana account. Let them know the admin has been notified to set up the mapping, and they should try again once that\'s done.';
          case 'task_not_found':
            return 'ACTION RESULT: Task assignment FAILED because the task was not found. Apologize for the confusion.';
          default:
            return 'ACTION RESULT: Task assignment FAILED due to a technical error. Apologize and suggest trying again.';
        }
      }
    } else if (outcome.action === 'decline_task') {
      const declineOutcome = outcome as DeclineTaskOutcome;
      if (declineOutcome.success) {
        return 'ACTION RESULT: Task decline was processed. The admin has been notified to find someone else. Thank the user and acknowledge their decision without judgment.';
      } else {
        return 'ACTION RESULT: There was an issue processing the decline. Apologize and let the user know we will try again.';
      }
    }

    return '';
  }

  /**
   * Determine what actions should be taken based on the intent
   */
  private determineSuggestedActions(
    intent: IntentClassification,
    taskContext?: TaskContext
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];
    const taskId = taskContext?.task.id;

    switch (intent.intent) {
      case MessageIntent.ACCEPT_TASK:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.CLAIM_TASK,
            taskId,
          });
        }
        break;

      case MessageIntent.DECLINE_TASK:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.DECLINE_TASK,
            taskId,
            metadata: intent.extractedData,
          });
        }
        break;

      case MessageIntent.REPORT_BLOCKER:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.NOTIFY_ADMIN,
            taskId,
            metadata: {
              blockerDetails: intent.extractedData,
            },
          });
        }
        break;

      case MessageIntent.REPORT_COMPLETION:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.UPDATE_TASK_STATUS,
            taskId,
            metadata: { status: 'completed' },
          });
        }
        break;

      case MessageIntent.REQUEST_HELP:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.ESCALATE,
            taskId,
            metadata: intent.extractedData,
          });
        }
        break;

      case MessageIntent.REQUEST_EXTENSION:
        if (taskId) {
          actions.push({
            type: SuggestedActionType.NOTIFY_ADMIN,
            taskId,
            metadata: {
              extensionRequest: intent.extractedData,
            },
          });
        }
        break;

      default:
        actions.push({ type: SuggestedActionType.NO_ACTION });
    }

    return actions;
  }
}
