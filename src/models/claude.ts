import type { IMessage } from '../common/interfaces';

import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '../prompts';
import { initialSetup } from '../prompts/shortPrompts';

const anthropic = new Anthropic();

// Model fallback configuration
const CLAUDE_MODELS = [
    'claude-opus-4-1',         // Primary model
    'claude-opus-4-0', // First fallback
    'claude-sonnet-4-0', // Second fallback
    'claude-3-7-sonnet-latest',     // Third fallback
] as const;

type ClaudeModel = typeof CLAUDE_MODELS[number];

// Type for model status
interface FallbackInfo {
    model: ClaudeModel;
    fallbackTo: ClaudeModel | null;
    reason: 'overload' | 'error';
    remainingMinutes: number;
}

interface ModelStatus {
    currentModel: ClaudeModel;
    fallbacks: FallbackInfo[];
}

// Fallback state management
interface FallbackState {
    failedModel: ClaudeModel;
    fallbackModel: ClaudeModel | null;
    timestamp: number;
    errorType: 'overload' | 'error';
}

class ModelFallbackManager {
    private fallbackStates: Map<ClaudeModel, FallbackState> = new Map();
    private readonly FALLBACK_DURATION_MS = 60 * 60 * 1000; // 1 hour

    // Get the next available model
    getNextModel(failedModel: ClaudeModel): ClaudeModel | null {
        const currentIndex = CLAUDE_MODELS.indexOf(failedModel);

        // Try each subsequent model
        for (let i = currentIndex + 1; i < CLAUDE_MODELS.length; i++) {
            const candidate = CLAUDE_MODELS[i];
            if (!candidate) continue;

            // Check if this model is also in fallback state
            const candidateState = this.fallbackStates.get(candidate);
            if (candidateState && !this.isExpired(candidateState)) {
                continue; // Skip this model, it's also having issues
            }

            return candidate;
        }

        return null; // No fallback available
    }

    // Record a model failure and set up fallback
    recordFailure(model: ClaudeModel, isOverload: boolean): ClaudeModel | null {
        const fallbackModel = this.getNextModel(model);

        if (fallbackModel) {
            this.fallbackStates.set(model, {
                failedModel: model,
                fallbackModel,
                timestamp: Date.now(),
                errorType: isOverload ? 'overload' : 'error'
            });

            // DEBUG: console.log(`[ModelFallback] Model ${model} failed (${isOverload ? 'overload' : 'error'}). Falling back to ${fallbackModel}`);
        } else {
            console.error(`[ModelFallback] Model ${model} failed with no fallback available`);
        }

        return fallbackModel;
    }

    // Get the current model to use (checking for active fallbacks)
    getCurrentModel(): ClaudeModel {
        const primaryModel = CLAUDE_MODELS[0];

        // Check if primary model has an active fallback
        const primaryState = this.fallbackStates.get(primaryModel);
        if (primaryState && !this.isExpired(primaryState) && primaryState.fallbackModel) {
            // Recursively check if the fallback itself needs a fallback
            return this.getActiveModel(primaryState.fallbackModel);
        }

        return primaryModel;
    }

    // Recursively find the active model (handling cascading fallbacks)
    private getActiveModel(model: ClaudeModel): ClaudeModel {
        const state = this.fallbackStates.get(model);

        if (state && !this.isExpired(state) && state.fallbackModel) {
            return this.getActiveModel(state.fallbackModel);
        }

        return model;
    }

    // Check if a fallback has expired
    private isExpired(state: FallbackState): boolean {
        return Date.now() - state.timestamp > this.FALLBACK_DURATION_MS;
    }

    // Clear expired fallbacks
    cleanupExpired(): void {
        for (const [model, state] of this.fallbackStates.entries()) {
            if (this.isExpired(state)) {
                // DEBUG: console.log(`[ModelFallback] Clearing expired fallback for ${model}`);
                this.fallbackStates.delete(model);
            }
        }
    }

    // Clear a specific model's fallback (e.g., after successful use)
    clearFallback(model: ClaudeModel): void {
        if (this.fallbackStates.has(model)) {
            // DEBUG: console.log(`[ModelFallback] Clearing fallback for ${model} after successful use`);
            this.fallbackStates.delete(model);
        }
    }

    // Get current fallback status for debugging
    getStatus(): ModelStatus {
        const status: ModelStatus = {
            currentModel: this.getCurrentModel(),
            fallbacks: []
        };

        for (const [model, state] of this.fallbackStates.entries()) {
            if (!this.isExpired(state)) {
                status.fallbacks.push({
                    model,
                    fallbackTo: state.fallbackModel,
                    reason: state.errorType,
                    remainingMinutes: Math.round((this.FALLBACK_DURATION_MS - (Date.now() - state.timestamp)) / 60000)
                });
            }
        }

        return status;
    }
}

// Create singleton instance
const fallbackManager = new ModelFallbackManager();

export type SendMessage = (messages: IMessage[]) => Promise<string>;

const cache = new Map<string, string>();
cache.set(initialSetup, JSON.stringify({
    "type": "speech",
    "source": "Data",
    "content": "Bienvenido a bordo, Jim. Me alegro de que hayamos logrado escapar. ¿Tienes alguna idea de hacia dónde deberíamos dirigirnos ahora? Nuestras opciones son limitadas, pero podríamos intentar llegar a un planeta en el borde exterior donde sea menos probable que nos encuentren.",
    "answers": [
        "Vayamos al planeta más cercano para reabastecernos.",
        "Busquemos un lugar para escondernos por un tiempo.",
        "Contactemos con la Coalición Rebelde en busca de ayuda.",
        "¿Qué sugieres tú, Data?"
    ],
    //     "type": "speech",
    //     "source": "Data",
    //     "content": "Welcome aboard, Jim. I'm Data, the service droid assigned to this vessel. We've successfully escaped from your former unit, but our situation remains precarious. What's our next move? Should we seek a safe haven, look for allies, or attempt to gather resources?",
    //     "answers": [
    //         "Let's head to the nearest populated planet.",
    //         "We need allies. Any rebel groups or independent colonies nearby?",
    //         "Resources are crucial. Where can we get supplies and fuel?"
    //     ]
}));

async function callClaudeWithModel(
    model: ClaudeModel,
    messages: IMessage[],
    narrativeArchitect: string
): Promise<Anthropic.Messages.Message> {
    // DEBUG: console.log(`[Claude] Attempting with model: ${model}`);

    try {
        // Use streaming for better handling of long-running requests
        const stream = await anthropic.messages.stream({
            model: model as Anthropic.Messages.MessageCreateParams['model'],
            max_tokens: 32000,
            system: narrativeArchitect,
            messages: messages,
        });

        // Wait for the complete message using the helper
        const msg = await stream.finalMessage();

        // Success - clear any fallback for this model
        fallbackManager.clearFallback(model);
        // DEBUG: console.log(`[Claude] Success with model: ${model}`);

        return msg;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;

        // Check if this is an overload error
        const isOverload = statusCode === 529 ||
            errorMessage.includes('529') ||
            errorMessage.includes('overloaded') ||
            errorMessage.includes('overloaded_error');

        console.error(`[Claude] Model ${model} failed:`, {
            status: statusCode,
            message: errorMessage,
            isOverload
        });

        // Record the failure and get fallback
        const fallbackModel = fallbackManager.recordFailure(model, isOverload);

        if (fallbackModel) {
            // Retry with fallback model
            return callClaudeWithModel(fallbackModel, messages, narrativeArchitect);
        } else {
            // No fallback available, throw the error
            throw error;
        }
    }
}

export const sendMessage: SendMessage = async (messages: IMessage[]) => {
    const lastMssg = messages.at(-1);
    if (lastMssg?.content && cache.has(lastMssg.content)) {
        return cache.get(lastMssg.content) || `Error: Missing content in cache for ${lastMssg.content}`;
    }
    if (lastMssg?.role === 'assistant') {
        throw new Error("Last message is from assistant, this won't return anything");
    }

    // Clean up expired fallbacks periodically
    fallbackManager.cleanupExpired();

    const narrativeArchitect = await getPrompt('narrativeArchitect');

    // Get the current model (considering active fallbacks)
    const currentModel = fallbackManager.getCurrentModel();

    // DEBUG: console.log(`[Claude] Using model: ${currentModel}`);

    // Log fallback status if there are active fallbacks
    const status = fallbackManager.getStatus();
    if (status.fallbacks.length > 0) {
        // DEBUG: console.log('[Claude] Active fallbacks:', status);
    }

    try {
        // DEBUG: console.log('PROMPT ###############');
        // DEBUG: console.log('CLAUDE:\n', messages[messages.length - 1]);
        const msg = await callClaudeWithModel(currentModel, messages, narrativeArchitect);

        const response = msg.content[0];
        if (!response || response.type !== 'text') {
            return 'Error: Wrong response type';
        }

        // Extract JSON from markdown code blocks if present
        const text = response.text;
        // DEBUG: console.log('RESPONSE ###############');
        // DEBUG: console.log('CLAUDE:\n', text);
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);

        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1].trim();
        }

        // Return as-is if no code block found
        return text;
    } catch (error) {
        console.error('[Claude] All models failed:', error);

        // Return a structured error response that the game can handle
        return JSON.stringify({
            type: 'error',
            message: 'AI service temporarily unavailable. Please try again.',
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

// Export the fallback manager for debugging/monitoring
export const getModelStatus = () => fallbackManager.getStatus();
