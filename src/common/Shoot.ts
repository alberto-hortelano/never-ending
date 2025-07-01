import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, ICell, Direction } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
} from "./events";

export interface VisibleCell {
    coord: ICoord;
    intensity: number; // 0-1, where 1 is fully visible
}

export class Shoot extends EventBus<
    GUIEventsMap & ControlsEventsMap & StateChangeEventsMap,
    GUIEventsMap & ControlsEventsMap
> {
    private shootingCharacter?: DeepReadonly<ICharacter>;
    private visibleCells?: VisibleCell[];

    constructor(
        private state: State,
    ) {
        super();
        this.listen(ControlsEvent.showShooting, characterName => this.onShowShooting(characterName));
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
    }

    // Listeners
    private onShowShooting(characterName: ControlsEventsMap[ControlsEvent.showShooting]) {
        const character = this.state.findCharacter(characterName);
        if (character) {
            this.showShootingRange(character);
        }
    }

    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (this.shootingCharacter && this.visibleCells?.find(vc => vc.coord.x === position.x && vc.coord.y === position.y)) {
            // TODO: Implement shooting logic
            this.clearShootingHighlights();
        }
    }

    // Helpers
    private showShootingRange(character: DeepReadonly<ICharacter>) {
        const range = 10; // Default weapon range
        const angleOfVision = 90; // Default field of vision

        this.shootingCharacter = character;
        this.visibleCells = this.calculateVisibleCells(
            this.state.map,
            character.position,
            character.direction,
            range,
            angleOfVision
        );

        // Highlight visible cells with intensity
        this.visibleCells.forEach(vc => {
            this.dispatch(GUIEvent.cellHighlightIntensity, { coord: vc.coord, intensity: vc.intensity }, JSON.stringify(vc.coord));
        });
    }

    private clearShootingHighlights() {
        if (this.visibleCells) {
            this.visibleCells.forEach(vc => {
                this.dispatch(GUIEvent.cellReset, vc.coord);
            });
            this.visibleCells = undefined;
            this.shootingCharacter = undefined;
        }
    }

    public calculateVisibleCells(
        map: DeepReadonly<ICell[][]>,
        position: ICoord,
        direction: Direction,
        range: number,
        angleOfVision: number = 90
    ): VisibleCell[] {
        const visibleCells: VisibleCell[] = [];
        const halfAngle = angleOfVision / 2;
        const directionAngles: Record<Direction, number> = {
            'up': -90,
            'right': 0,
            'down': 90,
            'left': 180
        };

        const baseAngle = directionAngles[direction];

        // Check each cell within range
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[0]!.length; x++) {
                const targetCoord = { x, y };
                const distance = this.getDistance(position, targetCoord);

                if (distance <= range && distance > 0) {
                    // Check if target cell itself is blocked
                    const targetCell = map[y]?.[x];
                    if (targetCell?.content?.blocker) {
                        continue; // Skip blocked cells
                    }

                    // Calculate angle to target
                    const angleToTarget = this.getAngle(position, targetCoord);
                    const relativeAngle = this.normalizeAngle(angleToTarget - baseAngle);

                    // Check if within field of vision
                    if (Math.abs(relativeAngle) <= halfAngle) {
                        // Calculate visibility based on angle and distance
                        const angleVisibility = this.calculateAngleVisibility(relativeAngle, halfAngle);
                        const distanceVisibility = this.calculateDistanceVisibility(distance, range);

                        // Check for obstacles blocking line of sight
                        const hasLineOfSight = this.checkLineOfSight(map, position, targetCoord);

                        if (hasLineOfSight) {
                            const intensity = angleVisibility * distanceVisibility;
                            if (intensity > 0.01) { // Threshold to avoid very dim cells
                                visibleCells.push({
                                    coord: targetCoord,
                                    intensity
                                });
                            }
                        }
                    }
                }
            }
        }

        return visibleCells;
    }

    private getDistance(from: ICoord, to: ICoord): number {
        return Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    }

    private getAngle(from: ICoord, to: ICoord): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    private normalizeAngle(angle: number): number {
        // Normalize angle to [-180, 180]
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    private calculateAngleVisibility(relativeAngle: number, halfAngle: number): number {
        // Full visibility at center, decreasing towards edges
        const edgeDistance = Math.abs(relativeAngle) / halfAngle;
        return Math.max(0, 1 - edgeDistance);
    }

    private calculateDistanceVisibility(distance: number, maxRange: number): number {
        // Linear falloff for now, could be quadratic
        return Math.max(0, 1 - (distance / maxRange));
    }

    private checkLineOfSight(map: DeepReadonly<ICell[][]>, from: ICoord, to: ICoord): boolean {
        // Bresenham's line algorithm to check for obstacles
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = from.x;
        let y = from.y;

        while (x !== to.x || y !== to.y) {
            // Skip the starting position
            if (x !== from.x || y !== from.y) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Obstacle blocks line of sight
                }
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true;
    }
}