Based on my analysis of both the web-test UI and game logic, here's a plan to connect them:

  1. Create a web adapter module that:
    - Initializes the shared EventBus instances
    - Converts between web UI events and game events
    - Provides a web-specific entry point
  2. Modify EventBridge in web-test to:
    - Connect to actual EventBuses instead of simulation
    - Map UI events to appropriate game events
    - Handle serialization of data between systems
  3. Update the entry point to:
    - Initialize EventBuses
    - Start game logic
    - Connect EventBridge to these buses
  4. Implement event mappings:
    - UI "player-move" → MovementEventBus direction events
    - MovementEventBus move events → UI "character-updated"
    - ServerEventBus map events → UI "map-updated"
  5. Add animation/game loop to sync UI rendering with game state

  The key insight is using the existing EventBus system as the communication backbone, allowing both
   systems to operate independently while sharing state through events.
