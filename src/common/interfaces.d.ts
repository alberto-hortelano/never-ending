export interface IState {
    map: ICell[][];
    characters: ICharacter[];
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
    cell: ICell;
    location: string;
    blocker: boolean;
}
export interface IMovable extends IPositionable {
    speed: 'verySlow' | 'slow' | 'medium' | 'fast' | 'veryFast';
    direction: 'down' | 'down-right' | 'right' | 'up-right' | 'up' | 'up-left' | 'left' | 'down-left';
    path: ICoord[];
    target: ICell;
}
export interface ICharacter extends IMovable {
    name: string;
    race: 'human' | 'alien' | 'robot';
    description: string;
    action: 'walk' | 'iddle';
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
