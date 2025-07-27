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

    public static getDirectionFromAngle(angle: number): Direction {
        // Convert from Math.atan2 range (-180 to 180) to 0-360
        let normalizedAngle = angle;
        if (normalizedAngle < 0) {
            normalizedAngle += 360;
        }

        console.log('[DirectionsService] getDirectionFromAngle - Input angle:', angle, 'Normalized:', normalizedAngle);

        // Define angle ranges for each direction
        // Math.atan2 returns: right=0°, down=90°, left=180°/-180°, up=-90°
        // After normalization: right=0°, down=90°, left=180°, up=270°
        let direction: Direction;
        if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
            direction = 'right';
        } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
            direction = 'down-right';
        } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
            direction = 'down';
        } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
            direction = 'down-left';
        } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
            direction = 'left';
        } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
            direction = 'up-left';
        } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
            direction = 'up';
        } else {
            direction = 'up-right';
        }
        
        console.log('[DirectionsService] getDirectionFromAngle - Output direction:', direction);
        return direction;
    }

}