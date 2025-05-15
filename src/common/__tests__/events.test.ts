import { EventsMap, BaseEvent, EventBus } from '../events';


class Extended extends EventBus {
    public name = 'Extended';
    public map?: EventsMap[BaseEvent.map];
    constructor() {
        super();
        this.listen(BaseEvent.map, (map) => {
            this.map = map;
            console.log('>>> - Extended - listen - map:', map)
        });
    }
    public load(map: EventsMap[BaseEvent.map]) {
        this.dispatch(BaseEvent.map, map);
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
