import type { 
    ICharacter, IState, IMessage, Direction, IInventory,
    ICharacterAnimation, ICharacterVisualState, ICellVisualState,
    IPopupState, IProjectileState, IHighlightStates, IInteractionMode
} from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

/** Events to update state. Only State can listen. All can dispatch */
export enum UpdateStateEvent {
    /** Update character position */
    characterPosition = 'UpdateStateEvent.characterPosition',
    characterPath = 'UpdateStateEvent.characterPath',
    /** Update character direction */
    characterDirection = 'UpdateStateEvent.characterDirection',
    /** Update messages history */
    updateMessages = 'UpdateStateEvent.updateMessages',
    /** Update character inventory */
    updateInventory = 'UpdateStateEvent.updateInventory',
    /** Equip weapon */
    equipWeapon = 'UpdateStateEvent.equipWeapon',
    /** Unequip weapon */
    unequipWeapon = 'UpdateStateEvent.unequipWeapon',
    /** Deduct action points from character */
    deductActionPoints = 'UpdateStateEvent.deductActionPoints',
    /** Reset action points for all characters of a player */
    resetActionPoints = 'UpdateStateEvent.resetActionPoints',
    /** Apply damage to a character */
    damageCharacter = 'UpdateStateEvent.damageCharacter',
    
    // UI State Events
    /** Update character animation state */
    uiCharacterAnimation = 'UpdateStateEvent.uiCharacterAnimation',
    /** Update character visual state */
    uiCharacterVisual = 'UpdateStateEvent.uiCharacterVisual',
    /** Update cell visual state */
    uiCellVisual = 'UpdateStateEvent.uiCellVisual',
    /** Update board visual state */
    uiBoardVisual = 'UpdateStateEvent.uiBoardVisual',
    /** Update popup state */
    uiPopup = 'UpdateStateEvent.uiPopup',
    /** Add projectile */
    uiAddProjectile = 'UpdateStateEvent.uiAddProjectile',
    /** Remove projectile */
    uiRemoveProjectile = 'UpdateStateEvent.uiRemoveProjectile',
    /** Update highlight states */
    uiHighlights = 'UpdateStateEvent.uiHighlights',
    /** Update interaction mode */
    uiInteractionMode = 'UpdateStateEvent.uiInteractionMode',
}

export interface UpdateStateEventsMap {
    [UpdateStateEvent.characterPosition]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.characterPath]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.characterDirection]: { characterName: string; direction: Direction };
    [UpdateStateEvent.updateMessages]: DeepReadonly<IMessage[]>;
    [UpdateStateEvent.updateInventory]: { 
        characterName: string; 
        inventory: DeepReadonly<IInventory>;
    };
    [UpdateStateEvent.equipWeapon]: {
        characterName: string;
        weaponId: string | null;
        slot: 'primary' | 'secondary';
    };
    [UpdateStateEvent.unequipWeapon]: {
        characterName: string;
        slot: 'primary' | 'secondary';
    };
    [UpdateStateEvent.deductActionPoints]: {
        characterName: string;
        actionId: string;
        cost: number;
    };
    [UpdateStateEvent.resetActionPoints]: {
        player: string;
    };
    [UpdateStateEvent.damageCharacter]: {
        targetName: string;
        damage: number;
        attackerName?: string;
    };
    
    // UI State Events
    [UpdateStateEvent.uiCharacterAnimation]: {
        characterId: string;
        animation: DeepReadonly<ICharacterAnimation> | null;
    };
    [UpdateStateEvent.uiCharacterVisual]: {
        characterId: string;
        visualState: Partial<DeepReadonly<ICharacterVisualState>>;
    };
    [UpdateStateEvent.uiCellVisual]: {
        cellKey: string; // "x,y" format
        visualState: Partial<DeepReadonly<ICellVisualState>> | null;
    };
    [UpdateStateEvent.uiBoardVisual]: {
        updates: Partial<DeepReadonly<{
            mapWidth?: number;
            mapHeight?: number;
            centerPosition?: { x: number; y: number };
            hasPopupActive?: boolean;
        }>>;
    };
    [UpdateStateEvent.uiPopup]: {
        popupId: string;
        popupState: DeepReadonly<IPopupState> | null;
    };
    [UpdateStateEvent.uiAddProjectile]: DeepReadonly<IProjectileState>;
    [UpdateStateEvent.uiRemoveProjectile]: { projectileId: string };
    [UpdateStateEvent.uiHighlights]: Partial<DeepReadonly<IHighlightStates>>;
    [UpdateStateEvent.uiInteractionMode]: DeepReadonly<IInteractionMode>;
}

/** Events when the state has changed. All can listen. Only State can dispatch */
export enum StateChangeEvent {
    /** Game state changed (turn, players, etc) */
    game = 'StateChangeEvent.game',
    /** Update character position */
    map = 'StateChangeEvent.map',
    characters = 'StateChangeEvent.characters',
    characterPosition = 'StateChangeEvent.characterPosition',
    characterPath = 'StateChangeEvent.characterPath',
    characterDirection = 'StateChangeEvent.characterDirection',
    messages = 'StateChangeEvent.messages',
    characterInventory = 'StateChangeEvent.characterInventory',
    characterActions = 'StateChangeEvent.characterActions',
    characterHealth = 'StateChangeEvent.characterHealth',
    characterDefeated = 'StateChangeEvent.characterDefeated',
    
    // UI State Change Events
    /** UI animations state changed */
    uiAnimations = 'StateChangeEvent.uiAnimations',
    /** UI visual states changed */
    uiVisualStates = 'StateChangeEvent.uiVisualStates',
    /** UI transient state changed */
    uiTransient = 'StateChangeEvent.uiTransient',
    /** UI interaction mode changed */
    uiInteractionMode = 'StateChangeEvent.uiInteractionMode',
}

export interface StateChangeEventsMap {
    [StateChangeEvent.game]: DeepReadonly<IState['game']>;
    [StateChangeEvent.map]: DeepReadonly<IState['map']>;
    [StateChangeEvent.characters]: DeepReadonly<IState['characters']>;
    [StateChangeEvent.characterPosition]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterPath]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterDirection]: DeepReadonly<ICharacter>;
    [StateChangeEvent.messages]: DeepReadonly<IState['messages']>;
    [StateChangeEvent.characterInventory]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterActions]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterHealth]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterDefeated]: DeepReadonly<ICharacter>;
    
    // UI State Change Events
    [StateChangeEvent.uiAnimations]: DeepReadonly<IState['ui']['animations']>;
    [StateChangeEvent.uiVisualStates]: DeepReadonly<IState['ui']['visualStates']>;
    [StateChangeEvent.uiTransient]: DeepReadonly<IState['ui']['transientUI']>;
    [StateChangeEvent.uiInteractionMode]: DeepReadonly<IState['ui']['interactionMode']>;
}
