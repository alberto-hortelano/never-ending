import { EventBus } from '../events/EventBus';
import { 
    ControlsEvent, 
    UpdateStateEvent, 
    GameEvent,
    GameEventsMap,
    StateChangeEventsMap,
    UpdateStateEventsMap,
    ControlsEventsMap
} from '../events';
import { State } from '../State';
import { AIContextBuilder } from './AIContextBuilder';
import { AICommandParser, AICommand } from './AICommandParser';
import { AIGameEngineService } from './AIGameEngineService';
import { ICharacter, ICoord, Direction } from '../interfaces';
import { DeepReadonly } from '../helpers/types';

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
    GameEventsMap & StateChangeEventsMap & ControlsEventsMap & UpdateStateEventsMap,
    GameEventsMap & StateChangeEventsMap & ControlsEventsMap & UpdateStateEventsMap
> {
    private static instance: AIController;
    private gameEngineService: AIGameEngineService;
    private contextBuilder?: AIContextBuilder;
    private commandParser: AICommandParser;
    private isProcessingTurn: boolean = false;
    private aiEnabled: boolean = true;
    private state?: State;

    private constructor() {
        super();
        this.gameEngineService = AIGameEngineService.getInstance();
        this.commandParser = new AICommandParser();
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
    }
    
    private isInitialized = false;

    private initialize(): void {
        if (!this.state) {
            console.log('[AI] Initialize called but no state available');
            return;
        }
        
        if (this.isInitialized) {
            console.log('[AI] Already initialized, skipping');
            return;
        }
        
        console.log('[AI] Initializing AIController with state');
        this.isInitialized = true;

        // Listen for turn changes to check if AI player should act
        this.listen(GameEvent.changeTurn, (data: GameEventsMap[GameEvent.changeTurn]) => {
            console.log('[AI] Turn changed to:', data.turn, 'from:', data.previousTurn);
            const currentPlayer = data.turn;
            
            // Check if this is an AI-controlled player
            const isAI = this.isAIPlayer(currentPlayer);
            console.log('[AI] Is player', currentPlayer, 'an AI?', isAI);
            
            if (isAI) {
                console.log('[AI] AI player turn detected, processing in 500ms...');
                // Give a small delay for UI to update
                setTimeout(() => this.processAIPlayerTurn(currentPlayer), 500);
            }
        });

        // Listen for dialogue responses from AI
        // Note: These events might not exist yet, so we'll handle them carefully
        // We'll use a generic listener pattern for now
    }

    private isAIPlayer(playerId: string): boolean {
        if (!this.state) {
            console.log('[AI] isAIPlayer - No state available');
            return false;
        }
        // Check if this player is marked as AI in the game state
        const game = this.state.game as ExtendedGame;
        console.log('[AI] isAIPlayer - Checking player:', playerId, 'playerInfo:', game.playerInfo);
        const playerInfo = game.playerInfo?.[playerId];
        const result = playerInfo?.isAI === true;
        console.log('[AI] isAIPlayer - Player', playerId, 'info:', playerInfo, 'isAI:', result);
        return result;
    }

    // Removed isAIControlled - not used

    private async processAIPlayerTurn(playerId: string): Promise<void> {
        if (!this.state) return;
        // When it's an AI player's turn, find their characters and take actions
        const aiCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) => c.player === playerId);
        
        if (aiCharacters.length === 0) return;
        
        // Process the first character's turn
        // The turn system will automatically move to the next character
        const firstChar = aiCharacters[0];
        if (firstChar) {
            await this.processAICharacterTurn(firstChar);
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
        console.log('[AI] Starting turn for character:', character.name);

        try {
            // Build context for AI
            const context = this.contextBuilder.buildTurnContext(character, this.state);
            console.log('[AI] Built context for character:', character.name);
            
            // Get AI decision from game engine
            console.log('[AI] Requesting AI action from game engine...');
            const response = await this.gameEngineService.requestAIAction(context);
            console.log('[AI] Received command type:', response.command?.type || 'none');
            
            // Parse and execute AI commands
            if (response.command) {
                const validatedCommand = this.commandParser.validate(response.command);
                if (validatedCommand) {
                    console.log('[AI] Command validated successfully, executing type:', validatedCommand.type);
                    await this.executeAICommand(validatedCommand, character);
                } else {
                    console.error('[AI] Invalid AI command received:', response.command);
                    this.endAITurn();
                }
            } else {
                console.warn('[AI] No AI command received, ending turn');
                this.endAITurn();
            }
        } catch (error) {
            console.error('Error processing AI turn:', error);
            // Fall back to skip turn
            this.endAITurn();
        } finally {
            this.isProcessingTurn = false;
        }
    }

    private async executeAICommand(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        console.log('[AI] ExecuteAICommand called with:', { type: command.type, character: character.name });
        const validatedCommand = this.commandParser.validate(command);
        if (!validatedCommand) {
            console.error('[AI] Invalid AI command:', command);
            this.endAITurn();
            return;
        }

        console.log('[AI] Executing command type:', validatedCommand.type);
        switch (validatedCommand.type) {
            case 'movement':
                console.log('[AI] Executing movement command...');
                await this.executeMovement(validatedCommand, character);
                break;
            case 'attack':
                console.log('[AI] Executing attack command...');
                await this.executeAttack(validatedCommand, character);
                break;
            case 'speech':
                console.log('[AI] Executing speech command...');
                await this.executeSpeech(validatedCommand, character);
                break;
            case 'character':
                console.log('[AI] Executing character spawn command...');
                await this.spawnCharacters(validatedCommand);
                break;
            default:
                console.warn('[AI] Unhandled AI command type:', validatedCommand.type);
                this.endAITurn();
        }
    }

    private async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        console.log('[AI] ExecuteMovement - Processing movement for:', character.name);
        
        // Find target location
        const targetLocationString = command.characters[0].location;
        console.log('[AI] ExecuteMovement - Resolving location:', targetLocationString);
        const targetLocation = this.resolveLocation(targetLocationString);
        
        if (!targetLocation) {
            console.log('[AI] ExecuteMovement - Could not resolve target location, ending turn');
            this.endAITurn();
            return;
        }
        
        console.log('[AI] ExecuteMovement - Target location resolved to:', targetLocation);
        
        // Enter movement mode first to get reachable cells
        console.log('[AI] ExecuteMovement - Dispatching showMovement for:', character.name);
        this.dispatch(ControlsEvent.showMovement, character.name);
        
        // Wait for Movement system to set up, then find best reachable position
        setTimeout(() => {
            // Get reachable cells from highlights in UI state
            const highlights = this.state?.ui?.transientUI?.highlights;
            const reachableCells = highlights?.reachableCells || [];
            
            console.log('[AI] ExecuteMovement - Found', reachableCells.length, 'reachable cells');
            
            if (reachableCells.length === 0) {
                console.log('[AI] ExecuteMovement - No reachable cells, ending turn');
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
            
            console.log('[AI] ExecuteMovement - Best reachable cell towards target:', bestCell);
            console.log('[AI] ExecuteMovement - Dispatching cellClick to:', bestCell);
            
            this.dispatch(ControlsEvent.cellClick, { x: bestCell.x, y: bestCell.y });
            console.log('[AI] ExecuteMovement - Movement command dispatched');
            
            // After another delay, if movement didn't happen, end turn
            setTimeout(() => {
                // Check if we're still in AI turn (movement might have changed it)
                if (this.state && this.state.game.turn === character.player) {
                    console.log('[AI] ExecuteMovement - Movement might have failed, ending turn');
                    this.endAITurn();
                }
            }, 1000);
        }, 750); // Slightly longer delay to ensure Movement system is ready
    }

    private async executeAttack(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state) {
            this.endAITurn();
            return;
        }

        const attackData = command.characters[0];
        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) => c.name === attackData.target);
        
        if (!targetChar) {
            console.error('Attack target not found:', attackData.target);
            this.endAITurn();
            return;
        }
        
        // Dispatch attack event based on attack type
        switch (attackData.attack) {
            case 'melee':
                // Check if target is adjacent for melee
                const distance = this.getDistance(character.position, targetChar.position);
                if (distance <= 1.5) {
                    // Use a melee attack action
                    // Attack in melee - would need proper melee attack event
                    console.log('AI melee attack:', character.name, 'vs', targetChar.name);
                    this.endAITurn();
                    // After a delay, select the target
                    // Note: Actual melee requires proper event
                    setTimeout(() => {
                        console.log('AI melee target click:', targetChar.name);
                        this.endAITurn();
                    }, 100);
                } else {
                    // Move closer to target first
                    // Move closer to target first
                    this.dispatch(ControlsEvent.showMovement, character.name);
                    setTimeout(() => {
                        this.dispatch(ControlsEvent.cellClick, targetChar.position);
                    }, 100);
                }
                break;
                
            case 'kill':
            case 'ranged':
                // Enter shooting mode
                this.dispatch(ControlsEvent.showShooting, character.name);
                // After a delay, click on target
                setTimeout(() => {
                    this.dispatch(ControlsEvent.cellClick, targetChar.position);
                }, 100);
                break;
                
            case 'hold':
                // Hold position - set overwatch
                this.dispatch(ControlsEvent.showOverwatch, character.name);
                // After a delay, confirm overwatch by clicking current position
                setTimeout(() => {
                    this.dispatch(ControlsEvent.cellClick, character.position);
                }, 100);
                break;
                
            case 'retreat':
                // Find retreat position and move
                const retreatTarget = this.findRetreatPosition(character, attackData.target);
                if (retreatTarget) {
                    this.dispatch(ControlsEvent.showMovement, character.name);
                    setTimeout(() => {
                        this.dispatch(ControlsEvent.cellClick, retreatTarget);
                    }, 100);
                } else {
                    this.endAITurn();
                }
                break;
                
            default:
                console.warn('Unknown attack type:', attackData.attack);
                this.endAITurn();
        }
    }

    private getDistance(pos1: ICoord, pos2: ICoord): number {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2)
        );
    }


    private async executeSpeech(command: AICommand, _character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state || !this.contextBuilder) {
            return;
        }
        
        console.log('[AI] ExecuteSpeech - Processing speech for:', command.source);
        console.log('[AI] ExecuteSpeech - Content:', command.content);
        console.log('[AI] ExecuteSpeech - Answers:', command.answers);
        
        // The conversation system expects messages in a specific format
        // For now, we'll display the dialogue in a simpler way
        // In the future, this could integrate with the Talk system
        
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
            console.log('[AI] ExecuteSpeech - Distance between speaker and player:', distance);
            
            if (distance <= 3) {
                // They're close enough - dispatch a talk event
                console.log('[AI] ExecuteSpeech - Characters are close, initiating talk');
                
                // Show the talk popup with the AI's message
                this.dispatch(ControlsEvent.showTalk, {
                    talkingCharacter: speaker,
                    availableCharacters: [player]
                });
                
                // Then after a delay, select the player to talk to
                setTimeout(() => {
                    console.log('[AI] ExecuteSpeech - Simulating conversation with player');
                    console.log(`[AI] ${command.source} says:`, command.content);
                    
                    // The actual conversation UI would need to be enhanced to support AI dialogue
                    // For now, we'll just log the message and end the turn
                    
                    // End turn after talking
                    setTimeout(() => {
                        this.endAITurn();
                    }, 1000);
                }, 500);
                
                // Record dialogue event
                this.contextBuilder.recordEvent({
                    type: 'dialogue',
                    actor: command.source,
                    description: `${command.source}: ${command.content}`,
                    turn: this.state.game.turn
                });
                
                return;
            }
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
            console.log('[AI] ResolveLocation - No state available');
            return null;
        }
        
        console.log('[AI] ResolveLocation - Attempting to resolve location:', location);
        console.log('[AI] ResolveLocation - Available characters:', this.state.characters.map(c => c.name));
        
        // Parse location string to find actual map position
        // Could be: "building/room", "near character name", coordinates, etc.
        
        // Try to find character by name (case-insensitive)
        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) => 
            c.name.toLowerCase() === location.toLowerCase()
        );
        if (targetChar) {
            console.log('[AI] ResolveLocation - Found character:', targetChar.name, 'at position:', targetChar.position);
            return { x: targetChar.position.x, y: targetChar.position.y };
        }
        console.log('[AI] ResolveLocation - No character found with name:', location);
        console.log('[AI] ResolveLocation - Tried to match (lowercase):', location.toLowerCase());

        // Try to parse as building/room
        if (location.includes('/')) {
            console.log('[AI] ResolveLocation - Location contains "/", treating as building/room (not yet implemented)');
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
                    console.log('[AI] ResolveLocation - Parsed as coordinates:', { x, y });
                    return { x, y };
                }
            }
        }
        console.log('[AI] ResolveLocation - No valid coordinate match found');

        console.log('[AI] ResolveLocation - Could not resolve location:', location);
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

    private endAITurn(): void {
        if (!this.state) {
            console.log('[AI] EndAITurn - No state available');
            return;
        }
        
        console.log('[AI] EndAITurn - Ending AI turn');
        // Signal end of turn by changing to next turn
        const currentTurn = this.state.game.turn;
        const players = this.state.game.players;
        const currentIndex = players.indexOf(currentTurn);
        const nextIndex = (currentIndex + 1) % players.length;
        const nextTurn = players[nextIndex] || currentTurn;
        
        console.log('[AI] EndAITurn - Changing turn from', currentTurn, 'to', nextTurn);
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
}