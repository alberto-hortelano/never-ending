import { GameEvent, EventBus, GameEventsMap } from '../events';


class Extended extends EventBus<GameEventsMap, GameEventsMap> {
    public name = 'Extended';
    public map?: GameEventsMap[GameEvent.map];
    constructor() {
        super();
        this.listen(GameEvent.map, (map) => {
            this.map = map;
            console.log('>>> - Extended - listen - map:', map)
        });
    }
    public load(map: GameEventsMap[GameEvent.map]) {
        this.dispatch(GameEvent.map, map);
    }
}

describe('events', () => {
    const extended = new Extended();

    describe('load', () => {
        extended.load([]);
        // A state is loaded, either from the server or from  local storage
        test('A state is loaded', () => {
            expect(extended.name).toBe('Extended');
            expect(extended.map?.length).toBe(1);

        });
    });
});
