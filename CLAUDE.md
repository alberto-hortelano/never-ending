# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Never Ending", a turn-based strategy game with AI integration built using TypeScript, Web Components, and an event-driven architecture.

## Essential Commands

### Development
- `npm start` - Starts the development environment (TypeScript watch, SCSS compilation, file sync, and server)
- `npm run serve` - Runs only the server
- `npm test` - Runs Jest tests
- `npm run build` - One-time TypeScript compilation

### Testing
- Run all tests: `npm test`
- Run specific test: `npm test -- corridorGenerator.test.ts`
- Tests are located in `__tests__/` directory

## Architecture Overview

### Event-Driven Architecture
The entire application communicates through a strongly-typed EventBus system. Components don't directly call each other - they dispatch and listen to events.

**Event Flow Pattern:**
```
User Action → Component → ControlsEvent → System Service → UpdateStateEvent → State → StateChangeEvent → Components Update
```

**Key Event Types:**
- `GameEvents` - Game lifecycle (play, characters)
- `StateEvents` - State updates and changes
- `ControlsEvents` - User interactions
- `UIEvents` - UI-specific events

### Component Architecture
All UI components extend the base `Component` class which provides:
- Shadow DOM encapsulation
- Automatic CSS/HTML loading (based on file naming convention)
- Built-in EventBus for communication
- Resource caching

**Creating a new component:**
1. Extend `Component` class
2. Set `hasCss` and `hasHtml` flags
3. Create matching `.scss` and `.html` files in same directory
4. Register with `customElements.define()`

### State Management
- Centralized in `State` class with private fields and readonly getters
- All state changes go through events (never direct mutation)
- State automatically dispatches change events when updated
- Uses `DeepReadonly` types to prevent accidental mutations

### File Structure
- `/src/components/` - Web Components (each has .ts, .scss, .html)
- `/src/common/` - Core game logic and shared code
- `/src/common/events/` - Event definitions and EventBus
- `/src/models/` - AI integrations (Claude, OpenAI)
- `/src/server/` - Express server and API
- `/public/` - Compiled output (DO NOT EDIT DIRECTLY)

### Adding New Features
1. Define new event types in appropriate event file
2. Add to event type maps
3. Create system service if needed (extend EventBus)
4. Update State interface if new data required
5. Components dispatch/listen to events as needed

### Important Patterns
- Always use events for component communication
- Never directly modify state - use UpdateStateEvent
- Components should be self-contained with Shadow DOM
- System services contain business logic, components handle UI
- Use TypeScript strict mode - all types must be explicit

### Server Endpoints
- `/` - Serves the game
- `/gameEngine` - AI-powered game narrative endpoint
- Static files served with smart ES module resolution