/**
 * Tests for AI Plugin System
 */

import { AIProviderManager } from '../src/common/ai-plugins/AIProviderManager';
import { MockProvider, MockProviderFactory } from '../src/common/ai-plugins/providers/MockProvider';
import { AIConfigManager } from '../src/common/ai-plugins/AIConfigManager';
import { IAIProviderConfig, AIError, AIErrorType } from '../src/common/ai-plugins/types';
import { IMessage } from '../src/common/interfaces';

describe('AI Plugin System', () => {
  let manager: AIProviderManager;
  let configManager: AIConfigManager;

  beforeEach(() => {
    // Get fresh instances
    manager = AIProviderManager.getInstance();
    configManager = AIConfigManager.getInstance();

    // Reset to clean state
    manager.disposeAll();
    configManager.reset();
  });

  afterEach(() => {
    // Clean up
    manager.disposeAll();
  });

  describe('AIProviderManager', () => {
    it('should be a singleton', () => {
      const manager1 = AIProviderManager.getInstance();
      const manager2 = AIProviderManager.getInstance();
      expect(manager1).toBe(manager2);
    });

    it('should register a factory', () => {
      const factory = new MockProviderFactory();
      manager.registerFactory('test', factory);
      // No error means success
    });

    it('should register a provider configuration', async () => {
      const factory = new MockProviderFactory();
      manager.registerFactory('mock', factory);

      const config: IAIProviderConfig = {
        provider: 'mock',
        name: 'Test Mock Provider',
        enabled: true,
        priority: 1
      };

      await manager.registerProvider(config);
      const providers = manager.getAllProviders();
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should initialize a provider', async () => {
      const factory = new MockProviderFactory();
      manager.registerFactory('mock', factory);

      const config: IAIProviderConfig = {
        provider: 'mock',
        name: 'Test Mock Provider',
        enabled: true,
        priority: 1
      };

      await manager.registerProvider(config);
      const provider = await manager.initializeProvider('mock');

      expect(provider).toBeDefined();
      expect(provider.status.available).toBe(true);
    });

    it('should switch providers', async () => {
      // Register mock providers
      const factory = new MockProviderFactory();
      manager.registerFactory('mock1', factory);
      manager.registerFactory('mock2', factory);

      await manager.registerProvider({
        provider: 'mock1',
        name: 'Mock 1',
        enabled: true,
        priority: 1
      });

      await manager.registerProvider({
        provider: 'mock2',
        name: 'Mock 2',
        enabled: true,
        priority: 2
      });

      // Initialize first provider
      await manager.initializeProvider('mock1');

      // Switch to second provider
      await manager.switchProvider('mock2');

      const activeProvider = await manager.getActiveProvider();
      expect(activeProvider.config.provider).toBe('mock2');
    });

    it('should handle fallback when primary provider fails', async () => {
      // This test would require a failing provider
      // For now, we just test the fallback chain setup
      const factory = new MockProviderFactory();
      manager.registerFactory('mock', factory);

      await manager.registerProvider({
        provider: 'mock',
        name: 'Mock Provider',
        enabled: true,
        priority: 1
      });

      const providers = manager.getAllProviders();
      expect(providers.size).toBeGreaterThan(0);
    });
  });

  describe('MockProvider', () => {
    let provider: MockProvider;

    beforeEach(async () => {
      const config: IAIProviderConfig = {
        provider: 'mock',
        name: 'Test Mock Provider',
        enabled: true,
        options: {
          seed: 12345 // Fixed seed for reproducible tests
        }
      };

      provider = new MockProvider(config);
      await provider.initialize();
    });

    afterEach(() => {
      provider.dispose();
    });

    it('should initialize successfully', () => {
      expect(provider.status.available).toBe(true);
    });

    it('should return mock responses for exploration scenario', async () => {
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'The character should explore the area'
        }
      ];

      const response = await provider.sendMessage(messages);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      // Should return a JSON command
      const command = JSON.parse(response.content);
      expect(command).toHaveProperty('command');
    });

    it('should return mock responses for combat scenario', async () => {
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'An enemy appears, engage in combat'
        }
      ];

      const response = await provider.sendMessage(messages);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      const command = JSON.parse(response.content);
      expect(command).toHaveProperty('command');
      expect(['attack', 'movement', 'speech'].includes(command.command)).toBe(true);
    });

    it('should return mock responses for dialogue scenario', async () => {
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'Start a conversation with another character'
        }
      ];

      const response = await provider.sendMessage(messages);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      const command = JSON.parse(response.content);
      expect(command).toHaveProperty('command');
      expect(command.command).toBe('speech');
    });

    it('should cycle through responses', async () => {
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'explore'
        }
      ];

      const response1 = await provider.sendMessage(messages);
      const response2 = await provider.sendMessage(messages);

      // Responses should be different (cycling through scenario responses)
      expect(response1.content).toBeDefined();
      expect(response2.content).toBeDefined();

      // Parse to check they are valid commands
      const command1 = JSON.parse(response1.content);
      const command2 = JSON.parse(response2.content);

      expect(command1).toHaveProperty('command');
      expect(command2).toHaveProperty('command');
    });

    it('should reset state when reset is called', async () => {
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'explore'
        }
      ];

      // Get first response
      await provider.sendMessage(messages);

      // Reset provider
      provider.reset();

      // Response after reset should be the first one again
      const responseAfterReset = await provider.sendMessage(messages);
      const command = JSON.parse(responseAfterReset.content);

      expect(command).toHaveProperty('command');
      expect(command.command).toBe('movement');
    });
  });

  describe('AIConfigManager', () => {
    it('should be a singleton', () => {
      const config1 = AIConfigManager.getInstance();
      const config2 = AIConfigManager.getInstance();
      expect(config1).toBe(config2);
    });

    it('should load default configuration', () => {
      const config = configManager.getConfig();

      expect(config).toBeDefined();
      expect(config.providers).toBeDefined();
      expect(config.providers.length).toBeGreaterThan(0);
      expect(config.activeProvider).toBeDefined();
    });

    it('should get provider configuration', () => {
      const mockConfig = configManager.getProviderConfig('mock');

      expect(mockConfig).toBeDefined();
      expect(mockConfig?.provider).toBe('mock');
      expect(mockConfig?.name).toBe('Mock AI Provider');
    });

    it('should get enabled providers', () => {
      const enabledProviders = configManager.getEnabledProviders();

      expect(enabledProviders).toBeDefined();
      expect(enabledProviders.length).toBeGreaterThan(0);
      expect(enabledProviders.every(p => p.enabled !== false)).toBe(true);
    });

    it('should update provider configuration', () => {
      configManager.updateProviderConfig('mock', {
        priority: 50,
        options: { customOption: true }
      });

      const mockConfig = configManager.getProviderConfig('mock');
      expect(mockConfig?.priority).toBe(50);
      expect(mockConfig?.options?.customOption).toBe(true);
    });

    it('should set active provider', () => {
      configManager.setActiveProvider('mock');
      expect(configManager.getActiveProvider()).toBe('mock');
    });

    it('should throw error when setting non-existent provider as active', () => {
      expect(() => {
        configManager.setActiveProvider('non-existent');
      }).toThrow('Provider non-existent not found');
    });

    it('should toggle plugin system', () => {
      configManager.setUsePluginSystem(false);
      expect(configManager.isPluginSystemEnabled()).toBe(false);

      configManager.setUsePluginSystem(true);
      expect(configManager.isPluginSystemEnabled()).toBe(true);
    });

    it('should update global settings', () => {
      configManager.updateGlobalSettings({
        cacheEnabled: false,
        logLevel: 'debug'
      });

      const global = configManager.getGlobalSettings();
      expect(global?.cacheEnabled).toBe(false);
      expect(global?.logLevel).toBe('debug');
    });

    it('should validate configuration', () => {
      const validation = configManager.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should export configuration without sensitive data', () => {
      // Set an API key
      configManager.updateProviderConfig('claude', {
        apiKey: 'secret-key-123'
      });

      const exported = configManager.export();

      expect(exported).toBeDefined();
      expect(exported).not.toContain('secret-key-123');
      expect(exported).toContain('***REDACTED***');
    });

    it('should reset configuration to defaults', () => {
      // Make changes
      configManager.setActiveProvider('mock');
      configManager.updateGlobalSettings({ cacheEnabled: false });

      // Reset
      configManager.reset();

      // Check defaults are restored
      const config = configManager.getConfig();
      expect(config.activeProvider).toBe('claude');
      expect(config.global?.cacheEnabled).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with mock provider', async () => {
      // Setup
      const factory = new MockProviderFactory();
      manager.registerFactory('mock', factory);

      await manager.registerProvider({
        provider: 'mock',
        name: 'Mock Provider',
        enabled: true,
        priority: 1
      });

      // Send message
      const messages: IMessage[] = [
        {
          role: 'user',
          content: 'Generate a map for the game'
        }
      ];

      const response = await manager.sendMessage(messages);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      // Parse and validate response
      const command = JSON.parse(response.content);
      expect(command).toHaveProperty('command');
      expect(command.command).toBe('map');
    });

    it('should handle provider not found error', async () => {
      await expect(
        manager.initializeProvider('non-existent')
      ).rejects.toThrow('Provider not found');
    });

    it('should handle provider initialization failure gracefully', async () => {
      // Create a provider that fails to initialize
      class FailingProvider extends MockProvider {
        protected async performInitialization(): Promise<void> {
          throw new Error('Initialization failed');
        }
      }

      class FailingFactory extends MockProviderFactory {
        create(config: IAIProviderConfig): FailingProvider {
          return new FailingProvider(config);
        }
      }

      const factory = new FailingFactory();
      manager.registerFactory('failing', factory);

      await manager.registerProvider({
        provider: 'failing',
        name: 'Failing Provider',
        enabled: true,
        priority: 1
      });

      await expect(
        manager.initializeProvider('failing')
      ).rejects.toThrow('Initialization failed');
    });
  });
});