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
import { GameEvent, EventBus, ControlsEvent, ControlsEventsMap } from "./common/events";
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
interface GameService {
    destroy?: () => void;
    remove?: (target: object) => void;
}

let gameServices: GameService[] = [];

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
