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

    private static getDirectionData(direction: Direction): DirectionData | undefined {
        return this.DIRECTION_DATA.find(d => d.direction === direction);
    }

    public static getOppositeDirection(direction: Direction): Direction {
        return this.OPPOSITE_DIRECTIONS[direction];
    }

    private static getAngleForDirection(direction: Direction): number {
        const data = this.getDirectionData(direction);
        return data ? data.angle : 0;
    }

    private static getDirectionFromAngle(angle: number): Direction {
        // Normalize angle to 0-360
        angle = ((angle % 360) + 360) % 360;
        
        // Find closest direction
        let closestDirection: Direction = 'down';
        let minDiff = 360;
        
        for (const data of this.DIRECTION_DATA) {
            const diff = Math.min(
                Math.abs(angle - data.angle),
                Math.abs(angle - data.angle + 360),
                Math.abs(angle - data.angle - 360)
            );
            
            if (diff < minDiff) {
                minDiff = diff;
                closestDirection = data.direction;
            }
        }
        
        return closestDirection;
    }

}