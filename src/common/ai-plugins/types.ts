/**
 * Core types and interfaces for the AI Plugin System
 */

import { IMessage, Language, IStoryState } from '../interfaces';
import { AICommand } from '../services/AICommandParser';

/**
 * Base configuration for all AI providers
 */
export interface IAIProviderConfig {
  /** Unique identifier for the provider */
  provider: string;
  /** Human-readable name */
  name: string;
  /** Optional API key */
  apiKey?: string;
  /** Base URL for API calls */
  endpoint?: string;
  /** Model to use */
  model?: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
  /** Whether this provider is enabled */
  enabled?: boolean;
  /** Priority for fallback (lower is higher priority) */
  priority?: number;
}

/**
 * Capabilities that a provider supports
 */
export interface IProviderCapabilities {
  /** Supports streaming responses */
  streaming?: boolean;
  /** Supports function/tool calling */
  functionCalling?: boolean;
  /** Maximum tokens in context */
  maxContextTokens?: number;
  /** Maximum tokens in response */
  maxResponseTokens?: number;
  /** Supports system messages */
  systemMessages?: boolean;
  /** Supports image inputs */
  vision?: boolean;
  /** Supports JSON mode */
  jsonMode?: boolean;
  /** Custom capabilities */
  custom?: Record<string, boolean>;
}

/**
 * Standardized AI response format
 */
export interface IAIResponse {
  /** The response content */
  content: string;
  /** Raw response from provider */
  raw?: unknown;
  /** Usage statistics */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
  /** Model used for this response */
  model?: string;
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider status information
 */
export interface IProviderStatus {
  /** Whether the provider is available */
  available: boolean;
  /** Current model being used */
  currentModel?: string;
  /** Error message if unavailable */
  error?: string;
  /** Last successful request timestamp */
  lastSuccess?: number;
  /** Last error timestamp */
  lastError?: number;
  /** Request count */
  requestCount?: number;
  /** Fallback information */
  fallback?: {
    active: boolean;
    reason?: string;
    until?: number;
  };
}

/**
 * Context for AI game engine requests
 */
export interface IAIGameContext {
  /** Current character information */
  currentCharacter?: {
    name: string;
    controller: string; // 'human' | 'ai' | etc.
    faction?: string;
    position?: { x: number; y: number };
  };
  /** Visible characters */
  visibleCharacters?: unknown[];
  /** Characters in conversation range */
  charactersInConversationRange?: unknown[];
  /** Conversation history */
  conversationHistory?: unknown[];
  /** Current mission */
  currentMission?: unknown;
  /** Story flags */
  storyFlags?: Set<string>;
  /** Current turn number */
  turn?: number;
  /** Language for responses */
  language?: Language;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Request options for AI calls
 */
export interface IAIRequestOptions {
  /** Temperature for randomness (0-1) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** System prompt override */
  systemPrompt?: string;
  /** Whether to stream the response */
  stream?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** Cache the response */
  cache?: boolean;
  /** Cache key */
  cacheKey?: string;
  /** Additional provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Core AI Provider interface
 */
export interface IAIProvider {
  /** Provider configuration */
  readonly config: IAIProviderConfig;

  /** Provider capabilities */
  readonly capabilities: IProviderCapabilities;

  /** Provider status */
  readonly status: IProviderStatus;

  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;

  /**
   * Send a message to the AI
   * @param messages - Conversation messages
   * @param options - Request options
   */
  sendMessage(messages: IMessage[], options?: IAIRequestOptions): Promise<IAIResponse>;

  /**
   * Validate provider configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider status
   */
  getStatus(): IProviderStatus;

  /**
   * Reset provider state
   */
  reset(): void;

  /**
   * Cleanup resources
   */
  dispose(): void;
}

/**
 * Factory for creating AI providers
 */
export interface IAIProviderFactory {
  /**
   * Create a provider instance
   * @param config - Provider configuration
   */
  create(config: IAIProviderConfig): IAIProvider;

  /**
   * Check if factory can create provider for given config
   * @param config - Provider configuration
   */
  supports(config: IAIProviderConfig): boolean;
}

/**
 * Plugin metadata
 */
export interface IAIPluginMetadata {
  /** Plugin identifier */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Required provider type */
  providerType?: string;
  /** Plugin dependencies */
  dependencies?: string[];
}

/**
 * Base plugin interface
 */
export interface IAIPlugin {
  /** Plugin metadata */
  readonly metadata: IAIPluginMetadata;

  /** Initialize the plugin */
  initialize(provider: IAIProvider): Promise<void>;

  /** Cleanup plugin resources */
  dispose(): void;
}

/**
 * Game engine specific plugin interface
 */
export interface IGameEnginePlugin extends IAIPlugin {
  /**
   * Request an AI action for a game turn
   * @param context - Game context
   * @param options - Request options
   */
  requestAction(context: IAIGameContext, options?: IAIRequestOptions): Promise<AICommand>;

  /**
   * Generate a map
   * @param prompt - Map generation prompt
   * @param options - Request options
   */
  generateMap(prompt: string, options?: IAIRequestOptions): Promise<AICommand>;

  /**
   * Validate and potentially retry a command
   * @param command - Command to validate
   * @param context - Game context
   * @param error - Validation error
   */
  validateAndRetry(command: AICommand, context: IAIGameContext, error: string): Promise<AICommand>;
}

/**
 * Story generation plugin interface
 */
export interface IStoryPlugin extends IAIPlugin {
  /**
   * Initialize a story
   * @param origin - Story origin
   * @param language - Language for the story
   * @param options - Request options
   */
  initializeStory(origin: string, language: Language, options?: IAIRequestOptions): Promise<IStoryState>;

  /**
   * Generate a story plan
   * @param context - Story context
   * @param options - Request options
   */
  generatePlan(context: unknown, options?: IAIRequestOptions): Promise<unknown>;

  /**
   * Get scene context
   * @param sceneId - Scene identifier
   * @param options - Request options
   */
  getSceneContext(sceneId: string, options?: IAIRequestOptions): Promise<unknown>;
}

/**
 * Dialogue plugin interface
 */
export interface IDialoguePlugin extends IAIPlugin {
  /**
   * Generate dialogue response
   * @param context - Dialogue context
   * @param history - Conversation history
   * @param options - Request options
   */
  generateResponse(context: unknown, history: IMessage[], options?: IAIRequestOptions): Promise<string>;

  /**
   * Generate dialogue options
   * @param context - Dialogue context
   * @param options - Request options
   */
  generateOptions(context: unknown, options?: IAIRequestOptions): Promise<string[]>;
}

/**
 * Provider registry entry
 */
export interface IProviderRegistryEntry {
  factory: IAIProviderFactory;
  config: IAIProviderConfig;
  instance?: IAIProvider;
}

/**
 * Error types for AI operations
 */
export enum AIErrorType {
  CONFIGURATION = 'CONFIGURATION',
  INITIALIZATION = 'INITIALIZATION',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  UNKNOWN = 'UNKNOWN'
}

/**
 * AI operation error
 */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly type: AIErrorType,
    public readonly provider?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * Response parser interface for different formats
 */
export interface IResponseParser {
  /**
   * Parse AI response into structured format
   * @param response - Raw response string
   */
  parse(response: string): unknown;

  /**
   * Check if parser can handle this response
   * @param response - Raw response string
   */
  canParse(response: string): boolean;
}

/**
 * Cache interface for AI responses
 */
export interface IAICache {
  /**
   * Get cached response
   * @param key - Cache key
   */
  get(key: string): Promise<IAIResponse | undefined>;

  /**
   * Set cached response
   * @param key - Cache key
   * @param response - Response to cache
   * @param ttl - Time to live in seconds
   */
  set(key: string, response: IAIResponse, ttl?: number): Promise<void>;

  /**
   * Clear cache
   * @param pattern - Optional pattern to match keys
   */
  clear(pattern?: string): Promise<void>;
}

/**
 * Logger interface for AI operations
 */
export interface IAILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}