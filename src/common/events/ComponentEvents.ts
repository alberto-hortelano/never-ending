/** Events from UI, Only Component can dispatch */
export enum ComponentEvent {
    characterConnected = 'ComponentEvent.characterConnected',
}

export interface ComponentEventsMap {
    [ComponentEvent.characterConnected]: string;
}
