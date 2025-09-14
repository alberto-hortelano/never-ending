import { EventBus, EventsMap } from '../events/EventBus';
import { NetworkService } from './NetworkService';
import { State } from '../State';
import { IState, IUIState, ICharacter, IOverwatchData } from '../interfaces';
import { GameEvent, UpdateStateEvent, ControlsEvent } from '../events';
import { getBaseState, getEmptyState } from '../../data/state';
import { StateDiffService, StateDiff } from './StateDiffService';

// Type for network event data
interface NetworkEventData {
    fromNetwork?: boolean;
    [key: string]: unknown;
}

export class MultiplayerManager extends EventBus<EventsMap, EventsMap> {
    private static instance: MultiplayerManager;
    private networkService: NetworkService;
    private state: State | null = null;
    private isHost = false;
    private isMultiplayer = false;
    private lastSyncedState: IState | null = null;
    private syncTimerCallback: (() => void) | null = null;
    private listenersSetup = false;

    private constructor() {
        super();
        this.networkService = NetworkService.getInstance();
        this.setupEventListeners();
    }

    static getInstance(): MultiplayerManager {
        if (!MultiplayerManager.instance) {
            MultiplayerManager.instance = new MultiplayerManager();
        }
        return MultiplayerManager.instance;
    }

    private setupEventListeners() {
        // Prevent duplicate listener registration
        if (this.listenersSetup) {
            return;
        }
        this.listenersSetup = true;

        // Listen for network events
        this.networkService.listen('gameStarted', (data) => {
            this.handleGameStart(data.initialState);
        });

        this.networkService.listen('stateSync', (data) => {
            const syncData = data as { state?: IState; diff?: StateDiff };
            if (syncData.diff) {
                this.handleStateDiff(syncData.diff);
            } else if (syncData.state) {
                this.handleStateSync(syncData.state);
            }
        });
        
        // Note: stateDiff actions are converted to stateSync events in NetworkService
        // to maintain a clean event system and avoid "no listeners" warnings

        this.networkService.listen('roomCreated', () => {
            this.isHost = true;
            this.isMultiplayer = true;
            this.startSyncInterval();
        });

        this.networkService.listen('roomJoined', () => {
            this.isHost = false;
            this.isMultiplayer = true;
        });

        this.networkService.listen('roomLeft', () => {
            this.isMultiplayer = false;
            this.isHost = false;
            this.stopSyncInterval();
            this.lastSyncedState = null;
        });

        // Listen for turn changes to broadcast to other players
        this.listen(GameEvent.changeTurn, (data) => {
            if (this.isMultiplayer && this.state) {
                // Only broadcast if this didn't come from network (to avoid loops)
                const fromNetwork = (data as NetworkEventData).fromNetwork;
                if (!fromNetwork) {
                    this.broadcastAction(GameEvent.changeTurn, data);
                }
                
                // Host also syncs the full state
                if (this.isHost) {
                    this.syncStateToClients();
                }
            }
        });

        // Listen for state update events and broadcast them in multiplayer
        this.setupStateUpdateListeners();
    }

    async connectToServer(playerName: string, serverUrl: string): Promise<void> {
        await this.networkService.connect(playerName, serverUrl);
    }

    createRoom(roomName: string, maxPlayers: number = 2): void {
        this.networkService.createRoom(roomName, maxPlayers);
    }

    joinRoom(roomId: string): void {
        this.networkService.joinRoom(roomId);
    }

    leaveRoom(): void {
        this.networkService.leaveRoom();
        this.switchToSinglePlayer();
    }

    setReady(ready: boolean, character?: Partial<ICharacter>): void {
        this.networkService.setReady(ready, character as ICharacter | undefined);
    }

    private handleGameStart(initialState: IState) {
        // Just dispatch the event with the initial state data
        this.dispatch('multiplayerGameStarted', { state: initialState });
    }
    
    setGameState(state: State) {
        // Allow web.ts to set the state instance after creating it
        this.state = state;
    }

    private handleStateSync(syncedState: IState) {
        if (!this.isHost && this.state) {
            // Don't create a new state - just dispatch the sync event
            // The existing state will be updated through individual events
            this.dispatch('stateSynced', { state: syncedState });
            this.lastSyncedState = syncedState;
        }
    }
    
    private handleStateDiff(diff: StateDiff) {
        if (!this.isHost && this.state && this.lastSyncedState) {
            // Apply the diff to get the new state
            const newState = StateDiffService.applyDiff(this.lastSyncedState, diff);
            
            // Dispatch individual events for each change
            this.dispatchStateChanges(this.lastSyncedState, newState);
            
            this.lastSyncedState = newState;
        }
    }
    
    private dispatchStateChanges(oldState: IState, newState: IState) {
        // Check for game state changes
        if (JSON.stringify(oldState.game) !== JSON.stringify(newState.game)) {
            const eventData = Object.assign({}, newState.game, { fromNetwork: true });
            this.dispatch(GameEvent.changeTurn, eventData);
        }
        
        // Check for character changes
        for (const character of newState.characters) {
            const oldChar = oldState.characters.find(c => c.name === character.name);
            if (!oldChar || JSON.stringify(oldChar) !== JSON.stringify(character)) {
                // Dispatch appropriate events based on what changed
                if (!oldChar || oldChar.position.x !== character.position.x || oldChar.position.y !== character.position.y) {
                    const eventData = Object.assign({}, character, { fromNetwork: true });
                    this.dispatch(UpdateStateEvent.characterPosition, eventData);
                }
                if (!oldChar || oldChar.health !== character.health) {
                    const damageData = {
                        targetName: character.name,
                        damage: oldChar ? oldChar.health - character.health : 0
                    };
                    const eventData = Object.assign({}, damageData, { fromNetwork: true });
                    this.dispatch(UpdateStateEvent.damageCharacter, eventData);
                }
            }
        }
        
        // Handle UI state changes
        this.dispatchUIStateChanges(oldState.ui, newState.ui);
        
        // Overwatch data changes
        const oldOverwatchData = oldState.overwatchData || {};
        const newOverwatchData = newState.overwatchData || {};
        
        // Check for added or updated overwatch entries
        for (const [characterName, data] of Object.entries(newOverwatchData)) {
            const oldData = oldOverwatchData[characterName];
            if (!oldData || JSON.stringify(oldData) !== JSON.stringify(data)) {
                const overwatchData = data as IOverwatchData;
                const eventData = Object.assign({ characterName }, overwatchData, { fromNetwork: true });
                this.dispatch(UpdateStateEvent.setOverwatchData, eventData);
            }
        }
        
        // Check for removed overwatch entries
        for (const characterName of Object.keys(oldOverwatchData)) {
            if (!newOverwatchData[characterName]) {
                const eventData = { characterName, active: false, fromNetwork: true };
                this.dispatch(UpdateStateEvent.setOverwatchData, eventData);
            }
        }
    }
    
    private dispatchUIStateChanges(oldUI: IUIState, newUI: IUIState) {
        // Animation changes
        for (const [characterId, animation] of Object.entries(newUI.animations.characters)) {
            const oldAnimation = oldUI.animations.characters[characterId];
            if (JSON.stringify(oldAnimation) !== JSON.stringify(animation)) {
                const animData = {
                    characterId,
                    animation: animation || null
                };
                const eventData = Object.assign({}, animData, { fromNetwork: true });
                this.dispatch(UpdateStateEvent.uiCharacterAnimation, eventData);
            }
        }
        
        // Visual state changes
        for (const [characterId, visualState] of Object.entries(newUI.visualStates.characters)) {
            const oldVisualState = oldUI.visualStates.characters[characterId];
            if (JSON.stringify(oldVisualState) !== JSON.stringify(visualState)) {
                const visualData = {
                    characterId,
                    visualState: visualState || {}
                };
                const eventData = Object.assign({}, visualData, { fromNetwork: true });
                this.dispatch(UpdateStateEvent.uiCharacterVisual, eventData);
            }
        }
        
        // Projectile changes
        if (JSON.stringify(oldUI.transientUI.projectiles) !== JSON.stringify(newUI.transientUI.projectiles)) {
            // Handle projectile additions/removals
            const oldIds = new Set(oldUI.transientUI.projectiles.map(p => p.id));
            const newIds = new Set(newUI.transientUI.projectiles.map(p => p.id));
            
            // Add new projectiles
            for (const projectile of newUI.transientUI.projectiles) {
                if (!oldIds.has(projectile.id)) {
                    const eventData = Object.assign({}, projectile, { fromNetwork: true });
                    this.dispatch(UpdateStateEvent.uiAddProjectile, eventData);
                }
            }
            
            // Remove old projectiles
            for (const projectile of oldUI.transientUI.projectiles) {
                if (!newIds.has(projectile.id)) {
                    const removeData = { projectileId: projectile.id };
                    const eventData = Object.assign({}, removeData, { fromNetwork: true });
                    this.dispatch(UpdateStateEvent.uiRemoveProjectile, eventData);
                }
            }
        }
    }

    private syncStateToClients() {
        if (!this.isHost || !this.state) return;

        // Get mutable state and clone it for comparison
        const internalState = this.state.getInternalState();
        const currentState: IState = structuredClone(internalState);

        if (this.lastSyncedState) {
            // Send diff if we have a previous state
            const diff = StateDiffService.createDiff(this.lastSyncedState, currentState);
            const filteredPatches = StateDiffService.filterUIPatches(diff.patches);
            
            if (filteredPatches.length > 0) {
                this.broadcastAction('stateDiff', {
                    roomId: this.networkService.getRoomId(),
                    diff: { ...diff, patches: filteredPatches },
                    timestamp: Date.now()
                });
            }
        } else {
            // Send full state on first sync
            this.broadcastAction('stateSync', {
                roomId: this.networkService.getRoomId(),
                state: currentState,
                timestamp: Date.now()
            });
        }
        
        this.lastSyncedState = currentState;
    }

    switchToSinglePlayer(origin?: any) {
        // DEBUG: console.log('[MultiplayerManager] Switching to single player mode');
        // DEBUG: console.log('[MultiplayerManager] Received origin:', origin?.id, origin?.name);
        this.isMultiplayer = false;
        this.isHost = false;

        // Use empty state if origin provided (AI will generate content)
        // Otherwise use the default base state
        const singlePlayerState = origin ? getEmptyState() : getBaseState();
        
        // If an origin was provided, add the story state
        if (origin) {
            // DEBUG: console.log('[MultiplayerManager] Adding origin to state');
            singlePlayerState.story = {
                selectedOrigin: origin,
                currentChapter: 1,
                completedMissions: [],
                majorDecisions: [],
                factionReputation: origin.factionRelations || {},
                storyFlags: new Set<string>(origin.specialTraits || []),
                journalEntries: [{
                    id: 'origin_' + origin.id,
                    title: `Inicio: ${origin.nameES}`,
                    content: origin.descriptionES,
                    date: new Date().toISOString(),
                    type: 'main' as const,
                    isRead: false
                }]
            };
        }
        
        // DEBUG: console.log('[MultiplayerManager] Base state created, checking for story data...');
        // DEBUG: console.log('[MultiplayerManager] Story state:', {
        //     hasStory: !!singlePlayerState.story,
        //     hasSelectedOrigin: !!singlePlayerState.story?.selectedOrigin,
        //     originName: singlePlayerState.story?.selectedOrigin?.name
        // });
        
        // Don't create state here - let web.ts handle it
        this.state = null;

        // DEBUG: console.log('[MultiplayerManager] Dispatching switchedToSinglePlayer event');
        this.dispatch('switchedToSinglePlayer', { state: singlePlayerState });
    }

    isInMultiplayerMode(): boolean {
        return this.isMultiplayer;
    }

    isGameHost(): boolean {
        return this.isHost;
    }

    getCurrentPlayerId(): string | null {
        return this.networkService.getPlayerId();
    }

    getState(): State | null {
        return this.state;
    }

    private setupStateUpdateListeners() {
        // Listen for character movement
        this.listen(UpdateStateEvent.characterPosition, (data) => {
            if (this.isMultiplayer && this.state) {
                // Don't broadcast if this came from network (to avoid loops)
                if (!(data as NetworkEventData).fromNetwork) {
this.broadcastAction(UpdateStateEvent.characterPosition, data);
                }
            }
        });

        // Listen for character path updates
        this.listen(UpdateStateEvent.characterPath, (data) => {
            if (this.isMultiplayer && this.state) {
                // Only broadcast if this didn't come from network (to avoid loops)
                if (!(data as NetworkEventData).fromNetwork) {
// Include current position in the broadcast for synchronization
                    this.broadcastAction(UpdateStateEvent.characterPath, {
                        ...data,
                        position: data.position // Ensure position is included
                    });
                }
            }
        });

        // Listen for other important state updates
        this.listen(UpdateStateEvent.deductActionPoints, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.deductActionPoints, data);
                }
            }
        });

        this.listen(UpdateStateEvent.damageCharacter, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.damageCharacter, data);
                }
            }
        });
        
        // Listen for UI state updates
        this.listen(UpdateStateEvent.uiCharacterAnimation, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiCharacterAnimation, data);
                }
            }
        });
        
        this.listen(UpdateStateEvent.uiCharacterVisual, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiCharacterVisual, data);
                }
            }
        });
        
        // Listen for overwatch data updates
        this.listen(UpdateStateEvent.setOverwatchData, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.setOverwatchData, data);
                }
            }
        });
        
        this.listen(UpdateStateEvent.uiAddProjectile, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiAddProjectile, data);
                }
            }
        });
        
        this.listen(UpdateStateEvent.uiRemoveProjectile, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiRemoveProjectile, data);
                }
            }
        });
        
        // Listen for melee combat events
        this.listen(UpdateStateEvent.uiMeleeDefense, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiMeleeDefense, data);
                }
            }
        });
        
        this.listen(ControlsEvent.meleeDefenseSelected, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(ControlsEvent.meleeDefenseSelected, data);
                }
            }
        });
        
        this.listen(UpdateStateEvent.uiMeleeCombatResult, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.uiMeleeCombatResult, data);
                }
            }
        });
        
    }

    private broadcastAction(type: string, data: unknown) {
        this.networkService.send('playerAction', {
            action: {
                type,
                data: {
                    ...(typeof data === 'object' && data !== null ? data : {}),
                    senderId: this.getCurrentPlayerId() // Add sender ID to track origin
                }
            }
        });
    }
    
    private startSyncInterval() {
        if (!this.syncTimerCallback) {
            // Create callback
            this.syncTimerCallback = () => {
                if (this.isMultiplayer && this.isHost) {
                    this.syncStateToClients();
                }
            };
            // Dispatch event to request timer setup - without the callback
            this.dispatch('requestSyncTimer', { 
                interval: 100 // Sync every 100ms
            });
        }
    }
    
    private stopSyncInterval() {
        if (this.syncTimerCallback) {
            // Dispatch event to request timer cleanup from component layer
            this.dispatch('cancelSyncTimer', {});
            this.syncTimerCallback = null;
        }
    }
    
    public executeSyncCallback() {
        if (this.syncTimerCallback) {
            this.syncTimerCallback();
        }
    }
}