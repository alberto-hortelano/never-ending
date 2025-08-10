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
        this.state = state;
        this.contextBuilder = new AIContextBuilder(state);
        this.initialize();
    }

    private initialize(): void {
        if (!this.state) return;

        // Listen for turn changes to check if AI player should act
        this.listen(GameEvent.changeTurn, (data: GameEventsMap[GameEvent.changeTurn]) => {
            const currentPlayer = data.turn;
            
            // Check if this is an AI-controlled player
            if (this.isAIPlayer(currentPlayer)) {
                // Give a small delay for UI to update
                setTimeout(() => this.processAIPlayerTurn(currentPlayer), 500);
            }
        });

        // Listen for dialogue responses from AI
        // Note: These events might not exist yet, so we'll handle them carefully
        // We'll use a generic listener pattern for now
    }

    private isAIPlayer(playerId: string): boolean {
        if (!this.state) return false;
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
        
        if (aiCharacters.length === 0) return;
        
        // Process the first character's turn
        // The turn system will automatically move to the next character
        const firstChar = aiCharacters[0];
        if (firstChar) {
            await this.processAICharacterTurn(firstChar);
        }
    }

    private async processAICharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        if (this.isProcessingTurn || !this.aiEnabled || !this.state || !this.contextBuilder) return;
        this.isProcessingTurn = true;

        try {
            // Build context for AI
            const context = this.contextBuilder.buildTurnContext(character, this.state);
            
            // Get AI decision from game engine
            const response = await this.gameEngineService.requestAIAction(context);
            
            // Parse and execute AI commands
            if (response.command) {
                const validatedCommand = this.commandParser.validate(response.command);
                if (validatedCommand) {
                    await this.executeAICommand(validatedCommand, character);
                } else {
                    console.error('Invalid AI command received:', response.command);
                    this.endAITurn();
                }
            } else {
                console.warn('No AI command received, ending turn');
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
        const validatedCommand = this.commandParser.validate(command);
        if (!validatedCommand) {
            console.error('Invalid AI command:', command);
            this.endAITurn();
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
                console.warn('Unhandled AI command type:', validatedCommand.type);
                this.endAITurn();
        }
    }

    private async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        // Find target location
        const targetLocation = this.resolveLocation(command.characters[0].location);
        
        if (targetLocation) {
            // Enter movement mode first
            this.dispatch(ControlsEvent.showMovement, character.name);
            
            // After a short delay, click on the target location
            setTimeout(() => {
                this.dispatch(ControlsEvent.cellClick, targetLocation);
            }, 100);
        } else {
            // If no valid target, end turn
            this.endAITurn();
        }
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
        
        // Create popup data for speech
        const popupData = {
            type: 'dialogue',
            speaker: command.source,
            content: command.content,
            answers: command.answers || [],
            action: command.action
        };
        
        // Show popup with dialogue (using correct interface)
        this.dispatch(UpdateStateEvent.uiPopup, {
            popupId: 'ai-dialogue',
            popupState: {
                type: 'conversation' as const,
                visible: true,
                data: popupData
            }
        });
        
        // Record dialogue event
        this.contextBuilder.recordEvent({
            type: 'dialogue',
            actor: command.source,
            description: `${command.source}: ${command.content}`,
            turn: this.state.game.turn
        });
        
        // If there are no answer options, close popup after delay
        if (!command.answers || command.answers.length === 0) {
            setTimeout(() => {
                this.dispatch(UpdateStateEvent.uiPopup, {
                    popupId: 'ai-dialogue',
                    popupState: {
                        type: 'conversation' as const,
                        visible: false,
                        data: {} // Empty data object for conversation popup
                    }
                });
                // Continue with next action if specified
                if (command.action) {
                    this.processFollowUpAction(command.action);
                }
            }, 3000);
        }
    }

    private processFollowUpAction(action: string): void {
        // Process follow-up actions after dialogue
        switch (action) {
            case 'storyline':
                // Continue with storyline progression
                console.log('Processing storyline continuation');
                break;
            case 'character':
                // Spawn new characters
                console.log('Processing character spawn');
                break;
            case 'movement':
                // Trigger movement
                console.log('Processing movement');
                break;
            case 'attack':
                // Trigger combat
                console.log('Processing attack');
                break;
            case 'map':
                // Generate new map
                console.log('Processing map generation');
                break;
            default:
                console.log('Unknown follow-up action:', action);
        }
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
        if (!this.state) return null;
        
        // Parse location string to find actual map position
        // Could be: "building/room", "near character name", coordinates, etc.
        
        // Try to find character by name
        const targetChar = this.state.characters.find((c: DeepReadonly<ICharacter>) => c.name === location);
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

    private endAITurn(): void {
        if (!this.state) return;
        
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
}