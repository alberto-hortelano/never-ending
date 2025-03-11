// State:
export interface IState {
    map: Cell[][];
    palette: {
        terrain: string;
    };
    characters: ICharacter[];
    messages: IMessage[];
}

export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface Cell {
    symbol: string;
    position?: Coord;
    location?: string[];
    style?: string;
    blocker?: boolean;
}

export interface Coord {
    x: number;
    y: number;
}

export interface IMovable {
    name: string;
    action: string;
    letter: string;
    speed: Speed;
    direction: Direction;
    route?: Coord[];
    target?: string;
    position?: Coord;
}

export interface ICharacter extends IMovable {
    race: Race;
    description: string;
    action: CharacterAction;
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
}

export type Direction = 'down' | 'down-right' | 'right' | 'up-right' | 'up' | 'up-left' | 'left' | 'down-left';
export type Race = 'human' | 'alien' | 'robot';

export interface IRoom {
    name: string;
    size: 'small' | 'medium' | 'big';
    position: Coord;
}

export interface IBuilding {
    name: string;
    rooms: IRoom[];
    position: Coord
    palette: {
        floor: string;
        innerWalls: string;
        outerWalls: string;
    };
}

// Movement
export interface IPath {
    source: string;
    target: string;
    route?: Coord[];
}

export interface ICharacterCell extends Coord {
    name: string;
    letter: string;
}

export interface ICharacterMovement {
    name: string;
    letter: string;
    position: Coord;
    direction: Direction;
    action: CharacterAction;
    speed: Speed;
}

export interface ICharacterAttack extends ICharacterMovement {
    attack: 'melee' | 'hold' | 'kill' | 'retreat';
}

export type CharacterAction = 'walk' | 'iddle';

export interface EventMove {
    action: CharacterAction;
    angle: number;
}

export type Speed = 'verySlow' | 'slow' | 'medium' | 'fast' | 'veryFast';

// Game Actions
export interface IAction {
    type: 'speech' | 'storyline' | 'character' | 'movement' | 'attack' | 'map';
}

export interface ISpeech extends IAction {
    type: 'speech';
    source: string;
    target: string;
    content: string;
    answers: string[];
}

export interface IMap extends IAction {
    type: 'map';
    palette: {
        terrain: string;
    };
    buildings: IBuilding[];
    characters: ICharacter[];
}

export interface IStoryline extends IAction {
    type: 'storyline';
    content: string;
    description: string;
}

export interface ICharacters extends IAction {
    type: 'character';
    characters: ICharacter[];
}

export interface IMovement extends IAction {
    type: 'movement';
    characters: ICharacterMovement[];
}

export interface IAttack extends IAction {
    type: 'attack';
    characters: ICharacterAttack[];
}
