import { ILLMService } from './llm.interface';
import { ClaudeProvider } from './claude.provider';
import { OpenAIProvider } from './openai.provider';
import { LLMConfig } from '../../types/nlp.types';

export { ILLMService, BaseLLMProvider } from './llm.interface';
export { ClaudeProvider } from './claude.provider';
export { OpenAIProvider } from './openai.provider';

/**
 * Factory function to create an LLM service based on configuration
 *
 * @param config - LLM configuration specifying provider, API key, model, etc.
 * @returns An implementation of ILLMService
 * @throws Error if provider is not supported
 *
 * @example
 * ```typescript
 * const llmService = createLLMService({
 *   provider: 'claude',
 *   apiKey: process.env.LLM_API_KEY,
 *   model: 'claude-sonnet-4-20250514',
 *   maxTokens: 1024,
 * });
 *
 * const result = await llmService.conductConversation(userMessage, context);
 * ```
 */
export function createLLMService(config: LLMConfig): ILLMService {
  switch (config.provider) {
    case 'claude':
      return new ClaudeProvider(config);

    case 'openai':
      return new OpenAIProvider(config);

    default:
      throw new Error(
        `Unknown LLM provider: ${config.provider}. Supported providers: claude, openai`
      );
  }
}

/**
 * Validate LLM configuration
 *
 * @param config - LLM configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateLLMConfig(config: Partial<LLMConfig>): void {
  if (!config.provider) {
    throw new Error('LLM_PROVIDER is required');
  }

  if (!['claude', 'openai'].includes(config.provider)) {
    throw new Error(`Invalid LLM_PROVIDER: ${config.provider}. Supported: claude, openai`);
  }

  if (!config.apiKey) {
    throw new Error('LLM_API_KEY is required');
  }
}
