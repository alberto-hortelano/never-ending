/* eslint-disable no-case-declarations */
import { EventBus } from '../events/EventBus';
import {
    GameEvent,
    ConversationEvent,
    GameEventsMap,
    StateChangeEventsMap,
    UpdateStateEventsMap,
    ControlsEventsMap,
    ConversationEventsMap,
    CharacterActionData,
    MovementActionData,
    AttackActionData,
    ItemActionData,
    type CombatEventData
} from '../events';
import { State } from '../State';
import { AIContextBuilder } from './AIContextBuilder';
import { AICommandParser, AICommand, MovementCommand, AttackCommand, CharacterCommand } from './AICommandParser';
import { AIGameEngineService, type AIActionContext } from './AIGameEngineService';
import { AICommandValidator } from './AICommandValidator';
import { StoryInitializationValidator } from './StoryInitializationValidator';
import { AIErrorHandler } from './AIErrorHandler';
import { AICommandExecutor } from './AICommandExecutor';
import { TacticalExecutor } from './TacticalExecutor';
import { CombatStances } from './CombatStances';
import { StoryCommandExecutor, ItemSpawnCommand } from './StoryCommandExecutor';
import { StoryPlanner } from './StoryPlanner';
import { WorldState } from './WorldState';
import { AITurnManager } from './AITurnManager';
import { ICharacter, ICoord, Direction, IOriginStory, IStoryState } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { FactionService } from './FactionService';
import type { LanguageCode } from '../constants';
import { i18n } from '../i18n/i18n';

interface DialogueData {
    speaker?: string;
    listener?: string;
    targetNPC?: string;
    playerChoice?: string;
    needsAIResponse?: boolean;
}

export class AIController extends EventBus<
    GameEventsMap & StateChangeEventsMap & ControlsEventsMap & UpdateStateEventsMap & ConversationEventsMap,
    GameEventsMap & StateChangeEventsMap & ControlsEventsMap & UpdateStateEventsMap & ConversationEventsMap
> {
    private static instance: AIController;
    private gameEngineService: AIGameEngineService;
    private contextBuilder?: AIContextBuilder;
    private commandParser: AICommandParser;
    private validator?: AICommandValidator;
    private errorHandler?: AIErrorHandler;
    private commandExecutor?: AICommandExecutor;
    private turnManager?: AITurnManager;
    private isProcessingTurn: boolean = false;
    private isForcedTurnEnd: boolean = false; // Track when turn was force-ended by conversation
    private aiEnabled: boolean = true;
    private state?: State;
    private pendingSpeechCommands: Map<string, AICommand> = new Map(); // Store per character
    private speechMovementAttempts: Map<string, number> = new Map(); // Track movement attempts for speech
    private isProcessingMultipleCharacters: boolean = false;
    private movementTimeouts: NodeJS.Timeout[] = [];
    private tacticalExecutor: TacticalExecutor;
    private storyExecutor: StoryCommandExecutor;
    private storyPlanner: StoryPlanner;
    private useTacticalSystem: boolean = false; // Flag to enable/disable tactical system - disabled by default to use AI endpoint
    private ongoingMovement?: { characterName: string; targetLocation: ICoord; targetName?: string; targetLocationString: string }; // Track ongoing multi-cell movement

    private constructor() {
        super();
        this.gameEngineService = AIGameEngineService.getInstance();
        this.commandParser = new AICommandParser();
        this.tacticalExecutor = TacticalExecutor.getInstance();
        this.storyExecutor = StoryCommandExecutor.getInstance();
        this.storyPlanner = StoryPlanner.getInstance();
        CombatStances.initialize();
    }

    public static getInstance(): AIController {
        if (!AIController.instance) {
            AIController.instance = new AIController();
        }
        return AIController.instance;
    }

    /**
     * Maps AI direction values to game direction values
     */
    private mapDirection(direction: string): Direction {
        const directionMap: { [key: string]: Direction } = {
            'top': 'up',
            'bottom': 'down',
            'left': 'left',
            'right': 'right',
            'top-left': 'up-left',
            'top-right': 'up-right',
            'bottom-left': 'down-left',
            'bottom-right': 'down-right'
        };
        return (directionMap[direction] || direction) as Direction;
    }

    public setGameState(state: State): void {
        console.log('[AI] setGameState called');
        // Clean up previous listeners before setting new state
        this.cleanup();

        this.state = state;

        // Preserve conversation history by keeping existing contextBuilder if possible
        // Only create new contextBuilder if it doesn't exist
        if (!this.contextBuilder) {
            console.log('[AI] Creating new contextBuilder');
            this.contextBuilder = new AIContextBuilder(state);
            // Initialize validator and error handler
            this.validator = new AICommandValidator(state);
            this.errorHandler = new AIErrorHandler(this.validator, this.gameEngineService);
        } else {
            console.log('[AI] Updating existing contextBuilder');
            // Update the state reference in existing contextBuilder
            // This preserves conversation history while updating game state
            this.contextBuilder.updateState(state);
            // Reinitialize validator with new state
            this.validator = new AICommandValidator(state);
            this.errorHandler = new AIErrorHandler(this.validator, this.gameEngineService);
        }

        // Initialize command executor
        this.commandExecutor = new AICommandExecutor(
            state,
            this.contextBuilder,
            this.commandParser,
            this.gameEngineService,
            this.storyExecutor,
            (event: string, data: unknown) => this.dispatch(event as any, data as any),
            (forceEnd?: boolean) => this.turnManager!.endTurn(forceEnd),
            () => this.isProcessingMultipleCharacters,
            this.pendingSpeechCommands,
            this.speechMovementAttempts,
            this.movementTimeouts,
            (value: boolean) => { this.isForcedTurnEnd = value; },
            (value: boolean) => { this.isProcessingTurn = value; },
            (value: boolean) => { this.isProcessingMultipleCharacters = value; },
            (dir: string) => this.mapDirection(dir)
        );

        // Initialize turn manager
        this.turnManager = new AITurnManager(
            () => this.state,
            this.commandExecutor,
            this.tacticalExecutor,
            () => this.contextBuilder,
            this.gameEngineService,
            () => this.errorHandler,
            this.storyPlanner,
            this.commandParser,
            (event: string, data: unknown) => this.dispatch(event as any, data as any),
            () => this.aiEnabled,
            () => this.useTacticalSystem,
            () => this.ongoingMovement,
            (value) => { this.ongoingMovement = value; },
            this.pendingSpeechCommands,
            this.speechMovementAttempts,
            () => this.isProcessingMultipleCharacters,
            (value: boolean) => { this.isProcessingMultipleCharacters = value; },
            () => this.isForcedTurnEnd,
            (value: boolean) => { this.isForcedTurnEnd = value; },
            () => this.isProcessingTurn,
            (value: boolean) => { this.isProcessingTurn = value; },
            () => this.clearMovementTimeouts(),
            (trigger: string, participants?, outcome?, location?) => this.triggerWorldStateUpdate(trigger as 'combat' | 'conversation' | 'discovery' | 'mission' | 'turn' | 'movement', participants, outcome, location),
            (character: DeepReadonly<ICharacter>) => this.isCharacterInCombat(character)
        );

        // Reset processing flags when setting new state
        this.isProcessingTurn = false;
        this.isForcedTurnEnd = false;
        console.log('[AI] Resetting flags: isProcessingTurn=false, isForcedTurnEnd=false');

        this.initialize();
    }

    private cleanup(): void {
        // Remove all listeners for this instance
        this.remove(this);
        this.isInitialized = false;
        // Clear any pending timeouts
        this.clearMovementTimeouts();
    }

    private clearMovementTimeouts(): void {
        // Clear all pending movement timeouts
        for (const timeout of this.movementTimeouts) {
            clearTimeout(timeout);
        }
        this.movementTimeouts = [];
    }

    private isInitialized = false;

    private initialize(): void {
        if (!this.state) {
            return;
        }

        if (this.isInitialized) {
            return;
        }

        this.isInitialized = true;

        // Initialize world state with story context
        this.initializeWorldState();

        // Listen for turn changes to check if AI player should act
        this.listen(GameEvent.changeTurn, (data: GameEventsMap[GameEvent.changeTurn]) => {
            const currentPlayer = data.turn;
            console.log(`[AI] Turn changed to: ${currentPlayer}`);

            // Reset the processing flag when turn changes
            // This ensures we don't get stuck from a previous turn
            if (data.previousTurn && this.turnManager!.isAIPlayer(data.previousTurn)) {
                console.log('[AI] Previous turn was AI, resetting isProcessingTurn flag');
                this.isProcessingTurn = false;
                this.isForcedTurnEnd = false;
            }

            // Check if this is an AI-controlled player
            const isAI = this.turnManager!.isAIPlayer(currentPlayer);
            console.log(`[AI] Is AI player: ${isAI}`);

            if (isAI) {
                console.log(`[AI] Scheduling AI turn for player ${currentPlayer}`);
                // Give a small delay for UI to update
                setTimeout(() => this.turnManager!.processTurn(currentPlayer), 500);
            }
        });

        // Listen for conversation responses from the player
        this.listen(ConversationEvent.continue, () => {
            // Player has responded to conversation
            // Turn management is now handled when conversation starts, not when it continues
        });

        // Listen for combat events to record in AI context
        this.listen(GameEvent.combatEvent, (data: CombatEventData) => {
            if (this.contextBuilder) {
                this.contextBuilder.recordEvent({
                    type: data.type,
                    actor: data.actor,
                    target: data.target,
                    description: data.description,
                    turn: data.turn
                });
            }
        });

        // Listen for speech action execution
        this.listen(ConversationEvent.executeAction, async (data) => {
            const { action, actionData } = data;

            // DEBUG: console.log('[AIController] Executing speech action:', action);

            // Handle the action based on its type
            switch (action) {
                case 'map':
                    // DEBUG: console.log('[AIController] Generating new map from speech action');
                    await this.commandExecutor!.executeNarrativeMapGeneration();
                    break;
                    
                case 'character':
                    // DEBUG: console.log('[AIController] Spawning characters from speech action');
                    // Type guard for character action data
                    const charActionData = actionData as CharacterActionData;
                    if (charActionData?.characters) {
                        const charCommand: CharacterCommand = {
                            type: 'character',
                            characters: charActionData.characters
                        };
                        try {
                            await this.commandExecutor!.spawnCharacters(charCommand);
                        } catch (error) {
                            console.error('[AIController] Error spawning characters:', error);
                        }
                    } else {
                        console.warn('[AIController] Character action missing character data');
                    }
                    break;
                    
                case 'movement':
                    // DEBUG: console.log('[AIController] Executing movement from speech action');
                    // Type guard for movement action data
                    const moveActionData = actionData as MovementActionData;
                    if (moveActionData?.movements && this.state) {
                        // Execute movements for specified characters
                        for (const movement of moveActionData.movements) {
                            const character = this.state.characters.find(c =>
                                c.name.toLowerCase() === movement.name.toLowerCase()
                            );
                            if (character) {
                                const moveCommand: MovementCommand = {
                                    type: 'movement',
                                    characters: [{
                                        name: movement.name,
                                        location: movement.location
                                    }]
                                };
                                await this.commandExecutor!.executeMovement(moveCommand, character);
                            }
                        }
                    } else {
                        console.warn('[AIController] Movement action missing movement data');
                    }
                    break;
                    
                case 'attack':
                    // DEBUG: console.log('[AIController] Initiating combat from speech action');
                    // Type guard for attack action data
                    const attackActionData = actionData as AttackActionData;
                    if (attackActionData?.combatants && this.state) {
                        // Initiate combat between specified characters
                        for (const combatant of attackActionData.combatants) {
                            const character = this.state.characters.find(c =>
                                c.name.toLowerCase() === combatant.attacker.toLowerCase()
                            );
                            if (character) {
                                const attackCommand: AttackCommand = {
                                    type: 'attack',
                                    characters: [{
                                        name: combatant.attacker,
                                        target: combatant.target,
                                        // Attack type simplified - no longer needed
                                    }]
                                };
                                await this.commandExecutor!.executeAttack(attackCommand, character);
                            }
                        }
                    } else {
                        console.warn('[AIController] Attack action missing combatant data');
                    }
                    break;
                    
                case 'item':
                    // DEBUG: console.log('[AIController] Spawning items from speech action');
                    // Type guard for item action data
                    const itemActionData = actionData as ItemActionData;
                    if (itemActionData?.items) {
                        const itemCommand: ItemSpawnCommand = {
                            type: 'item',
                            items: itemActionData.items
                        };
                        await this.storyExecutor.executeItemSpawnCommand(itemCommand);
                    } else {
                        console.warn('[AIController] Item action missing item data');
                    }
                    break;
                    
                default:
                    console.warn(`[AIController] Unknown speech action: ${action}. Ignoring.`);
                    // Don't throw an error - just log and continue
                    // This allows for future action types without breaking the game
            }
        });
    }


    private isCharacterInCombat(character: DeepReadonly<ICharacter>): boolean {
        if (!this.state) return false;

        // Check if any hostile characters are nearby
        const nearbyDistance = 20;

        for (const other of this.state.characters) {
            if (other.name === character.name || other.health <= 0) continue;

            if (FactionService.areHostile(character, other, this.state.game.factions)) {
                const distance = Math.sqrt(
                    Math.pow(other.position.x - character.position.x, 2) +
                    Math.pow(other.position.y - character.position.y, 2)
                );

                if (distance <= nearbyDistance) {
                    return true;
                }
            }
        }

        return false;
    }

    public async processAIDialogue(dialogue: DialogueData): Promise<void> {
        if (!this.state || !this.contextBuilder || !dialogue.targetNPC || !dialogue.playerChoice) return;

        // Record the player's dialogue choice
        this.contextBuilder.recordEvent({
            type: 'dialogue',
            actor: dialogue.speaker || 'Player',
            target: dialogue.targetNPC,
            description: `${dialogue.speaker || 'Player'} says: "${dialogue.playerChoice}"`,
            turn: this.state.game.turn,
            dialogue: {
                speaker: dialogue.speaker || 'Player',
                content: dialogue.playerChoice,
                answers: []
            }
        });

        const context = this.contextBuilder.buildDialogueContext(dialogue, this.state);

        try {
            const language = this.state?.language || 'en';

            // Create a mutable copy of the story state if it exists
            let storyStateCopy: IStoryState | undefined;
            if (this.state?.story) {
                const story = this.state.story;
                storyStateCopy = {
                    selectedOrigin: story.selectedOrigin ? {
                        id: story.selectedOrigin.id,
                        name: story.selectedOrigin.name,
                        nameES: story.selectedOrigin.nameES,
                        description: story.selectedOrigin.description,
                        descriptionES: story.selectedOrigin.descriptionES,
                        startingLocation: story.selectedOrigin.startingLocation,
                        startingCompanion: story.selectedOrigin.startingCompanion ? {
                            name: story.selectedOrigin.startingCompanion.name,
                            type: story.selectedOrigin.startingCompanion.type,
                            description: story.selectedOrigin.startingCompanion.description
                        } : undefined,
                        initialInventory: [...story.selectedOrigin.initialInventory],
                        factionRelations: { ...story.selectedOrigin.factionRelations },
                        specialTraits: [...story.selectedOrigin.specialTraits],
                        narrativeHooks: [...story.selectedOrigin.narrativeHooks]
                    } : null,
                    currentChapter: story.currentChapter,
                    completedMissions: [...story.completedMissions],
                    majorDecisions: story.majorDecisions.map(d => ({
                        id: d.id,
                        missionId: d.missionId,
                        choice: d.choice,
                        consequences: [...d.consequences],
                        timestamp: d.timestamp
                    })),
                    factionReputation: { ...story.factionReputation },
                    storyFlags: new Set<string>(),
                    journalEntries: story.journalEntries.map(j => ({ ...j })),
                    storyPlan: story.storyPlan ? JSON.parse(JSON.stringify(story.storyPlan)) : undefined,
                    completedObjectives: story.completedObjectives ? [...story.completedObjectives] : undefined
                };
                // Copy story flags manually due to DeepReadonly Set issues
                if (story.storyFlags && storyStateCopy) {
                    // Use a for...of loop to iterate over the Set
                    const flagsIterator = (story.storyFlags as any).values();
                    for (const flag of flagsIterator) {
                        storyStateCopy.storyFlags.add(flag);
                    }
                }
            }

            const response = await this.gameEngineService.requestDialogueResponse(
                dialogue.speaker || 'Player',
                dialogue.targetNPC,
                dialogue.playerChoice,
                context as AIActionContext,
                storyStateCopy,
                language as LanguageCode
            );

            if (response.command && response.command.type === 'speech' && this.errorHandler && this.state) {
                // Use error handler for validation and retry
                const retryResult = await this.errorHandler.executeWithRetry(
                    response.command,
                    context as AIActionContext,
                    this.state,
                    language as LanguageCode
                );

                if (retryResult.success && retryResult.command) {
                    await this.commandExecutor!.executeSpeech(retryResult.command, {} as DeepReadonly<ICharacter>);

                    // Trigger world state update for conversation
                    this.triggerWorldStateUpdate('conversation',
                        [dialogue.speaker || 'Player', dialogue.targetNPC],
                        'neutral',
                        undefined
                    );
                } else if (retryResult.finalErrors) {
                    console.error('[AI] Dialogue validation failed:',
                        this.errorHandler.formatErrorFeedback(retryResult.finalErrors));
                }
            } else if (response.command && response.command.type === 'speech') {
                // Fallback if error handler not initialized
                await this.commandExecutor!.executeSpeech(response.command, {} as DeepReadonly<ICharacter>);

                // Trigger world state update for conversation
                this.triggerWorldStateUpdate('conversation',
                    [dialogue.speaker || 'Player', dialogue.targetNPC],
                    'neutral',
                    undefined
                );
            }
        } catch (error) {
            console.error('Error generating AI dialogue response:', error);
        }
    }

    private initializeWorldState(): void {
        try {
            // Get WorldState instance
            const worldState = WorldState.getInstance();

            // Initialize with current story state if available
            if (this.state?.story) {
                worldState.initialize(this.state.story);
                // DEBUG: console.log('[AI] WorldState initialized');
            }
        } catch (error) {
            console.error('[AI] Error initializing WorldState:', error);
        }
    }

    private triggerWorldStateUpdate(
        trigger: 'combat' | 'conversation' | 'discovery' | 'mission' | 'turn' | 'movement',
        participants?: string[],
        outcome?: string,
        location?: string
    ): void {
        try {
            const worldState = WorldState.getInstance();

            worldState.processUpdate({
                trigger,
                participants,
                outcome,
                location,
                metadata: {
                    turn: this.state?.game.turn
                }
            });
        } catch (error) {
            console.error('[AI] Error updating WorldState:', error);
        }
    }

    public async forceAIAction(character: DeepReadonly<ICharacter>): Promise<void> {
        // Allow manual triggering of AI actions for testing
        await this.turnManager!.processCharacterTurn(character);
    }

    public enableAI(): void {
        // Enable AI processing
        this.aiEnabled = true;
        // DEBUG: console.log('AI Controller enabled');
    }

    public disableAI(): void {
        // Disable AI processing (for testing or manual control)
        this.aiEnabled = false;
        // DEBUG: console.log('AI Controller disabled');
    }

    public isAIEnabled(): boolean {
        return this.aiEnabled;
    }

    public enableTacticalSystem(): void {
        this.useTacticalSystem = true;
        // DEBUG: console.log('[AI] Tactical system ENABLED - will use local tactical executor for follow-up combat actions');
    }

    public disableTacticalSystem(): void {
        this.useTacticalSystem = false;
        // DEBUG: console.log('[AI] Tactical system DISABLED - will always use AI endpoint for all decisions');
    }

    /**
     * Initialize the story when starting single player mode with an origin
     * Requests the AI to generate initial map, characters, and narrative setup
     */
    public async initializeStoryFromOrigin(): Promise<void> {
        // DEBUG: console.log('[AI] initializeStoryFromOrigin called');

        if (!this.state) {
            console.error('[AI] Cannot initialize story - no state available');
            return;
        }

        // DEBUG: console.log('[AI] State exists, checking story...');
        const storyState = this.state.story;
        // DEBUG: console.log('[AI] Story state:', {
        //     hasStory: !!storyState,
        //     hasSelectedOrigin: !!storyState?.selectedOrigin,
        //     originName: storyState?.selectedOrigin?.name
        // });

        if (!storyState?.selectedOrigin) {
            console.error('[AI] Cannot initialize story - no origin selected');
            console.error('[AI] Full story state:', storyState);
            return;
        }

        // DEBUG: console.log('[AI] Initializing story from origin:', storyState.selectedOrigin.name);
        // DEBUG: console.log('[AI] Origin details:', {
        //     id: storyState.selectedOrigin.id,
        //     nameES: storyState.selectedOrigin.nameES,
        //     startingLocation: storyState.selectedOrigin.startingLocation,
        //     traits: storyState.selectedOrigin.specialTraits
        // });

        try {
            // Create a non-readonly copy of the origin for the API call
            const originCopy: IOriginStory = {
                id: storyState.selectedOrigin.id,
                name: storyState.selectedOrigin.name,
                nameES: storyState.selectedOrigin.nameES,
                description: storyState.selectedOrigin.description,
                descriptionES: storyState.selectedOrigin.descriptionES,
                startingLocation: storyState.selectedOrigin.startingLocation,
                startingCompanion: storyState.selectedOrigin.startingCompanion ? {
                    name: storyState.selectedOrigin.startingCompanion.name,
                    type: storyState.selectedOrigin.startingCompanion.type,
                    description: storyState.selectedOrigin.startingCompanion.description
                } : undefined,
                initialInventory: [...storyState.selectedOrigin.initialInventory],
                factionRelations: { ...storyState.selectedOrigin.factionRelations },
                specialTraits: [...storyState.selectedOrigin.specialTraits],
                narrativeHooks: [...storyState.selectedOrigin.narrativeHooks]
            };

            // Create a non-readonly copy of the story state
            const storyStateCopy: IStoryState = {
                selectedOrigin: originCopy,
                currentChapter: storyState.currentChapter,
                completedMissions: [...storyState.completedMissions],
                majorDecisions: storyState.majorDecisions.map(d => ({
                    id: d.id,
                    missionId: d.missionId,
                    choice: d.choice,
                    consequences: [...d.consequences],
                    timestamp: d.timestamp
                })),
                factionReputation: { ...storyState.factionReputation },
                // Use the origin's special traits as the initial story flags
                storyFlags: new Set<string>(originCopy.specialTraits),
                journalEntries: storyState.journalEntries.map(j => ({ ...j }))
            };

            // Request story initialization from AI
            // DEBUG: console.log('[AI] Calling AIGameEngineService.requestStoryInitialization...');
            const language = this.state?.language || 'en';
            const response = await this.gameEngineService.requestStoryInitialization(
                originCopy,
                storyStateCopy,
                language as LanguageCode
            );

            // DEBUG: console.log('[AI] Response received:', {
            //     hasResponse: !!response,
            //     hasCommands: !!response?.commands,
            //     commandCount: response?.commands?.length || 0,
            //     hasNarrative: !!response?.narrative
            // });

            if (!response) {
                console.error('[AI] Failed to get story initialization response');
                return;
            }

            // Execute the initialization commands
            // These should include map generation, character spawning, and initial narrative
            if (response.commands && Array.isArray(response.commands)) {
                // DEBUG: console.log('[AI] Executing story initialization commands:', response.commands.length);

                // Validate all commands using StoryInitializationValidator
                const storyValidator = new StoryInitializationValidator(this.validator!);
                const validationResult = storyValidator.validateInitializationCommands(response.commands);

                if (!validationResult.isValid) {
                    console.error('[AI] Story initialization commands validation failed:');
                    console.error(storyValidator.formatErrors(validationResult.errors));

                    // Send error feedback to AI for correction
                    if (this.errorHandler) {
                        // Build error feedback for retry
                        const errorFeedback = {
                            originalCommand: { commands: response.commands },
                            errors: validationResult.errors,
                            retryCount: 1,
                            maxRetries: 3
                        };

                        // Log the error and don't execute invalid commands
                        console.error('[AI] Story initialization validation errors:',
                            this.errorHandler.formatErrorFeedback(errorFeedback));
                    }

                    // Don't execute invalid commands - this would violate our principle
                    return;
                }

                // Execute validated commands
                for (const command of response.commands) {
                    const validatedCommand = this.commandParser.validate(command);
                    if (validatedCommand) {
                        // DEBUG: console.log('[AI] Executing initialization command:', validatedCommand.type);

                        // Execute commands without a specific character context
                        // These are story-level commands like map generation
                        // Pass an empty character for story-level commands
                        // Use center of map for dummy position instead of (0,0)
                        const mapWidth = this.state?.map[0]?.length || 50;
                        const mapHeight = this.state?.map.length || 50;
                        const emptyCharacter: DeepReadonly<ICharacter> = {
                            name: '',
                            controller: '',
                            faction: 'neutral',
                            position: { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) },
                            direction: 'down' as Direction,
                            health: 0,
                            maxHealth: 0,
                            palette: { skin: '', helmet: '', suit: '' },
                            race: 'human',
                            description: '',
                            action: 'idle',
                            actions: {
                                pointsLeft: 0,
                                general: { move: 0, talk: 0, use: 0, inventory: 0 },
                                rangedCombat: { shoot: 0, aim: 0, overwatch: 0, cover: 0, throw: 0 },
                                closeCombat: { powerStrike: 0, slash: 0, fastAttack: 0, feint: 0, breakGuard: 0 }
                            },
                            path: [],
                            location: '',
                            blocker: true,
                            inventory: {
                                items: [],
                                maxWeight: 0,
                                equippedWeapons: {
                                    primary: null,
                                    secondary: null
                                }
                            }
                        };
                        await this.commandExecutor!.executeCommand(validatedCommand, emptyCharacter);

                        // Small delay between commands for stability and state updates
                        await new Promise(resolve => setTimeout(resolve, 200));

                        // If this was a map command, ensure validator gets the updated state
                        if (validatedCommand.type === 'map' && this.state && this.validator) {
                            this.validator = new AICommandValidator(this.state);
                            if (this.errorHandler) {
                                this.errorHandler = new AIErrorHandler(this.validator, this.gameEngineService);
                            }
                        }
                    } else {
                        // This should not happen if StoryInitializationValidator worked correctly
                        console.error('[AI] Command passed batch validation but failed individual validation:', command);
                        // Don't continue with invalid commands
                        break;
                    }
                }
            }

            // If there's an initial narrative message, display it
            if (response.narrative) {
                // DEBUG: console.log('[AI] Initial narrative received:', response.narrative);

                // Show the narrative as a conversation from the narrator
                // Use empty answers array to show close button instead of continue
                this.dispatch(ConversationEvent.update, {
                    type: 'speech',
                    source: i18n.t('conversation.narrator'),
                    content: response.narrative,
                    answers: [],  // Empty array means show close button
                    action: undefined
                });
            } else {
                // DEBUG: console.log('[AI] No narrative text in response');
            }

            // DEBUG: console.log('[AI] Story initialization complete');

        } catch (error) {
            console.error('[AI] Error initializing story:', error);
            console.error('[AI] Error details:', {
                message: (error as Error).message,
                stack: (error as Error).stack
            });
        }
    }
}