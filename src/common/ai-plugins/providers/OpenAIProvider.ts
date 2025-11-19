/**
 * OpenAI Provider for GPT models
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
import OpenAI from 'openai';
import { PromptTemplate } from '../../../prompts/PromptTemplate';
import { LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS, getMainCharacterName } from '../../constants';

/**
 * OpenAI Provider for GPT models
 */
export class OpenAIProvider extends BaseAIProvider {
  private openai: OpenAI | undefined;
  private readonly defaultModel: string = 'gpt-4o';
  private readonly models = {
    'gpt-4o': { maxTokens: 128000, costPer1kPrompt: 0.005, costPer1kCompletion: 0.015 },
    'gpt-4o-mini': { maxTokens: 128000, costPer1kPrompt: 0.00015, costPer1kCompletion: 0.0006 },
    'gpt-4-turbo': { maxTokens: 128000, costPer1kPrompt: 0.01, costPer1kCompletion: 0.03 },
    'gpt-3.5-turbo': { maxTokens: 16385, costPer1kPrompt: 0.0005, costPer1kCompletion: 0.0015 }
  };

  constructor(config: IAIProviderConfig) {
    const model = config.model || 'gpt-4o';
    // Default to GPT-4o's max tokens if model not found
    const maxTokens = 128000;

    super(
      {
        ...config,
        model
      },
      {
        streaming: true,
        functionCalling: true,
        maxContextTokens: maxTokens,
        maxResponseTokens: 4096,
        systemMessages: true,
        vision: model.includes('gpt-4o'), // GPT-4o models support vision
        jsonMode: true, // OpenAI supports JSON mode
        custom: {
          costTracking: true,
          temperatureControl: true
        }
      }
    );
  }

  /**
   * Initialize OpenAI client
   */
  protected async performInitialization(): Promise<void> {
    // Check for API key
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIError(
        'OpenAI API key not configured',
        AIErrorType.CONFIGURATION,
        this.config.provider
      );
    }

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey,
      organization: this.config.options?.organization as string,
      project: this.config.options?.project as string,
      baseURL: this.config.endpoint,
      dangerouslyAllowBrowser: this.config.options?.allowBrowser as boolean || false
    });

    this.logger.info('OpenAI provider initialized', {
      model: this.config.model,
      organization: this.config.options?.organization
    });
  }

  /**
   * Send message to OpenAI
   */
  protected async performSendMessage(messages: IMessage[], options?: IAIRequestOptions): Promise<IAIResponse> {
    if (!this.openai) {
      throw new AIError(
        'OpenAI client not initialized',
        AIErrorType.INITIALIZATION,
        this.config.provider
      );
    }

    try {
      // Build system prompt if needed
      const systemPrompt = await this.buildSystemPromptWithTemplate(messages, options);

      // Prepare messages for OpenAI format
      const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system message if available
      if (systemPrompt) {
        openAIMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Convert our messages to OpenAI format
      for (const msg of messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          openAIMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Determine if we should use JSON mode
      const useJsonMode = this.shouldUseJsonMode(messages);

      // Create completion request
      const completionParams: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.config.model || this.defaultModel,
        messages: openAIMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        top_p: options?.topP ?? 1,
        stop: options?.stopSequences,
        stream: options?.stream ?? false,
        response_format: useJsonMode ? { type: 'json_object' } : undefined
      };

      let response: string;
      let usage: OpenAI.CompletionUsage | undefined;

      if (completionParams.stream) {
        // Handle streaming response
        const stream = await this.openai.chat.completions.create({
          ...completionParams,
          stream: true
        });

        const chunks: string[] = [];
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            chunks.push(content);
          }
          // Get usage from final chunk
          if (chunk.usage) {
            usage = chunk.usage;
          }
        }
        response = chunks.join('');
      } else {
        // Non-streaming response
        const completion = await this.openai.chat.completions.create(completionParams);

        const choice = completion.choices[0];
        if (!choice?.message?.content) {
          throw new AIError(
            'No response content from OpenAI',
            AIErrorType.API_ERROR,
            this.config.provider
          );
        }

        response = choice.message.content;
        usage = completion.usage;
      }

      // Extract JSON if present
      if (useJsonMode || response.includes('```json')) {
        response = this.extractJSONContent(response);
      }

      // Calculate cost if usage is available
      let cost = 0;
      if (usage && this.config.model) {
        const modelInfo = this.models[this.config.model as keyof typeof this.models];
        if (modelInfo) {
          cost = (usage.prompt_tokens / 1000) * modelInfo.costPer1kPrompt +
                 (usage.completion_tokens / 1000) * modelInfo.costPer1kCompletion;
        }
      }

      return {
        content: response,
        model: this.config.model || this.defaultModel,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost
        } : undefined,
        metadata: {
          provider: 'openai',
          jsonMode: useJsonMode
        }
      };

    } catch (error) {
      // Handle OpenAI specific errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new AIError(
            'Rate limit exceeded',
            AIErrorType.RATE_LIMIT,
            this.config.provider,
            error
          );
        } else if (error.status === 408 || error.message.includes('timeout')) {
          throw new AIError(
            'Request timeout',
            AIErrorType.TIMEOUT,
            this.config.provider,
            error
          );
        }
      }

      // Re-throw if already an AIError
      if (error instanceof AIError) {
        throw error;
      }

      // Generic error
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown OpenAI error',
        AIErrorType.API_ERROR,
        this.config.provider,
        error
      );
    }
  }

  /**
   * Build system prompt with template
   */
  private async buildSystemPromptWithTemplate(messages: IMessage[], options?: IAIRequestOptions): Promise<string | undefined> {
    // If explicit system prompt provided, use it
    if (options?.systemPrompt) {
      return options.systemPrompt;
    }

    // Try to build narrative architect prompt like Claude does
    try {
      const promptTemplate = new PromptTemplate();

      // Extract language from messages
      let language = 'es';
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage?.content.includes('Language: English')) {
        language = 'en';
      }

      const narrativeArchitect = await promptTemplate.load('narrativeArchitect', {
        language: LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES],
        languageInstruction: LANGUAGE_INSTRUCTIONS[language as keyof typeof LANGUAGE_INSTRUCTIONS],
        mainCharacter: getMainCharacterName(),
        companionName: 'Companion'
      });

      return narrativeArchitect;
    } catch (error) {
      this.logger.warn('Failed to load narrative architect prompt, using default', error);
      return undefined;
    }
  }

  /**
   * Check if we should use JSON mode based on message content
   */
  private shouldUseJsonMode(messages: IMessage[]): boolean {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return false;

    const content = lastMessage.content.toLowerCase();

    // Look for indicators that JSON response is expected
    return content.includes('json') ||
           content.includes('command') ||
           content.includes('return a') ||
           content.includes('generate a') ||
           content.includes('create a');
  }

  /**
   * Extract JSON content from response
   */
  private extractJSONContent(response: string): string {
    // First try to extract from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }

    // Try to parse as-is (might already be JSON)
    try {
      JSON.parse(response);
      return response;
    } catch {
      // Not valid JSON, return as-is
      return response;
    }
  }

  /**
   * Validate configuration
   */
  protected async performConfigValidation(): Promise<boolean> {
    // Check for API key
    if (!this.config.apiKey && !process.env.OPENAI_API_KEY) {
      this.logger.error('No OpenAI API key found');
      return false;
    }

    // Validate model
    if (this.config.model && !(this.config.model in this.models)) {
      this.logger.warn(`Unknown model ${this.config.model}, will use default`);
    }

    return true;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.keys(this.models);
  }
}

/**
 * Factory for creating OpenAI provider instances
 */
export class OpenAIProviderFactory implements IAIProviderFactory {
  create(config: IAIProviderConfig): OpenAIProvider {
    return new OpenAIProvider(config);
  }

  supports(config: IAIProviderConfig): boolean {
    return config.provider === 'openai' || config.provider === 'gpt';
  }
}

// Register factory with manager on import
import { AIProviderManager } from '../AIProviderManager';

const manager = AIProviderManager.getInstance();
manager.registerFactory('openai', new OpenAIProviderFactory());
manager.registerFactory('gpt', new OpenAIProviderFactory());

// Auto-register OpenAI provider configuration if API key is available
if (process.env.OPENAI_API_KEY) {
  manager.registerProvider({
    provider: 'openai',
    name: 'OpenAI GPT-4',
    model: 'gpt-4o',
    enabled: true,
    priority: 2, // Secondary priority after Claude
    options: {
      // These can be overridden by environment variables
      organization: process.env.OPENAI_ORG || 'org-ux0tAIdPcIBuvja2fdgRbLQQ',
      project: process.env.OPENAI_PROJECT || 'proj_PEmD62c3Men0DMuBgmolVI9f'
    }
  }).catch(error => {
    console.error('Failed to register OpenAI provider:', error);
  });
}