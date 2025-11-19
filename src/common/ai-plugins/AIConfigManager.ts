/**
 * Configuration manager for AI providers
 */

import { IAIProviderConfig } from './types';
import { AILogger } from './utils/AILogger';
import { IAILogger } from './types';

/**
 * Configuration source types
 */
export enum ConfigSource {
  DEFAULT = 'default',
  ENVIRONMENT = 'environment',
  FILE = 'file',
  RUNTIME = 'runtime'
}

/**
 * Complete configuration for AI system
 */
export interface AISystemConfig {
  /** Active provider ID */
  activeProvider?: string;
  /** Enable plugin system */
  usePluginSystem?: boolean;
  /** Provider configurations */
  providers: IAIProviderConfig[];
  /** Global settings */
  global?: {
    /** Enable response caching */
    cacheEnabled?: boolean;
    /** Cache TTL in seconds */
    cacheTTL?: number;
    /** Enable logging */
    loggingEnabled?: boolean;
    /** Log level */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    /** Retry configuration */
    retry?: {
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    };
  };
}

/**
 * Manager for AI provider configuration
 */
export class AIConfigManager {
  private static instance: AIConfigManager | undefined;
  private config: AISystemConfig;
  private logger: IAILogger = new AILogger('AIConfigManager');
  private configSources = new Map<string, ConfigSource>();

  /**
   * Get singleton instance
   */
  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.config = this.loadDefaultConfig();
    this.loadEnvironmentConfig();
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): AISystemConfig {
    const config: AISystemConfig = {
      activeProvider: 'claude',
      usePluginSystem: true,
      providers: [
        {
          provider: 'mock',
          name: 'Mock AI Provider',
          enabled: true,
          priority: 100,
          options: {
            seed: Date.now()
          }
        },
        {
          provider: 'claude',
          name: 'Claude AI (Anthropic)',
          enabled: true,
          priority: 1,
          model: 'claude-sonnet-4-5',
          options: {
            fallbackModels: [
              'claude-opus-4-1',
              'claude-opus-4-0',
              'claude-sonnet-4-0'
            ]
          }
        },
        {
          provider: 'openai',
          name: 'OpenAI GPT-4',
          enabled: false, // Disabled by default unless API key present
          priority: 2,
          model: 'gpt-4o',
          options: {}
        }
      ],
      global: {
        cacheEnabled: true,
        cacheTTL: 3600,
        loggingEnabled: true,
        logLevel: 'info',
        retry: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }
    };

    // Mark all as default source
    config.providers.forEach(p => {
      this.configSources.set(`provider.${p.provider}`, ConfigSource.DEFAULT);
    });

    return config;
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): void {
    // Check for plugin system toggle
    if (process.env.AI_PLUGIN_SYSTEM === 'false') {
      this.config.usePluginSystem = false;
      this.configSources.set('usePluginSystem', ConfigSource.ENVIRONMENT);
    }

    // Check for active provider
    if (process.env.AI_PROVIDER) {
      this.config.activeProvider = process.env.AI_PROVIDER;
      this.configSources.set('activeProvider', ConfigSource.ENVIRONMENT);
    }

    // Check for Claude configuration
    if (process.env.ANTHROPIC_API_KEY) {
      const claudeConfig = this.getProviderConfig('claude');
      if (claudeConfig) {
        claudeConfig.apiKey = process.env.ANTHROPIC_API_KEY;
        claudeConfig.enabled = true;
        this.configSources.set('provider.claude.apiKey', ConfigSource.ENVIRONMENT);
      }
    }

    // Check for OpenAI configuration
    if (process.env.OPENAI_API_KEY) {
      const openaiConfig = this.getProviderConfig('openai');
      if (openaiConfig) {
        openaiConfig.apiKey = process.env.OPENAI_API_KEY;
        openaiConfig.enabled = true;
        this.configSources.set('provider.openai.apiKey', ConfigSource.ENVIRONMENT);

        // Optional OpenAI settings
        if (process.env.OPENAI_ORG) {
          openaiConfig.options = openaiConfig.options || {};
          openaiConfig.options.organization = process.env.OPENAI_ORG;
        }
        if (process.env.OPENAI_PROJECT) {
          openaiConfig.options = openaiConfig.options || {};
          openaiConfig.options.project = process.env.OPENAI_PROJECT;
        }
        if (process.env.OPENAI_MODEL) {
          openaiConfig.model = process.env.OPENAI_MODEL;
        }
      }
    }

    // Check for global settings
    if (process.env.AI_CACHE_ENABLED === 'false') {
      if (this.config.global) {
        this.config.global.cacheEnabled = false;
        this.configSources.set('global.cacheEnabled', ConfigSource.ENVIRONMENT);
      }
    }

    if (process.env.AI_LOG_LEVEL) {
      const level = process.env.AI_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
      if (this.config.global && ['debug', 'info', 'warn', 'error'].includes(level)) {
        this.config.global.logLevel = level;
        this.configSources.set('global.logLevel', ConfigSource.ENVIRONMENT);
      }
    }

    this.logger.info('Loaded environment configuration', {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      activeProvider: this.config.activeProvider,
      usePluginSystem: this.config.usePluginSystem
    });
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filepath: string): Promise<void> {
    try {
      // This would load from a JSON or YAML file
      // For now, we'll skip implementation as it needs file system access
      this.logger.info(`Loading configuration from file: ${filepath}`);
      // TODO: Implement file loading
    } catch (error) {
      this.logger.error('Failed to load configuration from file', error);
      throw error;
    }
  }

  /**
   * Get complete configuration
   */
  getConfig(): AISystemConfig {
    return { ...this.config };
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): IAIProviderConfig | undefined {
    return this.config.providers.find(p => p.provider === providerId);
  }

  /**
   * Get all provider configurations
   */
  getAllProviderConfigs(): IAIProviderConfig[] {
    return [...this.config.providers];
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders(): IAIProviderConfig[] {
    return this.config.providers.filter(p => p.enabled !== false);
  }

  /**
   * Update provider configuration at runtime
   */
  updateProviderConfig(providerId: string, updates: Partial<IAIProviderConfig>): void {
    const config = this.getProviderConfig(providerId);
    if (!config) {
      throw new Error(`Provider ${providerId} not found`);
    }

    Object.assign(config, updates);
    this.configSources.set(`provider.${providerId}`, ConfigSource.RUNTIME);

    this.logger.info(`Updated provider configuration: ${providerId}`, updates);
  }

  /**
   * Set active provider
   */
  setActiveProvider(providerId: string): void {
    const config = this.getProviderConfig(providerId);
    if (!config) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (config.enabled === false) {
      throw new Error(`Provider ${providerId} is disabled`);
    }

    this.config.activeProvider = providerId;
    this.configSources.set('activeProvider', ConfigSource.RUNTIME);

    this.logger.info(`Set active provider: ${providerId}`);
  }

  /**
   * Get active provider ID
   */
  getActiveProvider(): string | undefined {
    return this.config.activeProvider;
  }

  /**
   * Enable/disable plugin system
   */
  setUsePluginSystem(use: boolean): void {
    this.config.usePluginSystem = use;
    this.configSources.set('usePluginSystem', ConfigSource.RUNTIME);
    this.logger.info(`Plugin system ${use ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if plugin system is enabled
   */
  isPluginSystemEnabled(): boolean {
    return this.config.usePluginSystem !== false;
  }

  /**
   * Get global settings
   */
  getGlobalSettings(): AISystemConfig['global'] {
    return { ...this.config.global };
  }

  /**
   * Update global settings
   */
  updateGlobalSettings(updates: Partial<AISystemConfig['global']>): void {
    this.config.global = { ...this.config.global, ...updates };

    if (updates) {
      Object.keys(updates).forEach(key => {
        this.configSources.set(`global.${key}`, ConfigSource.RUNTIME);
      });
    }

    this.logger.info('Updated global settings', updates);
  }

  /**
   * Get configuration source for a setting
   */
  getConfigSource(path: string): ConfigSource {
    return this.configSources.get(path) || ConfigSource.DEFAULT;
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = this.loadDefaultConfig();
    this.loadEnvironmentConfig();
    this.configSources.clear();
    this.logger.info('Configuration reset to defaults');
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.config, (key, value) => {
      // Don't export sensitive data
      if (key === 'apiKey') {
        return value ? '***REDACTED***' : undefined;
      }
      return value;
    }, 2);
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that at least one provider is enabled
    const enabledProviders = this.getEnabledProviders();
    if (enabledProviders.length === 0) {
      errors.push('No providers are enabled');
    }

    // Check that active provider exists and is enabled
    if (this.config.activeProvider) {
      const activeConfig = this.getProviderConfig(this.config.activeProvider);
      if (!activeConfig) {
        errors.push(`Active provider ${this.config.activeProvider} not found`);
      } else if (activeConfig.enabled === false) {
        errors.push(`Active provider ${this.config.activeProvider} is disabled`);
      }
    }

    // Validate provider configurations
    for (const provider of this.config.providers) {
      if (!provider.provider || !provider.name) {
        errors.push(`Provider missing required fields: ${JSON.stringify(provider)}`);
      }

      // Check API keys for enabled providers
      if (provider.enabled && ['claude', 'openai'].includes(provider.provider)) {
        if (!provider.apiKey && !process.env[provider.provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY']) {
          errors.push(`Provider ${provider.provider} is enabled but has no API key`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const aiConfig = AIConfigManager.getInstance();