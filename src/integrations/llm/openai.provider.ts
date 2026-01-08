import { BaseLLMProvider } from './llm.interface';
import {
  ConversationContext,
  TaskContext,
  IntentClassification,
  GeneratedResponse,
  LLMConfig,
} from '../../types/nlp.types';

/**
 * OpenAI implementation of the LLM service
 *
 * This is a stub implementation. To use OpenAI:
 * 1. Install the openai package: npm install openai
 * 2. Implement the methods following the same pattern as ClaudeProvider
 * 3. Use the same prompts from prompts.ts for consistency
 */
export class OpenAIProvider extends BaseLLMProvider {
  constructor(_config: LLMConfig) {
    super();
    // OpenAI implementation would initialize the client here
    // Example:
    // import OpenAI from 'openai';
    // this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async classifyIntent(
    _message: string,
    _context: ConversationContext,
    _taskContext?: TaskContext
  ): Promise<IntentClassification> {
    // TODO: Implement OpenAI-based intent classification
    // Use the same prompts from prompts.ts
    // Parse the response JSON the same way as ClaudeProvider

    throw new Error(
      'OpenAI provider not yet implemented. Please use LLM_PROVIDER=claude or implement this provider.'
    );
  }

  async generateResponse(
    _intent: IntentClassification,
    _userMessage: string,
    _context: ConversationContext,
    _taskContext?: TaskContext
  ): Promise<GeneratedResponse> {
    // TODO: Implement OpenAI-based response generation
    // Use the same prompts from prompts.ts

    throw new Error(
      'OpenAI provider not yet implemented. Please use LLM_PROVIDER=claude or implement this provider.'
    );
  }
}

/**
 * Example implementation outline for OpenAI:
 *
 * ```typescript
 * import OpenAI from 'openai';
 * import { INTENT_CLASSIFICATION_SYSTEM_PROMPT, buildIntentClassificationPrompt } from './prompts';
 *
 * export class OpenAIProvider extends BaseLLMProvider {
 *   private client: OpenAI;
 *   private model: string;
 *
 *   constructor(config: LLMConfig) {
 *     super();
 *     this.client = new OpenAI({ apiKey: config.apiKey });
 *     this.model = config.model || 'gpt-4o';
 *   }
 *
 *   async classifyIntent(message: string, context: ConversationContext, taskContext?: TaskContext): Promise<IntentClassification> {
 *     return this.withRetry(async () => {
 *       const userPrompt = buildIntentClassificationPrompt(
 *         message,
 *         context.conversation.state,
 *         taskContext?.asanaTaskName,
 *         context.messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
 *       );
 *
 *       const response = await this.client.chat.completions.create({
 *         model: this.model,
 *         messages: [
 *           { role: 'system', content: INTENT_CLASSIFICATION_SYSTEM_PROMPT },
 *           { role: 'user', content: userPrompt }
 *         ],
 *         response_format: { type: 'json_object' }, // OpenAI JSON mode
 *       });
 *
 *       const content = response.choices[0].message.content;
 *       const parsed = JSON.parse(content);
 *
 *       return {
 *         intent: parsed.intent as MessageIntent,
 *         confidence: parsed.confidence,
 *         extractedData: parsed.extractedData || {},
 *         reasoning: parsed.reasoning,
 *       };
 *     }, 'classifyIntent');
 *   }
 *
 *   // ... similar implementation for generateResponse
 * }
 * ```
 */
