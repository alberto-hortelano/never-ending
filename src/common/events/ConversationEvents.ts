import type { ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

export enum ConversationEvent {
    start = 'ConversationEvent.start',
    continue = 'ConversationEvent.continue',
    update = 'ConversationEvent.update',
    error = 'ConversationEvent.error',
}

export interface ConversationStartData {
    talkingCharacter: DeepReadonly<ICharacter>;
    targetCharacter: DeepReadonly<ICharacter>;
}

export interface ConversationUpdateData {
    type: string;
    source: string;
    content: string;
    answers?: string[];
    action?: string;
}

export interface ConversationEventsMap {
    [ConversationEvent.start]: ConversationStartData;
    [ConversationEvent.continue]: string; // The answer text
    [ConversationEvent.update]: ConversationUpdateData;
    [ConversationEvent.error]: string;
}