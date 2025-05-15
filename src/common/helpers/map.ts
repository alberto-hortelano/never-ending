import type { IState, ICell, IRow } from "../interfaces";

export const getTopBorder = (map: IState['map']): IRow => map[0] || [];
export const getRightBorder = (map: IState['map']): IRow => map.map(row => row[0]).filter(cell => !!cell);
export const getBottomBorder = (map: IState['map']): IRow => map[map.length - 1] || [];
export const getLeftBorder = (map: IState['map']): IRow => map.map(row => row[row.length - 1]).filter(cell => !!cell);
export const getBorders = (map: IState['map']): IRow => {
    if (map.length === 0) {
        return [];
    }
    return [...new Set([
        ...getTopBorder(map),
        ...getRightBorder(map),
        ...getBottomBorder(map),
        ...getLeftBorder(map),
    ])];
};
export const fillMap = (width: number, height: number): IState['map'] => {
    return Array(height).fill(null).map((_, y) => Array(width).fill(null).map((_, x) => ({
        position: { x, y },
        locations: [],
        elements: [],
        content: null,
    })));
};
export const setWalls = (map: IState['map'], wallPositions: ICell['position'][]) => {
    wallPositions.forEach(wallPosition => {
        const cell = map[wallPosition.y]?.[wallPosition.x];
        if (!cell) {
            throw new Error(`No cell at ${wallPosition}`);
        }
        const wall = {
            cell,
            location: '',
            blocker: true,
        }
        cell.content = wall;
    });
};
