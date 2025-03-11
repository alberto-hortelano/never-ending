import type { CharacterAction, Coord, ICharacter, IMovable, IPath, ISpeech } from "../../common/interfaces.js";
import type { EventBuses } from '../../common/events/index.js';

export class Character implements IMovable {
    name;
    action: CharacterAction = 'iddle';
    letter;
    race;
    description;
    speed;
    direction;
    angle = 0;
    position: Coord = {
        x: 0,
        y: 0,
    };
    route?: Coord[];
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
    speech: ISpeech | null = null;

    constructor(
        private bus: EventBuses,
        characterData: ICharacter,
    ) {
        this.name = characterData.name;
        this.letter = characterData.letter;
        this.race = characterData.race;
        this.description = characterData.description;
        this.speed = characterData.speed;
        this.direction = characterData.direction;
        this.target = characterData.target;
        this.palette = characterData.palette;

        this.bus.server.listen(this.bus.server.events.speech, this, speech => this.onSpeech(speech));
        this.bus.movement.listen(this.bus.movement.events.path, this, path => this.onPath(path));
        this.bus.movement.listen(this.bus.movement.events.position, this, character => {
            if (character && character.name === this.name && character.position) {
                this.position = character.position;
                this.bus.ui.log('Character', this.name, 'updated position to', this.position);
            }
        });
    }

    private _target?: string;
    
    get target(): string | undefined {
        return this._target;
    }

    private set target(value: string | undefined) {
        this._target = value;
        if (value) {
            this.bus.movement.dispatch(this.bus.movement.events.location, this);
        }
    }

    private onSpeech(speech: ISpeech) {
        if (this.name === speech.source) {
            this.target = speech.target;
            this.speech = speech;
            this.action = 'walk';
            this.bus.movement.dispatch(this.bus.movement.events.requestRoute, {
                source: speech.source,
                target: speech.target,
            });
        }
    }

    private onPath(path: IPath) {
        if (this.name === path.source && path.route?.length) {
            this.route = path.route;
            this.action = 'walk';
            this.bus.ui.log('onPath', this.name, this.position.x, this.position.y)
        }
    }
}
