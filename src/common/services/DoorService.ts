import type { ICharacter, ICoord, IDoor, ICell, DoorSide, IInventory } from '../interfaces';
import { EventBus, UpdateStateEventsMap, UpdateStateEvent } from '../events';

export class DoorService extends EventBus<UpdateStateEventsMap, UpdateStateEventsMap> {
    private static instance: DoorService;
    
    private constructor() {
        super();
    }
    
    public static getInstance(): DoorService {
        if (!DoorService.instance) {
            DoorService.instance = new DoorService();
        }
        return DoorService.instance;
    }
    
    /**
     * Check if a character can open a specific door
     */
    public canOpenDoor(door: IDoor, character: ICharacter): boolean {
        // Door is already open
        if (door.isOpen) {
            return true;
        }
        
        // Door is locked and requires a key
        if (door.isLocked && door.keyRequired) {
            return this.hasKey(character.inventory, door.keyRequired);
        }
        
        // Door is unlocked or doesn't require a key
        return !door.isLocked;
    }
    
    /**
     * Check if inventory contains a specific key
     */
    private hasKey(inventory: IInventory, keyId: string): boolean {
        return inventory.items.some(item => item.id === keyId);
    }
    
    /**
     * Open a door and trigger associated events
     */
    public openDoor(doorId: string, doors: Record<string, IDoor>, character?: ICharacter): boolean {
        const door = doors[doorId];
        if (!door) {
            console.error(`[DoorService] Door ${doorId} not found`);
            return false;
        }
        
        // Check if character can open the door
        if (character && !this.canOpenDoor(door, character)) {
            console.log(`[DoorService] Character ${character.name} cannot open door ${doorId}`);
            return false;
        }
        
        // Use the key if required
        if (door.isLocked && door.keyRequired && character) {
            this.consumeKey(character, door.keyRequired);
        }
        
        // Update door state
        const updatedDoor = { ...door, isOpen: true, isLocked: false };
        const updatedDoors = { ...doors, [doorId]: updatedDoor };
        
        // Dispatch state update
        this.dispatch(UpdateStateEvent.doors, updatedDoors);
        
        // Trigger transition if this is a transition door
        if (door.type === 'transition' && door.transition) {
            this.triggerTransition(door);
        }
        
        return true;
    }
    
    /**
     * Remove a key from character's inventory after use
     */
    private consumeKey(character: ICharacter, keyId: string): void {
        const updatedItems = character.inventory.items.filter(item => item.id !== keyId);
        const updatedInventory = { ...character.inventory, items: updatedItems };
        const updatedCharacter = { ...character, inventory: updatedInventory };
        
        // Dispatch character update
        this.dispatch(UpdateStateEvent.addCharacter, updatedCharacter);
    }
    
    /**
     * Trigger a transition event for exit doors
     */
    private triggerTransition(door: IDoor): void {
        if (!door.transition) return;
        
        console.log(`[DoorService] Triggering transition: ${door.transition.description}`);
        
        // Dispatch narrative event if configured
        if (door.transition.narrativeEvent) {
            this.dispatch(UpdateStateEvent.updateMessages, [{
                role: 'assistant',
                content: door.transition.narrativeEvent.content
            }]);
        }
        
        // Request new map generation from AI if configured
        if (door.transition.actionRequest) {
            // This would trigger AI to generate a new map
            console.log(`[DoorService] Requesting action: ${door.transition.actionRequest}`);
            // Implementation would connect to AIGameEngineService
        }
    }
    
    /**
     * Lock a door
     */
    public lockDoor(doorId: string, doors: Record<string, IDoor>): boolean {
        const door = doors[doorId];
        if (!door) {
            console.error(`[DoorService] Door ${doorId} not found`);
            return false;
        }
        
        const updatedDoor = { ...door, isOpen: false, isLocked: true };
        const updatedDoors = { ...doors, [doorId]: updatedDoor };
        
        this.dispatch(UpdateStateEvent.doors, updatedDoors);
        return true;
    }
    
    /**
     * Find all doors at a specific position
     */
    public findDoorsAtPosition(position: ICoord, doors: Record<string, IDoor>): IDoor[] {
        return Object.values(doors).filter(door => 
            door.position.x === position.x && door.position.y === position.y
        );
    }
    
    /**
     * Check if a door blocks movement between two cells
     */
    public isDoorBlocking(from: ICoord, to: ICoord, doors: Record<string, IDoor>): boolean {
        // Find doors at both positions
        const fromDoors = this.findDoorsAtPosition(from, doors);
        const toDoors = this.findDoorsAtPosition(to, doors);
        
        // Check if any door blocks this specific movement
        const direction = this.getDirection(from, to);
        const oppositeDirection = this.getOppositeDirection(direction);
        
        // Check doors at 'from' position
        for (const door of fromDoors) {
            if (door.side === direction && !door.isOpen) {
                return true;
            }
            // Check 'between' doors that connect these cells
            if (door.side === 'between' && door.targetPosition) {
                if (door.targetPosition.x === to.x && door.targetPosition.y === to.y && !door.isOpen) {
                    return true;
                }
            }
        }
        
        // Check doors at 'to' position
        for (const door of toDoors) {
            if (door.side === oppositeDirection && !door.isOpen) {
                return true;
            }
            // Check 'between' doors from the other side
            if (door.side === 'between' && door.targetPosition) {
                if (door.targetPosition.x === from.x && door.targetPosition.y === from.y && !door.isOpen) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Get the direction from one cell to another (adjacent cells only)
     */
    private getDirection(from: ICoord, to: ICoord): DoorSide {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        
        if (dx === 0 && dy === -1) return 'north';
        if (dx === 0 && dy === 1) return 'south';
        if (dx === 1 && dy === 0) return 'east';
        if (dx === -1 && dy === 0) return 'west';
        
        return 'between'; // Non-adjacent or diagonal
    }
    
    /**
     * Get the opposite direction
     */
    private getOppositeDirection(direction: DoorSide): DoorSide {
        switch (direction) {
            case 'north': return 'south';
            case 'south': return 'north';
            case 'east': return 'west';
            case 'west': return 'east';
            default: return 'between';
        }
    }
    
    /**
     * Create a door between two rooms during map generation
     */
    public createDoorBetweenRooms(cell1: ICoord, cell2: ICoord, isLocked: boolean = false): IDoor {
        const doorId = `door_${cell1.x}_${cell1.y}_${cell2.x}_${cell2.y}`;
        const direction = this.getDirection(cell1, cell2);
        
        return {
            id: doorId,
            type: isLocked ? 'locked' : 'regular',
            position: cell1,
            side: direction === 'between' ? 'between' : direction,
            targetPosition: cell2,
            isOpen: !isLocked,
            isLocked: isLocked,
            keyRequired: isLocked ? `key_${doorId}` : undefined
        };
    }
    
    /**
     * Create a transition door (exit to another map)
     */
    public createTransitionDoor(
        position: ICoord, 
        side: DoorSide, 
        description: string,
        targetMap?: string
    ): IDoor {
        const doorId = `transition_${position.x}_${position.y}_${side}`;
        
        return {
            id: doorId,
            type: 'transition',
            position: position,
            side: side,
            isOpen: false,
            isLocked: false,
            transition: {
                description: description,
                targetMap: targetMap,
                actionRequest: 'generate_new_map'
            }
        };
    }
    
    /**
     * Get adjacent cells that are accessible through doors
     */
    public getAccessibleAdjacentCells(
        position: ICoord, 
        map: ICell[][], 
        doors: Record<string, IDoor>
    ): ICoord[] {
        const accessible: ICoord[] = [];
        const directions = [
            { dx: 0, dy: -1, side: 'north' as DoorSide },
            { dx: 0, dy: 1, side: 'south' as DoorSide },
            { dx: 1, dy: 0, side: 'east' as DoorSide },
            { dx: -1, dy: 0, side: 'west' as DoorSide }
        ];
        
        for (const dir of directions) {
            const nextPos = { x: position.x + dir.dx, y: position.y + dir.dy };
            
            // Check map bounds
            if (nextPos.x < 0 || (map[0] && nextPos.x >= map[0].length) || 
                nextPos.y < 0 || nextPos.y >= map.length) {
                continue;
            }
            
            // Check if movement is blocked by door
            if (!this.isDoorBlocking(position, nextPos, doors)) {
                accessible.push(nextPos);
            }
        }
        
        return accessible;
    }
}