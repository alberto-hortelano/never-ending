/**
 * Base implementation for Dialogue plugins
 */

import {
  IDialoguePlugin,
  IAIPluginMetadata,
  IAIProvider,
  IAIRequestOptions,
  IAIResponse,
  AIError,
  AIErrorType
} from '../types';
import { IMessage } from '../../interfaces';
import { AILogger } from '../utils/AILogger';
import { IAILogger } from '../types';

/**
 * Base class for dialogue generation plugins
 */
export abstract class DialoguePluginBase implements IDialoguePlugin {
  protected provider: IAIProvider | undefined;
  protected logger: IAILogger;
  protected maxHistoryLength: number = 20; // Max conversation history to maintain

  constructor(
    public readonly metadata: IAIPluginMetadata
  ) {
    this.logger = new AILogger(`DialoguePlugin-${metadata.id}`);
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
   * Generate a dialogue response
   */
  async generateResponse(
    context: unknown,
    history: IMessage[],
    options?: IAIRequestOptions
  ): Promise<string> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Trim history if too long
      const trimmedHistory = this.trimHistory(history);

      // Build messages for dialogue
      const messages = await this.buildDialogueMessages(context, trimmedHistory);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, {
        ...options,
        temperature: options?.temperature ?? 0.7 // Moderate temperature for dialogue
      });

      // Parse response into dialogue text
      const dialogueText = await this.parseDialogueResponse(response, context);

      this.logger.debug('Generated dialogue response', {
        contextType: typeof context,
        historyLength: history.length,
        responseLength: dialogueText.length
      });

      return dialogueText;

    } catch (error) {
      this.logger.error('Failed to generate dialogue response', error);
      throw error;
    }
  }

  /**
   * Generate dialogue options for player choice
   */
  async generateOptions(context: unknown, options?: IAIRequestOptions): Promise<string[]> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for dialogue options
      const messages = await this.buildOptionsMessages(context);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, {
        ...options,
        temperature: options?.temperature ?? 0.8 // Higher temperature for variety
      });

      // Parse response into options array
      const dialogueOptions = await this.parseOptionsResponse(response, context);

      this.logger.debug('Generated dialogue options', {
        contextType: typeof context,
        optionCount: dialogueOptions.length
      });

      return dialogueOptions;

    } catch (error) {
      this.logger.error('Failed to generate dialogue options', error);
      throw error;
    }
  }

  /**
   * Build messages for dialogue response
   */
  protected abstract buildDialogueMessages(context: unknown, history: IMessage[]): Promise<IMessage[]>;

  /**
   * Build messages for dialogue options
   */
  protected abstract buildOptionsMessages(context: unknown): Promise<IMessage[]>;

  /**
   * Parse dialogue response
   */
  protected abstract parseDialogueResponse(response: IAIResponse, context: unknown): Promise<string>;

  /**
   * Parse options response
   */
  protected abstract parseOptionsResponse(response: IAIResponse, context: unknown): Promise<string[]>;

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.provider = undefined;
    this.logger.info(`Disposed ${this.metadata.name}`);
  }

  /**
   * Trim conversation history to manageable length
   */
  protected trimHistory(history: IMessage[]): IMessage[] {
    if (history.length <= this.maxHistoryLength) {
      return history;
    }

    // Keep first message (usually context) and last N messages
    const first = history[0];
    const recent = history.slice(-(this.maxHistoryLength - 1));

    return first ? [first, ...recent] : recent;
  }

  /**
   * Helper to extract dialogue from various response formats
   */
  protected extractDialogue(response: IAIResponse): string {
    const content = response.content;

    // Check if it's a JSON response with dialogue field
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        // Look for common dialogue fields
        if ('dialogue' in parsed) return String(parsed.dialogue);
        if ('text' in parsed) return String(parsed.text);
        if ('response' in parsed) return String(parsed.response);
        if ('speech' in parsed) return String(parsed.speech);
        if ('message' in parsed) return String(parsed.message);
      }
    } catch {
      // Not JSON or doesn't have expected fields
    }

    // Extract from markdown quotes if present
    const quoteMatch = content.match(/^["'](.+)["']$/);
    if (quoteMatch && quoteMatch[1]) {
      return quoteMatch[1];
    }

    // Return as-is
    return content;
  }

  /**
   * Helper to extract options array from response
   */
  protected extractOptions(response: IAIResponse): string[] {
    const content = response.content;

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            // Look for text fields in objects
            if ('text' in item) return String(item.text);
            if ('option' in item) return String(item.option);
            if ('choice' in item) return String(item.choice);
          }
          return String(item);
        });
      }

      // Check if it's an object with options array
      if (typeof parsed === 'object' && parsed !== null) {
        if ('options' in parsed && Array.isArray(parsed.options)) {
          return this.extractOptions({ ...response, content: JSON.stringify(parsed.options) });
        }
        if ('choices' in parsed && Array.isArray(parsed.choices)) {
          return this.extractOptions({ ...response, content: JSON.stringify(parsed.choices) });
        }
      }
    } catch {
      // Not JSON, try to parse as text
    }

    // Try to extract from numbered list
    const listMatch = content.match(/^\d+\.\s+(.+)$/gm);
    if (listMatch && listMatch.length > 0) {
      return listMatch.map(item => item.replace(/^\d+\.\s+/, ''));
    }

    // Try to extract from bullet points
    const bulletMatch = content.match(/^[-*]\s+(.+)$/gm);
    if (bulletMatch && bulletMatch.length > 0) {
      return bulletMatch.map(item => item.replace(/^[-*]\s+/, ''));
    }

    // Split by newlines as last resort
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 4); // Max 4 options
  }

  /**
   * Helper to format character context
   */
  protected formatCharacterContext(character: unknown): string {
    if (typeof character === 'string') {
      return character;
    }

    if (typeof character === 'object' && character !== null) {
      const char = character as Record<string, unknown>;
      const parts: string[] = [];

      if ('name' in char) parts.push(`Name: ${char.name}`);
      if ('role' in char) parts.push(`Role: ${char.role}`);
      if ('faction' in char) parts.push(`Faction: ${char.faction}`);
      if ('mood' in char) parts.push(`Mood: ${char.mood}`);
      if ('objective' in char) parts.push(`Objective: ${char.objective}`);

      return parts.join(', ');
    }

    return 'Unknown character';
  }
}