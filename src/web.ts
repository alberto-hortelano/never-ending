/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Component } from './components/Component';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { Shoot } from "./common/Shoot";
import { Overwatch } from "./common/Overwatch";
import { Rotate } from "./common/Rotate";
import { State } from "./common/State";
import { Conversation } from "./common/Conversation";
import { Action } from "./common/Action";
import { Inventory } from "./common/services/Inventory";
import { CharacterService } from "./common/services/CharacterService";
import { AutoSelectCharacter } from "./common/services/AutoSelectCharacter";
import { MultiplayerManager } from "./common/services/MultiplayerManager";
import { GameEvent, EventBus } from "./common/events";
import { initialState } from './data/state';
import { initializeCSSVariables } from './common/initializeCSSVariables';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');
document.documentElement.style.setProperty('--mobile-popup-height', '50vh');

// Initialize CSS variables from JavaScript constants
initializeCSSVariables();

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

    // Create new game services
    gameServices.push(
        new Movement(gameState),
        new Talk(gameState),
        new Shoot(gameState),
        new Overwatch(gameState),
        new Rotate(gameState),
        new Inventory(gameState),
        new Conversation(),
        new Action(gameState),
        new AutoSelectCharacter(gameState)
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

multiplayerManager.listen('switchedToSinglePlayer', (event) => {
    // Create a new game state for single player
    const gameState = new State(event.state);
    
    // Set the state back to MultiplayerManager
    multiplayerManager.setGameState(gameState);
    
    play(gameState);
});
