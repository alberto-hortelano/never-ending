/**
 * Base abstract class for AI providers
 */

import { IMessage } from '../interfaces';
import {
  IAIProvider,
  IAIProviderConfig,
  IProviderCapabilities,
  IProviderStatus,
  IAIResponse,
  IAIRequestOptions,
  AIError,
  AIErrorType,
  IAILogger
} from './types';
import { AILogger } from './utils/AILogger';

/**
 * Abstract base class for AI providers with common functionality
 */
export abstract class BaseAIProvider implements IAIProvider {
  protected logger: IAILogger;
  protected _status: IProviderStatus;
  protected responseCache: Map<string, { response: IAIResponse; timestamp: number }>;
  protected cacheTimeout: number = 3600000; // 1 hour default
  protected requestCount: number = 0;
  protected lastRequestTime: number = 0;
  protected retryDelay: number = 1000;
  protected maxRetries: number = 3;

  constructor(
    public readonly config: IAIProviderConfig,
    public readonly capabilities: IProviderCapabilities
  ) {
    this.logger = new AILogger(`AIProvider-${config.provider}`);
    this.responseCache = new Map();
    this._status = {
      available: false,
      requestCount: 0
    };
  }

  /**
   * Get current provider status
   */
  get status(): IProviderStatus {
    return { ...this._status };
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing ${this.config.name} provider`);

      // Validate configuration
      const isValid = await this.validateConfig();
      if (!isValid) {
        throw new AIError(
          'Invalid provider configuration',
          AIErrorType.CONFIGURATION,
          this.config.provider,
          this.config
        );
      }

      // Perform provider-specific initialization
      await this.performInitialization();

      this._status.available = true;
      this._status.lastSuccess = Date.now();

      this.logger.info(`${this.config.name} provider initialized successfully`);
    } catch (error) {
      this._status.available = false;
      this._status.error = error instanceof Error ? error.message : 'Unknown error';
      this._status.lastError = Date.now();

      this.logger.error(`Failed to initialize ${this.config.name} provider`, error);
      throw error;
    }
  }

  /**
   * Provider-specific initialization logic
   */
  protected abstract performInitialization(): Promise<void>;

  /**
   * Send a message to the AI with retry logic
   */
  async sendMessage(messages: IMessage[], options?: IAIRequestOptions): Promise<IAIResponse> {
    // Check if provider is available
    if (!this._status.available) {
      throw new AIError(
        `Provider ${this.config.name} is not available`,
        AIErrorType.INITIALIZATION,
        this.config.provider
      );
    }

    // Check cache if enabled
    if (options?.cache !== false) {
      const cacheKey = this.generateCacheKey(messages, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached response', { cacheKey });
        return cached;
      }
    }

    // Apply rate limiting
    await this.applyRateLimit();

    let lastError: Error | undefined;
    const maxRetries = options?.maxTokens ? 1 : this.maxRetries; // Don't retry if specific tokens requested

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.debug(`Sending message (attempt ${attempt + 1}/${maxRetries})`, {
          messageCount: messages.length,
          provider: this.config.provider
        });

        // Call provider-specific implementation
        const response = await this.performSendMessage(messages, options);

        // Update status
        this._status.lastSuccess = Date.now();
        this._status.requestCount = (this._status.requestCount || 0) + 1;
        this.requestCount++;

        // Cache response if enabled
        if (options?.cache !== false) {
          const cacheKey = this.generateCacheKey(messages, options);
          this.addToCache(cacheKey, response);
        }

        // Log usage if available
        if (response.usage) {
          this.logger.info('Request completed', {
            provider: this.config.provider,
            model: response.model,
            usage: response.usage
          });
        }

        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Request failed (attempt ${attempt + 1}/${maxRetries})`, error);

        // Handle specific error types
        if (error instanceof AIError) {
          if (error.type === AIErrorType.RATE_LIMIT && attempt < maxRetries - 1) {
            // Wait longer for rate limit errors
            await this.delay(this.retryDelay * Math.pow(2, attempt));
            continue;
          } else if (error.type === AIErrorType.API_ERROR && this.shouldRetryError(error)) {
            await this.delay(this.retryDelay);
            continue;
          }
        }

        // Update error status
        this._status.lastError = Date.now();
        this._status.error = lastError.message;

        // Don't retry certain errors
        if (!this.shouldRetryError(lastError)) {
          break;
        }

        // Wait before retry
        if (attempt < maxRetries - 1) {
          await this.delay(this.retryDelay);
        }
      }
    }

    throw new AIError(
      `Failed to get response from ${this.config.name} after ${maxRetries} attempts`,
      AIErrorType.API_ERROR,
      this.config.provider,
      lastError
    );
  }

  /**
   * Provider-specific message sending implementation
   */
  protected abstract performSendMessage(messages: IMessage[], options?: IAIRequestOptions): Promise<IAIResponse>;

  /**
   * Validate provider configuration
   */
  async validateConfig(): Promise<boolean> {
    if (!this.config.provider || !this.config.name) {
      this.logger.error('Provider ID and name are required');
      return false;
    }

    // Call provider-specific validation
    return this.performConfigValidation();
  }

  /**
   * Provider-specific configuration validation
   */
  protected abstract performConfigValidation(): Promise<boolean>;

  /**
   * Get current status
   */
  getStatus(): IProviderStatus {
    return this.status;
  }

  /**
   * Reset provider state
   */
  reset(): void {
    this.logger.info(`Resetting ${this.config.name} provider`);

    this.responseCache.clear();
    this.requestCount = 0;
    this._status = {
      available: this._status.available,
      requestCount: 0
    };

    // Call provider-specific reset
    this.performReset();
  }

  /**
   * Provider-specific reset logic
   */
  protected performReset(): void {
    // Override in subclasses if needed
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.logger.info(`Disposing ${this.config.name} provider`);

    this.responseCache.clear();
    this._status.available = false;

    // Call provider-specific cleanup
    this.performDispose();
  }

  /**
   * Provider-specific cleanup logic
   */
  protected performDispose(): void {
    // Override in subclasses if needed
  }

  /**
   * Generate cache key for messages
   */
  protected generateCacheKey(messages: IMessage[], options?: IAIRequestOptions): string {
    const messageHash = JSON.stringify(messages);
    const optionsHash = JSON.stringify({
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt
    });
    return `${this.config.provider}:${messageHash}:${optionsHash}`;
  }

  /**
   * Get response from cache
   */
  protected getFromCache(key: string): IAIResponse | undefined {
    const cached = this.responseCache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheTimeout) {
        return cached.response;
      } else {
        this.responseCache.delete(key);
      }
    }
    return undefined;
  }

  /**
   * Add response to cache
   */
  protected addToCache(key: string, response: IAIResponse): void {
    // Limit cache size
    if (this.responseCache.size > 100) {
      const firstKey = this.responseCache.keys().next().value;
      if (firstKey) {
        this.responseCache.delete(firstKey);
      }
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  /**
   * Apply rate limiting
   */
  protected async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = this.config.options?.minRequestDelay as number || 0;

    if (minDelay > 0 && timeSinceLastRequest < minDelay) {
      await this.delay(minDelay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Check if error should trigger retry
   */
  protected shouldRetryError(error: Error): boolean {
    if (error instanceof AIError) {
      return [
        AIErrorType.RATE_LIMIT,
        AIErrorType.TIMEOUT,
        AIErrorType.API_ERROR
      ].includes(error.type);
    }

    // Check for network errors
    const message = error.message.toLowerCase();
    return message.includes('network') ||
           message.includes('timeout') ||
           message.includes('connection');
  }

  /**
   * Delay helper
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse JSON from response with markdown code blocks
   */
  protected extractJSON(text: string): unknown {
    // Try to parse as-is first
    try {
      return JSON.parse(text);
    } catch {
      // Try to extract from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (parseError) {
          this.logger.warn('Failed to parse JSON from markdown block', parseError);
        }
      }
      throw new AIError(
        'Failed to parse response as JSON',
        AIErrorType.PARSING,
        this.config.provider,
        { response: text }
      );
    }
  }

  /**
   * Build system prompt from options
   */
  protected buildSystemPrompt(options?: IAIRequestOptions): string | undefined {
    return options?.systemPrompt ||
           this.config.options?.defaultSystemPrompt as string;
  }

  /**
   * Count approximate tokens in text (rough estimation)
   */
  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if messages exceed context limit
   */
  protected checkContextLimit(messages: IMessage[]): boolean {
    if (!this.capabilities.maxContextTokens) {
      return true;
    }

    const totalText = messages.map(m => m.content).join(' ');
    const estimatedTokens = this.estimateTokens(totalText);

    return estimatedTokens <= this.capabilities.maxContextTokens;
  }
}