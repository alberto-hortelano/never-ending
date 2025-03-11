import { Cell } from "../../common/interfaces.js";

export const spaceShipMap = `
###############
###############
###############
####┏━━╌━━┓####
#┏━━┛     ┗━━┓#
#┃           ┃#
#┃  ┏━━╌━━┓  ┃#
#┃  ┃     ┃  ┃#
#┃  ┃  =  ┃  ┃#
#┃  ┃     ┃  ┃#
#┣━╌┻━━┳━━┻╌━┫#
#┃     ┃     ┃#
#┃     ┃     ┃#
#┃     ┃     ┃#
#┗━━━━━┻━━━━━┛#
###############
`;
export const spaceShip: Cell[][] = spaceShipMap.split('\n').filter(line => line.length > 0).map(line => line.split('').map(cell => ({ symbol: cell })));

// Mark walkable areas
for (let y = 0; y < spaceShip.length; y++) {
    const row = spaceShip[y];
    if (!row) {
        continue;
    }
    for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        if (!cell) {
            continue;
        }
        if (cell.symbol === ' ') {
            // Add position to each cell for easier debugging
            cell.position = { x, y };
        }
    }
}
const setElement = (y: number, x: number, value: string[]) => {
    const row = spaceShip[y];
    if (!row) {
        return;
    }
    const cell = row[x];
    if (!cell) {
        return;
    }
    cell.location = value;
}
// Add named locations to the map for character spawning
// Control room (center area with "=")
// Original locations
setElement(8, 7, ['control room']);
setElement(8, 8, ['control room']);
setElement(8, 9, ['control room']); // = symbol
setElement(8, 10, ['control room']);
setElement(9, 7, ['control room']);
setElement(9, 8, ['control room']); // Empty space
setElement(9, 9, ['control room']); // Empty space
setElement(9, 10, ['control room']);
setElement(10, 7, ['control room']);
setElement(10, 8, ['control room']);
setElement(10, 9, ['control room']);
setElement(10, 10, ['control room']);

// Adding more locations in adjacent empty spaces
// This ensures the player has empty spaces to spawn in
setElement(7, 8, ['control room']);
setElement(7, 9, ['control room']);
setElement(7, 10, ['control room']);
setElement(8, 6, ['control room']);
setElement(9, 6, ['control room']);
setElement(10, 6, ['control room']);
setElement(11, 8, ['control room']);
setElement(11, 9, ['control room']);
setElement(11, 10, ['control room']);

// Living area (bottom of ship)
setElement(12, 3, ['spaceship']);
setElement(12, 4, ['spaceship']);
setElement(12, 5, ['spaceship']);
setElement(12, 6, ['spaceship']);
setElement(12, 7, ['spaceship']);
setElement(12, 8, ['spaceship']);
setElement(12, 9, ['spaceship']);
setElement(12, 10, ['spaceship']);
setElement(12, 11, ['spaceship']);
