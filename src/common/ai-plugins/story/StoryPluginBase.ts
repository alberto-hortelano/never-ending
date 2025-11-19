/**
 * Base implementation for Story generation plugins
 */

import {
  IStoryPlugin,
  IAIPluginMetadata,
  IAIProvider,
  IAIRequestOptions,
  IAIResponse,
  AIError,
  AIErrorType
} from '../types';
import { IMessage, Language, IStoryState } from '../../interfaces';
import { AILogger } from '../utils/AILogger';
import { IAILogger } from '../types';

/**
 * Base class for story generation plugins
 */
export abstract class StoryPluginBase implements IStoryPlugin {
  protected provider: IAIProvider | undefined;
  protected logger: IAILogger;

  constructor(
    public readonly metadata: IAIPluginMetadata
  ) {
    this.logger = new AILogger(`StoryPlugin-${metadata.id}`);
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
   * Initialize a story from an origin
   */
  async initializeStory(origin: string, language: Language, options?: IAIRequestOptions): Promise<IStoryState> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for story initialization
      const messages = await this.buildStoryInitMessages(origin, language);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, {
        ...options,
        temperature: options?.temperature ?? 0.8 // Higher temperature for creativity
      });

      // Parse response into story state
      const storyState = await this.parseStoryInitResponse(response, origin, language);

      this.logger.info('Story initialized', {
        origin: storyState.selectedOrigin?.name,
        language
      });

      return storyState;

    } catch (error) {
      this.logger.error('Failed to initialize story', error);
      throw error;
    }
  }

  /**
   * Generate a story plan
   */
  async generatePlan(context: unknown, options?: IAIRequestOptions): Promise<unknown> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for plan generation
      const messages = await this.buildPlanMessages(context);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, options);

      // Parse response into plan
      const plan = await this.parsePlanResponse(response);

      return plan;

    } catch (error) {
      this.logger.error('Failed to generate plan', error);
      throw error;
    }
  }

  /**
   * Get scene context
   */
  async getSceneContext(sceneId: string, options?: IAIRequestOptions): Promise<unknown> {
    if (!this.provider) {
      throw new AIError(
        'Plugin not initialized with provider',
        AIErrorType.INITIALIZATION,
        this.metadata.id
      );
    }

    try {
      // Build messages for scene context
      const messages = await this.buildSceneContextMessages(sceneId);

      // Send to AI provider
      const response = await this.provider.sendMessage(messages, options);

      // Parse response into scene context
      const sceneContext = await this.parseSceneContextResponse(response);

      return sceneContext;

    } catch (error) {
      this.logger.error('Failed to get scene context', error);
      throw error;
    }
  }

  /**
   * Build messages for story initialization
   */
  protected abstract buildStoryInitMessages(origin: string, language: Language): Promise<IMessage[]>;

  /**
   * Build messages for plan generation
   */
  protected abstract buildPlanMessages(context: unknown): Promise<IMessage[]>;

  /**
   * Build messages for scene context
   */
  protected abstract buildSceneContextMessages(sceneId: string): Promise<IMessage[]>;

  /**
   * Parse story initialization response
   */
  protected abstract parseStoryInitResponse(
    response: IAIResponse,
    origin: string,
    language: Language
  ): Promise<IStoryState>;

  /**
   * Parse plan generation response
   */
  protected abstract parsePlanResponse(response: IAIResponse): Promise<unknown>;

  /**
   * Parse scene context response
   */
  protected abstract parseSceneContextResponse(response: IAIResponse): Promise<unknown>;

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
   * Helper to create a default story state
   */
  protected createDefaultStoryState(_origin: string, _language: Language): IStoryState {
    return {
      selectedOrigin: null, // Would need the actual IOriginStory object
      currentChapter: 1,
      completedMissions: [],
      majorDecisions: [],
      factionReputation: {},
      storyFlags: new Set<string>(),
      journalEntries: []
    };
  }
}