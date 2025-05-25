/** Events from UI, Only Component can dispatch */
export enum ComponentEvent {
    characterConnected = 'characterConnected',
}

export interface ComponentEventsMap {
    [ComponentEvent.characterConnected]: string;
}
