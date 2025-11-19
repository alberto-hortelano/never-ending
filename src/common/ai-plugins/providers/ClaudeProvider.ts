/**
 * Claude AI Provider wrapper
 */

import { BaseAIProvider } from '../BaseAIProvider';
import {
  IAIProviderConfig,
  IAIResponse,
  IAIRequestOptions,
  IAIProviderFactory,
  AIError,
  AIErrorType
} from '../types';
import { IMessage } from '../../interfaces';
import { sendMessage, getModelStatus } from '../../../models/claude';

/**
 * Claude AI Provider that wraps the existing claude.ts functionality
 */
export class ClaudeProvider extends BaseAIProvider {
  private readonly defaultModel: string = 'claude-sonnet-4-5';

  constructor(config: IAIProviderConfig) {
    super(
      {
        ...config,
        model: config.model || 'claude-sonnet-4-5',
        endpoint: config.endpoint || 'https://api.anthropic.com'
      },
      {
        streaming: true,
        functionCalling: false, // Claude doesn't support function calling
        maxContextTokens: 200000, // Claude's context window
        maxResponseTokens: 32000,
        systemMessages: true,
        vision: true, // Claude supports image inputs
        jsonMode: false, // No native JSON mode, but we parse JSON from responses
        custom: {
          fallbackSupport: true,
          markdownParsing: true
        }
      }
    );
  }

  /**
   * Initialize the provider
   */
  protected async performInitialization(): Promise<void> {
    // Check if API key is set (the existing claude.ts uses environment variable)
    if (!process.env.ANTHROPIC_API_KEY && !this.config.apiKey) {
      throw new AIError(
        'Anthropic API key not configured',
        AIErrorType.CONFIGURATION,
        this.config.provider
      );
    }

    // The existing claude.ts handles its own initialization
    this.logger.info('Claude provider initialized using existing claude.ts implementation');
  }

  /**
   * Send message using the existing claude.ts implementation
   */
  protected async performSendMessage(messages: IMessage[], _options?: IAIRequestOptions): Promise<IAIResponse> {
    try {
      // The existing sendMessage function handles everything including:
      // - Model fallback
      // - Response caching
      // - JSON extraction from markdown
      // - Error handling
      // - Logging
      const responseText = await sendMessage(messages);

      // Check if it's an error response
      if (responseText.startsWith('Error:')) {
        throw new AIError(
          responseText,
          AIErrorType.API_ERROR,
          this.config.provider
        );
      }

      // Try to detect if it's a JSON error response
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.type === 'error') {
          throw new AIError(
            parsed.message || 'AI service error',
            AIErrorType.API_ERROR,
            this.config.provider,
            parsed
          );
        }
      } catch {
        // Not JSON or not an error, continue
      }

      // Get current model status for metadata
      const modelStatus = getModelStatus();

      return {
        content: responseText,
        model: modelStatus.currentModel || this.config.model || this.defaultModel,
        metadata: {
          provider: 'claude',
          modelStatus,
          hasActiveFallbacks: modelStatus.fallbacks.length > 0
        },
        usage: {
          // The existing implementation doesn't expose token counts
          // We could estimate them based on response length
          promptTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
          completionTokens: this.estimateTokens(responseText),
          totalTokens: 0,
          cost: 0
        }
      };

    } catch (error) {
      // Convert errors to our error type
      if (error instanceof AIError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for specific error types
      if (errorMessage.includes('overloaded') || errorMessage.includes('529')) {
        throw new AIError(
          'Claude API is overloaded',
          AIErrorType.RATE_LIMIT,
          this.config.provider,
          error
        );
      }

      if (errorMessage.includes('timeout')) {
        throw new AIError(
          'Request timeout',
          AIErrorType.TIMEOUT,
          this.config.provider,
          error
        );
      }

      // Generic API error
      throw new AIError(
        errorMessage,
        AIErrorType.API_ERROR,
        this.config.provider,
        error
      );
    }
  }

  /**
   * Validate configuration
   */
  protected async performConfigValidation(): Promise<boolean> {
    // The existing claude.ts uses ANTHROPIC_API_KEY from environment
    // We can allow override via config
    if (!process.env.ANTHROPIC_API_KEY && !this.config.apiKey) {
      this.logger.error('No Anthropic API key found');
      return false;
    }

    return true;
  }

  /**
   * Get provider status including fallback information
   */
  override getStatus(): import('../types').IProviderStatus {
    const baseStatus = super.getStatus();
    const modelStatus = getModelStatus();

    return {
      ...baseStatus,
      currentModel: modelStatus.currentModel
      // Note: modelStatus fallbacks are stored internally
      // Could add to metadata if IProviderStatus interface is extended
    };
  }

  /**
   * Reset provider state
   */
  protected override performReset(): void {
    // The existing implementation manages its own cache
    // We can't directly clear it from here
    this.logger.info('Claude provider reset (note: internal claude.ts cache not cleared)');
  }
}

/**
 * Factory for creating Claude provider instances
 */
export class ClaudeProviderFactory implements IAIProviderFactory {
  create(config: IAIProviderConfig): ClaudeProvider {
    return new ClaudeProvider(config);
  }

  supports(config: IAIProviderConfig): boolean {
    return config.provider === 'claude' || config.provider === 'anthropic';
  }
}

// Register factory with manager on import
import { AIProviderManager } from '../AIProviderManager';

const manager = AIProviderManager.getInstance();
manager.registerFactory('claude', new ClaudeProviderFactory());
manager.registerFactory('anthropic', new ClaudeProviderFactory());

// Auto-register Claude provider configuration
manager.registerProvider({
  provider: 'claude',
  name: 'Claude AI (Anthropic)',
  model: 'claude-sonnet-4-5',
  enabled: true,
  priority: 1, // High priority (low number)
  options: {
    fallbackModels: [
      'claude-opus-4-1',
      'claude-opus-4-0',
      'claude-sonnet-4-0'
    ]
  }
}).catch(error => {
  console.error('Failed to register Claude provider:', error);
});