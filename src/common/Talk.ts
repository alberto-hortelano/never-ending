import type { DeepReadonly } from "./helpers/types";
import type { ICharacter } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEventsMap,
} from "./events";

export class Talk extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {
    constructor(
        private state: State,
    ) {
        super();
        this.listen(ControlsEvent.talk, characterName => this.onTalk(characterName));
    }

    private onTalk(characterName: ControlsEventsMap[ControlsEvent.talk]) {
        const talkingCharacter = this.state.findCharacter(characterName);
        if (!talkingCharacter) return;

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (talkingCharacter.player !== currentTurn) {
            console.log(`${characterName} cannot be used by ${currentTurn} - belongs to ${talkingCharacter.player}`);
            return;
        }

        // Get all characters except the one who's talking
        const availableCharacters = this.state.characters.filter(
            char => char.name !== characterName
        );

        if (availableCharacters.length === 0) {
            console.log(`${characterName} has no one to talk to`);
            return;
        }

        // For now, we'll create and show the talk popup
        this.showTalkPopup(talkingCharacter, availableCharacters);
    }

    private showTalkPopup(talkingCharacter: DeepReadonly<ICharacter>, availableCharacters: DeepReadonly<ICharacter[]>) {
        // Dispatch event to show the talk popup with character list
        this.dispatch(ControlsEvent.showTalk, {
            talkingCharacter,
            availableCharacters
        });
    }
}