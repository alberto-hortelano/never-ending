/**
 * Base implementation for Game Engine plugins
 */

import {
  IGameEnginePlugin,
  IAIPluginMetadata,
  IAIProvider,
  IAIGameContext,
  IAIRequestOptions,
  IAIResponse,
  AIError,
  AIErrorType
} from '../types';
import { AICommand } from '../../services/AICommandParser';
import { IMessage } from '../../interfaces';
import { AILogger } from '../utils/AILogger';
import { IAILogger } from '../types';

/**
 * Base class for game engine plugins
 */
export abstract class GameEnginePluginBase implements IGameEnginePlugin {
  protected provider: IAIProvider | undefined;
  protected logger: IAILogger;

  constructor(
    public readonly metadata: IAIPluginMetadata
  ) {
    this.logger = new AILogger(`GameEnginePlugin-${metadata.id}`);
  }

  /**
   * Initialize the plugin with a provider
   */
  async initialize(provider: IAIProvider): Promise<void> {
    this.provider = provider;
    this.logger.info(`Initialized ${this.metadata.name} with provider ${provider.config.name}`);
    await this.performInitialization();
  }

  /**
   * Plugin-specific initialization
   */
  protected abstract performInitialization(): Promise<void>;

  /**
   * Request an AI action for a game turn
   */
  async requestAction(context: IAIGameContext, options?: IAIRequestOptions): Promise<AICommand> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for the AI
      const messages = await this.buildActionMessages(context);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, options);

      // Parse response into command
      const command = await this.parseActionResponse(response, context);

      return command;

    } catch (error) {
      this.logger.error('Failed to request action', error);
      throw error;
    }
  }

  /**
   * Generate a map
   */
  async generateMap(prompt: string, options?: IAIRequestOptions): Promise<AICommand> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for map generation
      const messages = await this.buildMapMessages(prompt);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, options);

      // Parse response into map command
      const command = await this.parseMapResponse(response);

      return command;

    } catch (error) {
      this.logger.error('Failed to generate map', error);
      throw error;
    }
  }

  /**
   * Validate and retry a command
   */
  async validateAndRetry(command: AICommand, context: IAIGameContext, error: string): Promise<AICommand> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build retry messages with error feedback
      const messages = await this.buildRetryMessages(command, context, error);

      // Send to AI provider with retry options
      const response = await this.provider.sendMessage(messages, {
        ...context,
        temperature: 0.5 // Lower temperature for corrections
      });

      // Parse corrected response
      const correctedCommand = await this.parseActionResponse(response, context);

      return correctedCommand;

    } catch (retryError) {
      this.logger.error('Failed to retry command', retryError);
      throw retryError;
    }
  }

  /**
   * Build messages for action request
   */
  protected abstract buildActionMessages(context: IAIGameContext): Promise<IMessage[]>;

  /**
   * Build messages for map generation
   */
  protected abstract buildMapMessages(prompt: string): Promise<IMessage[]>;

  /**
   * Build messages for retry with error
   */
  protected abstract buildRetryMessages(
    command: AICommand,
    context: IAIGameContext,
    error: string
  ): Promise<IMessage[]>;

  /**
   * Parse action response into command
   */
  protected abstract parseActionResponse(response: IAIResponse, context: IAIGameContext): Promise<AICommand>;

  /**
   * Parse map response into command
   */
  protected abstract parseMapResponse(response: IAIResponse): Promise<AICommand>;

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.provider = undefined;
    this.logger.info(`Disposed ${this.metadata.name}`);
  }

  /**
   * Helper to extract JSON from response
   */
  protected extractJSON(response: IAIResponse): unknown {
    const content = response.content;

    // Try to parse as-is
    try {
      return JSON.parse(content);
    } catch {
      // Try to extract from markdown
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (parseError) {
          throw new AIError(
            'Failed to parse JSON from response',
            AIErrorType.PARSING,
            this.metadata.id,
            { response: content, error: parseError }
          );
        }
      }

      throw new AIError(
        'No valid JSON found in response',
        AIErrorType.PARSING,
        this.metadata.id,
        { response: content }
      );
    }
  }

  /**
   * Helper to format context into text
   */
  protected formatContext(context: IAIGameContext): string {
    const parts: string[] = [];

    if (context.currentCharacter) {
      parts.push(`Current Character: ${context.currentCharacter.name} (${context.currentCharacter.controller})`);
      if (context.currentCharacter.position) {
        parts.push(`Position: (${context.currentCharacter.position.x}, ${context.currentCharacter.position.y})`);
      }
    }

    if (context.turn !== undefined) {
      parts.push(`Turn: ${context.turn}`);
    }

    if (context.visibleCharacters && context.visibleCharacters.length > 0) {
      parts.push(`Visible Characters: ${context.visibleCharacters.length}`);
    }

    if (context.currentMission) {
      parts.push('Mission Active');
    }

    return parts.join('\n');
  }
}