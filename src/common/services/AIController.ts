/* eslint-disable no-case-declarations */
import { EventBus } from '../events/EventBus';
import {
    ControlsEvent,
    UpdateStateEvent,
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
import { AIContextBuilder, type AIGameContext } from './AIContextBuilder';
import { AICommandParser, AICommand, MovementCommand, AttackCommand, SpeechCommand, CharacterCommand, MapCommand } from './AICommandParser';
import { AIGameEngineService, type AIActionContext } from './AIGameEngineService';
import { AICommandValidator } from './AICommandValidator';
import { AIErrorHandler } from './AIErrorHandler';
import { TacticalExecutor } from './TacticalExecutor';
import { CombatStances } from './CombatStances';
import { StoryCommandExecutor, ItemSpawnCommand } from './StoryCommandExecutor';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';
import { StoryPlanner } from './StoryPlanner';
import { WorldState } from './WorldState';
import { ICharacter, ICoord, Direction, IOriginStory, IStoryState, IScreenContext } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { calculatePath } from '../helpers/map';
import { FactionService } from './FactionService';
import { MAIN_CHARACTER_NAME, type LanguageCode } from '../constants';
import { i18n } from '../i18n/i18n';

interface DialogueData {
    speaker?: string;
    listener?: string;
    targetNPC?: string;
    playerChoice?: string;
    needsAIResponse?: boolean;
}

interface ExtendedGame {
    turn: string;
    players: readonly string[];
    playerInfo?: Record<string, { name: string; isAI?: boolean }>;
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
            if (data.previousTurn && this.isAIPlayer(data.previousTurn)) {
                console.log('[AI] Previous turn was AI, resetting isProcessingTurn flag');
                this.isProcessingTurn = false;
                this.isForcedTurnEnd = false;
            }

            // Check if this is an AI-controlled player
            const isAI = this.isAIPlayer(currentPlayer);
            console.log(`[AI] Is AI player: ${isAI}`);

            if (isAI) {
                console.log(`[AI] Scheduling AI turn for player ${currentPlayer}`);
                // Give a small delay for UI to update
                setTimeout(() => this.processAIPlayerTurn(currentPlayer), 500);
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
                    await this.executeNarrativeMapGeneration();
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
                            await this.spawnCharacters(charCommand);
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
                                await this.executeMovement(moveCommand, character);
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
                                await this.executeAttack(attackCommand, character);
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

    private isAIPlayer(playerId: string): boolean {
        if (!this.state) {
            console.error('[AI] isAIPlayer - No state available');
            return false;
        }
        // Check if this player is marked as AI in the game state
        const game = this.state.game as ExtendedGame;
        const playerInfo = game.playerInfo?.[playerId];
        console.log('[AI] isAIPlayer check:', {
            playerId,
            playerInfo,
            hasPlayerInfo: !!game.playerInfo,
            allPlayerInfo: game.playerInfo
        });

        // This maintains backward compatibility
        if (!game.playerInfo) {
            console.warn('[AIController] No playerInfo in game state, using fallback check');
            return playerId === 'ai';
        }
        return playerInfo?.isAI === true;
    }

    // Removed isAIControlled - not used

    private async processAIPlayerTurn(playerId: string): Promise<void> {
        console.log(`[AI] processAIPlayerTurn called for player: ${playerId}`);

        if (!this.state) {
            console.error('[AI] processAIPlayerTurn - No state available');
            return;
        }

        // Log all characters and their player assignments for debugging
        console.log('[AI] Current characters in game:');
        this.state.characters.forEach((c: DeepReadonly<ICharacter>) => {
            console.log(`  - ${c.name}: controller=${c.controller}, faction=${c.faction}, health=${c.health}`);
        });

        // When it's an AI player's turn, find their characters and take actions
        const aiCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) => c.controller === playerId);
        console.log(`[AI] Found ${aiCharacters.length} AI characters for player ${playerId}`);

        if (aiCharacters.length === 0) {
            console.warn(`[AI] No characters found for AI player ${playerId}`);
            console.warn('[AI] Make sure enemy faction characters are assigned to the AI player');
            return;
        }

        // Clear the forced turn end flag at the start of a new AI turn
        this.isForcedTurnEnd = false;

        // Clear speech movement attempts for new turn
        this.speechMovementAttempts.clear();

        // Set flag to prevent individual actions from ending the turn
        this.isProcessingMultipleCharacters = true;

        // Clear any pending timeouts from previous actions
        this.clearMovementTimeouts();

        // Clear tactical executor's turn tracking for new turn
        this.tacticalExecutor.clearTurnActions();

        // Process all AI characters in sequence
        // In single player, this includes both Data and enemy characters
        for (const character of aiCharacters) {
            // Skip dead characters
            if (character.health <= 0) {
                continue;
            }

            // Check if we should stop processing (e.g., if conversation started)
            if (this.state && this.state.game.turn !== playerId) {
                break;
            }

            try {
                await this.processAICharacterTurn(character);
            } catch (error) {
                console.error(`[AI] Error processing ${character.name}'s turn:`, error);
                // Continue with next character
            }

            // Add a small delay between character actions for better visibility
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Clear any remaining timeouts
        this.clearMovementTimeouts();

        // Clear the flag
        this.isProcessingMultipleCharacters = false;

        // Only end turn if it's still the AI's turn (conversation might have ended it already)
        if (this.state && this.state.game.turn === playerId) {
            this.endAITurn();
        }
    }

    private async processAICharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        console.log(`[AI] processAICharacterTurn called for character: ${character.name}`);

        if (this.isProcessingTurn) {
            console.warn('[AI] Already processing turn, skipping');
            return;
        }
        if (!this.aiEnabled) {
            console.warn('[AI] AI is disabled');
            return;
        }
        if (!this.state) {
            console.error('[AI] No state available');
            return;
        }
        if (!this.contextBuilder) {
            console.error('[AI] No contextBuilder available');
            return;
        }

        console.log('[AI] Starting to process character turn');
        this.isProcessingTurn = true;

        try {
            // Keep taking actions until we run out of action points
            let actionsPerformed = 0;
            const maxActions = 5; // Safety limit to prevent infinite loops

            while (actionsPerformed < maxActions) {
                // Wait a moment to ensure state is updated
                await new Promise(resolve => setTimeout(resolve, 100));

                // Get current character state (it may have changed after actions)
                const currentChar = this.state.characters.find(c => c.name === character.name);
                if (!currentChar) {
                    break;
                }

                // Check if character is defeated
                if (currentChar.health <= 0) {
                    break;
                }

                // Check if turn changed (e.g., due to conversation)
                if (this.state.game.turn !== currentChar.controller) {
                    break;
                }

                // Check if character has enough action points to continue
                const pointsLeft = currentChar.actions?.pointsLeft || 0;

                if (pointsLeft <= 0) {
                    // No points left at all
                    break;
                }

                // If we have very few points and have already performed actions, stop
                if (pointsLeft < 20 && actionsPerformed > 0) {
                    // Clear any ongoing movement
                    if (this.ongoingMovement?.characterName === currentChar.name) {
                        this.ongoingMovement = undefined;
                    }
                    break;
                }

                // Clear ongoing movement - each action should be a fresh AI decision
                // This prevents characters from moving multiple times per turn
                if (this.ongoingMovement?.characterName === currentChar.name) {
                    this.ongoingMovement = undefined;
                }

                // Check if there's a pending speech command from previous movement
                const pendingSpeech = this.pendingSpeechCommands.get(currentChar.name);
                if (pendingSpeech) {
                    // Check if we're now close enough to execute the pending speech
                    const speaker = currentChar;
                    const humanCharacters = this.state.characters.filter(c => c.controller === 'human' && c.health > 0);

                    // Check if speaker can talk to any human character
                    let canTalkToAnyHuman = false;
                    for (const humanChar of humanCharacters) {
                        const distance = this.getDistance(speaker.position, humanChar.position);
                        const viewDistance = 15; // Standard view distance
                        // For conversations, ignore characters blocking - only walls should block speech
                        const hasLineOfSight = this.checkLineOfSight(speaker.position, humanChar.position, true);

                        if (distance <= 8 && distance <= viewDistance && hasLineOfSight) {
                            canTalkToAnyHuman = true;
                            break;
                        }
                    }

                    if (canTalkToAnyHuman) {
                        // Close enough and visible to at least one human - execute the pending speech
                        this.pendingSpeechCommands.delete(currentChar.name);
                        this.speechMovementAttempts.delete(currentChar.name);  // Clear attempts on success
                        await this.executeSpeech(pendingSpeech, currentChar);
                        actionsPerformed++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                }

                // Check if there are any living enemies to interact with
                // Enemy is determined by different faction, not different player
                const hasLivingEnemies = this.state.characters.some(c =>
                    c.health > 0 &&
                    c.faction !== currentChar.faction &&
                    c.name !== currentChar.name
                );

                // Always try narrative AI first if there are enemies
                // This allows the AI to decide whether to attack, talk, move, etc.
                if (hasLivingEnemies) {
                    // On first action, always use narrative AI to get strategic decision
                    // On subsequent actions, can use tactical if enabled
                    if (actionsPerformed === 0 || !this.useTacticalSystem) {
                        // Call AI endpoint for decision
                        await this.processNarrativeCharacterTurn(currentChar);
                    } else if (this.useTacticalSystem && this.isCharacterInCombat(currentChar)) {
                        // Use tactical executor for follow-up combat decisions
                        await this.processTacticalCharacterTurn(currentChar);
                    } else {
                        // Default to narrative AI
                        await this.processNarrativeCharacterTurn(currentChar);
                    }
                } else {
                    // No enemies left - skip expensive API call
                    // Could do non-combat actions here like exploring, but for now just skip
                }

                actionsPerformed++;

                // Small delay between actions for visibility
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Final check for pending speech after all actions/movement is done
            // This handles the case where character used all action points moving closer
            const finalPendingSpeech = this.pendingSpeechCommands.get(character.name);
            if (finalPendingSpeech && this.state) {
                const currentChar = this.state.characters.find(c => c.name === character.name);
                if (currentChar && currentChar.health > 0) {
                    const speaker = currentChar;
                    const humanCharacters = this.state.characters.filter(c => c.controller === 'human' && c.health > 0);

                    // Check if speaker can talk to any human character
                    let canTalkToAnyHuman = false;
                    let closestDistance = Infinity;

                    for (const humanChar of humanCharacters) {
                        const distance = this.getDistance(speaker.position, humanChar.position);
                        const viewDistance = 15; // Standard view distance
                        const hasLineOfSight = this.checkLineOfSight(speaker.position, humanChar.position, true);

                        if (distance <= 8 && distance <= viewDistance && hasLineOfSight) {
                            canTalkToAnyHuman = true;
                            if (distance < closestDistance) {
                                closestDistance = distance;
                            }
                        }
                    }

                    if (canTalkToAnyHuman) {
                        // Close enough - execute the pending speech even with no action points
                        this.pendingSpeechCommands.delete(character.name);
                        this.speechMovementAttempts.delete(character.name);  // Clear attempts on success
                        await this.executeSpeech(finalPendingSpeech, currentChar);
                    } else {
                        this.pendingSpeechCommands.delete(character.name); // Clear it
                        this.speechMovementAttempts.delete(character.name);  // Clear attempts
                    }
                }
            }
        } catch (error) {
            console.error('[AI] Error:', error);
        } finally {
            // Only reset isProcessingTurn if the turn wasn't force-ended by conversation
            // This prevents the AI from processing again when it shouldn't
            console.log('[AI] Finally block - isForcedTurnEnd:', this.isForcedTurnEnd);
            if (!this.isForcedTurnEnd) {
                console.log('[AI] Clearing isProcessingTurn flag');
                this.isProcessingTurn = false;
            } else {
                console.log('[AI] NOT clearing isProcessingTurn due to forced end');
            }
        }
    }

    private async processTacticalCharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        // Trigger world state update for turn
        this.triggerWorldStateUpdate('turn', [character.name], undefined, undefined);
        if (!this.state || !this.contextBuilder) return;

        // Build context
        const context = this.contextBuilder.buildTurnContext(character, this.state);


        // Get visible characters (excluding dead ones)
        const visibleCharacters = context.visibleCharacters
            .map(vc => this.state!.characters.find(c => c.name === vc.name))
            .filter(c => c !== undefined && c.health > 0) as DeepReadonly<ICharacter>[];

        // Use tactical executor to decide action
        const tacticalAction = this.tacticalExecutor.evaluateSituation(
            character,
            this.state,
            visibleCharacters
        );

        // Execute the tactical action
        const validatedCommand = this.commandParser.validate(tacticalAction.command);
        if (validatedCommand) {
            // DEBUG: console.log(`[AI-Tactical] ${character.name}: ${tacticalAction.type} - ${tacticalAction.reasoning}`);
            await this.executeAICommand(validatedCommand, character);
        } else {
            console.error(`[AI-Tactical] ${character.name}: Invalid command from tactical executor`);
            // End turn if no valid command
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
        }
    }

    private async processNarrativeCharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state || !this.contextBuilder) return;

        // Build context for AI
        const context = this.contextBuilder.buildTurnContext(character, this.state);

        // Get story context for enhanced AI decision making
        const storyState = this.state.story;
        let screenContext: IScreenContext | null = null;
        let storyStateForPlanner: IStoryState | undefined;
        
        // Get language early for use in multiple places
        const language = this.state?.language || 'es';

        if (storyState) {
            const currentMission = storyState.storyPlan?.acts[storyState.storyPlan.currentAct]?.missions
                .find(m => m.id === storyState.currentMissionId) || null;

            const visibleCharacters = Array.from(this.state.characters.values())
                .filter(c => c.name !== character.name);

            // Create a proper IStoryState object from the DeepReadonly version
            // Deep clone to convert DeepReadonly arrays to mutable arrays
            const selectedOrigin = storyState.selectedOrigin ? {
                id: storyState.selectedOrigin.id,
                name: storyState.selectedOrigin.name,
                nameES: storyState.selectedOrigin.nameES,
                description: storyState.selectedOrigin.description,
                descriptionES: storyState.selectedOrigin.descriptionES,
                startingLocation: storyState.selectedOrigin.startingLocation,
                startingCompanion: storyState.selectedOrigin.startingCompanion ? { ...storyState.selectedOrigin.startingCompanion } : undefined,
                initialInventory: [...storyState.selectedOrigin.initialInventory],
                factionRelations: { ...storyState.selectedOrigin.factionRelations },
                specialTraits: [...storyState.selectedOrigin.specialTraits],
                narrativeHooks: [...storyState.selectedOrigin.narrativeHooks]
            } : null;

            const majorDecisions = storyState.majorDecisions.map(d => ({
                id: d.id,
                missionId: d.missionId,
                choice: d.choice,
                consequences: [...d.consequences],
                timestamp: d.timestamp
            }));

            const storyPlan = storyState.storyPlan ? JSON.parse(JSON.stringify(storyState.storyPlan)) : undefined;

            storyStateForPlanner = {
                selectedOrigin,
                currentChapter: storyState.currentChapter,
                completedMissions: [...storyState.completedMissions],
                majorDecisions,
                factionReputation: { ...storyState.factionReputation },
                storyFlags: (() => {
                    // Workaround for DeepReadonly Set issue
                    const flagsArray: string[] = [];
                    (storyState.storyFlags as Set<string>).forEach((flag: string) => flagsArray.push(flag));
                    return new Set<string>(flagsArray);
                })(),
                journalEntries: storyState.journalEntries.map(e => ({ ...e })),
                storyPlan,
                currentMissionId: storyState.currentMissionId,
                completedObjectives: storyState.completedObjectives ? [...storyState.completedObjectives] : undefined
            };

            if (storyStateForPlanner) {
                screenContext = await this.storyPlanner.getScreenContext(
                    currentMission ? JSON.parse(JSON.stringify(currentMission)) : null,
                    visibleCharacters.map(c => JSON.parse(JSON.stringify(c))) as ICharacter[],
                    storyStateForPlanner,
                    language as LanguageCode
                );
            }

            // Add screen context to AI context with proper typing
            if (screenContext) {
                const contextWithScreen = context as AIGameContext;
                contextWithScreen.screenContext = screenContext;
            }
        }


        // Add location to current character in context
        const contextWithLocation = {
            ...context,
            currentCharacter: {
                ...context.currentCharacter,
                location: this.getCurrentRoomName(character)
            }
        };

        // Get AI decision from game engine with story context
        const response = await this.gameEngineService.requestAIAction(contextWithLocation, undefined, storyStateForPlanner, language as LanguageCode);

        // Tactical directive removed - using story-driven decisions instead

        // Parse and execute AI commands with new validation system
        if (response.command && this.errorHandler && this.state) {
            const retryResult = await this.errorHandler.executeWithRetry(
                response.command,
                contextWithLocation,
                this.state,
                language
            );

            if (retryResult.success && retryResult.command) {
                const validatedCommand = retryResult.command;
                // Log the AI decision with more context
                if (validatedCommand.type === 'attack') {
                    const attackCmd = validatedCommand as AttackCommand;
                    const target = attackCmd.characters?.[0]?.target;
                    if (!target) {
                        console.warn('[AI] Invalid attack command - missing target');
                        return;
                    }
                    console.log(`[AI] ${character.name}: Attack vs ${target}`);
                } else if (validatedCommand.type === 'speech') {
                    const speechCmd = validatedCommand as SpeechCommand;
                    console.log(`[AI] ${character.name}: Speech - "${speechCmd.content?.substring(0, 50)}..."`);
                } else if (validatedCommand.type === 'movement') {
                    const moveCmd = validatedCommand as MovementCommand;
                    console.log(`[AI] ${character.name}: Move to ${moveCmd.characters?.[0]?.location}`);
                } else {
                    console.log(`[AI] ${character.name}: ${validatedCommand.type}`);
                }
                await this.executeAICommand(validatedCommand, character);
            } else if (retryResult.finalErrors) {
                // All retries failed - log the errors
                console.error('[AI] Command validation failed after retries:',
                    this.errorHandler.formatErrorFeedback(retryResult.finalErrors));
            }
        } else if (response.command) {
            // Fallback to old validation if new system not initialized
            const validatedCommand = this.commandParser.validate(response.command);
            if (validatedCommand) {
                await this.executeAICommand(validatedCommand, character);
            } else {
                console.error('[AI] Invalid command:', response.command);
            }
        }
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

    private async executeAICommand(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        const validatedCommand = this.commandParser.validate(command);
        if (!validatedCommand) {
            console.error('[AI] Invalid command');
            return;
        }

        // Get current story state if available
        const storyState = this.state?.story;

        switch (validatedCommand.type) {
            case 'movement':
                await this.executeMovement(validatedCommand, character);
                break;
            case 'attack':
                await this.executeAttack(validatedCommand, character);
                break;
            case 'speech':
                await this.executeSpeech(validatedCommand, character);
                break;
            case 'character':
                try {
                    await this.spawnCharacters(validatedCommand);
                } catch (error) {
                    if (error instanceof CharacterPositioningError) {
                        console.error('[AI] Character spawn positioning failed:', error.message);
                        await this.handlePositioningError(error, validatedCommand as CharacterCommand);
                    } else {
                        throw error;
                    }
                }
                break;
            case 'map':
                // Convert DeepReadonly<IStoryState> to IStoryState for story executor
                const storyStateForMap = storyState ? JSON.parse(JSON.stringify(storyState)) as IStoryState : undefined;
                try {
                    const mapCommand = validatedCommand as MapCommand;
                    await this.storyExecutor.executeMapCommand(mapCommand, storyStateForMap, mapCommand.seed);
                } catch (error) {
                    if (error instanceof CharacterPositioningError) {
                        console.error('[AI] Character positioning failed:', error.message);
                        // Send error feedback to AI and request correction
                        await this.handlePositioningError(error, validatedCommand as MapCommand);
                    } else {
                        throw error;
                    }
                }
                break;
            case 'item':
                await this.storyExecutor.executeItemSpawnCommand(validatedCommand as ItemSpawnCommand);
                break;
            default:
                console.warn('[AI] Unknown command type:', validatedCommand.type);
                this.endAITurn();
        }
    }

    private async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        // Find target location
        const movementCmd = command as MovementCommand;
        const characters = movementCmd.characters;
        if (!characters || !characters[0]) {
            throw new Error('[AI] ExecuteMovement - No characters in command');
        }
        const targetLocationString = characters[0].location;

        let targetLocation: ICoord | null = null;
        try {
            // Allow coordinates if the location string looks like coordinates (e.g., "11,12")
            // This is for internal system use (e.g., when executeSpeech generates movement to line-of-sight positions)
            const isCoordinate = /^\d+,\s*\d+$/.test(targetLocationString);
            targetLocation = this.resolveLocation(targetLocationString, character, isCoordinate);
        } catch (error) {
            console.error(`[AI] ExecuteMovement - Failed to resolve location for ${character.name}:`, error);

            // End the turn properly on invalid location
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }

        if (!targetLocation || !isFinite(targetLocation.x) || !isFinite(targetLocation.y) ||
            targetLocation.x < -1000 || targetLocation.x > 1000 ||
            targetLocation.y < -1000 || targetLocation.y > 1000) {
            console.error('[AI] ExecuteMovement - Invalid resolved location:', targetLocationString, targetLocation);
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }

        // Check if we're already at the target location (distance 0)
        const currentDistance = this.getDistance(character.position, targetLocation);
        if (currentDistance === 0) {
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }

        // Log the movement decision
        const targetChar = this.state?.characters.find((c: DeepReadonly<ICharacter>) =>
            c.position.x === targetLocation.x && c.position.y === targetLocation.y
        );

        // Ongoing movement tracking disabled to prevent multiple movements per turn
        // Each action loop iteration should request a fresh AI decision
        // if (currentDistance > 3) {
        //     this.ongoingMovement = {
        //         characterName: character.name,
        //         targetLocation: targetLocation,
        //         targetName: targetChar?.name,
        //         targetLocationString: targetLocationString
        //     };
        //     console.log(`[AI] Setting ongoing movement for ${character.name} to ${targetChar?.name || targetLocationString}`);
        // }

        // If we're already adjacent (within 1.5 cells), switch to appropriate action
        if (currentDistance <= 1.5) {
            // Check if we have a pending speech command
            const pendingSpeech = this.pendingSpeechCommands.get(character.name);
            if (pendingSpeech) {
                this.pendingSpeechCommands.delete(character.name); // Clear the pending command
                await this.executeSpeech(pendingSpeech, character);
                return;
            }

            // Check if the target is a character we can interact with
            const targetChar = this.state?.characters.find((c: DeepReadonly<ICharacter>) =>
                c.position.x === targetLocation.x && c.position.y === targetLocation.y
            );

            if (targetChar && targetChar.controller !== character.controller && targetChar.name === MAIN_CHARACTER_NAME) {
                // Create a speech command
                const speechCommand: AICommand = {
                    type: 'speech',
                    source: character.name,
                    content: 'Hello! Do you need help?',
                    answers: ['Yes, please', 'No, I\'m fine', 'Maybe later']
                };
                await this.executeSpeech(speechCommand, character);
                return;
            }

            this.endAITurn();
            return;
        }

        // For AI characters, calculate the full path directly without entering movement mode
        const path = calculatePath(
            character.position,
            targetLocation,
            this.state!.map,
            this.state!.characters,
            character.name
        );

        if (path.length === 0) {
            console.warn('[AI] No path to target found');

            // Detect what's blocking the path
            const blockage = this.detectBlockingEntity(character.position, targetLocation);

            if (blockage.type === 'character' && blockage.character && this.state) {
                const isAlly = FactionService.areAllied(character, blockage.character, this.state.game.factions);
                console.log(`[AI] Path blocked by ${isAlly ? 'ally' : 'enemy'}: ${blockage.character.name} (health: ${blockage.character.health})`);

                // Request new AI instructions with context about the blockage
                const blockageContext = {
                    blocked: true,
                    blockingCharacter: {
                        name: blockage.character.name,
                        isAlly: isAlly,
                        health: blockage.character.health,
                        maxHealth: blockage.character.maxHealth,
                        position: blockage.character.position,
                        distance: this.getDistance(character.position, blockage.character.position)
                    },
                    originalTarget: targetChar?.name || 'location',
                    message: `Cannot reach ${targetChar?.name || 'target location'} - ${blockage.character.name} is blocking the path.`
                };

                // Build special context and request new action from AI
                if (!this.contextBuilder) {
                    console.error('[AI] No context builder available');
                    if (!this.isProcessingMultipleCharacters) {
                        this.endAITurn();
                    }
                    return;
                }

                const context = this.contextBuilder.buildTurnContext(character, this.state);
                // Create a new context object with blockage info as string (as expected by AIActionContext)
                // Also add location to current character
                const contextWithBlockage = {
                    ...context,
                    currentCharacter: {
                        ...context.currentCharacter,
                        location: this.getCurrentRoomName(character)
                    },
                    blockageInfo: JSON.stringify(blockageContext)
                } as unknown as AIGameContext;

                console.log('[AI] Requesting new instructions due to blocked path');
                const language = this.state?.language || 'en';
                const response = await this.gameEngineService.requestAIAction(contextWithBlockage as unknown as AIActionContext, undefined, undefined, language as LanguageCode);

                if (response.command) {
                    const validatedCommand = this.commandParser.validate(response.command);
                    if (validatedCommand) {
                        // DEBUG: console.log(`[AI] New action after blockage: ${validatedCommand.type}`);
                        await this.executeAICommand(validatedCommand, character);
                        return;
                    }
                }
            } else if (blockage.type === 'wall') {
                // DEBUG: console.log('[AI] Path blocked by wall/obstacle');
            }

            // If no alternative found, end turn
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }

        // Calculate how many cells we can move based on action points
        const moveCost = character.actions.general.move;
        const pointsLeft = character.actions.pointsLeft;
        const maxCellsToMove = Math.floor(pointsLeft / moveCost);

        // Move as far as we can toward the target (up to maxCellsToMove cells)
        const cellsToMove = Math.min(path.length, maxCellsToMove);

        if (cellsToMove === 0) {
            // DEBUG: console.log('[AI] Not enough action points to move');
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }

        // Get the destination cell (either the target or as far as we can go)
        const moveToIndex = cellsToMove - 1; // -1 because array is 0-indexed
        const moveToDest = path[moveToIndex];

        // Check if destination is occupied by another character
        if (moveToDest && this.state) {
            const occupyingChar = this.state.characters.find((c: DeepReadonly<ICharacter>) =>
                c.name !== character.name &&
                Math.round(c.position.x) === Math.round(moveToDest.x) &&
                Math.round(c.position.y) === Math.round(moveToDest.y) &&
                c.health > 0
            );

            if (occupyingChar) {
                console.warn(`[AI] Cannot move ${character.name} - destination (${moveToDest.x}, ${moveToDest.y}) occupied by ${occupyingChar.name}`);
                if (!this.isProcessingMultipleCharacters) {
                    this.endAITurn();
                }
                return;
            }
        }

        // DEBUG: console.log(`[AI] Moving ${cellsToMove} cells toward target (${path.length} total cells to target)`);

        // Directly set the character's path to move them
        // This will trigger the animation system to move the character
        const pathToMove = path.slice(0, cellsToMove);
        this.dispatch(UpdateStateEvent.characterPath, {
            ...character,
            path: pathToMove
        });

        // After movement completes, check if we need to execute pending speech or continue moving
        const timeoutId = setTimeout(async () => {
            // Don't do anything if we're processing multiple characters
            if (this.isProcessingMultipleCharacters) {
                return;
            }

            // Check if we're still in AI turn (movement might have changed it)
            if (this.state && this.state.game.turn === character.controller) {
                // Check if we have a pending speech command and are now close enough
                const pendingSpeech = this.pendingSpeechCommands.get(character.name);
                if (pendingSpeech && moveToDest) {
                    const newDistance = this.getDistance(moveToDest, targetLocation);
                    const viewDistance = 15; // Standard view distance
                    // For conversations, ignore characters blocking - only walls should block speech
                    const hasLineOfSight = this.checkLineOfSight(moveToDest, targetLocation, true);

                    // Check if within speaking range, view range, and has line of sight
                    if (newDistance <= 8 && newDistance <= viewDistance && hasLineOfSight) {
                        this.pendingSpeechCommands.delete(character.name);
                        await this.executeSpeech(pendingSpeech, character);
                        return;
                    }
                }

                // Movement complete - next action loop will request fresh AI decision
                // No longer using ongoingMovement to prevent multiple moves per turn
                this.ongoingMovement = undefined;
            }
        }, 1500); // Wait for movement animation to complete

        // Store timeout so we can cancel it if needed
        this.movementTimeouts.push(timeoutId);
    }

    private async executeAttack(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state) {
            console.error('[AI] ExecuteAttack - No state available');
            return;
        }

        const attackCmd = command as AttackCommand;
        const chars = attackCmd.characters;
        if (!chars || !chars[0]) {
            // DEBUG: console.log('[AI] ExecuteAttack - No characters in command');
            return;
        }
        const attackData = chars[0];

        // Handle 'area' target for overwatch - removed with simplified attack
        if (attackData.target === 'area') {
            // Set overwatch without specific target
            this.dispatch(ControlsEvent.showOverwatch, character.name);
            await new Promise<void>(resolve => {
                setTimeout(() => {
                    const frontPosition = this.getPositionInFront(character);
                    this.dispatch(ControlsEvent.cellClick, frontPosition);
                    // Don't end turn if processing multiple characters
                    if (!this.isProcessingMultipleCharacters) {
                        this.endAITurn();
                    }
                    resolve();
                }, 100);
            });
            return;
        }

        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) =>
            c.name.toLowerCase() === (attackData.target as string).toLowerCase()
        );

        if (!targetChar) {
            console.error('[AI] ExecuteAttack - Target not found:', attackData.target);
            // End turn if no valid target
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }


        // Dispatch attack event - simplified without attack types
        const distance = this.getDistance(character.position, targetChar.position);
        if (distance <= 1.5) {
            // Melee attack if adjacent
            this.dispatch(ControlsEvent.toggleMelee, character.name);
            // After a delay, click on target character
            await new Promise<void>(resolve => {
                setTimeout(() => {
                    this.dispatch(ControlsEvent.characterClick, {
                        characterName: targetChar.name,
                        position: targetChar.position
                    });
                    resolve();
                }, 500);
            });
        } else {
            // Ranged attack if not adjacent
            const hasLineOfSight = this.checkLineOfSight(character.position, targetChar.position);

            if (!hasLineOfSight) {
                // Move closer to target instead of shooting
                await this.executeMovement({
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: targetChar.name
                    }]
                }, character);
                return;
            }

            // First, rotate to face the target
            const angle = Math.atan2(
                targetChar.position.y - character.position.y,
                targetChar.position.x - character.position.x
            );
            const direction = this.angleToDirection(angle);

            // Update character direction
            this.dispatch(UpdateStateEvent.characterDirection, {
                characterName: character.name,
                direction: direction
            });

            // Small delay for rotation to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Enter shooting mode
            this.dispatch(ControlsEvent.showShooting, character.name);
            // After a delay, click on target character
            await new Promise<void>(resolve => {
                setTimeout(() => {
                    this.dispatch(ControlsEvent.characterClick, {
                        characterName: targetChar.name,
                        position: targetChar.position
                    });
                    resolve();
                }, 500);
            });

            // Wait longer to ensure action completes and points are deducted
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    private getDistance(pos1: ICoord, pos2: ICoord): number {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2)
        );
    }

    /**
     * Find positions within conversation range that have line of sight to the target
     * This is used when an AI character wants to speak but is blocked by walls
     */
    private findPositionsWithLineOfSight(
        from: ICoord,
        target: ICoord,
        maxDistance: number = 8
    ): ICoord[] {
        if (!this.state) return [];

        const positions: ICoord[] = [];
        const map = this.state.map;

        // Search in a square around the target within maxDistance
        const searchRadius = Math.ceil(maxDistance);
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const x = Math.round(target.x) + dx;
                const y = Math.round(target.y) + dy;

                // Check if position is valid and within range
                const testPos = { x, y };
                const distance = this.getDistance(testPos, target);
                if (distance > maxDistance) continue;

                // Check if the cell is walkable
                const cell = map[y]?.[x];
                if (!cell || cell.content?.blocker) continue;

                // Check if there's a character already there
                const occupied = this.state.characters.some(c =>
                    Math.round(c.position.x) === x &&
                    Math.round(c.position.y) === y &&
                    c.health > 0
                );
                if (occupied) continue;

                // Check if this position has line of sight to target (ignoring characters)
                if (this.checkLineOfSight(testPos, target, true)) {
                    positions.push(testPos);
                }
            }
        }

        // Sort by distance from the character's current position
        positions.sort((a, b) => {
            const distA = this.getDistance(from, a);
            const distB = this.getDistance(from, b);
            return distA - distB;
        });

        return positions;
    }


    /**
     * Detect what's blocking the path between two positions
     * Returns information about the blocking entity
     */
    private detectBlockingEntity(
        from: ICoord,
        to: ICoord
    ): { type: 'none' | 'wall' | 'character', character?: DeepReadonly<ICharacter> } {
        if (!this.state) return { type: 'none' };

        // Use the line of sight algorithm to find what's blocking
        const map = this.state.map;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.x);
        let y = Math.round(from.y);
        const targetX = Math.round(to.x);
        const targetY = Math.round(to.y);

        while (x !== targetX || y !== targetY) {
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }

            // Skip checking the starting position
            if (x === Math.round(from.x) && y === Math.round(from.y)) {
                continue;
            }

            // Check for wall
            const cell = map[y]?.[x];
            if (cell?.content?.blocker) {
                return { type: 'wall' };
            }

            // Check for character (except at target position)
            if (!(x === targetX && y === targetY)) {
                const blockingChar = this.state.characters.find(c =>
                    Math.round(c.position.x) === x &&
                    Math.round(c.position.y) === y &&
                    c.health > 0
                );
                if (blockingChar) {
                    return { type: 'character', character: blockingChar };
                }
            }
        }

        return { type: 'none' };
    }

    private checkLineOfSight(from: ICoord, to: ICoord, ignoreCharacters: boolean = false): boolean {
        if (!this.state) return false;

        // Use Bresenham's line algorithm to check for obstacles
        const map = this.state.map;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.x);
        let y = Math.round(from.y);
        const targetX = Math.round(to.x);
        const targetY = Math.round(to.y);

        while (x !== targetX || y !== targetY) {
            // Skip the starting position
            if (x !== Math.round(from.x) || y !== Math.round(from.y)) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Wall blocks line of sight
                }

                // Only check for blocking characters if not ignoring them
                // For conversations, we should ignore characters (only walls block)
                if (!ignoreCharacters && !(x === targetX && y === targetY)) {
                    const blockingChar = this.state.characters.find(c =>
                        Math.round(c.position.x) === x &&
                        Math.round(c.position.y) === y &&
                        c.health > 0
                    );
                    if (blockingChar) {
                        return false; // Character blocks line of sight
                    }
                }
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true;
    }

    private angleToDirection(angle: number): Direction {
        // Normalize angle to 0-360 degrees
        const degrees = ((angle * 180 / Math.PI) + 360) % 360;

        // Map angle to 8 directions
        if (degrees >= 337.5 || degrees < 22.5) return 'right';
        if (degrees >= 22.5 && degrees < 67.5) return 'down-right';
        if (degrees >= 67.5 && degrees < 112.5) return 'down';
        if (degrees >= 112.5 && degrees < 157.5) return 'down-left';
        if (degrees >= 157.5 && degrees < 202.5) return 'left';
        if (degrees >= 202.5 && degrees < 247.5) return 'up-left';
        if (degrees >= 247.5 && degrees < 292.5) return 'up';
        return 'up-right'; // 292.5 to 337.5
    }

    private getPositionInFront(character: DeepReadonly<ICharacter>): ICoord {
        // Get a position 3 cells in front of the character based on their direction
        const direction = character.direction;
        let dx = 0, dy = 0;

        switch (direction) {
            case 'up': dy = -3; break;
            case 'down': dy = 3; break;
            case 'left': dx = -3; break;
            case 'right': dx = 3; break;
            case 'up-left': dx = -2; dy = -2; break;
            case 'up-right': dx = 2; dy = -2; break;
            case 'down-left': dx = -2; dy = 2; break;
            case 'down-right': dx = 2; dy = 2; break;
        }

        return {
            x: character.position.x + dx,
            y: character.position.y + dy
        };
    }


    private async executeSpeech(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state || !this.contextBuilder) {
            return;
        }

        const speechCmd = command as SpeechCommand;
        // Log the speech action is already done in processNarrativeCharacterTurn
        // console.log(`[AI]   → Speaking: "${speechCmd.content}"`);  

        // Check if we should use the Talk system for nearby conversation
        const source = speechCmd.source;
        const speaker = this.state.characters.find((c: DeepReadonly<ICharacter>) =>
            c.name.toLowerCase() === (source || '').toLowerCase()
        );

        // Check if the target is specified and is another AI character
        const targetCharName = speechCmd.target || speechCmd.listener;
        if (targetCharName && speaker) {
            const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) =>
                c.name.toLowerCase() === targetCharName.toLowerCase() && c.health > 0
            );
            
            if (targetChar && targetChar.controller !== 'human') {
                // This is an AI-to-AI conversation
                const distance = this.getDistance(speaker.position, targetChar.position);
                const hasLineOfSight = this.checkLineOfSight(speaker.position, targetChar.position, true);
                
                if (distance <= 8 && hasLineOfSight) {
                    // Check if human player is nearby to observe
                    const humanCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) =>
                        c.controller === 'human' && c.health > 0
                    );
                    
                    let isEavesdropping = false;
                    for (const human of humanCharacters) {
                        const distToConversation = Math.min(
                            this.getDistance(human.position, speaker.position),
                            this.getDistance(human.position, targetChar.position)
                        );
                        if (distToConversation <= 15) {
                            isEavesdropping = true;
                            break;
                        }
                    }
                    
                    // Start AI-to-AI conversation
                    // DEBUG: console.log(`[AI] Starting AI-to-AI conversation between ${speaker.name} and ${targetChar.name}`);
                    
                    // Show the popup for the conversation
                    this.dispatch(UpdateStateEvent.uiPopup, {
                        popupId: 'main-popup',
                        popupState: {
                            type: 'conversation',
                            visible: true,
                            position: undefined,
                            data: {
                                title: `${speaker.name} y ${targetChar.name} - Conversación AI`
                            }
                        }
                    });
                    
                    // Wait for popup to be ready
                    setTimeout(() => {
                        // Dispatch AI-to-AI conversation start event
                        this.dispatch(ConversationEvent.startAIToAI, {
                            speaker: speaker,
                            listener: targetChar,
                            isEavesdropping: isEavesdropping
                        });
                        
                        // End the AI turn
                        this.isForcedTurnEnd = true;
                        this.isProcessingTurn = true;
                        this.isProcessingMultipleCharacters = false;
                        this.endAITurn(true);
                    }, 200);
                    
                    return;
                }
            }
        }

        // Find any human-controlled character that's in conversation range
        const humanCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) =>
            c.controller === 'human' && c.health > 0
        );

        // Check if speaker can talk to any human character
        let canTalkToAnyHuman = false;

        if (speaker) {
            for (const humanChar of humanCharacters) {
                const distance = this.getDistance(speaker.position, humanChar.position);
                const viewDistance = 15; // Standard view distance
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = this.checkLineOfSight(speaker.position, humanChar.position, true);

                // DEBUG: console.log(`[AI] Line of sight check from ${speaker.name} to ${humanChar.name}:`, {
                //     distance: distance.toFixed(2),
                //     hasLineOfSight,
                //     speakerPos: speaker.position,
                //     humanPos: humanChar.position
                // });

                if (distance <= 8 && distance <= viewDistance && hasLineOfSight) {
                    canTalkToAnyHuman = true;
                    break;
                }
            }
        }

        if (speaker && humanCharacters.length > 0) {
            if (!canTalkToAnyHuman) {
                // Too far from all human characters - move closer to the nearest one
                const nearestHuman = humanCharacters.reduce((nearest, human) => {
                    const distToNearest = this.getDistance(speaker.position, nearest.position);
                    const distToHuman = this.getDistance(speaker.position, human.position);
                    return distToHuman < distToNearest ? human : nearest;
                });

                // const distance = this.getDistance(speaker.position, nearestHuman.position);
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = this.checkLineOfSight(speaker.position, nearestHuman.position, true);
                // const reason = !hasLineOfSight ? 'no line of sight (wall blocking)' :
                //     distance > 15 ? 'out of view range' :
                //         'too far to speak';
                // DEBUG: console.log(`[AI]   → Cannot speak (${reason}), moving closer`);

                // If blocked by walls, find a position with line of sight
                let targetLocation = nearestHuman.name;
                if (!hasLineOfSight) {
                    const goodPositions = this.findPositionsWithLineOfSight(
                        speaker.position,
                        nearestHuman.position,
                        8  // conversation range
                    );

                    if (goodPositions.length > 0) {
                        // Use the closest position with line of sight as the target
                        const bestPos = goodPositions[0];
                        if (bestPos) {
                            targetLocation = `${bestPos.x},${bestPos.y}`;
                            // DEBUG: console.log(`[AI]   → Found position with line of sight at ${targetLocation}`);
                        }
                    } else {
                        // DEBUG: console.log(`[AI]   → No positions with line of sight found, moving directly toward target`);
                    }
                }

                // Execute a movement command to get closer
                const moveCommand: AICommand = {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: targetLocation
                    }]
                };

                // Check if we've already tried to move for this speech too many times
                const attempts = this.speechMovementAttempts.get(character.name) || 0;
                if (attempts >= 3) {
                    // DEBUG: console.log(`[AI]   → Gave up trying to speak after ${attempts} movement attempts`);
                    this.speechMovementAttempts.delete(character.name);
                    this.pendingSpeechCommands.delete(character.name);
                    return;
                }

                // Store the speech command to execute after movement
                this.pendingSpeechCommands.set(character.name, command);
                this.speechMovementAttempts.set(character.name, attempts + 1);

                // Execute movement - it will check for proximity and execute speech if close enough
                await this.executeMovement(moveCommand, character);
                return;
            }

            // They're close enough - show conversation directly

            // Record the conversation event with full dialogue content
            const firstHuman = humanCharacters[0];
            if (firstHuman) {
                this.contextBuilder.recordEvent({
                    type: 'dialogue',
                    actor: speaker.name,
                    target: firstHuman.name,
                    description: `${speaker.name} says: "${speechCmd.content}"`,
                    turn: this.state.game.turn,
                    dialogue: {
                        speaker: speaker.name,
                        content: speechCmd.content || '',
                        answers: speechCmd.answers
                    }
                });
            }

            // Show the popup first to ensure UI is ready
            this.dispatch(UpdateStateEvent.uiPopup, {
                popupId: 'main-popup',  // Must match the popupId in Popup.ts
                popupState: {
                    type: 'conversation',
                    visible: true,
                    position: undefined,
                    data: {
                        title: `${source || speaker.name} - Conversación`
                    }
                }
            });

            // Wait a bit for the popup and conversation component to be created
            setTimeout(() => {
                // Directly dispatch conversation update event with the AI's speech
                // No need to call ConversationEvent.start which would make another API call
                this.dispatch(ConversationEvent.update, {
                    type: 'speech',
                    source: source || speaker.name,
                    content: speechCmd.content || '',
                    answers: speechCmd.answers || [],
                    action: undefined
                });

                // End the AI turn immediately when conversation starts
                // This prevents other AI characters from continuing to act
                // console.log('[AI] ExecuteSpeech - Conversation started, force ending AI turn');

                // Set the forced turn end flag to prevent resetting isProcessingTurn in finally block
                this.isForcedTurnEnd = true;

                // Set the processing flags to prevent further AI processing
                this.isProcessingTurn = true; // Keep this true to prevent re-processing
                this.isProcessingMultipleCharacters = false;

                this.endAITurn(true); // Force end to stop other AI characters
            }, 200); // Increased delay to ensure conversation component is ready

            // Record dialogue event
            this.contextBuilder.recordEvent({
                type: 'dialogue',
                actor: source,
                description: `${source}: ${speechCmd.content}`,
                turn: this.state.game.turn
            });

            return;
        }

        // If not close enough or can't find characters, just log and end turn
        // DEBUG: console.log('[AI] ExecuteSpeech - Cannot talk, characters too far or not found');
        // DEBUG: console.log(`[AI] ${source} wants to say:`, speechCmd.content);

        // Record the attempt
        this.contextBuilder.recordEvent({
            type: 'dialogue',
            actor: source,
            description: `${source} (too far): ${speechCmd.content}`,
            turn: this.state.game.turn
        });

        // End turn
        this.endAITurn();
    }


    private async spawnCharacters(command: AICommand): Promise<void> {
        if (!this.state || !this.contextBuilder) return;

        // Spawn new characters during gameplay
        const charCmd = command as CharacterCommand;
        const chars = charCmd.characters;
        if (!chars) return;
        for (const charData of chars) {
            const spawnLocation = this.resolveLocation(charData.location);

            if (!spawnLocation) {
                console.warn('Could not resolve spawn location for', charData.name);
                continue;
            }

            // Determine which controller owns this character based on faction
            // Enemy faction characters should always belong to the AI controller
            let assignedController = this.state.game.turn;
            if (charData.faction === 'enemy') {
                assignedController = 'ai';
            } else if (charData.faction === 'player') {
                assignedController = 'human';
            }
            // neutral faction characters remain assigned to current turn

            // Create a new character object with required fields
            const newCharacter = {
                name: charData.name,
                race: charData.race || 'human',
                description: charData.description || '',
                faction: charData.faction || 'neutral',
                position: spawnLocation,
                x: spawnLocation.x,
                y: spawnLocation.y,
                direction: this.mapDirection(charData.orientation || 'down'),
                speed: charData.speed || 'medium',
                controller: assignedController,
                health: 100,
                maxHealth: 100,
                palette: charData.palette || {
                    skin: '#d7a55f',
                    helmet: '#808080',
                    suit: '#404040'
                }
            };

            console.log(`[AI] Spawning character ${charData.name} with faction ${charData.faction} assigned to controller ${assignedController}`);

            // Add character to game state
            this.dispatch(UpdateStateEvent.addCharacter, newCharacter);

            // Record spawn event
            this.contextBuilder.recordEvent({
                type: 'spawn',
                actor: 'AI',
                target: charData.name,
                description: `${charData.name} spawned at ${spawnLocation.x},${spawnLocation.y}`,
                turn: this.state.game.turn
            });
        }
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
                    await this.executeSpeech(retryResult.command, {} as DeepReadonly<ICharacter>);

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
                await this.executeSpeech(response.command, {} as DeepReadonly<ICharacter>);

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

    private resolveLocation(location: string, _fromCharacter?: DeepReadonly<ICharacter>, allowCoordinates = false): ICoord | null {
        if (!this.state) {
            throw new Error(`[AI] Cannot resolve location: game state is not initialized`);
        }

        if (!location || location.trim() === '') {
            throw new Error(`[AI] Invalid location: location is empty or null`);
        }

        const lowerLocation = location.toLowerCase().trim();

        // Check if it's a direction - these are NOT allowed
        const directions = [
            'north', 'south', 'east', 'west', 'up', 'down', 'left', 'right',
            'northeast', 'northwest', 'southeast', 'southwest',
            'north-east', 'north-west', 'south-east', 'south-west'
        ];

        if (directions.includes(lowerLocation)) {
            const errorMsg = `[AI] Invalid location format '${location}': Movement locations must be room names or character names, not directions. Use actual location names like 'Cargo Bay' or character names like 'Enemy Captain'.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Handle "center" or "center of map"
        if (lowerLocation.includes('center')) {
            const mapWidth = this.state.map[0]?.length || 50;
            const mapHeight = this.state.map.length || 50;
            return { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
        }

        // Try to find character by name (case-insensitive)
        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) =>
            c.name.toLowerCase() === lowerLocation
        );
        if (targetChar) {
            // Find the nearest empty cell near the target character
            const nearestEmpty = this.findNearestEmptyCell(
                targetChar.position,
                _fromCharacter?.position
            );

            if (nearestEmpty) {
                console.log(`[AI] Resolved character '${targetChar.name}' at (${targetChar.position.x}, ${targetChar.position.y}) to nearest empty cell at (${nearestEmpty.x}, ${nearestEmpty.y})`);
                return nearestEmpty;
            }

            // Fallback: if no empty cell found, return character position
            // (this shouldn't happen in normal gameplay but provides a safe fallback)
            console.warn(`[AI] No empty cell found near character '${targetChar.name}', using character position`);
            return { x: targetChar.position.x, y: targetChar.position.y };
        }

        // Try to find room by name
        const roomPosition = this.findRoomCenter(location);
        if (roomPosition) {
            return roomPosition;
        }

        // Try to parse as building/room
        if (location.includes('/')) {
            const parts = location.split('/');
            const roomName = parts[parts.length - 1]; // Get last part as room name
            const roomPos = roomName ? this.findRoomCenter(roomName) : null;
            if (roomPos) {
                return roomPos;
            }
        }

        // Check for coordinate strings (e.g., "11,12")
        // Only allow coordinates if this is an internal system call (allowCoordinates=true)
        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            if (allowCoordinates) {
                // Parse and validate coordinates for internal system use
                const x = parseInt(coordMatch[1], 10);
                const y = parseInt(coordMatch[2], 10);

                // Validate coordinates are within map bounds
                const mapWidth = this.state.map[0]?.length || 50;
                const mapHeight = this.state.map.length || 50;

                if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
                    return { x, y };
                }

                const errorMsg = `[AI] Coordinate '${location}' is out of map bounds (${mapWidth}x${mapHeight})`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            } else {
                // Coordinates from AI commands are not allowed
                const errorMsg = `[AI] Invalid location format '${location}': Movement locations must be room names or character names, not coordinates. Use names like 'Cargo Bay', 'Bridge', or character names like 'Enemy Captain'.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        // If we couldn't resolve the location, throw an error with helpful information
        const availableRooms = this.getAvailableRoomNames();
        const availableCharacters = this.state.characters.map(c => c.name).join(', ');
        const errorMsg = `[AI] Could not resolve location '${location}'. Available rooms: [${availableRooms.join(', ')}]. Available characters: [${availableCharacters}]`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    /**
     * Find the nearest empty and reachable cell near a target position
     */
    private findNearestEmptyCell(targetPosition: ICoord, fromPosition?: ICoord): ICoord | null {
        if (!this.state) return null;

        const map = this.state.map;
        const characters = this.state.characters;
        const mapWidth = map[0]?.length || 0;
        const mapHeight = map.length;

        // Check cells in expanding radius around target
        const maxRadius = 10; // Don't search too far

        for (let radius = 1; radius <= maxRadius; radius++) {
            const candidates: Array<{ pos: ICoord; distance: number }> = [];

            // Check all cells at this radius
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check cells at exactly this radius (Manhattan distance)
                    if (Math.abs(dx) + Math.abs(dy) !== radius) continue;

                    const pos: ICoord = {
                        x: targetPosition.x + dx,
                        y: targetPosition.y + dy
                    };

                    // Check bounds
                    if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) {
                        continue;
                    }

                    // Check if cell is valid (not blocked, not occupied)
                    const cell = map[pos.y]?.[pos.x];
                    if (cell?.content?.blocker) continue;

                    // Check if a character is blocking
                    const isOccupied = characters.some(c =>
                        Math.round(c.position.x) === pos.x &&
                        Math.round(c.position.y) === pos.y &&
                        c.health > 0
                    );
                    if (isOccupied) continue;

                    // Calculate distance from starting position if provided
                    const distance = fromPosition ?
                        Math.abs(pos.x - fromPosition.x) + Math.abs(pos.y - fromPosition.y) :
                        0;

                    candidates.push({ pos, distance });
                }
            }

            // If we found valid cells at this radius, return the closest one to starting position
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.distance - b.distance);
                return candidates[0]!.pos;
            }
        }

        return null;
    }

    private getAvailableRoomNames(): string[] {
        if (!this.state) return [];

        const roomNames = new Set<string>();
        const map = this.state.map;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < (map[y]?.length || 0); x++) {
                const cell = map[y]?.[x];
                if (cell?.locations) {
                    for (const loc of cell.locations) {
                        if (loc && loc !== 'floor' && loc !== 'wall') {
                            roomNames.add(loc);
                        }
                    }
                }
            }
        }

        return Array.from(roomNames);
    }

    private getCurrentRoomName(character: DeepReadonly<ICharacter>): string {
        if (!this.state) return 'Unknown Location';

        const map = this.state.map;
        const x = Math.round(character.position.x);
        const y = Math.round(character.position.y);

        // Get the cell at the character's position
        const cell = map[y]?.[x];
        if (cell?.locations && cell.locations.length > 0) {
            // Find the first meaningful location (not floor/wall)
            for (const loc of cell.locations) {
                if (loc && loc !== 'floor' && loc !== 'wall') {
                    return loc;
                }
            }
        }

        // If no room name found, return a descriptive fallback
        return 'Unknown Location';
    }

    private findRoomCenter(roomName: string): ICoord | null {
        if (!this.state) return null;

        const map = this.state.map;
        const roomPositions: ICoord[] = [];
        const lowerRoomName = roomName.toLowerCase();

        // Find all cells belonging to this room
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < (map[0]?.length || 0); x++) {
                const cell = map[y]?.[x];
                if (cell?.locations && cell.locations.length > 0) {
                    const cellRoom = cell.locations[0];
                    if (cellRoom && cellRoom.toLowerCase().includes(lowerRoomName)) {
                        roomPositions.push({ x, y });
                    }
                }
            }
        }

        // Calculate center of room
        if (roomPositions.length > 0) {
            const centerX = Math.floor(roomPositions.reduce((sum, pos) => sum + pos.x, 0) / roomPositions.length);
            const centerY = Math.floor(roomPositions.reduce((sum, pos) => sum + pos.y, 0) / roomPositions.length);
            return { x: centerX, y: centerY };
        }

        return null;
    }

    private async executeNarrativeMapGeneration(): Promise<void> {
        // DEBUG: console.log('[AIController] Executing narrative map generation');

        try {
            // Get current story state
            const storyState = this.state?.story;

            // Request map generation from AI
            const mapResponse = await this.gameEngineService.requestMapGeneration(
                'narrative_transition',
                'Generate a new map based on the narrative progression',
                storyState ? JSON.parse(JSON.stringify(storyState)) : undefined
            );

            if (mapResponse && typeof mapResponse === 'object' && 'type' in mapResponse) {
                // DEBUG: console.log('[AIController] Generated map command from narrative action');

                // Execute the map command
                const validatedCommand = this.commandParser.validate(mapResponse);
                if (validatedCommand && validatedCommand.type === 'map') {
                    const storyStateForMap = storyState ? JSON.parse(JSON.stringify(storyState)) as IStoryState : undefined;
                    const mapCommand = validatedCommand as MapCommand;
                    await this.storyExecutor.executeMapCommand(mapCommand, storyStateForMap, mapCommand.seed);
                    // DEBUG: console.log('[AIController] Map generation complete');
                } else {
                    console.error('[AIController] Invalid map command generated');
                }
            } else {
                console.error('[AIController] Failed to generate map from narrative action');
            }
        } catch (error) {
            console.error('[AIController] Error executing narrative map generation:', error);
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

    private async handlePositioningError(error: CharacterPositioningError, originalCommand: AICommand): Promise<void> {
        console.error('[AI] Handling positioning error for character:', error.characterName);
        console.error('[AI] Available rooms:', error.availableRooms);
        
        // Build error context for the AI
        const errorContext = {
            error: 'CHARACTER_POSITIONING_FAILED',
            failedCommand: originalCommand,
            characterName: error.characterName,
            requestedLocation: error.requestedLocation,
            availableRooms: error.availableRooms,
            mapBounds: error.mapBounds,
            instructions: [
                'The character location you specified is invalid.',
                'Please use one of these exact room names:',
                ...error.availableRooms.slice(0, 5).map(room => `  - "${room}"`),
                'Or use coordinates within bounds: 0-' + (error.mapBounds.width - 1) + ' x 0-' + (error.mapBounds.height - 1),
                'IMPORTANT: Use hyphen (-) separator for room names, not slash (/)'
            ].join('\n')
        };
        
        // Request correction from AI
        try {
            if (this.state && this.contextBuilder) {
                // Use first character or create dummy for context
                // Use center of map for dummy position instead of (0,0)
                const mapWidth = this.state.map[0]?.length || 50;
                const mapHeight = this.state.map.length || 50;
                const contextCharacter = this.state.characters[0] || {
                    name: 'system',
                    position: { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) },
                    health: 100,
                    actions: { pointsLeft: 100 }
                } as DeepReadonly<ICharacter>;
                const context = this.contextBuilder.buildTurnContext(contextCharacter, this.state);
                // Add error context to the AI request
                // Also add location to current character
                const contextWithError = {
                    ...context,
                    currentCharacter: {
                        ...context.currentCharacter,
                        location: this.getCurrentRoomName(contextCharacter)
                    },
                    positioningError: errorContext
                } as unknown as AIGameContext;

                console.log('[AI] Requesting corrected command after positioning error');
                const language = this.state?.language || 'en';
                const response = await this.gameEngineService.requestAIAction(contextWithError as unknown as AIActionContext, undefined, undefined, language as LanguageCode);
                
                if (response.command) {
                    const validatedCommand = this.commandParser.validate(response.command);
                    if (validatedCommand) {
                        console.log('[AI] Retrying with corrected command:', validatedCommand.type);
                        // Get a dummy character for the retry
                        // Use center of map for dummy position instead of (0,0)
                        const mapWidth = this.state?.map[0]?.length || 50;
                        const mapHeight = this.state?.map.length || 50;
                        const dummyCharacter = (this.state?.characters[0] || {
                            name: 'system',
                            position: { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) }
                        }) as DeepReadonly<ICharacter>;
                        await this.executeAICommand(validatedCommand, dummyCharacter);
                    } else {
                        console.error('[AI] Failed to get valid corrected command');
                    }
                } else {
                    console.error('[AI] No corrected command received from AI');
                }
            } else {
                console.error('[AI] Cannot handle positioning error - no state or context builder');
            }
        } catch (retryError) {
            console.error('[AI] Failed to recover from positioning error:', retryError);
            // Continue game despite error to avoid complete failure
        }
    }

    private endAITurn(forceEnd: boolean = false): void {
        // Don't end turn if we're processing multiple characters (unless forced)
        if (!forceEnd && this.isProcessingMultipleCharacters) {
            return;
        }

        if (!this.state) {
            return;
        }

        // Clear any ongoing movement
        this.ongoingMovement = undefined;

        // If forcing end, clear the processing flag and timeouts
        if (forceEnd) {
            this.isProcessingMultipleCharacters = false;
            this.clearMovementTimeouts();
        }

        // Signal end of turn by changing to next turn
        const currentTurn = this.state.game.turn;
        const players = this.state.game.players;
        const currentIndex = players.indexOf(currentTurn);
        const nextIndex = (currentIndex + 1) % players.length;
        const nextTurn = players[nextIndex] || currentTurn;
        this.dispatch(GameEvent.changeTurn, {
            turn: nextTurn,
            previousTurn: currentTurn
        });
    }

    public async forceAIAction(character: DeepReadonly<ICharacter>): Promise<void> {
        // Allow manual triggering of AI actions for testing
        await this.processAICharacterTurn(character);
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
                        await this.executeAICommand(validatedCommand, emptyCharacter);

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
                        console.warn('[AI] Invalid initialization command:', command);
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