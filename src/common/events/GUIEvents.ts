import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, ICoord } from "../interfaces";

/** Events to communicate with UI */
export enum GUIEvent {
    cellHighlight = 'GUIEvent.cellHighlight',
    cellHighlightIntensity = 'GUIEvent.cellHighlightIntensity',
    cellReset = 'GUIEvent.cellReset',
    movementEnd = 'GUIEvent.movementEnd',
    popupShow = 'GUIEvent.popupShow',
    popupHide = 'GUIEvent.popupHide',
    shootProjectile = 'GUIEvent.shootProjectile',
    shootingModeStart = 'GUIEvent.shootingModeStart',
    shootingModeEnd = 'GUIEvent.shootingModeEnd',
}

export interface GUIEventsMap {
    [GUIEvent.cellHighlight]: DeepReadonly<ICoord>;
    [GUIEvent.cellHighlightIntensity]: DeepReadonly<{ coord: ICoord; intensity: number }>;
    [GUIEvent.cellReset]: DeepReadonly<ICoord>;
    [GUIEvent.movementEnd]: ICharacter['name'];
    [GUIEvent.popupShow]: void;
    [GUIEvent.popupHide]: void;
    [GUIEvent.shootProjectile]: DeepReadonly<{
        from: ICoord;
        to: ICoord;
        type: 'bullet' | 'laser';
    }>;
    [GUIEvent.shootingModeStart]: void;
    [GUIEvent.shootingModeEnd]: void;
}
