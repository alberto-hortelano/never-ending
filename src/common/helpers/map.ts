import type { IState, ICoord, ICharacter, ICell } from "../interfaces";
import type { DeepReadonly } from "./types";

export const getNeighbors = (pos: ICoord): ICoord[] => [
    { x: pos.x, y: pos.y - 1 }, // up
    { x: pos.x, y: pos.y + 1 }, // down
    { x: pos.x - 1, y: pos.y }, // left
    { x: pos.x + 1, y: pos.y }  // right
];

const isValidCell = (pos: ICoord, map: DeepReadonly<IState['map']>): boolean => {
    const mapHeight = map.length;
    const mapWidth = map[0]?.length || 0;

    if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) {
        return false;
    }

    const cell = map[pos.y]?.[pos.x];
    return !cell?.content?.blocker;
};

const coordToKey = (pos: ICoord): string => `${pos.x},${pos.y}`;

export const getReachableCells = (start: ICoord, range: number, map: DeepReadonly<IState['map']>): ICoord[] => {
    const reachable: ICoord[] = [];
    const visited = new Set<string>();
    const queue: { pos: ICoord; distance: number }[] = [{ pos: start, distance: 0 }];

    while (queue.length > 0) {
        const { pos, distance } = queue.shift()!;
        const key = coordToKey(pos);

        if (visited.has(key) || distance > range) continue;
        visited.add(key);

        if (distance > 0) reachable.push(pos);

        if (distance < range) {
            for (const neighbor of getNeighbors(pos)) {
                if (isValidCell(neighbor, map)) {
                    queue.push({ pos: neighbor, distance: distance + 1 });
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

    while (queue.length > 0) {
        const { pos, path } = queue.shift()!;
        const key = coordToKey(pos);

        if (visited.has(key)) continue;
        visited.add(key);

        if (pos.x === destination.x && pos.y === destination.y) {
            return path;
        }

        for (const neighbor of getNeighbors(pos)) {
            if (isValidCell(neighbor, map)) {
                queue.push({
                    pos: neighbor,
                    path: [...path, neighbor]
                });
            }
        }
    }

    return [];
};

export const positionCharacters = (characters: ICharacter[], map: DeepReadonly<IState['map']>): ICharacter[] => {
    const positionedCharacters: ICharacter[] = [];
    
    for (const character of characters) {
        // Find all cells that belong to the character's location
        const candidateCells = map.reduce(
            (cells, row) => cells.concat(
                row.filter(
                    cell => cell.locations.includes(character.location)
                )
            ), [] as DeepReadonly<ICell>[]
        );
        
        // Filter out cells already occupied by positioned characters
        const availableCells = candidateCells.filter(
            cell => !positionedCharacters.some(
                char => char.position.x === cell.position.x && char.position.y === cell.position.y
            )
        );
        
        if (availableCells.length > 0) {
            // Pick a random available cell
            const cell = availableCells[Math.floor(Math.random() * availableCells.length)];
            if (cell) {
                const positionedCharacter = { ...character, path: [cell.position], position: cell.position };
                positionedCharacters.push(positionedCharacter);
            } else {
                // Fallback to original position
                positionedCharacters.push(character);
            }
        } else {
            // No available cells in the location, use original position
            positionedCharacters.push(character);
        }
    }
    
    return positionedCharacters;
};
