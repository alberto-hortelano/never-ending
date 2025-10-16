import type { Express } from 'express';
import type { Server } from 'http';
import type { IMessage, IOriginStory, IStoryState, ICharacter } from '../common/interfaces';

import express from 'express';
import { dirname, resolve, extname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { initialSetup } from '../prompts/shortPrompts';
import { WebSocketServer } from './WebSocketServer';
import { sendMessage, getModelStatus } from '../models/claude';
import { FileLogger } from '../models/fileLogger';
import { PromptTemplate } from '../prompts/PromptTemplate';
import { LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS, getMainCharacterName } from '../common/constants';

export class Api {
    private dirname = dirname(fileURLToPath(import.meta.url));
    private publicDir = resolve(this.dirname, '../../public');
    private server: Server;

    constructor(
        private app: Express,
        private port = 3000,
    ) {
        // Initialize the logger (clears log file for new session)
        FileLogger.initialize();

        this.start();
        this.server = this.listen();
        new WebSocketServer(this.server);
    }

    private listen() {
        const server = this.app.listen(this.port, () => {
            console.log(`Static server running at http://localhost:${this.port}`);
            console.log(`WebSocket server running on ws://localhost:${this.port}`);
        });
        return server;
    }

    private start() {
        this.jsFiles();
        this.staticFiles();
        this.gameEngine();
        this.storyPlan();
        this.sceneContext();
        this.modelStatus();
    }

    private jsFiles() {
        this.app.use((req, res, next) => {
            if (req.url.startsWith('/js')) {
                if (!extname(req.url)) {
                    if (existsSync(join(this.publicDir, req.url + '.js'))) {
                        req.url += '.js';
                    } else {
                        const dirPath = req.url.endsWith('/') ? req.url : req.url + '/';
                        const indexPath = join(this.publicDir, dirPath, 'index.js');

                        if (existsSync(indexPath)) {
                            req.url = dirPath + 'index.js';
                            return res.redirect(302, join(dirPath, 'index.js'));
                        } else {
                            FileLogger.error('Error: Path not found', indexPath, join(dirPath, 'index.js'))
                        }
                    }
                }
            }

            next();
        });
    }

    private staticFiles() {
        this.app.use(express.static(this.publicDir, {
            dotfiles: 'ignore'
        }));
    }

    private gameEngine() {
        this.app.post('/gameEngine', async (req, res) => {
            try {
                // Check if this is a legacy request with messages array
                if (Array.isArray(req.body)) {
                    // Handle legacy format for backward compatibility
                    const body: IMessage[] = req.body;
                    const messages: IMessage[] = body.length ? body : [{
                        role: 'user',
                        content: initialSetup,
                    }];

                    await new Promise(r => setTimeout(r, 1000));
                    const response = await sendMessage(messages);
                    const message: IMessage = {
                        role: 'assistant',
                        content: response,
                    };
                    messages.push(message);
                    res.send(messages);
                    return;
                }

                // New format: receive context and build prompts server-side
                const { context, language = 'es', storyState, systemPrompt } = req.body;

                // Build messages array server-side
                const messages: IMessage[] = [];

                // If this is initial setup (no context provided)
                if (!context) {
                    messages.push({
                        role: 'user',
                        content: initialSetup,
                    });
                } else {
                    // Build the narrative architect prompt with proper substitution
                    const promptTemplate = new PromptTemplate();
                    const originId = storyState?.selectedOrigin?.id;
                    const companionName = storyState?.selectedOrigin?.startingCompanion?.name;

                    const narrativePrompt = await promptTemplate.load('narrativeArchitect', {
                        language: LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES],
                        languageInstruction: LANGUAGE_INSTRUCTIONS[language as keyof typeof LANGUAGE_INSTRUCTIONS],
                        mainCharacter: getMainCharacterName(originId),
                        companionName: companionName || 'Companion'
                    });

                    // Add system prompt
                    messages.push({
                        role: 'user',
                        content: systemPrompt || narrativePrompt
                    });

                    // Add the context as a formatted prompt
                    const contextPrompt = this.buildContextPrompt(context, storyState);
                    messages.push({
                        role: 'user',
                        content: contextPrompt
                    });
                }

                // Add artificial delay for testing
                await new Promise(r => setTimeout(r, 1000));

                // Call the AI service
                const response = await sendMessage(messages);

                const message: IMessage = {
                    role: 'assistant',
                    content: response,
                };

                messages.push(message);
                res.send(messages);
            } catch (error) {
                FileLogger.error('Api - /gameEngine - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    private buildContextPrompt(context: Record<string, unknown>, _storyState?: IStoryState): string {
        const current = context.currentCharacter as Record<string, unknown> | undefined;
        const visibleChars = (context.visibleCharacters as unknown[]) || [];
        const conversableChars = (context.charactersInConversationRange as unknown[]) || [];

        // Build character descriptions with clear status
        const characterDescriptions = visibleChars.map((char: unknown) => {
            const charObj = char as Record<string, unknown>;
            const status = [];
            if (charObj.isPlayer) {
                status.push('PLAYER');
            } else {
                status.push('NPC');
            }
            if (charObj.isAlly) status.push('ALLY');
            if (charObj.isEnemy) status.push('ENEMY');
            if (charObj.canConverse) status.push('CAN TALK');
            if (charObj.isAdjacent) status.push('ADJACENT');

            const health = charObj.health as Record<string, unknown> | undefined;
            return `  - ${charObj.name}: ${Math.round(Number(charObj.distanceFromCurrent) || 0)} cells away [${status.join(', ')}] Health: ${health?.current}/${health?.max}`;
        }).join('\n');

        // Create natural language situation summary
        const position = current?.position as Record<string, unknown> | undefined;
        const health = current?.health as Record<string, unknown> | undefined;
        let situationSummary = `## CURRENT SITUATION

You are: ${current?.name || 'unknown'} (${current?.race || 'unknown'})
Your position: (${position?.x || 0}, ${position?.y || 0})
Your health: ${health?.current || 0}/${health?.max || 100}
Your faction: ${current?.faction || 'neutral'}
Your personality: ${current?.personality || 'standard'}

## VISIBLE CHARACTERS (${visibleChars.length} total)
${characterDescriptions || '  None visible'}

## CONVERSATION OPTIONS (within 8 cells)
${conversableChars.map((c: unknown) => `  - ${(c as Record<string, unknown>).name}`).join('\n') || '  None in range'}`;

        // Add conversation history if present
        const convHistory = context.conversationHistory as unknown[] | undefined;
        if (convHistory && convHistory.length > 0) {
            situationSummary += `\n\n## RECENT CONVERSATION\n${convHistory.map((exchange: unknown) => {
                const ex = exchange as Record<string, unknown>;
                return `  ${ex.speaker}: "${ex.content}"`;
            }).join('\n')}`;
        }

        // Add blockage information if present
        const blockageInfo = context.blockageInfo as Record<string, unknown> | undefined;
        if (blockageInfo) {
            const blockingChar = blockageInfo.blockingCharacter as Record<string, unknown>;
            situationSummary += `\n\n## PATH BLOCKED\n  Your path is blocked by ${blockingChar.name}\n  They are ${blockingChar.isAlly ? 'an ally' : 'not an ally'}\n  Original target: ${blockageInfo.originalTarget}`;
        }

        // Add mission information
        const currentMission = context.currentMission as Record<string, unknown> | undefined;
        if (currentMission) {
            const objectives = currentMission.objectives as string[] | undefined;
            situationSummary += `\n\n## CURRENT MISSION\n  Name: ${currentMission.name}\n  Type: ${currentMission.type}\n  Objectives: ${objectives?.join(', ') || 'None'}`;
        }

        // Add existing characters list
        const existingChars = context.existingCharacters as string[] | undefined;
        if (existingChars && existingChars.length > 0) {
            situationSummary += `\n\n## ALL EXISTING CHARACTERS\nThese are the ONLY characters that exist and can be referenced in commands:\n${existingChars.map((name: string) => `  - ${name}`).join('\n')}`;
        }

        // Add available locations list
        const availableLocs = context.availableLocations as string[] | undefined;
        if (availableLocs && availableLocs.length > 0) {
            situationSummary += `\n\n## AVAILABLE LOCATIONS\nThese are the ONLY rooms/locations that exist and can be used in movement commands:\n${availableLocs.map((loc: string) => `  - ${loc}`).join('\n')}`;
        }

        situationSummary += `\n\n## YOUR RESPONSE\nDecide what ${current?.name || 'the character'} should do next. You must respond with a valid JSON command.\nIMPORTANT: Only use character names and locations from the lists above.`;

        return situationSummary;
    }

    private storyPlan() {
        this.app.post('/storyPlan', async (req, res) => {
            try {
                const { origin, currentState, playerDecisions } = req.body as {
                    origin: IOriginStory;
                    currentState?: IStoryState;
                    playerDecisions?: string[];
                };

                if (!origin) {
                    res.status(400).json({ error: 'Origin story is required' });
                    return;
                }

                // Build story planning prompt
                const prompt = this.buildStoryPlanPrompt(origin, currentState, playerDecisions);

                const messages: IMessage[] = [{
                    role: 'user',
                    content: prompt
                }];

                // Add small delay to prevent rate limiting
                await new Promise(r => setTimeout(r, 1000));

                const response = await sendMessage(messages);

                res.json({
                    type: 'storyPlan',
                    content: response
                });
            } catch (error) {
                FileLogger.error('Api - /storyPlan - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    private sceneContext() {
        this.app.post('/sceneContext', async (req, res) => {
            try {
                const { missionId, visibleCharacters, storyState } = req.body as {
                    missionId: string;
                    visibleCharacters: ICharacter[];
                    storyState: IStoryState;
                };

                // Build scene context prompt
                const prompt = this.buildSceneContextPrompt(missionId, visibleCharacters, storyState);

                const messages: IMessage[] = [{
                    role: 'user',
                    content: prompt
                }];

                // Add small delay to prevent rate limiting
                await new Promise(r => setTimeout(r, 1000));

                const response = await sendMessage(messages);

                res.json({
                    type: 'sceneContext',
                    content: response
                });
            } catch (error) {
                FileLogger.error('Api - /sceneContext - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    private buildStoryPlanPrompt(
        origin: IOriginStory,
        currentState?: IStoryState,
        playerDecisions?: string[]
    ): string {
        let prompt = `# STORY PLAN GENERATION REQUEST

Generate a comprehensive story plan for "Never Ending" based on the following:

## Selected Origin: ${origin.nameES}
- Description: ${origin.descriptionES}
- Starting Location: ${origin.startingLocation}
- Special Traits: ${origin.specialTraits.join(', ')}
- Faction Relations: ${Object.entries(origin.factionRelations).map(([f, v]) => `${f}: ${v}`).join(', ')}`;

        if (currentState) {
            prompt += `

## Current Progress:
- Chapter: ${currentState.currentChapter}
- Completed Missions: ${currentState.completedMissions.join(', ')}
- Story Flags: ${Array.from(currentState.storyFlags).join(', ')}`;
        }

        if (playerDecisions && playerDecisions.length > 0) {
            prompt += `

## Player Decisions:
${playerDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
        }

        prompt += `

## Requirements:
Create a multi-act story with:

1. **Overall Narrative** (200 words)
   - Main story arc connecting all acts
   - Central conflict and resolution path
   - Thematic elements

2. **Three Acts** each containing:
   - Act title and description (Spanish and English)
   - 3-5 missions per act
   - Key characters and their roles
   - Important objects and their purposes
   - Climax description

3. **Each Mission** should include:
   - Mission name and type (combat/exploration/infiltration/diplomacy/survival)
   - Clear objectives (primary and secondary)
   - Required objects or items
   - NPCs with defined roles
   - Map context (environment, atmosphere)
   - Narrative hooks for player engagement

Return a JSON object with the complete story structure.
Remember: All player-facing text should be primarily in Spanish.`;

        return prompt;
    }

    private buildSceneContextPrompt(
        missionId: string,
        visibleCharacters: ICharacter[],
        storyState: IStoryState
    ): string {
        return `# SCENE CONTEXT REQUEST

Generate contextual information for the current scene:

## Current Mission: ${missionId}
## Visible Characters: ${visibleCharacters.map(c => c.name).join(', ')}
## Story Progress:
- Chapter: ${storyState.currentChapter}
- Completed Objectives: ${storyState.completedObjectives?.join(', ') || 'None'}

## Requirements:
Provide:
1. Current objectives with descriptions
2. Character purposes and dialogue topics
3. Important objects in the scene
4. Narrative hooks to guide player action
5. Suggested next actions

Return as JSON with scene context details.
Remember: All text in Spanish.`;
    }

    private modelStatus() {
        this.app.get('/modelStatus', (_req, res) => {
            try {
                const status = getModelStatus();
                res.json(status);
            } catch (error) {
                FileLogger.error('Api - /modelStatus - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }
}
