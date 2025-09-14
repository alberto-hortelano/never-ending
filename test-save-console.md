# Console Save/Load Testing Guide

## Available Functions

All save/load functionality is now accessible via the browser console:

### Core Functions

- `window.saveGame(slotName)` - Save game to a named slot
- `window.loadGame(slotName)` - Load game from a named slot  
- `window.listSaves()` - List all available saves (returns a promise)
- `window.quickSave()` - Quick save (same as pressing F5)
- `window.quickLoad()` - Quick load (same as pressing F9)
- `window.deleteSave(slotName)` - Delete a saved game

### Keyboard Shortcuts

- **F5** - Quick save
- **F9** - Quick load

## Testing Steps

1. **Start the development server:**
   ```bash
   npm start
   ```

2. **Open the browser console** (F12 in most browsers)

3. **Start a game** (click Single Player in the main menu)

4. **Test saving:**
   ```javascript
   // Save the current game
   window.saveGame("test1")
   
   // Or use quick save
   window.quickSave()
   ```

5. **List saved games:**
   ```javascript
   // This returns a promise with save data
   await window.listSaves()
   ```

6. **Load a saved game:**
   ```javascript
   // Load a specific save
   window.loadGame("test1")
   
   // Or use quick load
   window.quickLoad()
   ```

7. **Delete a save:**
   ```javascript
   window.deleteSave("test1")
   ```

## Save Data Structure

Saves are stored in localStorage with the following structure:
- Slot name
- Timestamp
- Game state (complete serialized state)
- Metadata (turn number, character count, etc.)

## Notes

- All UI components have been removed
- Save/load functionality works through the event system
- The SaveGameService handles all persistence
- State management remains intact through the State class