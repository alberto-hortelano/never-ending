/* eslint-disable @typescript-eslint/no-explicit-any */
// Initialize Logger early to intercept all console calls
import './common/services/LoggerService';

import './components';
import { Component } from './components/Component';
import { LoadingScreen } from './components/loadingscreen/LoadingScreen';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { Shoot } from "./common/Shoot";
import { Overwatch } from "./common/Overwatch";
import { MeleeCombat } from "./common/MeleeCombat";
import { State } from "./common/State";
import { Conversation } from "./common/Conversation";
import { Action } from "./common/Action";
import { Inventory } from "./common/services/Inventory";
import { CharacterService } from "./common/services/CharacterService";
import { AutoSelectCharacter } from "./common/services/AutoSelectCharacter";
import { MultiplayerManager } from "./common/services/MultiplayerManager";
import { AIController } from "./common/services/AIController";
import { GameEvent, EventBus, ControlsEvent, ControlsEventsMap, StateChangeEvent } from "./common/events";
import { initialState, getBaseState } from './data/state';
import { initializeCSSVariables } from './common/initializeCSSVariables';
import './common/services/AICacheManager'; // Initialize AI cache
// import { AIBrowserCacheService } from './common/services/AIBrowserCacheService'; // Removed - no longer auto-clearing cache

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');
document.documentElement.style.setProperty('--mobile-popup-height', '50vh');

// Initialize CSS variables from JavaScript constants
initializeCSSVariables();

// Setup keyboard shortcuts for save/load
document.addEventListener('keydown', (e) => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    
    // F5 for quicksave
    if (e.key === 'F5') {
        e.preventDefault(); // Prevent browser refresh
        eventBus.dispatch(ControlsEvent.quickSave, {});
    }
    
    // F9 for quickload
    if (e.key === 'F9') {
        e.preventDefault();
        eventBus.dispatch(ControlsEvent.quickLoad, {});
    }
});

let gameState: State | null = null;
let menuState: State | null = null; // Minimal state for menu operations

interface GameService {
    destroy?: () => void;
    remove?: (target: object) => void;
}

let gameServices: GameService[] = [];

// Initialize a minimal state for menu operations (save/load)
const initializeMenuState = () => {
    if (!menuState) {
        // Create a minimal state just for save/load operations
        menuState = new State(getBaseState());
        // This state instance will handle save/load events even before game starts
    }
    return menuState;
};

const play = (state?: State) => {
    // Clean up previous game services
    gameServices.forEach(service => {
        if (service) {
            if (typeof service.destroy === 'function') {
                service.destroy();
            } else if (typeof service.remove === 'function') {
                // For EventBus instances, remove listeners
                service.remove(service);
            }
        }
    });
    gameServices = [];

    // Clear component state reference
    Component.setGameState(null);

    // Clean up menu state if we're starting a game
    if (menuState) {
        // Remove all event listeners from menu state
        menuState.remove(menuState);
        menuState = null;
    }

    // Use provided state or create new one
    gameState = state || new State(initialState(50, 50));

    // Set state reference for components
    Component.setGameState(gameState);

    // Initialize singleton services
    CharacterService.initialize(gameState);
    MeleeCombat.initialize(gameState);

    // Initialize AI Controller for NPC control
    const aiController = AIController.getInstance();
    aiController.setGameState(gameState);
    aiController.enableAI(); // Enable AI by default

    // Create new game services
    gameServices.push(
        new Movement(gameState),
        new Talk(gameState),
        new Shoot(gameState),
        new Overwatch(gameState),
        new Inventory(gameState),
        new Conversation(gameState),
        new Action(gameState),
        new AutoSelectCharacter(gameState),
        aiController // Add AI controller to services for cleanup
    );

    // Show game UI
    const container = document.querySelector('container-component');
    const turnIndicator = document.querySelector('turn-indicator');
    if (container) container.setAttribute('style', 'display: block;');
    // Turn indicator functionality is now in TopBar, hide the original
    if (turnIndicator) turnIndicator.setAttribute('style', 'display: none;');
}

// Initialize event listeners
const eventBus = new EventBus<any, any>();
const multiplayerManager = MultiplayerManager.getInstance();

// Listen for game start from select character
eventBus.listen(GameEvent.play, () => play());

// Listen for menu events
eventBus.listen('startSinglePlayer', () => {
    // Single player will be handled by switchedToSinglePlayer event
});

eventBus.listen('startMultiplayer', () => {
    // Multiplayer game will be started by the MultiplayerManager
    const state = multiplayerManager.getState();
    if (state) {
        play(state);
    }
});

// Listen for multiplayer events
multiplayerManager.listen('multiplayerGameStarted', (event) => {
    // Use the initial state data to create the game state
    const gameState = new State(event.state);

    // IMPORTANT: Set the state back to MultiplayerManager so it can handle events
    multiplayerManager.setGameState(gameState);

    play(gameState);
});

multiplayerManager.listen('stateSynced', () => {
    // State has been synced, UI will update automatically through events
});

// Loading screen instance
let loadingScreen: LoadingScreen | null = null;

multiplayerManager.listen('switchedToSinglePlayer', async (event) => {
    // console.log('[Web] Received switchedToSinglePlayer event');
    // console.log('[Web] Event state has story:', {
    //     hasStory: !!event.state?.story,
    //     hasSelectedOrigin: !!event.state?.story?.selectedOrigin,
    //     originName: event.state?.story?.selectedOrigin?.name
    // });
    
    // Create a new game state for single player
    const gameState = new State(event.state);
    // console.log('[Web] Created new State instance');
    
    // Set the state back to MultiplayerManager
    multiplayerManager.setGameState(gameState);
    
    // IMPORTANT: Set the Component state reference BEFORE AI initialization
    // This ensures Character components can find spawned characters in the correct state
    Component.setGameState(gameState);
    
    // Check if we need AI initialization
    if (gameState.story?.selectedOrigin) {
        // console.log('[Web] Origin selected, starting AI initialization flow');
        
        // Don't automatically clear cache - let user control this via dev UI
        // AIBrowserCacheService.clearProblematicCache();
        
        // Game state is already created and will be used later
        
        // Create and show loading screen
        if (!loadingScreen) {
            loadingScreen = document.createElement('loading-screen') as LoadingScreen;
            document.body.appendChild(loadingScreen);
        }
        
        // Set up loading screen
        loadingScreen.setOriginStory(gameState.story.selectedOrigin);
        loadingScreen.setSteps([
            { id: 'connect', label: 'Conectando con IA...', status: 'pending' },
            { id: 'generate_map', label: 'Generando mapa...', status: 'pending' },
            { id: 'place_characters', label: 'Colocando personajes...', status: 'pending' },
            { id: 'create_story', label: 'Creando narrativa...', status: 'pending' },
            { id: 'finalize', label: 'Finalizando...', status: 'pending' }
        ]);
        
        // Set up callbacks
        loadingScreen.setCallbacks(
            // Fallback: use default state
            () => {
                // console.log('[Web] User selected fallback to default state');
                loadingScreen?.hide();
                // Start with default state instead
                const defaultState = new State(getBaseState());
                multiplayerManager.setGameState(defaultState);
                play(defaultState);
            },
            // Retry: try AI initialization again
            () => {
                // console.log('[Web] User selected retry AI initialization');
                initializeAIStory(gameState);
            }
        );
        
        loadingScreen.show();
        
        // Dispatch AI initialization started event
        eventBus.dispatch(GameEvent.aiInitializationStarted, { origin: gameState.story.selectedOrigin });
        
        // Start AI initialization
        await initializeAIStory(gameState);
        
    } else {
        // console.log('[Web] No origin selected, starting game normally');
        play(gameState);
    }
});

// Function to initialize AI story
async function initializeAIStory(gameState: State) {
    const aiController = AIController.getInstance();
    aiController.setGameState(gameState);
    
    // Update loading screen
    loadingScreen?.updateStep('connect', 'active');
    eventBus.dispatch(GameEvent.aiInitializationProgress, {
        stepId: 'connect',
        status: 'active',
        message: 'Conectando con el servicio de IA...'
    });
    
    try {
        // Small delay to show loading screen
        await new Promise(resolve => setTimeout(resolve, 500));
        
        loadingScreen?.updateStep('connect', 'completed');
        loadingScreen?.updateStep('generate_map', 'active');
        
        // Call AI initialization
        // console.log('[Web] Calling AI story initialization...');
        await aiController.initializeStoryFromOrigin();
        
        // If we get here, initialization succeeded
        // console.log('[Web] AI initialization completed successfully');
        
        loadingScreen?.updateStep('generate_map', 'completed');
        loadingScreen?.updateStep('place_characters', 'completed');
        loadingScreen?.updateStep('create_story', 'completed');
        loadingScreen?.updateStep('finalize', 'active');
        
        // Small delay before starting game
        await new Promise(resolve => setTimeout(resolve, 500));
        
        loadingScreen?.updateStep('finalize', 'completed');
        loadingScreen?.hide();
        
        // Now start the game with the AI-initialized state
        eventBus.dispatch(GameEvent.aiInitializationComplete, { state: gameState });
        play(gameState);
        
    } catch (error) {
        console.error('[Web] AI initialization failed:', error);
        
        // Update loading screen to show error
        const errorMessage = (error as Error).message || 'Error desconocido';
        
        // Check if it's an overload error
        if (errorMessage.includes('overloaded') || errorMessage.includes('529')) {
            loadingScreen?.updateStep('connect', 'error', 'Servicio sobrecargado');
            loadingScreen?.showError('El servicio de IA está temporalmente sobrecargado. Por favor, intenta de nuevo en unos momentos.');
        } else {
            loadingScreen?.updateStep('connect', 'error', errorMessage);
            loadingScreen?.showError(`Error al inicializar la historia: ${errorMessage}`);
        }
        
        eventBus.dispatch(GameEvent.aiInitializationFailed, {
            message: errorMessage,
            retryCount: 0,
            maxRetries: 3,
            canRetry: true
        });
    }
}

// Initialize menu state when the module loads
// This ensures save/load functionality works from the main menu
initializeMenuState();

// Expose save/load functions to window for console testing
(window as any).saveGame = (slotName?: string) => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    if (slotName) {
        eventBus.dispatch(ControlsEvent.saveGame, { slotName });
        console.log(`Game saved to slot: ${slotName}`);
    } else {
        console.error('Please provide a slot name for saveGame(slotName)');
    }
};

(window as any).loadGame = (slotName?: string) => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    if (slotName) {
        eventBus.dispatch(ControlsEvent.loadGame, { slotName });
        console.log(`Loading game from slot: ${slotName}`);
    } else {
        console.error('Please provide a slot name for loadGame(slotName)');
    }
};

(window as any).listSaves = () => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    // Create a promise to wait for the response
    return new Promise((resolve) => {
        // Listen for the saves list response
        const listener = (saves: any) => {
            console.log('Available saves:');
            if (saves && saves.length > 0) {
                saves.forEach((save: any) => {
                    const date = new Date(save.timestamp);
                    console.log(`- ${save.slotName}: Turn ${save.turn}, ${save.characterCount} characters, saved at ${date.toLocaleString()}`);
                });
            } else {
                console.log('No saves found');
            }
            resolve(saves);
        };
        
        // Listen for the response event
        eventBus.listen(StateChangeEvent.savesListed, listener);
        
        // Dispatch the list saves request
        eventBus.dispatch(ControlsEvent.listSaves, {});
        
        // Clean up listener after a timeout
        setTimeout(() => {
            eventBus.remove(listener);
        }, 1000);
    });
};

(window as any).quickSave = () => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    eventBus.dispatch(ControlsEvent.quickSave, {});
    console.log('Quick save triggered (F5)');
};

(window as any).quickLoad = () => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    eventBus.dispatch(ControlsEvent.quickLoad, {});
    console.log('Quick load triggered (F9)');
};

(window as any).deleteSave = (slotName?: string) => {
    const eventBus = new EventBus<never, ControlsEventsMap>();
    if (slotName) {
        eventBus.dispatch(ControlsEvent.deleteSave, { slotName });
        console.log(`Deleted save: ${slotName}`);
    } else {
        console.error('Please provide a slot name for deleteSave(slotName)');
    }
};

// Expose EventBus to window for testing
(window as any).EventBus = EventBus;

// Expose Component for state access in tests
(window as any).Component = Component;

// Expose a way to get the current game state
(window as any).getCurrentGameState = () => {
    if (gameState) {
        return gameState.getInternalState();
    } else if (menuState) {
        return menuState.getInternalState();
    }
    return null;
};

// Add a function to inspect a saved game
(window as any).inspectSave = async (slotName: string) => {
    try {
        // Get the saves from localStorage directly
        const savesJson = localStorage.getItem('neverending_saves');
        if (!savesJson) {
            console.log('No saves found in localStorage');
            return null;
        }
        
        // Saves are stored as an array of [slotName, saveData] tuples
        const savesArray = JSON.parse(savesJson);
        const saveEntry = savesArray.find(([name]: [string, any]) => name === slotName);
        
        if (!saveEntry) {
            console.log(`Save '${slotName}' not found`);
            console.log('Available saves:', savesArray.map(([name]: [string, any]) => name));
            return null;
        }
        
        const [, saveData] = saveEntry;
        
        console.log(`\n=== Save Data for '${slotName}' ===`);
        console.log('Metadata:', saveData.metadata);
        console.log('\n--- State Structure ---');
        console.log('State keys:', Object.keys(saveData.state));
        
        // Log the state object itself
        console.log('\nFull state object:', saveData.state);
        
        // Check specific properties
        if (saveData.state.map) {
            console.log('\nMap info:');
            console.log('- Type:', typeof saveData.state.map);
            console.log('- Is Array:', Array.isArray(saveData.state.map));
            console.log('- Length:', saveData.state.map.length);
            if (Array.isArray(saveData.state.map) && saveData.state.map.length > 0) {
                console.log('- First row type:', typeof saveData.state.map[0]);
                console.log('- First row is Array:', Array.isArray(saveData.state.map[0]));
                if (Array.isArray(saveData.state.map[0]) && saveData.state.map[0].length > 0) {
                    console.log('- First cell:', saveData.state.map[0][0]);
                }
            }
        }
        
        if (saveData.state.characters) {
            console.log('\nCharacters info:');
            console.log('- Count:', saveData.state.characters.length);
            if (saveData.state.characters.length > 0) {
                console.log('- First character:', saveData.state.characters[0]);
            }
        }
        
        if (saveData.state.game) {
            console.log('\nGame info:', saveData.state.game);
        }
        
        return saveData;
    } catch (error) {
        console.error('Error inspecting save:', error);
        return null;
    }
};

// Expose play function for testing game start with loaded state
(window as any).playWithState = (state?: any) => {
    // Hide main menu if visible
    const mainMenu = document.querySelector('main-menu') as HTMLElement;
    if (mainMenu) {
        mainMenu.style.display = 'none';
    }
    
    // Start the game with the provided state
    if (state) {
        const gameState = new State(state);
        play(gameState);
    } else {
        play();
    }
};

// Add a simpler helper function to load and start a game
(window as any).loadAndPlayGame = async (slotName: string) => {
    try {
        console.log(`Loading game from slot: ${slotName}`);
        
        // First, trigger the load through the window function
        // This will update the state internally
        (window as any).loadGame(slotName);
        
        // Wait a moment for the state to be loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the current state (which should now be the loaded state)
        const loadedState = (window as any).getCurrentGameState();
        
        if (!loadedState) {
            throw new Error('Failed to get loaded state');
        }
        
        console.log('Starting game with loaded state...');
        
        // Hide main menu if visible
        const mainMenu = document.querySelector('main-menu') as HTMLElement;
        if (mainMenu) {
            mainMenu.style.display = 'none';
        }
        
        // Start the game with the loaded state
        (window as any).playWithState(loadedState);
        
        console.log('Game started successfully');
        return { success: true, message: 'Game loaded and started' };
        
    } catch (error) {
        console.error('Error in loadAndPlayGame:', error);
        throw error;
    }
};

// Log available save/load functions
console.log('%c Save/Load Functions Available:', 'color: #4CAF50; font-weight: bold');
console.log('  window.saveGame(slotName) - Save game to a named slot');
console.log('  window.loadGame(slotName) - Load game from a named slot');
console.log('  window.listSaves() - List all available saves');
console.log('  window.quickSave() - Quick save (same as F5)');
console.log('  window.quickLoad() - Quick load (same as F9)');
console.log('  window.deleteSave(slotName) - Delete a saved game');
console.log('  window.inspectSave(slotName) - Inspect saved game data');
console.log('  window.loadAndPlayGame(slotName) - Load and start game');
console.log('  window.getCurrentGameState() - Get current game state');
