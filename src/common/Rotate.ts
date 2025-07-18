import type { DeepReadonly } from "./helpers/types";
import type { ICharacter } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEventsMap,
} from "./events";

export class Rotate extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {
    constructor(
        private state: State,
    ) {
        super();
        this.listen(ControlsEvent.rotate, characterName => this.onRotate(characterName));
    }

    private onRotate(characterName: ControlsEventsMap[ControlsEvent.rotate]) {
        const character = this.state.findCharacter(characterName);
        if (!character) return;

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.log(`${characterName} cannot be rotated by ${currentTurn} - belongs to ${character.player}`);
            return;
        }

        // Show the rotate popup
        this.showRotatePopup(character);
    }

    private showRotatePopup(character: DeepReadonly<ICharacter>) {
        // Dispatch event to show the rotate popup with directional buttons
        this.dispatch(ControlsEvent.showRotate, character);
    }
}