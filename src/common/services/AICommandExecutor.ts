/* eslint-disable no-case-declarations */
import {
    ControlsEvent,
    UpdateStateEvent,
    ConversationEvent
} from '../events';
import { State } from '../State';
import { AIContextBuilder, type AIGameContext } from './AIContextBuilder';
import { AICommandParser, AICommand, MovementCommand, AttackCommand, SpeechCommand, CharacterCommand, MapCommand } from './AICommandParser';
import { AIGameEngineService, type AIActionContext } from './AIGameEngineService';
import { StoryCommandExecutor, ItemSpawnCommand } from './StoryCommandExecutor';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';
import { AISpatialUtils } from './AISpatialUtils';
import { AILocationResolver } from './AILocationResolver';
import { ICharacter, ICoord, Direction, IStoryState } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { calculatePath } from '../helpers/map';
import { FactionService } from './FactionService';
import { MAIN_CHARACTER_NAME, type LanguageCode } from '../constants';

/**
 * AICommandExecutor handles the execution of AI commands.
 * This service is responsible for translating AI decisions into game actions.
 */
export class AICommandExecutor {
    constructor(
        private state: State,
        private contextBuilder: AIContextBuilder,
        private commandParser: AICommandParser,
        private gameEngineService: AIGameEngineService,
        private storyExecutor: StoryCommandExecutor,
        private dispatch: (event: string, data: unknown) => void,
        private endTurnCallback: (forceEnd?: boolean) => void,
        private isProcessingMultipleCharacters: () => boolean,
        private pendingSpeechCommands: Map<string, AICommand>,
        private speechMovementAttempts: Map<string, number>,
        private movementTimeouts: NodeJS.Timeout[],
        private setIsForcedTurnEnd: (value: boolean) => void,
        private setIsProcessingTurn: (value: boolean) => void,
        private setIsProcessingMultipleCharacters: (value: boolean) => void,
        private mapDirection: (dir: string) => Direction
    ) {}

    public async executeCommand(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
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
                this.endTurnCallback();
        }
    }

    public async executeMovement(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
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
            targetLocation = AILocationResolver.resolveLocation(targetLocationString, this.state!, character, isCoordinate);
        } catch (error) {
            console.error(`[AI] ExecuteMovement - Failed to resolve location for ${character.name}:`, error);

            // End the turn properly on invalid location
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
            }
            return;
        }

        if (!targetLocation || !isFinite(targetLocation.x) || !isFinite(targetLocation.y) ||
            targetLocation.x < -1000 || targetLocation.x > 1000 ||
            targetLocation.y < -1000 || targetLocation.y > 1000) {
            console.error('[AI] ExecuteMovement - Invalid resolved location:', targetLocationString, targetLocation);
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
            }
            return;
        }

        // Check if we're already at the target location (distance 0)
        const currentDistance = AISpatialUtils.getDistance(character.position, targetLocation);
        if (currentDistance === 0) {
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
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

            this.endTurnCallback();
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
            const blockage = AISpatialUtils.detectBlockingEntity(character.position, targetLocation, this.state!.map, this.state!.characters);

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
                        distance: AISpatialUtils.getDistance(character.position, blockage.character.position)
                    },
                    originalTarget: targetChar?.name || 'location',
                    message: `Cannot reach ${targetChar?.name || 'target location'} - ${blockage.character.name} is blocking the path.`
                };

                // Build special context and request new action from AI
                if (!this.contextBuilder) {
                    console.error('[AI] No context builder available');
                    if (!this.isProcessingMultipleCharacters()) {
                        this.endTurnCallback();
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
                        location: AILocationResolver.getCurrentRoomName(character, this.state!.map)
                    },
                    blockageInfo: JSON.stringify(blockageContext)
                } as unknown as AIGameContext;

                console.log('[AI] Requesting new instructions due to blocked path');
                const language = this.state?.language || 'en';
                const response = await this.gameEngineService.requestAIAction(contextWithBlockage as unknown as AIActionContext, undefined, undefined, language as LanguageCode);

                if (response.command) {
                    const validatedCommand = this.commandParser.validate(response.command);
                    if (validatedCommand) {
                        await this.executeCommand(validatedCommand, character);
                        return;
                    }
                }
            } else if (blockage.type === 'wall') {
            }

            // If no alternative found, end turn
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
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
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
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
                if (!this.isProcessingMultipleCharacters()) {
                    this.endTurnCallback();
                }
                return;
            }
        }


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
            if (this.isProcessingMultipleCharacters()) {
                return;
            }

            // Check if we're still in AI turn (movement might have changed it)
            if (this.state && this.state.game.turn === character.controller) {
                // Check if we have a pending speech command and are now close enough
                const pendingSpeech = this.pendingSpeechCommands.get(character.name);
                if (pendingSpeech && moveToDest) {
                    const newDistance = AISpatialUtils.getDistance(moveToDest, targetLocation);
                    const viewDistance = 15; // Standard view distance
                    // For conversations, ignore characters blocking - only walls should block speech
                    const hasLineOfSight = AISpatialUtils.checkLineOfSight(moveToDest, targetLocation, this.state!.map, this.state!.characters, true);

                    // Check if within speaking range, view range, and has line of sight
                    if (newDistance <= 8 && newDistance <= viewDistance && hasLineOfSight) {
                        this.pendingSpeechCommands.delete(character.name);
                        await this.executeSpeech(pendingSpeech, character);
                        return;
                    }
                }

                // Movement complete - next action loop will request fresh AI decision
                // ongoingMovement tracking handled by AIController/AITurnManager
            }
        }, 1500); // Wait for movement animation to complete

        // Store timeout so we can cancel it if needed
        this.movementTimeouts.push(timeoutId);
    }

    public async executeAttack(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
        if (!this.state) {
            console.error('[AI] ExecuteAttack - No state available');
            return;
        }

        const attackCmd = command as AttackCommand;
        const chars = attackCmd.characters;
        if (!chars || !chars[0]) {
            return;
        }
        const attackData = chars[0];

        // Handle 'area' target for overwatch - removed with simplified attack
        if (attackData.target === 'area') {
            // Set overwatch without specific target
            this.dispatch(ControlsEvent.showOverwatch, character.name);
            await new Promise<void>(resolve => {
                setTimeout(() => {
                    const frontPosition = AISpatialUtils.getPositionInFront(character);
                    this.dispatch(ControlsEvent.cellClick, frontPosition);
                    // Don't end turn if processing multiple characters
                    if (!this.isProcessingMultipleCharacters()) {
                        this.endTurnCallback();
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
            if (!this.isProcessingMultipleCharacters()) {
                this.endTurnCallback();
            }
            return;
        }


        // Dispatch attack event - simplified without attack types
        const distance = AISpatialUtils.getDistance(character.position, targetChar.position);
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
            const hasLineOfSight = AISpatialUtils.checkLineOfSight(character.position, targetChar.position, this.state!.map, this.state!.characters);

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
            const direction = AISpatialUtils.angleToDirection(angle);

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

    public async executeSpeech(command: AICommand, character: DeepReadonly<ICharacter>): Promise<void> {
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
                const distance = AISpatialUtils.getDistance(speaker.position, targetChar.position);
                const hasLineOfSight = AISpatialUtils.checkLineOfSight(speaker.position, targetChar.position, this.state!.map, this.state!.characters, true);

                if (distance <= 8 && hasLineOfSight) {
                    // Check if human player is nearby to observe
                    const humanCharacters = this.state.characters.filter((c: DeepReadonly<ICharacter>) =>
                        c.controller === 'human' && c.health > 0
                    );

                    let isEavesdropping = false;
                    for (const human of humanCharacters) {
                        const distToConversation = Math.min(
                            AISpatialUtils.getDistance(human.position, speaker.position),
                            AISpatialUtils.getDistance(human.position, targetChar.position)
                        );
                        if (distToConversation <= 15) {
                            isEavesdropping = true;
                            break;
                        }
                    }

                    // Start AI-to-AI conversation

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
                        this.setIsForcedTurnEnd(true);
                        this.setIsProcessingTurn(true);
                        this.setIsProcessingMultipleCharacters(false);
                        this.endTurnCallback(true);
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
                const distance = AISpatialUtils.getDistance(speaker.position, humanChar.position);
                const viewDistance = 15; // Standard view distance
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = AISpatialUtils.checkLineOfSight(speaker.position, humanChar.position, this.state!.map, this.state!.characters, true);

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
                    const distToNearest = AISpatialUtils.getDistance(speaker.position, nearest.position);
                    const distToHuman = AISpatialUtils.getDistance(speaker.position, human.position);
                    return distToHuman < distToNearest ? human : nearest;
                });

                // const distance = AISpatialUtils.getDistance(speaker.position, nearestHuman.position);
                // For conversations, ignore characters blocking - only walls should block speech
                const hasLineOfSight = AISpatialUtils.checkLineOfSight(speaker.position, nearestHuman.position, this.state!.map, this.state!.characters, true);
                // const reason = !hasLineOfSight ? 'no line of sight (wall blocking)' :
                //     distance > 15 ? 'out of view range' :
                //         'too far to speak';

                // If blocked by walls, find a position with line of sight
                let targetLocation = nearestHuman.name;
                if (!hasLineOfSight) {
                    const goodPositions = AISpatialUtils.findPositionsWithLineOfSight(
                        speaker.position,
                        nearestHuman.position,
                        this.state!.map,
                        this.state!.characters,
                        8  // conversation range
                    );

                    if (goodPositions.length > 0) {
                        // Use the closest position with line of sight as the target
                        const bestPos = goodPositions[0];
                        if (bestPos) {
                            targetLocation = `${bestPos.x},${bestPos.y}`;
                        }
                    } else {
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
                this.setIsForcedTurnEnd(true);

                // Set the processing flags to prevent further AI processing
                this.setIsProcessingTurn(true); // Keep this true to prevent re-processing
                this.setIsProcessingMultipleCharacters(false);

                this.endTurnCallback(true); // Force end to stop other AI characters
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

        // Record the attempt
        this.contextBuilder.recordEvent({
            type: 'dialogue',
            actor: source,
            description: `${source} (too far): ${speechCmd.content}`,
            turn: this.state.game.turn
        });

        // End turn
        this.endTurnCallback();
    }


    public async spawnCharacters(command: AICommand): Promise<void> {
        if (!this.state || !this.contextBuilder) return;

        // Spawn new characters during gameplay
        const charCmd = command as CharacterCommand;
        const chars = charCmd.characters;
        if (!chars) return;
        for (const charData of chars) {
            const spawnLocation = AILocationResolver.resolveLocation(charData.location, this.state!);

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

    public async executeNarrativeMapGeneration(): Promise<void> {

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

                // Execute the map command
                const validatedCommand = this.commandParser.validate(mapResponse);
                if (validatedCommand && validatedCommand.type === 'map') {
                    const storyStateForMap = storyState ? JSON.parse(JSON.stringify(storyState)) as IStoryState : undefined;
                    const mapCommand = validatedCommand as MapCommand;
                    await this.storyExecutor.executeMapCommand(mapCommand, storyStateForMap, mapCommand.seed);
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

    public async handlePositioningError(error: CharacterPositioningError, originalCommand: AICommand): Promise<void> {
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
                        location: AILocationResolver.getCurrentRoomName(contextCharacter, this.state!.map)
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
                        await this.executeCommand(validatedCommand, dummyCharacter);
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
}
