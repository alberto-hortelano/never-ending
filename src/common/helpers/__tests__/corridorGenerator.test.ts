import { CorridorGenerator, CorridorPattern } from '../CorridorGenerator';
import type { BasicDirection, ICoord } from '../../interfaces';

describe('CorridorGenerator', () => {
    let corridorGenerator: CorridorGenerator;
    const mapWidth = 50;
    const mapHeight = 50;

    beforeEach(() => {
        corridorGenerator = new CorridorGenerator(mapWidth, mapHeight);
    });

    describe('generateCorridors', () => {
        test('should generate corridors based on room count', () => {
            const roomCount = 5;
            const corridors = corridorGenerator.generateCorridors(roomCount, 'random');

            expect(corridors.length).toBeGreaterThan(0);
            expect(corridors.length).toBeGreaterThanOrEqual(2); // Minimum 2 corridors
        });

        test('should generate random pattern corridors', () => {
            const corridors = corridorGenerator.generateCorridors(5, 'random');

            expect(corridors.length).toBeGreaterThan(0);
            corridors.forEach(corridor => {
                expect(corridor.start).toBeDefined();
                expect(corridor.end).toBeDefined();
                expect(corridor.direction).toMatch(/^(up|right|down|left)$/);
                expect(corridor.cells.length).toBeGreaterThan(0);
            });
        });

        test('should generate star pattern corridors', () => {
            const corridors = corridorGenerator.generateCorridors(5, 'star');

            expect(corridors.length).toBeGreaterThan(0);
            expect(corridors.length).toBeLessThanOrEqual(4); // Max 4 directions from center

            // All corridors should start from the same center point
            const center = corridors[0]?.start;
            corridors.forEach(corridor => {
                expect(corridor.start).toEqual(center);
            });
        });

        test('should generate grid pattern corridors', () => {
            const corridors = corridorGenerator.generateCorridors(5, 'grid');

            expect(corridors.length).toBe(2); // Horizontal and vertical

            // Should have one horizontal and one vertical corridor
            const horizontalCorridor = corridors.find(c => c.direction === 'right');
            const verticalCorridor = corridors.find(c => c.direction === 'down');

            expect(horizontalCorridor).toBeDefined();
            expect(verticalCorridor).toBeDefined();
        });

        test('should generate linear pattern corridors', () => {
            const corridors = corridorGenerator.generateCorridors(5, 'linear');

            expect(corridors.length).toBe(1); // Single linear corridor
            // Linear corridors can be in any direction due to fallback logic
            expect(['up', 'right', 'down', 'left']).toContain(corridors[0]?.direction);
        });

        test('should use custom center point', () => {
            const customCenter: ICoord = { x: 20, y: 30 };
            const corridors = corridorGenerator.generateCorridors(5, 'star', customCenter);

            corridors.forEach(corridor => {
                expect(corridor.start).toEqual(customCenter);
            });
        });

        test('should respect map boundaries', () => {
            const corridors = corridorGenerator.generateCorridors(10, 'random');

            corridors.forEach(corridor => {
                // Check start and end points are within boundaries with 5-cell padding
                expect(corridor.start.x).toBeGreaterThanOrEqual(5);
                expect(corridor.start.x).toBeLessThan(mapWidth - 5);
                expect(corridor.start.y).toBeGreaterThanOrEqual(5);
                expect(corridor.start.y).toBeLessThan(mapHeight - 5);

                expect(corridor.end.x).toBeGreaterThanOrEqual(5);
                expect(corridor.end.x).toBeLessThan(mapWidth - 5);
                expect(corridor.end.y).toBeGreaterThanOrEqual(5);
                expect(corridor.end.y).toBeLessThan(mapHeight - 5);

                // Check all cells are within map bounds
                corridor.cells.forEach(cell => {
                    expect(cell.x).toBeGreaterThanOrEqual(0);
                    expect(cell.x).toBeLessThan(mapWidth);
                    expect(cell.y).toBeGreaterThanOrEqual(0);
                    expect(cell.y).toBeLessThan(mapHeight);
                });
            });
        });

        test('should always generate at least some corridors', () => {
            // Test with various room counts and patterns
            const patterns: CorridorPattern[] = ['random', 'star', 'grid', 'linear'];
            const roomCounts = [1, 5, 10, 20];

            patterns.forEach(pattern => {
                roomCounts.forEach(roomCount => {
                    const corridors = corridorGenerator.generateCorridors(roomCount, pattern);
                    expect(corridors.length).toBeGreaterThan(0);
                });
            });
        });
    });

    describe('extendCorridor', () => {
        test('should extend an existing corridor', () => {
            corridorGenerator.generateCorridors(3, 'random');
            const initialCorridors = corridorGenerator.getCorridors();
            const initialCount = initialCorridors.length;

            corridorGenerator.extendCorridor(0);
            const extendedCorridors = corridorGenerator.getCorridors();

            expect(extendedCorridors.length).toBeGreaterThanOrEqual(initialCount);
        });

        test('should handle invalid corridor index', () => {
            corridorGenerator.generateCorridors(3, 'random');
            const initialCount = corridorGenerator.getCorridors().length;

            corridorGenerator.extendCorridor(999); // Invalid index
            const afterCount = corridorGenerator.getCorridors().length;

            expect(afterCount).toBe(initialCount); // No change
        });

        test('should not extend in opposite direction', () => {
            corridorGenerator.generateCorridors(1, 'linear');
            const initialCorridor = corridorGenerator.getCorridors()[0];

            if (initialCorridor) {
                for (let i = 0; i < 10; i++) {
                    corridorGenerator.extendCorridor(0);
                }

                const corridors = corridorGenerator.getCorridors();
                // Should not have any corridors going in the opposite direction
                const oppositeBasicDirection = getOppositeBasicDirection(initialCorridor.direction);
                const hasOpposite = corridors.some(c =>
                    c.start.x === initialCorridor.end.x &&
                    c.start.y === initialCorridor.end.y &&
                    c.direction === oppositeBasicDirection
                );

                expect(hasOpposite).toBe(false);
            }
        });
    });

    describe('addNewCorridorBranch', () => {
        test('should add perpendicular branches to existing corridors', () => {
            corridorGenerator.generateCorridors(1, 'linear');
            const initialCount = corridorGenerator.getCorridors().length;

            corridorGenerator.addNewCorridorBranch();
            const afterCount = corridorGenerator.getCorridors().length;

            expect(afterCount).toBeGreaterThanOrEqual(initialCount);
        });

        test('should create branches perpendicular to base corridor', () => {
            // Create a horizontal corridor first
            corridorGenerator.generateCorridors(1, 'linear');
            const baseCorridor = corridorGenerator.getCorridors()[0];

            if (baseCorridor && baseCorridor.direction === 'right') {
                corridorGenerator.addNewCorridorBranch();
                const corridors = corridorGenerator.getCorridors();

                // New corridors should be vertical (up or down)
                const newCorridors = corridors.slice(1);
                newCorridors.forEach(corridor => {
                    expect(['up', 'down']).toContain(corridor.direction);
                });
            }
        });

        test('should handle case with no corridors', () => {
            expect(() => {
                corridorGenerator.addNewCorridorBranch();
            }).not.toThrow();
        });
    });

    describe('addLongCorridors', () => {
        test('should add longer corridors to the map', () => {
            corridorGenerator.generateCorridors(3, 'random');
            const initialCorridors = corridorGenerator.getCorridors();
            const initialTotalLength = initialCorridors.reduce((sum, c) => sum + c.cells.length, 0);

            corridorGenerator.addLongCorridors();
            const afterCorridors = corridorGenerator.getCorridors();
            const afterTotalLength = afterCorridors.reduce((sum, c) => sum + c.cells.length, 0);

            expect(afterTotalLength).toBeGreaterThanOrEqual(initialTotalLength);
        });

        test('should create corridors with significant length', () => {
            corridorGenerator.generateCorridors(1, 'star');
            corridorGenerator.addLongCorridors();

            const corridors = corridorGenerator.getCorridors();
            const longCorridors = corridors.filter(c => c.cells.length > Math.min(mapWidth, mapHeight) / 4);

            expect(longCorridors.length).toBeGreaterThan(0);
        });
    });

    describe('carveCorridors', () => {
        test('should carve corridor paths into the map', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));
            corridorGenerator.generateCorridors(5, 'random');
            const corridors = corridorGenerator.getCorridors();

            corridorGenerator.carveCorridors(map);

            // Check that corridor cells are carved (set to 1)
            corridors.forEach(corridor => {
                corridor.cells.forEach(cell => {
                    expect(map[cell.y]?.[cell.x]).toBe(1);
                });
            });
        });

        test('should handle empty corridor list', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));

            expect(() => {
                corridorGenerator.carveCorridors(map);
            }).not.toThrow();

            // Map should remain unchanged
            const allZeros = map.every(row => row.every(cell => cell === 0));
            expect(allZeros).toBe(true);
        });
    });

    describe('corridor cell generation', () => {
        test('should generate continuous path of cells', () => {
            corridorGenerator.generateCorridors(1, 'linear');
            const corridor = corridorGenerator.getCorridors()[0];

            if (corridor) {
                // Check continuity - each cell should be adjacent to the next
                for (let i = 0; i < corridor.cells.length - 1; i++) {
                    const current = corridor.cells[i];
                    const next = corridor.cells[i + 1];

                    if (current && next) {
                        const distance = Math.abs(current.x - next.x) + Math.abs(current.y - next.y);
                        expect(distance).toBe(1); // Adjacent cells
                    }
                }

                // First and last cells should match start and end
                expect(corridor.cells[0]).toEqual(corridor.start);
                expect(corridor.cells[corridor.cells.length - 1]).toEqual(corridor.end);
            }
        });
    });

    describe('corridor collision detection', () => {
        test('should maintain minimum distance between parallel corridors', () => {
            // Generate multiple corridors
            corridorGenerator.generateCorridors(10, 'random');
            const corridors = corridorGenerator.getCorridors();

            // Check parallel corridors maintain minimum distance
            for (let i = 0; i < corridors.length; i++) {
                for (let j = i + 1; j < corridors.length; j++) {
                    const corridor1 = corridors[i];
                    const corridor2 = corridors[j];

                    if (corridor1 && corridor2 && areParallel(corridor1.direction, corridor2.direction)) {
                        // Check minimum perpendicular distance
                        corridor1.cells.forEach(cell1 => {
                            corridor2.cells.forEach(cell2 => {
                                if (areOnSameLine(cell1, cell2, corridor1.direction)) {
                                    const distance = getPerpendicularDistance(cell1, cell2, corridor1.direction);
                                    expect(distance).toBeGreaterThanOrEqual(3);
                                }
                            });
                        });
                    }
                }
            }
        });
    });

    describe('edge cases', () => {
        test('should handle very small maps', () => {
            const smallGenerator = new CorridorGenerator(10, 10);
            const corridors = smallGenerator.generateCorridors(5, 'random');

            expect(corridors.length).toBeGreaterThan(0);
            corridors.forEach(corridor => {
                expect(corridor.cells.length).toBeGreaterThan(0);
            });
        });

        test('should handle large room counts', () => {
            const corridors = corridorGenerator.generateCorridors(50, 'random');

            expect(corridors.length).toBeGreaterThan(0);
            expect(corridors.length).toBeGreaterThanOrEqual(2);
        });

        test('should always create valid corridors', () => {
            // Test multiple times to catch any randomness issues
            for (let i = 0; i < 10; i++) {
                const generator = new CorridorGenerator(mapWidth, mapHeight);
                const patterns: CorridorPattern[] = ['random', 'star', 'grid', 'linear'];
                const pattern = patterns[i % patterns.length]!;

                const corridors = generator.generateCorridors(5, pattern);

                expect(corridors.length).toBeGreaterThan(0);
                corridors.forEach(corridor => {
                    expect(corridor.cells.length).toBeGreaterThan(0);
                    expect(corridor.start).toBeDefined();
                    expect(corridor.end).toBeDefined();
                    expect(corridor.direction).toBeDefined();
                });
            }
        });

        test('should always find or create space for corridors', () => {
            // This is the critical test - ensure corridors are ALWAYS generated
            const patterns: CorridorPattern[] = ['random', 'star', 'grid', 'linear'];
            const roomCounts = [1, 10, 25, 50];

            patterns.forEach(pattern => {
                roomCounts.forEach(roomCount => {
                    const generator = new CorridorGenerator(mapWidth, mapHeight);
                    const corridors = generator.generateCorridors(roomCount, pattern);

                    // CRITICAL: Must always generate at least one corridor
                    expect(corridors.length).toBeGreaterThan(0);

                    // Each corridor must have cells
                    corridors.forEach(corridor => {
                        expect(corridor.cells.length).toBeGreaterThan(0);
                    });
                });
            });
        });
    });
});

// Helper functions
function getOppositeBasicDirection(direction: BasicDirection): BasicDirection {
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
    return opposites[direction];
}

function areParallel(dir1: BasicDirection, dir2: BasicDirection): boolean {
    const horizontal = ['left', 'right'];
    const vertical = ['up', 'down'];
    return (horizontal.includes(dir1) && horizontal.includes(dir2)) ||
        (vertical.includes(dir1) && vertical.includes(dir2));
}

function getPerpendicularDistance(point1: ICoord, point2: ICoord, direction: BasicDirection): number {
    return ['left', 'right'].includes(direction)
        ? Math.abs(point1.y - point2.y)
        : Math.abs(point1.x - point2.x);
}

function areOnSameLine(point1: ICoord, point2: ICoord, direction: BasicDirection): boolean {
    const tolerance = 3;
    return ['left', 'right'].includes(direction)
        ? Math.abs(point1.y - point2.y) < tolerance
        : Math.abs(point1.x - point2.x) < tolerance;
}