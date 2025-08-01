import { Direction, ICoord } from "../interfaces";

export interface DirectionData {
    direction: Direction;
    label: string;
    position: string;
    angle: number;
}

export class DirectionsService {
    // Standardized angle system: right=0°, angles increase counter-clockwise
    private static readonly DIRECTION_DATA: DirectionData[] = [
        { direction: 'right', label: '→', position: 'right', angle: 0 },
        { direction: 'down-right', label: '↘', position: 'bottom-right', angle: 45 },
        { direction: 'down', label: '↓', position: 'bottom', angle: 90 },
        { direction: 'down-left', label: '↙', position: 'bottom-left', angle: 135 },
        { direction: 'left', label: '←', position: 'left', angle: 180 },
        { direction: 'up-left', label: '↖', position: 'top-left', angle: 225 },
        { direction: 'up', label: '↑', position: 'top', angle: 270 },
        { direction: 'up-right', label: '↗', position: 'top-right', angle: 315 }
    ];
    
    // CSS rotation classes for character sprites
    private static readonly ROTATION_CLASSES: Record<Direction, string> = {
        'down': 'rotate-0',
        'down-right': 'rotate-45',
        'right': 'rotate-90',
        'up-right': 'rotate-135',
        'up': 'rotate-180',
        'up-left': 'rotate-225',
        'left': 'rotate-270',
        'down-left': 'rotate-315'
    };
    
    // Angle mappings for shooting calculations (matches Math.atan2 output)
    private static readonly DIRECTION_ANGLES: Record<Direction, number> = {
        'right': 0,
        'down-right': 45,
        'down': 90,
        'down-left': 135,
        'left': 180,
        'up-left': -135,
        'up': -90,
        'up-right': -45
    };

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
    
    public static getAllDirectionValues(): Direction[] {
        return this.DIRECTION_DATA.map(d => d.direction);
    }
    
    public static getDirectionAngle(direction: Direction): number {
        return this.DIRECTION_ANGLES[direction];
    }
    
    public static getRotationClass(direction: Direction): string {
        return this.ROTATION_CLASSES[direction];
    }
    
    public static calculateDirection(from: ICoord, to: ICoord): Direction {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        
        // Calculate direction including diagonals
        if (dx > 0 && dy > 0) return 'down-right';
        else if (dx > 0 && dy < 0) return 'up-right';
        else if (dx < 0 && dy > 0) return 'down-left';
        else if (dx < 0 && dy < 0) return 'up-left';
        else if (dx > 0) return 'right';
        else if (dx < 0) return 'left';
        else if (dy > 0) return 'down';
        else if (dy < 0) return 'up';
        
        return 'down'; // Default direction
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
        
        return direction;
    }

}