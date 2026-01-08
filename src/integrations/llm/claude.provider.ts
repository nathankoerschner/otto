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
} from '../../types/nlp.types';
import { ConversationState } from '../../models';
import { logger } from '../../utils/logger';

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
    taskContext?: TaskContext
  ): Promise<GeneratedResponse> {
    return this.withRetry(async () => {
      const userPrompt = buildResponseGenerationPrompt(
        intent.intent,
        userMessage,
        taskContext?.formattedAsanaData,
        this.buildAdditionalContext(intent, context)
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

      return {
        text: content.text.trim(),
        suggestedActions,
      };
    }, 'generateResponse');
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
    context: ConversationContext
  ): string {
    const parts: string[] = [];

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
