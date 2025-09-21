import type { ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

export enum ConversationEvent {
    start = 'ConversationEvent.start',
    continue = 'ConversationEvent.continue',
    update = 'ConversationEvent.update',
    error = 'ConversationEvent.error',
    executeAction = 'ConversationEvent.executeAction',
    startAIToAI = 'ConversationEvent.startAIToAI',
    aiExchange = 'ConversationEvent.aiExchange',
    playerInterrupt = 'ConversationEvent.playerInterrupt',
    skipConversation = 'ConversationEvent.skipConversation',
}

export interface ConversationStartData {
    talkingCharacter: DeepReadonly<ICharacter>;
    targetCharacter: DeepReadonly<ICharacter>;
}

// Specific action data types for different speech actions
export interface CharacterActionData {
    characters?: Array<{
        name: string;
        race: 'human' | 'alien' | 'robot';
        description: string;
        speed: 'slow' | 'medium' | 'fast';
        orientation: 'right' | 'left' | 'top' | 'bottom';
        location: string;
        palette?: {
            skin: string;
            helmet: string;
            suit: string;
        };
    }>;
}

export interface MovementActionData {
    movements?: Array<{
        name: string;
        location: string;
    }>;
}

export interface AttackActionData {
    combatants?: Array<{
        attacker: string;
        target: string;
        attackType?: 'melee' | 'hold' | 'kill' | 'retreat';
    }>;
}

export interface ItemActionData {
    items?: Array<{
        id?: string;
        name: string;
        type: 'weapon' | 'consumable' | 'key' | 'artifact';
        location: string;
        description?: string;
    }>;
}

// Union type for all possible action data
export type ActionData = CharacterActionData | MovementActionData | AttackActionData | ItemActionData | void;

export interface ConversationUpdateData {
    type: string;
    source: string;
    content: string;
    answers?: string[];
    action?: string;
    actionData?: ActionData;
    target?: string;  // For AI-to-AI conversations
}

interface ConversationActionData {
    action: string;
    actionData?: ActionData;
}

export interface AIToAIConversationData {
    speaker: DeepReadonly<ICharacter>;
    listener: DeepReadonly<ICharacter>;
    isEavesdropping: boolean; // Whether player is observing
}

export interface AIExchangeData {
    speaker: string;
    listener: string;
    content: string;
    exchangeNumber: number;
    maxExchanges: number;
    isLastExchange: boolean;
}

export interface ConversationEventsMap {
    [ConversationEvent.start]: ConversationStartData;
    [ConversationEvent.continue]: string; // The answer text
    [ConversationEvent.update]: ConversationUpdateData;
    [ConversationEvent.error]: string;
    [ConversationEvent.executeAction]: ConversationActionData;
    [ConversationEvent.startAIToAI]: AIToAIConversationData;
    [ConversationEvent.aiExchange]: AIExchangeData;
    [ConversationEvent.playerInterrupt]: void;
    [ConversationEvent.skipConversation]: void;
}