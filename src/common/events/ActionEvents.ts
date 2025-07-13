import type { DeepReadonly } from "../helpers/types";
import type { ICharacterActions } from "../interfaces";
import type { ControlsEvent } from "./ControlsEvents";

export interface ActionItem {
    id: string;
    label: string;
    icon: string;
    event: ControlsEvent;
}

export interface ActionCategory {
    name: string;
    actions: ActionItem[];
}

export interface ActionUpdateData {
    categories: ActionCategory[];
    characterName: string;
    characterActions: DeepReadonly<ICharacterActions>;
}

export enum ActionEvent {
    request = 'ActionEvent.request',
    update = 'ActionEvent.update',
    selected = 'ActionEvent.selected',
    error = 'ActionEvent.error'
}

export interface ActionEventsMap {
    [ActionEvent.request]: string; // character name
    [ActionEvent.update]: ActionUpdateData;
    [ActionEvent.selected]: { action: string; characterName: string };
    [ActionEvent.error]: string;
}