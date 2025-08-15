import { DoorService } from '../services/DoorService';
import type { ICharacter, IDoor, ICell } from '../interfaces';

describe('DoorService', () => {
    let doorService: DoorService;
    
    beforeEach(() => {
        doorService = DoorService.getInstance();
    });
    
    describe('Door Creation', () => {
        it('should create a regular door between two rooms', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            
            expect(door.type).toBe('regular');
            expect(door.position).toEqual({ x: 10, y: 10 });
            expect(door.targetPosition).toEqual({ x: 10, y: 11 });
            expect(door.isOpen).toBe(true);
            expect(door.isLocked).toBe(false);
            expect(door.keyRequired).toBeUndefined();
        });
        
        it('should create a locked door requiring a key', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 5, y: 5 },
                { x: 6, y: 5 },
                true
            );
            
            expect(door.type).toBe('locked');
            expect(door.isOpen).toBe(false);
            expect(door.isLocked).toBe(true);
            expect(door.keyRequired).toBeDefined();
        });
        
        it('should create a transition door', () => {
            const door = doorService.createTransitionDoor(
                { x: 0, y: 10 },
                'west',
                'Exit to the wasteland',
                'wasteland_map'
            );
            
            expect(door.type).toBe('transition');
            expect(door.side).toBe('west');
            expect(door.transition).toBeDefined();
            expect(door.transition?.description).toBe('Exit to the wasteland');
            expect(door.transition?.targetMap).toBe('wasteland_map');
            expect(door.transition?.actionRequest).toBe('generate_new_map');
        });
    });
    
    describe('Door Interaction', () => {
        it('should allow opening an unlocked door', () => {
            const doors: Record<string, IDoor> = {};
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            door.isOpen = false; // Close it first
            doors[door.id] = door;
            
            const character = {
                name: 'TestChar',
                position: { x: 10, y: 10 },
                inventory: { items: [], maxWeight: 50, equippedWeapons: { primary: null, secondary: null } }
            } as any as ICharacter;
            
            const canOpen = doorService.canOpenDoor(door, character);
            expect(canOpen).toBe(true);
        });
        
        it('should prevent opening a locked door without key', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 5, y: 5 },
                { x: 6, y: 5 },
                true
            );
            
            const character = {
                name: 'TestChar',
                position: { x: 5, y: 5 },
                inventory: { items: [], maxWeight: 50, equippedWeapons: { primary: null, secondary: null } }
            } as any as ICharacter;
            
            const canOpen = doorService.canOpenDoor(door, character);
            expect(canOpen).toBe(false);
        });
        
        it('should allow opening a locked door with correct key', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 5, y: 5 },
                { x: 6, y: 5 },
                true
            );
            
            const character = {
                name: 'TestChar',
                position: { x: 5, y: 5 },
                inventory: { 
                    items: [{ 
                        id: door.keyRequired!, 
                        name: 'Key',
                        description: 'A key',
                        weight: 0.1,
                        cost: 0,
                        icon: '🔑',
                        type: 'misc'
                    }], 
                    maxWeight: 50, 
                    equippedWeapons: { primary: null, secondary: null } 
                }
            } as any as ICharacter;
            
            const canOpen = doorService.canOpenDoor(door, character);
            expect(canOpen).toBe(true);
        });
    });
    
    describe('Movement Blocking', () => {
        it('should block movement through a closed door', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            door.isOpen = false;
            door.side = 'south';
            
            const doors: Record<string, IDoor> = { [door.id]: door };
            
            const isBlocked = doorService.isDoorBlocking(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                doors
            );
            
            expect(isBlocked).toBe(true);
        });
        
        it('should allow movement through an open door', () => {
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            door.isOpen = true;
            door.side = 'south';
            
            const doors: Record<string, IDoor> = { [door.id]: door };
            
            const isBlocked = doorService.isDoorBlocking(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                doors
            );
            
            expect(isBlocked).toBe(false);
        });
        
        it('should detect doors at specific positions', () => {
            const door1 = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            const door2 = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 11, y: 10 },
                false
            );
            const door3 = doorService.createDoorBetweenRooms(
                { x: 5, y: 5 },
                { x: 5, y: 6 },
                false
            );
            
            const doors: Record<string, IDoor> = {
                [door1.id]: door1,
                [door2.id]: door2,
                [door3.id]: door3
            };
            
            const doorsAtPosition = doorService.findDoorsAtPosition({ x: 10, y: 10 }, doors);
            expect(doorsAtPosition).toHaveLength(2);
            expect(doorsAtPosition).toContain(door1);
            expect(doorsAtPosition).toContain(door2);
            expect(doorsAtPosition).not.toContain(door3);
        });
    });
    
    describe('Accessible Cells', () => {
        it('should return accessible adjacent cells through open doors', () => {
            const map: ICell[][] = Array(20).fill(null).map((_, y) => 
                Array(20).fill(null).map((_, x) => ({
                    position: { x, y },
                    locations: [],
                    elements: [],
                    content: null
                }))
            );
            
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            door.isOpen = true;
            door.side = 'south';
            
            const doors: Record<string, IDoor> = { [door.id]: door };
            
            const accessible = doorService.getAccessibleAdjacentCells(
                { x: 10, y: 10 },
                map,
                doors
            );
            
            // Should include all 4 adjacent cells since door is open
            expect(accessible).toHaveLength(4);
            expect(accessible).toContainEqual({ x: 10, y: 9 });  // north
            expect(accessible).toContainEqual({ x: 10, y: 11 }); // south (through open door)
            expect(accessible).toContainEqual({ x: 11, y: 10 }); // east
            expect(accessible).toContainEqual({ x: 9, y: 10 });  // west
        });
        
        it('should block access through closed doors', () => {
            const map: ICell[][] = Array(20).fill(null).map((_, y) => 
                Array(20).fill(null).map((_, x) => ({
                    position: { x, y },
                    locations: [],
                    elements: [],
                    content: null
                }))
            );
            
            const door = doorService.createDoorBetweenRooms(
                { x: 10, y: 10 },
                { x: 10, y: 11 },
                false
            );
            door.isOpen = false;
            door.side = 'south';
            
            const doors: Record<string, IDoor> = { [door.id]: door };
            
            const accessible = doorService.getAccessibleAdjacentCells(
                { x: 10, y: 10 },
                map,
                doors
            );
            
            // Should exclude south cell due to closed door
            expect(accessible).toHaveLength(3);
            expect(accessible).toContainEqual({ x: 10, y: 9 });  // north
            expect(accessible).not.toContainEqual({ x: 10, y: 11 }); // south (blocked)
            expect(accessible).toContainEqual({ x: 11, y: 10 }); // east
            expect(accessible).toContainEqual({ x: 9, y: 10 });  // west
        });
    });
});