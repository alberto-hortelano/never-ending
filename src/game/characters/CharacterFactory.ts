import type { ICharacter } from '../../common/interfaces.js';
import type { EventBuses } from '../../common/events/index.js';

import { Character } from './Character.js';

export class CharacterFactory {
    private characters: Character[] = [];

    constructor(private bus: EventBuses) {
        this.bus.server.listen(this.bus.server.events.characters, this, characters => this.createCharacters(characters));
        this.bus.server.listen(this.bus.server.events.player, this, player => this.setPlayer(player));
    }

    private createCharacters(characters: ICharacter[]) {
        this.characters = characters.map(characterData => new Character(this.bus, characterData));
    }

    private setPlayer(playerData: ICharacter) {
        let player = this.characters.find(character => character.letter === playerData.letter);
        if (!player) {
            player = new Character(this.bus, playerData);
            this.characters.push(player);
        }
        // Note: we don't need to store the player reference as it's already in the characters array
    }
}
