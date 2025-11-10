import { State } from '../State';
import { AIContextBuilder, type AIGameContext } from './AIContextBuilder';
import { AICommandParser, AICommand, MovementCommand, AttackCommand, SpeechCommand } from './AICommandParser';
import { AIGameEngineService } from './AIGameEngineService';
import { AIErrorHandler } from './AIErrorHandler';
import { AICommandExecutor } from './AICommandExecutor';
import { TacticalExecutor } from './TacticalExecutor';
import { StoryPlanner } from './StoryPlanner';
import { AISpatialUtils } from './AISpatialUtils';
import { AILocationResolver } from './AILocationResolver';
import { GameEvent } from '../events';
import { ICharacter, IStoryState, IScreenContext } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import type { LanguageCode } from '../constants';

interface ExtendedGame {
    turn: string;
    players: readonly string[];
    playerInfo?: Record<string, { name: string; isAI?: boolean }>;
}

export class AITurnManager {
    constructor(
        private getState: () => State | undefined,
        private commandExecutor: AICommandExecutor,
        private tacticalExecutor: TacticalExecutor,
        private contextBuilder: () => AIContextBuilder | undefined,
        private gameEngineService: AIGameEngineService,
        private errorHandler: () => AIErrorHandler | undefined,
        private storyPlanner: StoryPlanner,
        private commandParser: AICommandParser,
        private dispatch: (event: string, data: unknown) => void,
        private isAIEnabled: () => boolean,
        private useTacticalSystemGetter: () => boolean,
        private getOngoingMovement: () => { characterName: string; targetLocation: { x: number; y: number }; targetName?: string; targetLocationString: string } | undefined,
        private setOngoingMovement: (value: { characterName: string; targetLocation: { x: number; y: number }; targetName?: string; targetLocationString: string } | undefined) => void,
        private pendingSpeechCommands: Map<string, AICommand>,
        private speechMovementAttempts: Map<string, number>,
        private isProcessingMultipleCharactersGetter: () => boolean,
        private setIsProcessingMultipleCharacters: (value: boolean) => void,
        private isForcedTurnEndGetter: () => boolean,
        private setIsForcedTurnEnd: (value: boolean) => void,
        private isProcessingTurnGetter: () => boolean,
        private setIsProcessingTurn: (value: boolean) => void,
        private clearMovementTimeouts: () => void,
        private triggerWorldStateUpdate: (trigger: string, participants?: string[], outcome?: string, location?: string) => void,
        private isCharacterInCombatGetter: (character: DeepReadonly<ICharacter>) => boolean
    ) {}

    public isAIPlayer(playerId: string): boolean {
        const state = this.getState();
        if (!state) {
            console.error('[AI] isAIPlayer - No state available');
            return false;
        }
        // Check if this player is marked as AI in the game state
        const game = state.game as ExtendedGame;
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

    public async processTurn(playerId: string): Promise<void> {
        console.log(`[AI] processAIPlayerTurn called for player: ${playerId}`);

        const state = this.getState();
        if (!state) {
            console.error('[AI] processAIPlayerTurn - No state available');
            return;
        }

        // Log all characters and their player assignments for debugging
        console.log('[AI] Current characters in game:');
        state.characters.forEach((c: DeepReadonly<ICharacter>) => {
            console.log(`  - ${c.name}: controller=${c.controller}, faction=${c.faction}, health=${c.health}`);
        });

        // When it's an AI player's turn, find their characters and take actions
        const aiCharacters = state.characters.filter((c: DeepReadonly<ICharacter>) => c.controller === playerId);
        console.log(`[AI] Found ${aiCharacters.length} AI characters for player ${playerId}`);

        if (aiCharacters.length === 0) {
            console.warn(`[AI] No characters found for AI player ${playerId}`);
            console.warn('[AI] Make sure enemy faction characters are assigned to the AI player');
            return;
        }

        // Clear the forced turn end flag at the start of a new AI turn
        this.setIsForcedTurnEnd(false);

        // Clear speech movement attempts for new turn
        this.speechMovementAttempts.clear();

        // Set flag to prevent individual actions from ending the turn
        this.setIsProcessingMultipleCharacters(true);

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
            const currentState = this.getState();
            if (currentState && currentState.game.turn !== playerId) {
                break;
            }

            try {
                await this.processCharacterTurn(character);
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
        this.setIsProcessingMultipleCharacters(false);

        // Only end turn if it's still the AI's turn (conversation might have ended it already)
        const finalState = this.getState();
        if (finalState && finalState.game.turn === playerId) {
            this.endTurn();
        }
    }

    public async processCharacterTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        console.log(`[AI] processAICharacterTurn called for character: ${character.name}`);

        if (this.isProcessingTurnGetter()) {
            console.warn('[AI] Already processing turn, skipping');
            return;
        }
        if (!this.isAIEnabled()) {
            console.warn('[AI] AI is disabled');
            return;
        }
        const state = this.getState();
        if (!state) {
            console.error('[AI] No state available');
            return;
        }
        const contextBuilder = this.contextBuilder();
        if (!contextBuilder) {
            console.error('[AI] No contextBuilder available');
            return;
        }

        console.log('[AI] Starting to process character turn');
        this.setIsProcessingTurn(true);

        try {
            // Keep taking actions until we run out of action points
            let actionsPerformed = 0;
            const maxActions = 5; // Safety limit to prevent infinite loops

            while (actionsPerformed < maxActions) {
                // Wait a moment to ensure state is updated
                await new Promise(resolve => setTimeout(resolve, 100));

                // Get current character state (it may have changed after actions)
                const currentState = this.getState();
                if (!currentState) break;

                const currentChar = currentState.characters.find(c => c.name === character.name);
                if (!currentChar) {
                    break;
                }

                // Check if character is defeated
                if (currentChar.health <= 0) {
                    break;
                }

                // Check if turn changed (e.g., due to conversation)
                if (currentState.game.turn !== currentChar.controller) {
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
                    const ongoingMovement = this.getOngoingMovement();
                    if (ongoingMovement?.characterName === currentChar.name) {
                        this.setOngoingMovement(undefined);
                    }
                    break;
                }

                // Clear ongoing movement - each action should be a fresh AI decision
                // This prevents characters from moving multiple times per turn
                const ongoingMovement = this.getOngoingMovement();
                if (ongoingMovement?.characterName === currentChar.name) {
                    this.setOngoingMovement(undefined);
                }

                // Check if there's a pending speech command from previous movement
                const pendingSpeech = this.pendingSpeechCommands.get(currentChar.name);
                if (pendingSpeech) {
                    // Check if we're now close enough to execute the pending speech
                    const speaker = currentChar;
                    const humanCharacters = currentState.characters.filter(c => c.controller === 'human' && c.health > 0);

                    // Check if speaker can talk to any human character
                    let canTalkToAnyHuman = false;
                    for (const humanChar of humanCharacters) {
                        const distance = AISpatialUtils.getDistance(speaker.position, humanChar.position);
                        const viewDistance = 15; // Standard view distance
                        // For conversations, ignore characters blocking - only walls should block speech
                        const hasLineOfSight = AISpatialUtils.checkLineOfSight(speaker.position, humanChar.position, currentState.map, currentState.characters, true);

                        if (distance <= 8 && distance <= viewDistance && hasLineOfSight) {
                            canTalkToAnyHuman = true;
                            break;
                        }
                    }

                    if (canTalkToAnyHuman) {
                        // Close enough and visible to at least one human - execute the pending speech
                        this.pendingSpeechCommands.delete(currentChar.name);
                        this.speechMovementAttempts.delete(currentChar.name);  // Clear attempts on success
                        await this.commandExecutor.executeSpeech(pendingSpeech, currentChar);
                        actionsPerformed++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                }

                // Check if there are any living enemies to interact with
                // Enemy is determined by different faction, not different player
                const hasLivingEnemies = currentState.characters.some(c =>
                    c.health > 0 &&
                    c.faction !== currentChar.faction &&
                    c.name !== currentChar.name
                );

                // Always try narrative AI first if there are enemies
                // This allows the AI to decide whether to attack, talk, move, etc.
                if (hasLivingEnemies) {
                    // On first action, always use narrative AI to get strategic decision
                    // On subsequent actions, can use tactical if enabled
                    if (actionsPerformed === 0 || !this.useTacticalSystemGetter()) {
                        // Call AI endpoint for decision
                        await this.processNarrativeTurn(currentChar);
                    } else if (this.useTacticalSystemGetter() && this.isCharacterInCombatGetter(currentChar)) {
                        // Use tactical executor for follow-up combat decisions
                        await this.processTacticalTurn(currentChar);
                    } else {
                        // Default to narrative AI
                        await this.processNarrativeTurn(currentChar);
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
            const finalState = this.getState();
            const finalPendingSpeech = this.pendingSpeechCommands.get(character.name);
            if (finalPendingSpeech && finalState) {
                const currentChar = finalState.characters.find(c => c.name === character.name);
                if (currentChar && currentChar.health > 0) {
                    const speaker = currentChar;
                    const humanCharacters = finalState.characters.filter(c => c.controller === 'human' && c.health > 0);

                    // Check if speaker can talk to any human character
                    let canTalkToAnyHuman = false;
                    let closestDistance = Infinity;

                    for (const humanChar of humanCharacters) {
                        const distance = AISpatialUtils.getDistance(speaker.position, humanChar.position);
                        const viewDistance = 15; // Standard view distance
                        const hasLineOfSight = AISpatialUtils.checkLineOfSight(speaker.position, humanChar.position, finalState.map, finalState.characters, true);

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
                        await this.commandExecutor.executeSpeech(finalPendingSpeech, currentChar);
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
            console.log('[AI] Finally block - isForcedTurnEnd:', this.isForcedTurnEndGetter());
            if (!this.isForcedTurnEndGetter()) {
                console.log('[AI] Clearing isProcessingTurn flag');
                this.setIsProcessingTurn(false);
            } else {
                console.log('[AI] NOT clearing isProcessingTurn due to forced end');
            }
        }
    }

    private async processTacticalTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        // Trigger world state update for turn
        this.triggerWorldStateUpdate('turn', [character.name], undefined, undefined);
        const state = this.getState();
        const contextBuilder = this.contextBuilder();
        if (!state || !contextBuilder) return;

        // Build context
        const context = contextBuilder.buildTurnContext(character, state);


        // Get visible characters (excluding dead ones)
        const visibleCharacters = context.visibleCharacters
            .map(vc => state.characters.find(c => c.name === vc.name))
            .filter(c => c !== undefined && c.health > 0) as DeepReadonly<ICharacter>[];

        // Use tactical executor to decide action
        const tacticalAction = this.tacticalExecutor.evaluateSituation(
            character,
            state,
            visibleCharacters
        );

        // Execute the tactical action
        const validatedCommand = this.commandParser.validate(tacticalAction.command);
        if (validatedCommand) {
            // DEBUG: console.log(`[AI-Tactical] ${character.name}: ${tacticalAction.type} - ${tacticalAction.reasoning}`);
            await this.commandExecutor.executeCommand(validatedCommand, character);
        } else {
            console.error(`[AI-Tactical] ${character.name}: Invalid command from tactical executor`);
            // End turn if no valid command
            if (!this.isProcessingMultipleCharactersGetter()) {
                this.endTurn();
            }
        }
    }

    private async processNarrativeTurn(character: DeepReadonly<ICharacter>): Promise<void> {
        const state = this.getState();
        const contextBuilder = this.contextBuilder();
        if (!state || !contextBuilder) return;

        // Build context for AI
        const context = contextBuilder.buildTurnContext(character, state);

        // Get story context for enhanced AI decision making
        const storyState = state.story;
        let screenContext: IScreenContext | null = null;
        let storyStateForPlanner: IStoryState | undefined;

        // Get language early for use in multiple places
        const language = state?.language || 'es';

        if (storyState) {
            const currentMission = storyState.storyPlan?.acts[storyState.storyPlan.currentAct]?.missions
                .find(m => m.id === storyState.currentMissionId) || null;

            const visibleCharacters = Array.from(state.characters.values())
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
                location: AILocationResolver.getCurrentRoomName(character, state.map)
            }
        };

        // Get AI decision from game engine with story context
        const response = await this.gameEngineService.requestAIAction(contextWithLocation, undefined, storyStateForPlanner, language as LanguageCode);

        // Tactical directive removed - using story-driven decisions instead

        // Parse and execute AI commands with new validation system
        const errorHandler = this.errorHandler();
        if (response.command && errorHandler && state) {
            const retryResult = await errorHandler.executeWithRetry(
                response.command,
                contextWithLocation,
                state,
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
                await this.commandExecutor.executeCommand(validatedCommand, character);
            } else if (retryResult.finalErrors) {
                // All retries failed - log the errors
                console.error('[AI] Command validation failed after retries:',
                    errorHandler.formatErrorFeedback(retryResult.finalErrors));
            }
        } else if (response.command) {
            // Fallback to old validation if new system not initialized
            const validatedCommand = this.commandParser.validate(response.command);
            if (validatedCommand) {
                await this.commandExecutor.executeCommand(validatedCommand, character);
            } else {
                console.error('[AI] Invalid command:', response.command);
            }
        }
    }

    public endTurn(forceEnd: boolean = false): void {
        // Don't end turn if we're processing multiple characters (unless forced)
        if (!forceEnd && this.isProcessingMultipleCharactersGetter()) {
            return;
        }

        const state = this.getState();
        if (!state) {
            return;
        }

        // Clear any ongoing movement
        this.setOngoingMovement(undefined);

        // If forcing end, clear the processing flag and timeouts
        if (forceEnd) {
            this.setIsProcessingMultipleCharacters(false);
            this.clearMovementTimeouts();
        }

        // Signal end of turn by changing to next turn
        const currentTurn = state.game.turn;
        const players = state.game.players;
        const currentIndex = players.indexOf(currentTurn);
        const nextIndex = (currentIndex + 1) % players.length;
        const nextTurn = players[nextIndex] || currentTurn;
        this.dispatch(GameEvent.changeTurn, {
            turn: nextTurn,
            previousTurn: currentTurn
        });
    }
}
