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

export class Api {
    private dirname = dirname(fileURLToPath(import.meta.url));
    private publicDir = resolve(this.dirname, '../../public');
    private server: Server;

    constructor(
        private app: Express,
        private port = 3000,
    ) {
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
                            console.error('Error: Path not found', indexPath, join(dirPath, 'index.js'))
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
            const body: IMessage[] = req.body;

            const messages: IMessage[] = body.length ? body : [{
                role: 'user',
                content: initialSetup,
            }];

            try {
                await new Promise(r => setTimeout(r, 1000))
                const response = await sendMessage(messages);
                // const response = JSON.stringify({
                //     "type": "speech",
                //     "source": "Data",
                //     "content": "Capitán, mis sensores detectan múltiples señales de comunicación interceptadas desde que abandonamos la base. Creo que nos están rastreando activamente. Debemos tomar medidas evasivas inmediatas.",
                //     "answers": ["¿Qué tipo de señales?", "¿Cuánto tiempo tenemos?", "Prepara un salto de emergencia", "Déjalo por ahora"]
                // });

                const message: IMessage = {
                    role: 'assistant',
                    content: response,
                }

                messages.push(message);
                res.send(messages);
            } catch (error) {
                console.error('Api - /gameEngine - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
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
                console.error('Api - /storyPlan - error:', error);
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
                console.error('Api - /sceneContext - error:', error);
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
                console.error('Api - /modelStatus - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }
}
