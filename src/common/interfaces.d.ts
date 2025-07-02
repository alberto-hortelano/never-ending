export interface IState {
    map: ICell[][];
    characters: ICharacter[];
    player?: ICharacter;
    messages: IMessage[];
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
export type Speed = 'verySlow' | 'slow' | 'medium' | 'fast' | 'veryFast';
export type BasicDirection = 'down' | 'right' | 'up' | 'left';
export type Direction = BasicDirection | 'down-right' | 'up-right' | 'up-left' | 'down-left';
export interface IMovable extends IPositionable {
    speed: Speed;
    direction: Direction;
    path: ICoord[];
}
export type Race = 'human' | 'alien' | 'robot';
export type Action = 'walk' | 'iddle';
export interface ICharacter extends IMovable {
    name: string;
    race: Race;
    description: string;
    action: Action
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
}
export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
}

export type IRow = IState['map'][number];
