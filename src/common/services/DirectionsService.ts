import { Direction } from "../interfaces";

export interface DirectionData {
    direction: Direction;
    label: string;
    position: string;
    angle: number;
}

export class DirectionsService {
    private static readonly DIRECTION_DATA: DirectionData[] = [
        { direction: 'up', label: '↑', position: 'top', angle: 180 },
        { direction: 'up-right', label: '↗', position: 'top-right', angle: 135 },
        { direction: 'right', label: '→', position: 'right', angle: 90 },
        { direction: 'down-right', label: '↘', position: 'bottom-right', angle: 45 },
        { direction: 'down', label: '↓', position: 'bottom', angle: 0 },
        { direction: 'down-left', label: '↙', position: 'bottom-left', angle: 315 },
        { direction: 'left', label: '←', position: 'left', angle: 270 },
        { direction: 'up-left', label: '↖', position: 'top-left', angle: 225 }
    ];

    private static readonly OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
        'up': 'down',
        'up-right': 'down-left',
        'right': 'left',
        'down-right': 'up-left',
        'down': 'up',
        'down-left': 'up-right',
        'left': 'right',
        'up-left': 'down-right'
    };

    public static getAllDirections(): DirectionData[] {
        return [...this.DIRECTION_DATA];
    }


    public static getOppositeDirection(direction: Direction): Direction {
        return this.OPPOSITE_DIRECTIONS[direction];
    }


}