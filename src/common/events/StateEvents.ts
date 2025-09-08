import type { 
    ICharacter, IState, IMessage, Direction, IInventory,
    ICharacterAnimation, ICharacterVisualState, ICellVisualState,
    IPopupState, IProjectileState, IHighlightStates, IInteractionMode,
    IDoor, IStoryState
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
    /** Set pending action cost (preview before actual deduction) */
    setPendingActionCost = 'UpdateStateEvent.setPendingActionCost',
    /** Reset action points for all characters of a player */
    resetActionPoints = 'UpdateStateEvent.resetActionPoints',
    /** Apply damage to a character */
    damageCharacter = 'UpdateStateEvent.damageCharacter',
    /** Add new character to game */
    addCharacter = 'UpdateStateEvent.addCharacter',
    /** Remove character from game */
    removeCharacter = 'UpdateStateEvent.removeCharacter',
    /** Update the game map */
    map = 'UpdateStateEvent.map',
    
    // UI State Events
    /** Update character animation state */
    uiCharacterAnimation = 'UpdateStateEvent.uiCharacterAnimation',
    /** Update character visual state */
    uiCharacterVisual = 'UpdateStateEvent.uiCharacterVisual',
    /** Update cell visual state */
    uiCellVisual = 'UpdateStateEvent.uiCellVisual',
    /** Batch update multiple cell visual states */
    uiCellVisualBatch = 'UpdateStateEvent.uiCellVisualBatch',
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
    /** Set overwatch data for character */
    setOverwatchData = 'UpdateStateEvent.setOverwatchData',
    /** Update selected character */
    uiSelectedCharacter = 'UpdateStateEvent.uiSelectedCharacter',
    /** Initiate melee defense UI */
    uiMeleeDefense = 'UpdateStateEvent.uiMeleeDefense',
    /** Show melee combat result */
    uiMeleeCombatResult = 'UpdateStateEvent.uiMeleeCombatResult',
    /** Update story state */
    storyState = 'UpdateStateEvent.storyState',
    /** Update language */
    language = 'UpdateStateEvent.language',
    /** Update doors */
    doors = 'UpdateStateEvent.doors',
    /** Update bottom bar expanded state */
    uiBottomBarExpanded = 'UpdateStateEvent.uiBottomBarExpanded',
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
    [UpdateStateEvent.setPendingActionCost]: {
        characterName: string;
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
    [UpdateStateEvent.addCharacter]: Partial<ICharacter> & {
        name: string;
        position: { x: number; y: number };
    };
    [UpdateStateEvent.removeCharacter]: {
        characterName: string;
    };
    [UpdateStateEvent.map]: IState['map'];
    
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
    [UpdateStateEvent.uiCellVisualBatch]: {
        updates: Array<{
            cellKey: string; // "x,y" format
            visualState: Partial<DeepReadonly<ICellVisualState>> | null;
        }>;
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
    [UpdateStateEvent.setOverwatchData]: {
        characterName: string;
        active: boolean;
        direction?: Direction;
        position?: DeepReadonly<{ x: number; y: number }>;
        range?: number;
        shotsRemaining?: number;
        watchedCells?: DeepReadonly<{ x: number; y: number }>[];
        shotCells?: string[]; // Array instead of Set for serialization
    };
    [UpdateStateEvent.uiSelectedCharacter]: string | undefined;
    [UpdateStateEvent.uiMeleeDefense]: {
        attacker: string;
        defender: string;
        attackType: string;
        weaponInfo: {
            attackerWeapon: string;
            defenderWeapon: string;
        };
    };
    [UpdateStateEvent.uiMeleeCombatResult]: {
        attacker: string;
        defender: string;
        attackType: string;
        defenseType: string;
        damage: number;
        blocked: boolean;
    };
    [UpdateStateEvent.storyState]: Partial<IStoryState>;
    [UpdateStateEvent.language]: 'en' | 'es';
    [UpdateStateEvent.doors]: Record<string, IDoor>;
    [UpdateStateEvent.uiBottomBarExpanded]: boolean;
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
    characterAdded = 'StateChangeEvent.characterAdded',
    characterRemoved = 'StateChangeEvent.characterRemoved',
    
    // UI State Change Events
    /** UI animations state changed */
    uiAnimations = 'StateChangeEvent.uiAnimations',
    /** UI visual states changed */
    uiVisualStates = 'StateChangeEvent.uiVisualStates',
    /** Targeted cell update - sent to specific cells only */
    uiCellUpdate = 'StateChangeEvent.uiCellUpdate',
    /** UI transient state changed */
    uiTransient = 'StateChangeEvent.uiTransient',
    /** UI interaction mode changed */
    uiInteractionMode = 'StateChangeEvent.uiInteractionMode',
    /** Overwatch state changed */
    overwatchData = 'StateChangeEvent.overwatchData',
    /** Selected character changed */
    uiSelectedCharacter = 'StateChangeEvent.uiSelectedCharacter',
    /** Story state changed */
    storyState = 'StateChangeEvent.storyState',
    /** Language changed */
    language = 'StateChangeEvent.language',
    /** Doors state changed */
    doors = 'StateChangeEvent.doors',
    /** Bottom bar expanded state changed */
    uiBottomBarExpanded = 'StateChangeEvent.uiBottomBarExpanded',
    /** Game saved */
    gameSaved = 'StateChangeEvent.gameSaved',
    /** Game loaded */
    gameLoaded = 'StateChangeEvent.gameLoaded',
    /** Save deleted */
    saveDeleted = 'StateChangeEvent.saveDeleted',
    /** Saves listed */
    savesListed = 'StateChangeEvent.savesListed',
}

export interface StateChangeEventsMap {
    [StateChangeEvent.game]: DeepReadonly<IState['game']>;
    [StateChangeEvent.map]: DeepReadonly<IState['map']>;
    [StateChangeEvent.characters]: DeepReadonly<IState['characters']>;
    [StateChangeEvent.characterPosition]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterPath]: DeepReadonly<ICharacter> & { fromNetwork?: boolean };
    [StateChangeEvent.characterDirection]: DeepReadonly<ICharacter>;
    [StateChangeEvent.messages]: DeepReadonly<IState['messages']>;
    [StateChangeEvent.characterInventory]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterActions]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterHealth]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterDefeated]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterAdded]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterRemoved]: DeepReadonly<ICharacter>;
    
    // UI State Change Events
    [StateChangeEvent.uiAnimations]: DeepReadonly<IState['ui']['animations']>;
    [StateChangeEvent.uiVisualStates]: DeepReadonly<IState['ui']['visualStates']>;
    [StateChangeEvent.uiCellUpdate]: { visualState: ICellVisualState | null };
    [StateChangeEvent.uiTransient]: DeepReadonly<IState['ui']['transientUI']>;
    [StateChangeEvent.uiInteractionMode]: DeepReadonly<IState['ui']['interactionMode']>;
    [StateChangeEvent.overwatchData]: DeepReadonly<Record<string, {
        active: boolean;
        direction: Direction;
        position: { x: number; y: number };
        range: number;
        shotsRemaining: number;
        watchedCells?: { x: number; y: number }[];
        shotCells?: string[];
    }>>;
    [StateChangeEvent.uiSelectedCharacter]: string | undefined;
    [StateChangeEvent.storyState]: DeepReadonly<IStoryState>;
    [StateChangeEvent.language]: 'en' | 'es';
    [StateChangeEvent.doors]: DeepReadonly<Record<string, IDoor>>;
    [StateChangeEvent.uiBottomBarExpanded]: boolean;
    [StateChangeEvent.gameSaved]: {
        slotName: string;
        success: boolean;
        error?: string;
    };
    [StateChangeEvent.gameLoaded]: {
        slotName: string;
        success: boolean;
        error?: string;
    };
    [StateChangeEvent.saveDeleted]: {
        slotName: string;
        success: boolean;
    };
    [StateChangeEvent.savesListed]: Array<{
        slotName: string;
        timestamp: number;
        turn: string;
        characterCount: number;
    }>;
}
