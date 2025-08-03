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

#### Unit Tests (Jest)
- Run all tests: `npm test`
- Run specific test: `npm test -- corridorGenerator.test.ts`
- Tests are located in `__tests__/` directory

#### End-to-End Tests (Playwright)
- Run all E2E tests: `npm run test:e2e`
- Run with UI mode: `npm run test:e2e:ui`
- Debug mode: `npm run test:e2e:debug`
- View test report: `npm run test:e2e:report`
- Run specific test: `npm run test:e2e -- e2e/tests/basic.spec.ts`

**E2E Test Structure:**
- `/e2e/tests/` - Test specifications
- `/e2e/pages/` - Page Object Models for clean test organization
- `/e2e/fixtures/` - Test fixtures and utilities
- `playwright.config.ts` - Playwright configuration

**Docker Support:**
The E2E tests are configured to run in Docker with headless browsers:
- Dependencies installed via `npx playwright install-deps`
- Screenshots captured on failure to `/test-results/`
- Videos recorded for debugging

**Important Notes:**
- Web components' shadow DOM may take time to initialize in tests
- Tests automatically start the development server before running
- Screenshots and videos are saved for failed tests
- Tests run in Chromium, Firefox, and WebKit by default

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

### State
The state is a readonly object. It can be read from any class from /logic. It must be serializable, no Map, Set or any complex types. It can only be modified by the UpdateState events.

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

### State-Driven UI Pattern

**Core Principle:** UI components are purely reactive - they listen for state changes and update their visual representation accordingly. Components never store their own UI state.

**State → UI Update Flow:**
1. **State Update**: Something dispatches an `UpdateStateEvent`
2. **State Processing**: The State class processes the update and modifies internal state
3. **State Dispatch**: State automatically dispatches a `StateChangeEvent` with the new data
4. **Component Receives**: Components listening to that specific event receive the data
5. **UI Update**: Components update their DOM/visual representation immediately

**State Categories:**
- `visualStates` - Persistent visual state (classes, styles) for components
- `transientUI` - Temporary UI state (highlights, popups, projectiles)
- `interactionMode` - Current interaction mode (selecting, placing, etc.)
- `animations` - Animation queue for visual effects

**Component State Listening Pattern:**
```typescript
// Component listens for relevant state changes
this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
    const myVisualState = visualStates.characters[this.id];
    if (myVisualState) {
        this.applyVisualState(myVisualState);
    }
});

// Components filter by ID to check if change applies to them
this.listen(StateChangeEvent.characterHealth, (character) => {
    if (character.name === this.id) {
        this.updateHealthBar(character);
    }
});
```

**Key Patterns:**
1. **ID-based Filtering**: Components check if state changes apply to them by ID
2. **Immediate Updates**: Use `requestAnimationFrame` for performance when updating DOM
3. **Bidirectional Flow**: Components can dispatch updates that come back as state changes
4. **No Local State**: Components derive all visual state from the centralized state
5. **Granular Events**: Different `StateChangeEvent` subtypes for different data (game, map, characters, etc.)

### File Structure
- `/src/components/` - Web Components (each has .ts, .scss, .html) - UI only, no business logic
- `/src/components/_variables.scss` - Global SCSS variables and mixins
- `/src/common/` - Core game logic and shared code
- `/src/common/events/` - Event definitions and EventBus
- `/src/common/services/` - Business logic services (isolated from DOM/browser)
- `/src/models/` - AI integrations (Claude, OpenAI)
- `/src/server/` - Express server and API
- `/public/` - Compiled output (DO NOT EDIT DIRECTLY)

### Adding New Features
1. Define new event types in appropriate event file
2. Add to event type maps
3. Create system service if needed (extend EventBus or create static service class)
4. Extract any business logic from components into services
5. Update State interface if new data required
6. Components dispatch/listen to events as needed
7. Ensure services remain isolated from DOM/browser APIs

### Important Patterns
- Always use events for component communication
- Never directly modify state - use UpdateStateEvent
- Components should be self-contained with Shadow DOM
- System services contain business logic, components handle UI
- Use TypeScript strict mode - all types must be explicit, don't use any or forced casting except in test files.
- Services must NOT use browser APIs (window, document) - pass configuration from components
- Use EventBus for global application events, CustomEvent for parent-child component communication

### Separation of Concerns

**Components (UI Layer):**
- Handle DOM manipulation and user interactions
- Render UI based on data from services
- Dispatch events for user actions
- Listen to state changes and update display
- Should NOT contain business logic, calculations, or data transformations

**Services (Business Logic Layer):**
- Contain all business logic and data transformations
- Are completely isolated from DOM/browser APIs
- Use static methods for stateless operations
- Can be easily unit tested
- Should NOT access window, document, or any browser-specific APIs

**Key Services:**
- `BoardService` - Map rendering calculations, cell generation, positioning
- `CharacterService` - Character state, directions, filtering, movement calculations
- `Inventory` - Weight calculations, item grouping, weapon slot logic
- `Action` - Action definitions, cost calculations, and event handling
- `DirectionsService` - Direction calculations, angles, rotations
- `Conversation` - Conversation state management, retry logic

**Example Pattern:**
```typescript
// Service (pure logic)
export class BoardService {
  static calculateCellWidth(cellWidthInVH: number, viewportHeight: number): number {
    return cellWidthInVH * viewportHeight / 100;
  }
}

// Component (UI handling)
class Board extends Component {
  private getCellWidth(): number {
    const rootStyles = getComputedStyle(document.documentElement);
    const cellWidthStr = rootStyles.getPropertyValue('--cell-width');
    const cellWidthInVH = parseFloat(cellWidthStr);
    return BoardService.calculateCellWidth(cellWidthInVH, window.innerHeight);
  }
}
```

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

**IMPORTANT - Common SCSS Variable Names (always check _variables.scss before using):**
- Background colors: `$color-bg-primary`, `$color-bg-secondary`, `$color-bg-tertiary` (NOT `$color-primary`)
- Text colors: `$color-text-primary`, `$color-text-secondary`, `$color-text-muted` (NOT `$color-text-inverse`)
- Border colors: `$color-border-primary`, `$color-border-secondary` (NOT `$color-border`)
- Status colors: Only `$color-danger` and `$color-info` exist (NO `$color-success` or `$color-warning`)
- Game colors: `$color-highlight`, `$color-path`
- Font sizes: `$font-size-base`, `$font-size-lg`, etc. (NOT `$font-size-md`)
- **ALWAYS** check `/src/components/_variables.scss` for exact variable names before using them

### Server Endpoints
- `/` - Serves the game
- `/gameEngine` - AI-powered game narrative endpoint
- Static files served with smart ES module resolution

## Code Quality & Maintenance

### Keeping Code Clean
The project is configured with strict TypeScript settings to prevent unused code:
- `noUnusedLocals: true` - Reports errors on unused local variables
- `noUnusedParameters: true` - Reports errors on unused function parameters

### Checking for Unused Code
- `npm run check:unused` - Find unused exports using ts-prune
- `npm run check:all` - Build and check for unused code
- `npm run build` - TypeScript will report unused locals/parameters

### Best Practices
1. **Before committing**: Run `npm run check:all` to ensure no unused code
2. **Remove unused code immediately**: Don't let it accumulate
3. **Use underscore prefix**: For intentionally unused parameters (e.g., `_unused`)
4. **Make internal methods private**: Use `private` for class methods only used internally
5. **Delete unused files**: Remove entire files if all exports are unused

### Tools Configured
- **TypeScript Compiler**: Strict checks for unused locals and parameters
- **ts-prune**: Finds unused exports across the codebase
- **ESLint** (optional): Can be configured with `@typescript-eslint/no-unused-vars`

## Notes:
Don't run npm start, if you want to see the output of the build run one of the build commands