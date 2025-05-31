import type { IState, ICell, IRow, ICoord } from "../interfaces";
import type { DeepReadonly } from "./types";

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
            position: cell.position,
            location: '',
            blocker: true,
        }
        cell.content = wall;
    });
};

export const getReachableCells = (start: ICoord, range: number, map: DeepReadonly<IState['map']>): ICoord[] => {
    const reachable: ICoord[] = [];
    const visited = new Set<string>();
    const queue: { pos: ICoord; distance: number }[] = [{ pos: start, distance: 0 }];

    while (queue.length > 0) {
        const { pos, distance } = queue.shift()!;
        const key = `${pos.x},${pos.y}`;

        if (visited.has(key) || distance > range) continue;
        visited.add(key);

        if (distance > 0) reachable.push(pos);

        if (distance < range) {
            const neighbors = [
                { x: pos.x, y: pos.y - 1 }, // up
                { x: pos.x, y: pos.y + 1 }, // down
                { x: pos.x - 1, y: pos.y }, // left
                { x: pos.x + 1, y: pos.y }  // right
            ];

            const mapLength = map[0]?.length || 0

            for (const neighbor of neighbors) {
                if (neighbor.x >= 0 && neighbor.x < mapLength &&
                    neighbor.y >= 0 && neighbor.y < map.length) {
                    const cell = map[neighbor.y]?.[neighbor.x];
                    if (!cell?.content?.blocker) {
                        queue.push({ pos: neighbor, distance: distance + 1 });
                    }
                }
            }
        }
    }

    return reachable;
};

export const calculatePath = (start: ICoord, destination: ICoord, map: DeepReadonly<IState['map']>): ICoord[] => {
    if (start.x === destination.x && start.y === destination.y) {
        return [];
    }

    const visited = new Set<string>();
    const queue: { pos: ICoord; path: ICoord[] }[] = [{ pos: start, path: [] }];
    const mapHeight = map.length;
    const mapWidth = map[0]?.length || 0;

    while (queue.length > 0) {
        const { pos, path } = queue.shift()!;
        const key = `${pos.x},${pos.y}`;

        if (visited.has(key)) continue;
        visited.add(key);

        if (pos.x === destination.x && pos.y === destination.y) {
            return path;
        }

        const neighbors = [
            { x: pos.x, y: pos.y - 1 }, // up
            { x: pos.x, y: pos.y + 1 }, // down
            { x: pos.x - 1, y: pos.y }, // left
            { x: pos.x + 1, y: pos.y }  // right
        ];

        for (const neighbor of neighbors) {
            if (neighbor.x >= 0 && neighbor.x < mapWidth &&
                neighbor.y >= 0 && neighbor.y < mapHeight) {
                const cell = map[neighbor.y]?.[neighbor.x];
                if (!cell?.content?.blocker) {
                    queue.push({
                        pos: neighbor,
                        path: [...path, neighbor]
                    });
                }
            }
        }
    }

    return [];
};
