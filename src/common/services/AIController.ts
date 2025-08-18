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
    ConversationEventsMap
} from '../events';
import { State } from '../State';
import { AIContextBuilder } from './AIContextBuilder';
import { AICommandParser, AICommand } from './AICommandParser';
import { AIGameEngineService } from './AIGameEngineService';
import { TacticalExecutor, TacticalDirective } from './TacticalExecutor';
import { CombatStances } from './CombatStances';
import { StoryCommandExecutor } from './StoryCommandExecutor';
import { ICharacter, ICoord, Direction, IOriginStory, IStoryState } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { calculatePath } from '../helpers/map';
import { TeamService } from './TeamService';

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
    private isProcessingTurn: boolean = false;
    private aiEnabled: boolean = true;
    private state?: State;
    private pendingSpeechCommands: Map<string, AICommand> = new Map(); // Store per character
    private isProcessingMultipleCharacters: boolean = false;
    private movementTimeouts: NodeJS.Timeout[] = [];
    private tacticalExecutor: TacticalExecutor;
    private storyExecutor: StoryCommandExecutor;
    private useTacticalSystem: boolean = false; // Flag to enable/disable tactical system - disabled by default to use AI endpoint
    private ongoingMovement?: { characterName: string; targetLocation: ICoord; targetName?: string }; // Track ongoing multi-cell movement

    private constructor() {
        super();
        this.gameEngineService = AIGameEngineService.getInstance();
        this.commandParser = new AICommandParser();
        this.tacticalExecutor = TacticalExecutor.getInstance();
        this.storyExecutor = StoryCommandExecutor.getInstance();
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
        // Clean up previous listeners before setting new state
        this.cleanup();
        
        this.state = state;
        this.contextBuilder = new AIContextBuilder(state);
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

        // Listen for turn changes to check if AI player should act
        this.listen(GameEvent.changeTurn, (data: GameEventsMap[GameEvent.changeTurn]) => {
            const currentPlayer = data.turn;
            
            // Check if this is an AI-controlled player
            const isAI = this.isAIPlayer(currentPlayer);
            
            if (isAI) {
                console.log(`[AI] === Turn ${data.turn} ===`);
                // Give a small delay for UI to update
                setTimeout(() => this.processAIPlayerTurn(currentPlayer), 500);
            }
        });

        // Listen for conversation responses from the player
        this.listen(ConversationEvent.continue, (_answer: string) => {
            // Player has responded to conversation
            // Turn management is now handled when conversation starts, not when it continues
            console.log('[AI] Player responded to conversation');
        });
    }

    private isAIPlayer(playerId: string): boolean {
        if (!this.state) {
            return false;
        }
        // Check if this player is marked as AI in the game state
        const game = this.state.game as ExtendedGame;
        const playerInfo = game.playerInfo?.[playerId];
        return playerInfo?.isAI === true;
    }

    // Removed isAIControlled - not used

    private async processAIPlayerTurn(playerId: string): Promise<void> {
        if (!this.state) return;
        // When it's an AI player's turn, find their characters and take actions
        const aiCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) => c.player === playerId);
        
        if (aiCharacters.length === 0) {
            return;
        }
        
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
                console.log(`[AI] Skipping ${character.name} - defeated`);
                continue;
            }
            
            // Check if we should stop processing (e.g., if conversation started)
            if (this.state && this.state.game.turn !== playerId) {
                console.log('[AI] Turn changed during processing, stopping');
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
            console.log('[AI] All AI characters processed, ending AI turn');
            this.endAITurn();
        } else {
            console.log('[AI] Turn already changed, not ending turn');
        }
    }

    private async processAICharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        if (this.isProcessingTurn || !this.aiEnabled || !this.state || !this.contextBuilder) {
            console.log('[AI] Cannot process turn:', {
                isProcessingTurn: this.isProcessingTurn,
                aiEnabled: this.aiEnabled,
                hasState: !!this.state,
                hasContextBuilder: !!this.contextBuilder
            });
            return;
        }
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
                    console.log(`[AI] Character ${character.name} not found in state`);
                    break;
                }
                
                // Check if character is defeated
                if (currentChar.health <= 0) {
                    console.log(`[AI] ${currentChar.name} was defeated, ending turn`);
                    break;
                }
                
                // Check if turn changed (e.g., due to conversation)
                if (this.state.game.turn !== currentChar.player) {
                    console.log(`[AI] Turn changed to ${this.state.game.turn}, stopping ${currentChar.name}'s actions`);
                    break;
                }
                
                // Check if character has enough action points to continue
                const pointsLeft = currentChar.actions?.pointsLeft || 0;
                console.log(`[AI] ${currentChar.name} has ${pointsLeft} action points remaining (loop ${actionsPerformed + 1})`);
                
                if (pointsLeft <= 0) {
                    // No points left at all
                    console.log(`[AI] ${currentChar.name} no action points remaining, ending character turn`);
                    break;
                }
                
                // If we have very few points and have already performed actions, stop
                if (pointsLeft < 20 && actionsPerformed > 0) {
                    console.log(`[AI] ${currentChar.name} insufficient action points for further actions, ending character turn`);
                    // Clear any ongoing movement
                    if (this.ongoingMovement?.characterName === currentChar.name) {
                        this.ongoingMovement = undefined;
                    }
                    break;
                }
                
                // Check if we have an ongoing movement to continue
                if (this.ongoingMovement && this.ongoingMovement.characterName === currentChar.name) {
                    const target = this.ongoingMovement.targetLocation;
                    const distance = this.getDistance(currentChar.position, target);
                    
                    // Check if we've reached the target or are close enough
                    if (distance <= 3) {
                        console.log(`[AI] ${currentChar.name} reached target, clearing ongoing movement`);
                        this.ongoingMovement = undefined;
                        // Continue to get new AI decision
                    } else if (pointsLeft >= 20) {
                        // Continue moving toward the target
                        console.log(`[AI] ${currentChar.name} continuing movement to ${this.ongoingMovement.targetName || 'target'} (${distance.toFixed(1)} cells away)`);
                        // Create a movement command to continue toward the target
                        const moveCommand: AICommand = {
                            type: 'movement',
                            characters: [{
                                name: currentChar.name,
                                location: this.ongoingMovement.targetName || `${target.x},${target.y}`
                            }]
                        };
                        await this.executeMovement(moveCommand, currentChar);
                        actionsPerformed++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue; // Skip AI request and continue movement
                    } else {
                        // Not enough points to continue
                        console.log(`[AI] ${currentChar.name} cannot continue movement - insufficient action points`);
                        this.ongoingMovement = undefined;
                    }
                }
                
                // Check if there's a pending speech command from previous movement
                const pendingSpeech = this.pendingSpeechCommands.get(currentChar.name);
                if (pendingSpeech) {
                    // Check if we're now close enough to execute the pending speech
                    const speaker = currentChar;
                    const humanCharacters = this.state.characters.filter(c => c.player === 'human' && c.health > 0);
                    
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
                        console.log('[AI] Executing pending speech after movement');
                        await this.executeSpeech(pendingSpeech, currentChar);
                        actionsPerformed++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                }
                
                // Check if there are any living enemies to interact with
                const hasLivingEnemies = this.state.characters.some(c => 
                    c.health > 0 && 
                    c.player !== currentChar.player &&
                    c.name !== currentChar.name
                );
                
                // Always try narrative AI first if there are enemies
                // This allows the AI to decide whether to attack, talk, move, etc.
                if (hasLivingEnemies) {
                    // On first action, always use narrative AI to get strategic decision
                    // On subsequent actions, can use tactical if enabled
                    if (actionsPerformed === 0 || !this.useTacticalSystem) {
                        // Call AI endpoint for decision
                        console.log(`[AI] ${currentChar.name}: Requesting AI decision (action ${actionsPerformed + 1})`);
                        await this.processNarrativeCharacterTurn(currentChar);
                    } else if (this.useTacticalSystem && this.isCharacterInCombat(currentChar)) {
                        // Use tactical executor for follow-up combat decisions
                        console.log(`[AI] ${currentChar.name}: Using tactical system for follow-up action`);
                        await this.processTacticalCharacterTurn(currentChar);
                    } else {
                        // Default to narrative AI
                        await this.processNarrativeCharacterTurn(currentChar);
                    }
                } else {
                    // No enemies left - skip expensive API call
                    console.log(`[AI] ${currentChar.name}: No living enemies, skipping AI actions`);
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
                    const humanCharacters = this.state.characters.filter(c => c.player === 'human' && c.health > 0);
                    
                    // Check if speaker can talk to any human character
                    let canTalkToAnyHuman = false;
                    let closestHuman: DeepReadonly<ICharacter> | undefined;
                    let closestDistance = Infinity;
                    
                    for (const humanChar of humanCharacters) {
                        const distance = this.getDistance(speaker.position, humanChar.position);
                        const viewDistance = 15; // Standard view distance
                        const hasLineOfSight = this.checkLineOfSight(speaker.position, humanChar.position, true);
                        
                        console.log(`[AI] Final speech check from ${speaker.name} to ${humanChar.name}: distance=${distance.toFixed(2)}, hasLOS=${hasLineOfSight}`);
                        
                        if (distance <= 8 && distance <= viewDistance && hasLineOfSight) {
                            canTalkToAnyHuman = true;
                            if (distance < closestDistance) {
                                closestDistance = distance;
                                closestHuman = humanChar;
                            }
                        }
                    }
                    
                    if (canTalkToAnyHuman) {
                        // Close enough - execute the pending speech even with no action points
                        this.pendingSpeechCommands.delete(character.name);
                        console.log(`[AI] Executing pending speech after all movement completed (closest to ${closestHuman?.name})`);
                        await this.executeSpeech(finalPendingSpeech, currentChar);
                    } else {
                        console.log('[AI] Still too far to speak after all movement');
                        this.pendingSpeechCommands.delete(character.name); // Clear it
                    }
                }
            }
        } catch (error) {
            console.error('[AI] Error:', error);
        } finally {
            this.isProcessingTurn = false;
        }
    }

    private async processTacticalCharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
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
            console.log(`[AI-Tactical] ${character.name}: ${tacticalAction.type} - ${tacticalAction.reasoning}`);
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
        
        console.log(`[AI-Narrative] Building context for ${character.name} to call AI endpoint`);
        
        // Build context for AI
        const context = this.contextBuilder.buildTurnContext(character, this.state);
        
        console.log(`[AI-Narrative] Calling AI endpoint for ${character.name}'s decision...`);
        
        // Get AI decision from game engine
        const response = await this.gameEngineService.requestAIAction(context);
        
        // Check if response contains tactical directive
        if (response.command?.type === 'tactical_directive') {
            const directive = response.command as TacticalDirective;
            this.tacticalExecutor.setDirective(directive);
            console.log('[AI] Received tactical directive:', directive.objective);
            
            // After setting directive, process turn with tactical system
            if (this.useTacticalSystem) {
                await this.processTacticalCharacterTurn(character);
            }
            return;
        }
        
        // Parse and execute AI commands normally
        if (response.command) {
            const validatedCommand = this.commandParser.validate(response.command);
            if (validatedCommand) {
                // Log the AI decision with more context
                if (validatedCommand.type === 'attack') {
                    const attackType = validatedCommand.characters?.[0]?.attack || 'unknown';
                    const target = validatedCommand.characters?.[0]?.target || 'unknown';
                    console.log(`[AI] ${character.name}: ${validatedCommand.type} (${attackType} vs ${target})`);
                } else {
                    console.log(`[AI] ${character.name}: ${validatedCommand.type}`);
                }
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
            
            if (TeamService.areHostile(character, other, this.state.game.teams)) {
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
                await this.spawnCharacters(validatedCommand);
                break;
            case 'map':
                await this.storyExecutor.executeMapCommand(validatedCommand as any, storyState as any);
                break;
            case 'storyline':
                await this.storyExecutor.executeStorylineCommand(validatedCommand as any, storyState as any);
                break;
            case 'item':
                await this.storyExecutor.executeItemSpawnCommand(validatedCommand as any);
                break;
            default:
                console.warn('[AI] Unknown command type:', validatedCommand.type);
                this.endAITurn();
        }
    }

    private async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        // Find target location
        const targetLocationString = command.characters[0].location;
        const targetLocation = this.resolveLocation(targetLocationString, character);
        
        if (!targetLocation || !isFinite(targetLocation.x) || !isFinite(targetLocation.y) || 
            targetLocation.x < -1000 || targetLocation.x > 1000 || 
            targetLocation.y < -1000 || targetLocation.y > 1000) {
            console.log('[AI] ExecuteMovement - Invalid location:', targetLocationString, targetLocation);
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }
        
        // Check if we're already at the target location (distance 0)
        const currentDistance = this.getDistance(character.position, targetLocation);
        if (currentDistance === 0) {
            console.log('[AI] ExecuteMovement - Already at target location');
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }
        
        // Log the movement decision
        const targetChar = this.state?.characters.find((c: DeepReadonly<ICharacter>) => 
            c.position.x === targetLocation.x && c.position.y === targetLocation.y
        );
        if (targetChar) {
            console.log(`[AI]   → Moving toward ${targetChar.name} (distance: ${currentDistance.toFixed(1)})`);
        } else {
            console.log(`[AI]   → Moving to (${targetLocation.x}, ${targetLocation.y})`);
        }
        
        // Set ongoing movement tracker if we're moving more than 1 cell away
        if (currentDistance > 3) {
            this.ongoingMovement = {
                characterName: character.name,
                targetLocation: targetLocation,
                targetName: targetChar?.name
            };
            console.log(`[AI] Setting ongoing movement for ${character.name} to ${targetChar?.name || 'location'}`);
        }
        
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
            
            if (targetChar && targetChar.player !== character.player && targetChar.name === 'player') {
                // Create a speech command
                const speechCommand: AICommand = {
                    type: 'speech',
                    source: character.name,
                    content: '¡Hola! ¿Necesitas ayuda?',
                    answers: ['Sí, gracias', 'No, estoy bien', 'Tal vez más tarde']
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
            console.log('[AI] No path to target found');
            
            // Detect what's blocking the path
            const blockage = this.detectBlockingEntity(character.position, targetLocation);
            
            if (blockage.type === 'character' && blockage.character && this.state) {
                const isAlly = TeamService.areAllied(character, blockage.character, this.state.game.teams);
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
                    console.log('[AI] No context builder available');
                    if (!this.isProcessingMultipleCharacters) {
                        this.endAITurn();
                    }
                    return;
                }
                
                const context = this.contextBuilder.buildTurnContext(character, this.state);
                (context as any).blockageInfo = blockageContext;
                
                console.log('[AI] Requesting new instructions due to blocked path');
                const response = await this.gameEngineService.requestAIAction(context);
                
                if (response.command) {
                    const validatedCommand = this.commandParser.validate(response.command);
                    if (validatedCommand) {
                        console.log(`[AI] New action after blockage: ${validatedCommand.type}`);
                        await this.executeAICommand(validatedCommand, character);
                        return;
                    }
                }
            } else if (blockage.type === 'wall') {
                console.log('[AI] Path blocked by wall/obstacle');
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
            console.log('[AI] Not enough action points to move');
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }
        
        // Get the destination cell (either the target or as far as we can go)
        const moveToIndex = cellsToMove - 1; // -1 because array is 0-indexed
        const moveToDest = path[moveToIndex];
        
        console.log(`[AI] Moving ${cellsToMove} cells toward target (${path.length} total cells to target)`);
        
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
            if (this.state && this.state.game.turn === character.player) {
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
                
                // If we haven't reached the target and still have action points, continue in next loop
                if (cellsToMove < path.length) {
                    console.log('[AI] Will continue movement in next action loop');
                    // ongoingMovement is already set, so next loop will continue
                } else {
                    console.log('[AI] Reached destination');
                    this.ongoingMovement = undefined;
                }
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

        const attackData = command.characters[0];
        
        // Handle 'area' target for overwatch
        if (attackData.target === 'area' && attackData.attack === 'hold') {
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
            c.name.toLowerCase() === attackData.target.toLowerCase()
        );
        
        if (!targetChar) {
            console.error('[AI] ExecuteAttack - Target not found:', attackData.target);
            // End turn if no valid target
            if (!this.isProcessingMultipleCharacters) {
                this.endAITurn();
            }
            return;
        }
        
        
        // Dispatch attack event based on attack type
        switch (attackData.attack) {
            case 'melee':
                // Check if target is adjacent for melee
                const distance = this.getDistance(character.position, targetChar.position);
                if (distance <= 1.5) {
                    // Dispatch melee attack
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
                    // Move closer to target first
                    await this.executeMovement({
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: targetChar.name
                        }]
                    }, character);
                }
                break;
                
            case 'kill':
            case 'ranged':
                // First check if we have line of sight to the target
                // If not, we should move closer instead
                const hasLineOfSight = this.checkLineOfSight(character.position, targetChar.position);
                
                if (!hasLineOfSight) {
                    console.log(`[AI] No line of sight to ${targetChar.name}, moving closer instead`);
                    // Move closer to target instead of shooting
                    await this.executeMovement({
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: targetChar.name
                        }]
                    }, character);
                    break;
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
                // After a delay, click on target character (not just the cell)
                await new Promise<void>(resolve => {
                    setTimeout(() => {
                        this.dispatch(ControlsEvent.characterClick, {
                            characterName: targetChar.name,
                            position: targetChar.position
                        });
                        resolve();
                    }, 500); // Slightly longer delay for shooting action
                });
                
                // Wait longer to ensure action completes and points are deducted
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;
                
            case 'hold':
                // Hold position - set overwatch
                this.dispatch(ControlsEvent.showOverwatch, character.name);
                // After a delay, click in front of character to activate overwatch
                await new Promise<void>(resolve => {
                    setTimeout(() => {
                        // Calculate a position in front of the character
                        const frontPosition = this.getPositionInFront(character);
                        this.dispatch(ControlsEvent.cellClick, frontPosition);
                        resolve();
                    }, 500);
                });
                break;
                
            case 'retreat':
                // Find retreat position and move
                const retreatTarget = this.findRetreatPosition(character, attackData.target);
                if (retreatTarget) {
                    await this.executeMovement({
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: `${retreatTarget.x},${retreatTarget.y}`
                        }]
                    }, character);
                }
                break;
                
            default:
                console.warn('[AI] Unknown attack type:', attackData.attack);
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
        
        // Log the speech action
        console.log(`[AI]   → Speaking: "${command.content}"`);
        
        // Check if we should use the Talk system for nearby conversation
        const speaker = this.state.characters.find((c: DeepReadonly<ICharacter>) => 
            c.name.toLowerCase() === (command.source || '').toLowerCase()
        );
        
        // Find any human-controlled character that's in conversation range
        const humanCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) => 
            c.player === 'human' && c.health > 0
        );
        
        // Check if speaker can talk to any human character
        let canTalkToAnyHuman = false;
        
        if (speaker) {
            for (const humanChar of humanCharacters) {
                const distance = this.getDistance(speaker.position, humanChar.position);
                const viewDistance = 15; // Standard view distance
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = this.checkLineOfSight(speaker.position, humanChar.position, true);
                
                // Debug logging
                console.log(`[AI] Line of sight check from ${speaker.name} to ${humanChar.name}:`, {
                    distance: distance.toFixed(2),
                    hasLineOfSight,
                    speakerPos: speaker.position,
                    humanPos: humanChar.position
                });
                
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
                
                const distance = this.getDistance(speaker.position, nearestHuman.position);
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = this.checkLineOfSight(speaker.position, nearestHuman.position, true);
                const reason = !hasLineOfSight ? 'no line of sight (wall blocking)' : 
                              distance > 15 ? 'out of view range' : 
                              'too far to speak';
                console.log(`[AI]   → Cannot speak (${reason}), moving closer`);
                
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
                            console.log(`[AI]   → Found position with line of sight at ${targetLocation}`);
                        }
                    } else {
                        console.log(`[AI]   → No positions with line of sight found, moving directly toward target`);
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
                
                // Store the speech command to execute after movement
                this.pendingSpeechCommands.set(character.name, command);
                
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
                    description: `${speaker.name} says: "${command.content}"`,
                    turn: this.state.game.turn,
                    dialogue: {
                        speaker: speaker.name,
                        content: command.content || '',
                        answers: command.answers
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
                        title: `${command.source || speaker.name} - Conversación`
                    }
                }
            });
            
            // Wait a bit for the popup and conversation component to be created
            setTimeout(() => {
                // Directly dispatch conversation update event with the AI's speech
                // No need to call ConversationEvent.start which would make another API call
                this.dispatch(ConversationEvent.update, {
                    type: 'speech',
                    source: command.source || speaker.name,
                    content: command.content || '',
                    answers: command.answers || [],
                    action: undefined
                });
                
                // End the AI turn immediately when conversation starts
                // This prevents other AI characters from continuing to act
                console.log('[AI] ExecuteSpeech - Conversation started, force ending AI turn');
                this.endAITurn(true); // Force end to stop other AI characters
                
                // Also set the processing flags to false to stop any loops
                this.isProcessingTurn = false;
                this.isProcessingMultipleCharacters = false;
            }, 200); // Increased delay to ensure conversation component is ready
            
            // Record dialogue event
            this.contextBuilder.recordEvent({
                type: 'dialogue',
                actor: command.source,
                description: `${command.source}: ${command.content}`,
                turn: this.state.game.turn
            });
            
            return;
        }
        
        // If not close enough or can't find characters, just log and end turn
        console.log('[AI] ExecuteSpeech - Cannot talk, characters too far or not found');
        console.log(`[AI] ${command.source} wants to say:`, command.content);
        
        // Record the attempt
        this.contextBuilder.recordEvent({
            type: 'dialogue',
            actor: command.source,
            description: `${command.source} (too far): ${command.content}`,
            turn: this.state.game.turn
        });
        
        // End turn
        this.endAITurn();
    }


    private async spawnCharacters(command: AICommand): Promise<void> {
        if (!this.state || !this.contextBuilder) return;
        
        // Spawn new characters during gameplay
        for (const charData of command.characters) {
            const spawnLocation = this.resolveLocation(charData.location);
            
            if (!spawnLocation) {
                console.warn('Could not resolve spawn location for', charData.name);
                continue;
            }
            
            // Create a new character object with required fields
            const newCharacter = {
                name: charData.name,
                race: charData.race || 'human',
                description: charData.description || '',
                position: spawnLocation,
                x: spawnLocation.x,
                y: spawnLocation.y,
                direction: this.mapDirection(charData.orientation || 'down'),
                speed: charData.speed || 'medium',
                player: this.state.game.turn, // Assign to current AI player
                health: 100,
                maxHealth: 100,
                palette: charData.palette || {
                    skin: '#d7a55f',
                    helmet: '#808080',
                    suit: '#404040'
                }
            };
            
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
            const response = await this.gameEngineService.requestDialogueResponse(
                dialogue.speaker || 'Player',
                dialogue.targetNPC,
                dialogue.playerChoice,
                context
            );

            if (response.command && response.command.type === 'speech') {
                await this.executeSpeech(response.command, {} as DeepReadonly<ICharacter>);
            }
        } catch (error) {
            console.error('Error generating AI dialogue response:', error);
        }
    }

    private resolveLocation(location: string, fromCharacter?: DeepReadonly<ICharacter>): ICoord | null {
        if (!this.state) {
            return null;
        }
        
        const lowerLocation = location.toLowerCase().trim();
        
        // Handle relative directions (north, south, east, west)
        if (fromCharacter && ['north', 'south', 'east', 'west', 'up', 'down', 'left', 'right'].includes(lowerLocation)) {
            const moveDistance = 5; // Move 5 cells in the direction
            switch (lowerLocation) {
                case 'north':
                case 'up':
                    return { x: fromCharacter.position.x, y: fromCharacter.position.y - moveDistance };
                case 'south':
                case 'down':
                    return { x: fromCharacter.position.x, y: fromCharacter.position.y + moveDistance };
                case 'east':
                case 'right':
                    return { x: fromCharacter.position.x + moveDistance, y: fromCharacter.position.y };
                case 'west':
                case 'left':
                    return { x: fromCharacter.position.x - moveDistance, y: fromCharacter.position.y };
            }
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

        // Try to parse as coordinates
        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch) {
            const xStr = coordMatch[1];
            const yStr = coordMatch[2];
            if (xStr && yStr) {
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                if (!isNaN(x) && !isNaN(y)) {
                    return { x, y };
                }
            }
        }

        return null;
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

    private findRetreatPosition(character: DeepReadonly<ICharacter>, threat: string): ICoord | null {
        if (!this.state) return null;
        
        // Find a position away from the threat
        const threatChar = this.state.characters.find((c: DeepReadonly<ICharacter>) => c.name === threat);
        
        if (!threatChar) return null;

        // Calculate direction away from threat
        const dx = character.position.x - threatChar.position.x;
        const dy = character.position.y - threatChar.position.y;
        
        // Move in opposite direction
        const retreatX = character.position.x + Math.sign(dx) * 5;
        const retreatY = character.position.y + Math.sign(dy) * 5;
        
        // TODO: Validate position is walkable
        return { x: retreatX, y: retreatY };
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

    public async forceAIAction(character: DeepReadonly<ICharacter>, _actionType?: string): Promise<void> {
        // Allow manual triggering of AI actions for testing
        await this.processAICharacterTurn(character);
    }

    public enableAI(): void {
        // Enable AI processing
        this.aiEnabled = true;
        console.log('AI Controller enabled');
    }

    public disableAI(): void {
        // Disable AI processing (for testing or manual control)
        this.aiEnabled = false;
        console.log('AI Controller disabled');
    }

    public isAIEnabled(): boolean {
        return this.aiEnabled;
    }
    
    public enableTacticalSystem(): void {
        this.useTacticalSystem = true;
        console.log('[AI] Tactical system ENABLED - will use local tactical executor for follow-up combat actions');
    }
    
    public disableTacticalSystem(): void {
        this.useTacticalSystem = false;
        console.log('[AI] Tactical system DISABLED - will always use AI endpoint for all decisions');
    }
    
    /**
     * Initialize the story when starting single player mode with an origin
     * Requests the AI to generate initial map, characters, and narrative setup
     */
    public async initializeStoryFromOrigin(): Promise<void> {
        console.log('[AI] initializeStoryFromOrigin called');
        
        if (!this.state) {
            console.error('[AI] Cannot initialize story - no state available');
            return;
        }
        
        console.log('[AI] State exists, checking story...');
        const storyState = this.state.story;
        console.log('[AI] Story state:', {
            hasStory: !!storyState,
            hasSelectedOrigin: !!storyState?.selectedOrigin,
            originName: storyState?.selectedOrigin?.name
        });
        
        if (!storyState?.selectedOrigin) {
            console.error('[AI] Cannot initialize story - no origin selected');
            console.error('[AI] Full story state:', storyState);
            return;
        }
        
        console.log('[AI] Initializing story from origin:', storyState.selectedOrigin.name);
        console.log('[AI] Origin details:', {
            id: storyState.selectedOrigin.id,
            nameES: storyState.selectedOrigin.nameES,
            startingLocation: storyState.selectedOrigin.startingLocation,
            traits: storyState.selectedOrigin.specialTraits
        });
        
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
            console.log('[AI] Calling AIGameEngineService.requestStoryInitialization...');
            const response = await this.gameEngineService.requestStoryInitialization(
                originCopy,
                storyStateCopy
            );
            
            console.log('[AI] Response received:', {
                hasResponse: !!response,
                hasCommands: !!response?.commands,
                commandCount: response?.commands?.length || 0,
                hasNarrative: !!response?.narrative
            });
            
            if (!response) {
                console.error('[AI] Failed to get story initialization response');
                return;
            }
            
            // Execute the initialization commands
            // These should include map generation, character spawning, and initial narrative
            if (response.commands && Array.isArray(response.commands)) {
                console.log('[AI] Executing story initialization commands:', response.commands.length);
                
                for (const command of response.commands) {
                    const validatedCommand = this.commandParser.validate(command);
                    if (validatedCommand) {
                        console.log('[AI] Executing initialization command:', validatedCommand.type);
                        
                        // Execute commands without a specific character context
                        // These are story-level commands like map generation
                        // Pass an empty character for story-level commands
                        const emptyCharacter: DeepReadonly<ICharacter> = {
                            name: '',
                            player: '',
                            position: { x: 0, y: 0 },
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
                        
                        // Small delay between commands for stability
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                        console.warn('[AI] Invalid initialization command:', command);
                    }
                }
            }
            
            // If there's an initial narrative message, display it
            if (response.narrative) {
                console.log('[AI] Initial narrative received:', response.narrative);
                // This could be shown via a popup or conversation system
                // For now, just log it
            } else {
                console.log('[AI] No narrative text in response');
            }
            
            console.log('[AI] Story initialization complete');
            
        } catch (error) {
            console.error('[AI] Error initializing story:', error);
            console.error('[AI] Error details:', {
                message: (error as Error).message,
                stack: (error as Error).stack
            });
        }
    }
}