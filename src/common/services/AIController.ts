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
import { ICharacter, ICoord, Direction } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
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
    private pendingSpeechCommand?: AICommand;
    private isProcessingMultipleCharacters: boolean = false;
    private movementTimeouts: NodeJS.Timeout[] = [];
    private tacticalExecutor: TacticalExecutor;
    private useTacticalSystem: boolean = true; // Flag to enable/disable tactical system

    private constructor() {
        super();
        this.gameEngineService = AIGameEngineService.getInstance();
        this.commandParser = new AICommandParser();
        this.tacticalExecutor = TacticalExecutor.getInstance();
        CombatStances.initialize();
    }

    public static getInstance(): AIController {
        if (!AIController.instance) {
            AIController.instance = new AIController();
        }
        return AIController.instance;
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
            // Check if we should stop processing (e.g., if conversation started)
            if (this.state && this.state.game.turn !== playerId) {
                console.log('[AI] Turn changed during processing, stopping');
                break;
            }
            
            await this.processAICharacterTurn(character);
            
            // Add a small delay between character actions for better visibility
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Clear any remaining timeouts
        this.clearMovementTimeouts();
        
        // Clear the flag
        this.isProcessingMultipleCharacters = false;
        
        // Only end turn if it's still the AI's turn (conversation might have ended it already)
        if (this.state && this.state.game.turn === playerId) {
            // All AI characters processed, ending AI turn
            this.endAITurn();
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
                
                // Check if character has enough action points to continue
                const pointsLeft = currentChar.actions?.pointsLeft || 0;
                console.log(`[AI] ${currentChar.name} has ${pointsLeft} action points remaining (loop ${actionsPerformed + 1})`);
                
                if (pointsLeft < 20) {
                    // Not enough points for most actions
                    console.log(`[AI] ${currentChar.name} insufficient action points, ending character turn`);
                    break;
                }
                
                // Check if we should use tactical system for combat characters
                const isInCombat = this.isCharacterInCombat(currentChar);
                
                if (this.useTacticalSystem && isInCombat) {
                    // Use tactical executor for combat decisions
                    await this.processTacticalCharacterTurn(currentChar);
                } else {
                    // Use traditional AI system for non-combat or narrative actions
                    await this.processNarrativeCharacterTurn(currentChar);
                }
                
                actionsPerformed++;
                
                // Small delay between actions for visibility
                await new Promise(resolve => setTimeout(resolve, 500));
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
        
        
        // Get visible characters
        const visibleCharacters = context.visibleCharacters
            .map(vc => this.state!.characters.find(c => c.name === vc.name))
            .filter(c => c !== undefined) as DeepReadonly<ICharacter>[];
        
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
        
        // Build context for AI
        const context = this.contextBuilder.buildTurnContext(character, this.state);
        
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
            default:
                console.warn('[AI] Unknown command type:', validatedCommand.type);
                this.endAITurn();
        }
    }

    private async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        // Find target location
        const targetLocationString = command.characters[0].location;
        const targetLocation = this.resolveLocation(targetLocationString);
        
        if (!targetLocation) {
            console.log('[AI] ExecuteMovement - Could not resolve location:', targetLocationString);
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
        
        // If we're already adjacent (within 1.5 cells), switch to appropriate action
        if (currentDistance <= 1.5) {
            // Check if we have a pending speech command
            if (this.pendingSpeechCommand) {
                const speechCommand = this.pendingSpeechCommand;
                this.pendingSpeechCommand = undefined; // Clear the pending command
                await this.executeSpeech(speechCommand, character);
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
        
        // Enter movement mode first to get reachable cells
        this.dispatch(ControlsEvent.showMovement, character.name);
        
        // Wait for Movement system to set up, then find best reachable position
        await new Promise<void>(resolve => {
            setTimeout(() => {
            // Get reachable cells from highlights in UI state
            const highlights = this.state?.ui?.transientUI?.highlights;
            const reachableCells = highlights?.reachableCells || [];
            
            if (reachableCells.length === 0) {
                this.endAITurn();
                return;
            }
            
            // Find the reachable cell closest to the target
            let bestCell = reachableCells[0];
            if (!bestCell) {
                console.log('[AI] ExecuteMovement - No valid best cell found, ending turn');
                this.endAITurn();
                return;
            }
            
            let bestDistance = this.getDistance(bestCell, targetLocation);
            
            for (const cell of reachableCells) {
                const dist = this.getDistance(cell, targetLocation);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestCell = cell;
                }
            }
            
            this.dispatch(ControlsEvent.cellClick, { x: bestCell.x, y: bestCell.y });
            
            // After another delay, check if we need to execute pending speech
            const timeoutId = setTimeout(async () => {
                // Don't do anything if we're processing multiple characters
                if (this.isProcessingMultipleCharacters) {
                    return;
                }
                // Check if we're still in AI turn (movement might have changed it)
                if (this.state && this.state.game.turn === character.player) {
                    // Check if we have a pending speech command and are now close enough
                    if (this.pendingSpeechCommand) {
                        const newDistance = this.getDistance(character.position, targetLocation);
                        if (newDistance <= 3) {
                            const speechCommand = this.pendingSpeechCommand;
                            this.pendingSpeechCommand = undefined;
                            await this.executeSpeech(speechCommand, character);
                            return;
                        }
                    }
                    this.endAITurn();
                }
            }, 1000);
            
            // Store timeout so we can cancel it if needed
            this.movementTimeouts.push(timeoutId);
            
            // Resolve the promise after setting up the timeout
            resolve();
        }, 750); // Slightly longer delay to ensure Movement system is ready
        });
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
        const player = this.state.characters.find((c: DeepReadonly<ICharacter>) => 
            c.name.toLowerCase() === 'player'
        );
        
        if (speaker && player) {
            // Check if they're close enough to talk (within 3 cells)
            const distance = this.getDistance(speaker.position, player.position);
            
            if (distance > 3) {
                // Too far - automatically move closer first
                console.log(`[AI]   → Too far to speak, moving closer`);
                
                // Execute a movement command to get closer
                const moveCommand: AICommand = {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: 'player'
                    }]
                };
                
                // Store the speech command to execute after movement
                this.pendingSpeechCommand = command;
                
                // Execute movement - it will check for proximity and execute speech if close enough
                await this.executeMovement(moveCommand, character);
                return;
            }
            
            // They're close enough - show conversation directly
            
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
                direction: (charData.orientation || 'bottom') as Direction,
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

    private resolveLocation(location: string): ICoord | null {
        if (!this.state) {
            return null;
        }
        
        // Parse location string to find actual map position
        // Could be: "building/room", "near character name", coordinates, etc.
        
        // Try to find character by name (case-insensitive)
        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) => 
            c.name.toLowerCase() === location.toLowerCase()
        );
        if (targetChar) {
            return { x: targetChar.position.x, y: targetChar.position.y };
        }

        // Try to parse as building/room
        if (location.includes('/')) {
            // const [building, room] = location.split('/');
            // Would need to look up building and room positions from map data
            // For now, return null
            return null;
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
        console.log('[AI] Tactical system enabled');
    }
    
    public disableTacticalSystem(): void {
        this.useTacticalSystem = false;
        console.log('[AI] Tactical system disabled');
    }
}