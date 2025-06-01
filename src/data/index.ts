import { initialState } from "./state";

export const miniState = initialState(4, 4, { position: { x: 1, y: 2 } });
export const baseState = initialState(20, 30, { name: 'player', position: { x: 4, y: 5 } });
