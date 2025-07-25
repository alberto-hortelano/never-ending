export interface IState {
    game: IGame;
    map: ICell[][];
    characters: ICharacter[];
    messages: IMessage[];
    ui: IUIState;
}
export interface IGame {
    turn: string;
    players: string[];
    playerInfo?: Record<string, { name: string; isAI?: boolean }>;
}
export interface ICoord {
    x: number;
    y: number;
}
export interface ICell {
    position: ICoord;
    locations: string[];
    elements: IPositionable[];
    content: IPositionable | null;
}
export interface IPositionable {
    position: ICoord;
    location: string;
    blocker: boolean;
}
export interface IRoom {
    size: number;
    name: string;
    center?: ICoord;
}
export type BasicDirection = 'down' | 'right' | 'up' | 'left';
export type Direction = BasicDirection | 'down-right' | 'up-right' | 'up-left' | 'down-left';
export interface IMovable extends IPositionable {
    direction: Direction;
    path: ICoord[];
}
export type Race = 'human' | 'alien' | 'robot';
export type Action = 'walk' | 'idle';
export type ItemType = 'consumable' | 'weapon' | 'armor' | 'misc';
export type WeaponType = 'oneHanded' | 'twoHanded';
export type WeaponCategory = 'melee' | 'ranged';
export type WeaponClass = 'pistol' | 'rifle' | 'shotgun' | 'sword' | 'polearm' | 'knife';

export interface IItem {
    id: string;
    name: string;
    description: string;
    weight: number;
    cost: number;
    icon: string;
    type: ItemType;
}

export interface IWeapon extends IItem {
    type: 'weapon';
    weaponType: WeaponType;
    category: WeaponCategory;
    class: WeaponClass;
    damage: number;
    range: number;
}

export interface IInventory {
    items: IItem[];
    maxWeight: number;
    equippedWeapons: {
        primary: IWeapon | null;
        secondary: IWeapon | null;
    };
}

export interface ICharacterActions {
    pointsLeft: number;
    general: {
        move: number;
        talk: number;
        use: number;
        rotate: number;
        inventory: number;
    };
    rangedCombat: {
        shoot: number;
        aim: number;
        suppress: number;
        cover: number;
        throw: number;
    };
    closeCombat: {
        powerStrike: number;
        slash: number;
        fastAttack: number;
        feint: number;
        breakGuard: number;
    };
}

export interface ICharacter extends IMovable {
    name: string;
    race: Race;
    description: string;
    action: Action;
    player: string;
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
    inventory: IInventory;
    actions: ICharacterActions;
    health: number;
    maxHealth: number;
}
export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
}

// UI State Interfaces
export interface IUIState {
    animations: IAnimationStates;
    visualStates: IVisualStates;
    transientUI: ITransientUI;
    interactionMode: IInteractionMode;
}

export interface IAnimationStates {
    characters: Record<string, ICharacterAnimation | undefined>;
}

export interface ICharacterAnimation {
    type: 'walk' | 'idle' | 'attack' | 'defeat' | 'rotate';
    startTime: number;
    duration: number;
    from?: ICoord;
    to?: ICoord;
    fromDirection?: Direction;
    toDirection?: Direction;
    progress?: number; // 0-1
    path?: ICoord[]; // For multi-step movements
    currentStep?: number; // Current step in path
}

export interface IVisualStates {
    characters: Record<string, ICharacterVisualState | undefined>;
    cells: Record<string, ICellVisualState | undefined>; // Key format: "x,y"
    board: IBoardVisualState;
}

export interface ICharacterVisualState {
    direction: Direction;
    classList: string[];
    temporaryClasses: string[]; // For transient actions like 'shoot'
    weaponClass?: string; // Current equipped weapon class
    styles: Record<string, string>;
    healthBarPercentage: number;
    healthBarColor: string;
    isDefeated: boolean;
    isCurrentTurn: boolean;
    isMyCharacter?: boolean; // Multiplayer
    isOpponentCharacter?: boolean; // Multiplayer
    equippedWeapon?: string; // Current weapon being displayed
}

export interface ICellVisualState {
    isHighlighted: boolean;
    highlightIntensity?: number;
    highlightType?: 'movement' | 'attack' | 'path';
    classList: string[];
}

export interface IBoardVisualState {
    mapWidth: number;
    mapHeight: number;
    centerPosition?: ICoord;
    hasPopupActive: boolean;
}

export interface ITransientUI {
    popups: Record<string, IPopupState | undefined>;
    projectiles: IProjectileState[];
    highlights: IHighlightStates;
}

export interface IPopupState {
    type: 'actions' | 'inventory' | 'conversation' | 'rotate' | 'directions';
    visible: boolean;
    position?: { x: number; y: number };
    data: IPopupData & { title?: string };
    isPinned?: boolean;
}

export type IPopupData =
    | IActionsPopupData
    | IInventoryPopupData
    | IConversationPopupData
    | IRotatePopupData
    | IDirectionsPopupData;

export interface IActionsPopupData {
    characterId?: string;
    actions?: ICharacterActions;
}

export interface IInventoryPopupData {
    characterId?: string;
    inventory?: IInventory;
}

export interface IConversationPopupData {
    characterId?: string;
    messages?: IMessage[];
}

export interface IRotatePopupData {
    characterId?: string;
    currentDirection?: Direction;
}

export interface IDirectionsPopupData {
    characterId?: string;
    availableDirections?: Direction[];
}

export interface IProjectileState {
    id: string;
    type: 'bullet' | 'laser';
    from: ICoord;
    to: ICoord;
    startTime: number;
    duration: number;
}

export interface IHighlightStates {
    reachableCells: ICoord[];
    pathCells: ICoord[];
    targetableCells: ICoord[];
}

export interface IInteractionMode {
    type: 'normal' | 'moving' | 'shooting' | 'selecting' | 'rotating';
    data?: IInteractionModeData;
}

export type IInteractionModeData =
    | IMovingModeData
    | IShootingModeData
    | ISelectingModeData
    | IRotatingModeData;

export interface IMovingModeData {
    characterId: string;
    startPosition: ICoord;
    targetPosition?: ICoord;
}

export interface IShootingModeData {
    characterId: string;
    weapon: IWeapon;
    targetPosition?: ICoord;
}

export interface ISelectingModeData {
    targetType: 'character' | 'cell';
    selectedId?: string;
}

export interface IRotatingModeData {
    characterId: string;
    targetDirection?: Direction;
}

// Character Creation Interfaces
export interface ICharacterCreationState {
    isOpen: boolean;
    currentTab: 'appearance' | 'info' | 'abilities' | 'equipment';
    data: ICreatorData;
    validation: ICreatorValidation;
    availableWeapons: ISimplifiedWeapon[];
    availableItems: ISimplifiedItem[];
}

export interface ICreatorData {
    name: string;
    race: Race;
    description: string;
    colors: ICharacterColors;
    abilities: IAbilityCost;
    primaryWeapon: string | null;
    secondaryWeapon: string | null;
    items: string[];
}

export interface ICharacterColors {
    skin: string;
    helmet: string;
    suit: string;
}

export interface IAbilityCost {
    move: number;
    shoot: number;
    reload: number;
    pickup: number;
}

export interface ICreatorValidation {
    nameError: string;
    isWeightValid: boolean;
    isBudgetValid: boolean;
    currentWeight: number;
    currentCost: number;
    usedAbilityPoints: number;
}

export interface ISimplifiedWeapon {
    id: string;
    name: string;
    weight: number;
    cost: number;
}

export interface ISimplifiedItem {
    id: string;
    name: string;
    weight: number;
    cost: number;
}

