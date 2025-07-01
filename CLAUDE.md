# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Auto update

After important changes review this document and update it if necessary.

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

**IMPORTANT - Event Bus is Shared:**
- The EventBus uses a static listeners Map, so ALL EventBus instances share the same event system
- Components and services can communicate even though they have separate EventBus instances
- Events are dispatched globally - any listener anywhere in the app will receive them
- This is why components MUST exist before they can receive events (can't listen if not created yet)

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

**IMPORTANT - Component Initialization Pattern:**
When creating components that receive data via `setOptions` or similar methods:

1. **DO NOT** wait for async initialization before calling `setOptions`
2. **DO NOT** make the parent's show method async
3. **DO** follow this pattern (see SelectCharacter.ts as example):
   ```typescript
   // In your component:
   override async connectedCallback() {
       const root = await super.connectedCallback();
       if (!root) return root;
       
       // Render with current options if they exist
       if (this.options) {
           this.renderContent(root);
       }
       return root;
   }
   
   public setOptions(options: YourOptions) {
       this.options = options;
       
       // Try to render immediately if shadowRoot exists
       const root = this.shadowRoot;
       if (root) {
           root.innerHTML = '';
           this.renderContent(root);
       }
   }
   ```

4. **In the parent component (e.g., Popup):**
   ```typescript
   private showYourComponent(data: any) {  // NOT async!
       this.clearContent();
       
       const component = document.createElement('your-component') as YourComponent;
       this.appendChild(component);
       
       this.show(`Title`);
       
       // Call setOptions immediately - no await needed
       if (component && component.setOptions) {
           component.setOptions(data);
       }
   }
   ```

This pattern ensures the component renders correctly regardless of initialization timing.

### State Management
- Centralized in `State` class with private fields and readonly getters
- All state changes go through events (never direct mutation)
- State automatically dispatches change events when updated
- Uses `DeepReadonly` types to prevent accidental mutations

### File Structure
- `/src/components/` - Web Components (each has .ts, .scss, .html)
- `/src/components/_variables.scss` - Global SCSS variables and mixins
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

### SCSS Styling Guidelines

**Variables & Design System:**
- All styles use centralized variables from `/src/components/_variables.scss`
- Mobile-first approach using rem units instead of pixels
- Percentage-based spacing for flexible layouts
- Consistent color palette with semantic naming
- Use provided mixins for responsive breakpoints

**When styling components:**
1. Import variables: `@use '../variables' as *;`
2. Use semantic color variables (e.g., `$color-bg-primary`, `$color-text-primary`)
3. Use spacing scale: `$spacing-xs` through `$spacing-3xl`
4. Use typography scale: `$font-size-xs` through `$font-size-xl`
5. Use consistent borders: `$border-width`, `$border-radius-*`
6. Use transition variables: `$transition-all`, `$transition-duration-base`
7. Follow z-index scale for layering

**Key SCSS Variables:**
- Colors: `$gray-*` scale, semantic colors like `$color-bg-*`, `$color-text-*`
- Spacing: rem-based scale and percentage options
- Typography: rem-based sizes, weights, line heights
- Borders: consistent widths and radius options
- Shadows: predefined shadow styles
- Breakpoints: mobile-first mixins (`@include md-up`, etc.)

### Server Endpoints
- `/` - Serves the game
- `/gameEngine` - AI-powered game narrative endpoint
- Static files served with smart ES module resolution

## Notes:
Don't run npm start, if you want to see the output of the build run one of the build commands