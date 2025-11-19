/**
 * Manager for AI Provider instances and registry
 */

import {
  IAIProvider,
  IAIProviderConfig,
  IAIProviderFactory,
  IProviderRegistryEntry,
  AIError,
  AIErrorType,
  IAIRequestOptions,
  IAIResponse
} from './types';
import { IMessage } from '../interfaces';
import { AILogger } from './utils/AILogger';
import { IAILogger } from './types';

/**
 * Manages AI providers and handles fallback logic
 */
export class AIProviderManager {
  private static instance: AIProviderManager | undefined;
  private providers: Map<string, IProviderRegistryEntry> = new Map();
  private factories: Map<string, IAIProviderFactory> = new Map();
  private activeProvider: string | undefined;
  private fallbackChain: string[] = [];
  private logger: IAILogger = new AILogger('AIProviderManager');

  /**
   * Get singleton instance
   */
  static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.logger.info('AIProviderManager initialized');
  }

  /**
   * Register a provider factory
   */
  registerFactory(type: string, factory: IAIProviderFactory): void {
    this.factories.set(type, factory);
    this.logger.info(`Registered factory for provider type: ${type}`);
  }

  /**
   * Register a provider configuration
   */
  async registerProvider(config: IAIProviderConfig): Promise<void> {
    // Find appropriate factory
    const factory = this.findFactoryForConfig(config);
    if (!factory) {
      throw new AIError(
        `No factory found for provider type: ${config.provider}`,
        AIErrorType.PROVIDER_NOT_FOUND,
        config.provider
      );
    }

    // Create and store registry entry
    const entry: IProviderRegistryEntry = {
      factory,
      config,
      instance: undefined
    };

    this.providers.set(config.provider, entry);
    this.logger.info(`Registered provider: ${config.provider} (${config.name})`);

    // Update fallback chain based on priority
    this.updateFallbackChain();
  }

  /**
   * Initialize a provider
   */
  async initializeProvider(providerId: string): Promise<IAIProvider> {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new AIError(
        `Provider not found: ${providerId}`,
        AIErrorType.PROVIDER_NOT_FOUND,
        providerId
      );
    }

    // Return existing instance if already initialized
    if (entry.instance && entry.instance.status.available) {
      return entry.instance;
    }

    try {
      this.logger.info(`Initializing provider: ${providerId}`);

      // Create new instance
      const provider = entry.factory.create(entry.config);
      await provider.initialize();

      // Store instance
      entry.instance = provider;
      this.providers.set(providerId, entry);

      // Set as active if none set
      if (!this.activeProvider) {
        this.activeProvider = providerId;
        this.logger.info(`Set active provider: ${providerId}`);
      }

      return provider;

    } catch (error) {
      this.logger.error(`Failed to initialize provider: ${providerId}`, error);
      throw error;
    }
  }

  /**
   * Get active provider
   */
  async getActiveProvider(): Promise<IAIProvider> {
    if (!this.activeProvider) {
      // Try to initialize first available provider
      for (const [id, entry] of this.providers.entries()) {
        if (entry.config.enabled !== false) {
          try {
            return await this.initializeProvider(id);
          } catch (error) {
            this.logger.warn(`Failed to initialize provider ${id}, trying next`, error);
          }
        }
      }
      throw new AIError(
        'No providers available',
        AIErrorType.PROVIDER_NOT_FOUND
      );
    }

    const entry = this.providers.get(this.activeProvider);
    if (!entry) {
      throw new AIError(
        `Active provider not found: ${this.activeProvider}`,
        AIErrorType.PROVIDER_NOT_FOUND,
        this.activeProvider
      );
    }

    // Initialize if needed
    if (!entry.instance) {
      return await this.initializeProvider(this.activeProvider);
    }

    return entry.instance;
  }

  /**
   * Switch active provider
   */
  async switchProvider(providerId: string): Promise<void> {
    const provider = await this.initializeProvider(providerId);

    if (!provider.status.available) {
      throw new AIError(
        `Provider not available: ${providerId}`,
        AIErrorType.INITIALIZATION,
        providerId
      );
    }

    const previousProvider = this.activeProvider;
    this.activeProvider = providerId;

    this.logger.info(`Switched provider from ${previousProvider} to ${providerId}`);
  }

  /**
   * Send message with automatic fallback
   */
  async sendMessage(messages: IMessage[], options?: IAIRequestOptions): Promise<IAIResponse> {
    const attemptedProviders: string[] = [];
    let lastError: Error | undefined;

    // Try active provider first
    if (this.activeProvider) {
      try {
        const provider = await this.getActiveProvider();
        return await provider.sendMessage(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attemptedProviders.push(this.activeProvider);
        this.logger.warn(`Active provider ${this.activeProvider} failed, trying fallbacks`, error);
      }
    }

    // Try fallback providers
    for (const providerId of this.fallbackChain) {
      if (attemptedProviders.includes(providerId)) {
        continue;
      }

      try {
        this.logger.info(`Trying fallback provider: ${providerId}`);
        const provider = await this.initializeProvider(providerId);
        const response = await provider.sendMessage(messages, options);

        // Switch to this provider since it worked
        this.activeProvider = providerId;
        this.logger.info(`Fallback successful, switched to provider: ${providerId}`);

        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attemptedProviders.push(providerId);
        this.logger.warn(`Fallback provider ${providerId} failed`, error);
      }
    }

    throw new AIError(
      `All providers failed. Attempted: ${attemptedProviders.join(', ')}`,
      AIErrorType.API_ERROR,
      undefined,
      lastError
    );
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId)?.instance;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, IProviderRegistryEntry> {
    return new Map(this.providers);
  }

  /**
   * Get provider status for all providers
   */
  getAllStatuses(): Record<string, unknown> {
    const statuses: Record<string, unknown> = {};

    for (const [id, entry] of this.providers.entries()) {
      statuses[id] = {
        config: {
          name: entry.config.name,
          enabled: entry.config.enabled !== false,
          priority: entry.config.priority
        },
        status: entry.instance?.getStatus() || { available: false },
        isActive: id === this.activeProvider
      };
    }

    return statuses;
  }

  /**
   * Reset all providers
   */
  resetAll(): void {
    for (const entry of this.providers.values()) {
      if (entry.instance) {
        entry.instance.reset();
      }
    }
    this.logger.info('Reset all providers');
  }

  /**
   * Dispose all providers
   */
  disposeAll(): void {
    for (const entry of this.providers.values()) {
      if (entry.instance) {
        entry.instance.dispose();
      }
    }
    this.providers.clear();
    this.activeProvider = undefined;
    this.logger.info('Disposed all providers');
  }

  /**
   * Find factory that supports config
   */
  private findFactoryForConfig(config: IAIProviderConfig): IAIProviderFactory | undefined {
    // Direct match first
    const directFactory = this.factories.get(config.provider);
    if (directFactory && directFactory.supports(config)) {
      return directFactory;
    }

    // Check all factories
    for (const factory of this.factories.values()) {
      if (factory.supports(config)) {
        return factory;
      }
    }

    return undefined;
  }

  /**
   * Update fallback chain based on priorities
   */
  private updateFallbackChain(): void {
    const entries = Array.from(this.providers.entries())
      .filter(([_, entry]) => entry.config.enabled !== false)
      .sort((a, b) => {
        const aPriority = a[1].config.priority || 999;
        const bPriority = b[1].config.priority || 999;
        return aPriority - bPriority;
      });

    this.fallbackChain = entries.map(([id]) => id);
    this.logger.debug('Updated fallback chain', this.fallbackChain);
  }

  /**
   * Load configuration from file or environment
   */
  async loadConfiguration(_configPath?: string): Promise<void> {
    // TODO: Implement configuration loading
    // For now, we'll manually register providers
    this.logger.info('Configuration loading not yet implemented');
  }

  /**
   * Register default providers
   */
  async registerDefaults(): Promise<void> {
    // This will be called to register the default Mock, Claude, and OpenAI providers
    this.logger.info('Registering default providers');

    // The actual registration will be done by the specific provider factories
    // when they are imported and initialized
  }
}