import {
  ConversationContext,
  TaskContext,
  IntentClassification,
  GeneratedResponse,
  ConversationResult,
  ActionOutcome,
} from '../../types/nlp.types';

/**
 * Provider-agnostic interface for LLM services.
 * Implementations can use Claude, OpenAI, or other providers.
 */
export interface ILLMService {
  /**
   * Classify the intent of a user message
   * @param message - The user's message text
   * @param context - Current conversation context
   * @param taskContext - Optional task context if message relates to a specific task
   * @returns Classification result with intent, confidence, and extracted data
   */
  classifyIntent(
    message: string,
    context: ConversationContext,
    taskContext?: TaskContext
  ): Promise<IntentClassification>;

  /**
   * Generate a response based on classified intent and action outcome
   * @param intent - The classified intent
   * @param userMessage - The user's message text (passed explicitly to avoid stale context)
   * @param context - Current conversation context
   * @param taskContext - Optional task context
   * @param actionOutcome - Optional outcome from executed action (for outcome-aware responses)
   * @returns Generated response with text, optional Slack blocks, and suggested actions
   */
  generateResponse(
    intent: IntentClassification,
    userMessage: string,
    context: ConversationContext,
    taskContext?: TaskContext,
    actionOutcome?: ActionOutcome
  ): Promise<GeneratedResponse>;

  /**
   * Conduct a full conversation turn: classify intent and generate response
   * @param userMessage - The user's message text
   * @param context - Current conversation context
   * @param taskContext - Optional task context
   * @returns Full conversation result with intent, response, and context updates
   */
  conductConversation(
    userMessage: string,
    context: ConversationContext,
    taskContext?: TaskContext
  ): Promise<ConversationResult>;
}

/**
 * Base class for LLM providers with common retry logic
 */
export abstract class BaseLLMProvider implements ILLMService {
  protected maxRetries = 3;
  protected retryDelayMs = 1000;

  abstract classifyIntent(
    message: string,
    context: ConversationContext,
    taskContext?: TaskContext
  ): Promise<IntentClassification>;

  abstract generateResponse(
    intent: IntentClassification,
    userMessage: string,
    context: ConversationContext,
    taskContext?: TaskContext,
    actionOutcome?: ActionOutcome
  ): Promise<GeneratedResponse>;

  async conductConversation(
    userMessage: string,
    context: ConversationContext,
    taskContext?: TaskContext
  ): Promise<ConversationResult> {
    const intent = await this.classifyIntent(userMessage, context, taskContext);
    const response = await this.generateResponse(intent, userMessage, context, taskContext);

    return {
      intent,
      response,
    };
  }

  /**
   * Retry wrapper with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
