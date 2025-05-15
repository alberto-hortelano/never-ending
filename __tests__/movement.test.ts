import { MovementEventBus, ServerEventBus, UiEventBus } from '../src/common/events/index';
import { Movement } from '../src/game/Movement';
import { Cell, IMovable, ICharacter } from '../src/common/interfaces';

describe('Movement', () => {
  // Setup test environment
  let mockBus: {
    server: ServerEventBus;
    ui: UiEventBus;
    movement: MovementEventBus;
  };
  let movement: Movement;
  let player: ICharacter;
  let mockMap: Cell[][];

  beforeEach(() => {
    // Create mock event buses
    mockBus = {
      server: new ServerEventBus(),
      ui: new UiEventBus(),
      movement: new MovementEventBus()
    };
    // Silence console TODO: Remove console log
    mockBus.ui.listen(mockBus.ui.events.log, mockBus, (msg) => { console.log(...msg) });

    // Create simple test map (5x5)
    // 0 = wall, 1 = floor (walkable)
    mockMap = [
      [{ symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }],
      [{ symbol: '#', blocker: true }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: '#', blocker: true }],
      [{ symbol: '#', blocker: true }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: '#', blocker: true }],
      [{ symbol: '#', blocker: true }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: ' ', blocker: false }, { symbol: '#', blocker: true }],
      [{ symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }, { symbol: '#', blocker: true }],
    ];

    // Create test player
    player = {
      name: 'TestPlayer',
      letter: 'P',
      action: 'iddle',
      speed: 'medium',
      direction: 'down',
      position: { x: 2, y: 2 }, // Center of the map
      race: 'human',
      description: 'Test player',
      palette: {
        skin: '',
        helmet: '',
        suit: ''
      }
    };

    // Create movement instance
    movement = new Movement(mockBus);

    // Send map and valid cells to movement
    mockBus.server.dispatch(mockBus.server.events.map, mockMap);
    mockBus.server.dispatch(mockBus.server.events.validCells, [' ']);
    mockBus.server.dispatch(mockBus.server.events.player, player);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should update player direction when direction event is dispatched', () => {
    // Set up a mock listener to verify the movement
    let receivedMovable: IMovable | null = null;
    mockBus.movement.listen(mockBus.movement.events.move, {}, (movable: IMovable) => {
      receivedMovable = movable;
      // Dispatch direction event
      mockBus.movement.dispatch(mockBus.movement.events.direction, 'up');

      // Simulate frame event to trigger movement
      mockBus.ui.dispatch(mockBus.ui.events.frame, 100);

      // Check if player direction was updated
      expect(player.direction).toBe('up');

      // Verify that the player is in walking state
      expect(player.action).toBe('walk');

      // Verify that the move event was dispatched
      expect(receivedMovable).not.toBeNull();
      if (receivedMovable) {
        expect(receivedMovable.name).toBe('TestPlayer');
        expect(receivedMovable.action).toBe('walk');
        expect(receivedMovable.direction).toBe('up');
      }
    });

  });

  test.only('should update player position over time when moving', () => {
    // Initial position
    const initialX = player.position!.x;
    const initialY = player.position!.y;

    // Set player to walk up
    mockBus.movement.dispatch(mockBus.movement.events.direction, 'up');

    // Simulate multiple frames to allow movement
    for (let i = 0; i < 10; i++) {
      mockBus.ui.dispatch(mockBus.ui.events.frame, 100);
    }

    // Check if player position has changed
    expect(player.position!.y).toBeLessThan(initialY);

    // Now try moving right
    mockBus.movement.dispatch(mockBus.movement.events.direction, 'right');

    // Simulate multiple frames
    for (let i = 0; i < 10; i++) {
      mockBus.ui.dispatch(mockBus.ui.events.frame, 100);
    }

    // Check if player position has changed
    expect(player.position!.x).toBeGreaterThan(initialX);
  });

  test('should stop player movement when stopMovement event is dispatched', () => {
    // Set player to walk
    mockBus.movement.dispatch(mockBus.movement.events.direction, 'right');

    // Simulate frame to start movement
    mockBus.ui.dispatch(mockBus.ui.events.frame, 100);

    // Verify player is walking
    expect(player.action).toBe('walk');

    // Stop movement
    mockBus.movement.dispatch(mockBus.movement.events.stopMovement, null);

    // Verify player stopped
    expect(player.action).toBe('iddle');
    expect(player.route).toEqual([]);
  });
});