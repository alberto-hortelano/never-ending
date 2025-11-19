/**
 * Updated Server API that uses the plugin system
 * This can replace the original Api.ts once testing is complete
 */

import type { Express } from 'express';
import type { Server } from 'http';
import type { IMessage, IOriginStory, IStoryState, ICharacter } from '../common/interfaces';

import express from 'express';
import { dirname, resolve, extname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { initialSetup } from '../prompts/shortPrompts';
import { WebSocketServer } from './WebSocketServer';
import { FileLogger } from '../models/fileLogger';
import { PromptTemplate } from '../prompts/PromptTemplate';
import { LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS, getMainCharacterName } from '../common/constants';

// Import plugin system
import { AIProviderManager } from '../common/ai-plugins/AIProviderManager';
import { IAIRequestOptions } from '../common/ai-plugins/types';

// Import legacy for fallback
import { sendMessage, getModelStatus } from '../models/claude';

export class Api {
    private dirname = dirname(fileURLToPath(import.meta.url));
    private publicDir = resolve(this.dirname, '../../public');
    private server: Server;
    private providerManager: AIProviderManager;
    private usePluginSystem: boolean = true; // Feature flag

    constructor(
        private app: Express,
        private port = 3000,
    ) {
        // Initialize the logger (clears log file for new session)
        FileLogger.initialize();

        // Initialize provider manager
        this.providerManager = AIProviderManager.getInstance();
        this.initializeProviders();

        this.start();
        this.server = this.listen();
        new WebSocketServer(this.server);
    }

    /**
     * Initialize AI providers
     */
    private async initializeProviders(): Promise<void> {
        try {
            // Import providers to register them
            await import('../common/ai-plugins/providers/MockProvider');
            await import('../common/ai-plugins/providers/ClaudeProvider');
            await import('../common/ai-plugins/providers/OpenAIProvider');

            console.log('[Api] AI providers initialized');

            // Check for provider preference from environment
            const preferredProvider = process.env.AI_PROVIDER || 'claude';
            try {
                await this.providerManager.switchProvider(preferredProvider);
                console.log(`[Api] Using ${preferredProvider} provider`);
            } catch (error) {
                console.warn(`[Api] Failed to switch to ${preferredProvider}, using default`, error);
            }
        } catch (error) {
            console.error('[Api] Failed to initialize providers:', error);
            this.usePluginSystem = false; // Fall back to legacy system
        }
    }

    private listen() {
        const server = this.app.listen(this.port, () => {
            console.log(`Static server running at http://localhost:${this.port}`);
            console.log(`WebSocket server running on ws://localhost:${this.port}`);
            console.log(`AI Plugin System: ${this.usePluginSystem ? 'ENABLED' : 'DISABLED (using legacy)'}`);
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
        this.providerStatus(); // New endpoint for plugin status
        this.switchProvider(); // New endpoint for switching providers
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
                // Check if using plugin system
                if (!this.usePluginSystem) {
                    return this.legacyGameEngine(req, res);
                }

                // Check if this is a legacy request with messages array
                if (Array.isArray(req.body)) {
                    // Handle legacy format for backward compatibility
                    const body: IMessage[] = req.body;
                    const messages: IMessage[] = body.length ? body : [{
                        role: 'user',
                        content: initialSetup,
                    }];

                    await new Promise(r => setTimeout(r, 1000));

                    // Use plugin system
                    const provider = await this.providerManager.getActiveProvider();
                    const response = await provider.sendMessage(messages);

                    const message: IMessage = {
                        role: 'assistant',
                        content: response.content,
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
                    // Add the context as a formatted prompt
                    const contextPrompt = this.buildContextPrompt(context, storyState);
                    messages.push({
                        role: 'user',
                        content: contextPrompt
                    });
                }

                // Add artificial delay for testing
                await new Promise(r => setTimeout(r, 1000));

                // Use plugin system
                const provider = await this.providerManager.getActiveProvider();
                const options: IAIRequestOptions = {
                    systemPrompt: systemPrompt || undefined,
                    cache: true
                };

                // Build the narrative architect prompt if needed and no system prompt provided
                if (!systemPrompt) {
                    const promptTemplate = new PromptTemplate();
                    const originId = storyState?.selectedOrigin?.id;
                    const companionName = storyState?.selectedOrigin?.startingCompanion?.name;

                    const narrativePrompt = await promptTemplate.load('narrativeArchitect', {
                        language: LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES],
                        languageInstruction: LANGUAGE_INSTRUCTIONS[language as keyof typeof LANGUAGE_INSTRUCTIONS],
                        mainCharacter: getMainCharacterName(originId),
                        companionName: companionName || 'Companion'
                    });

                    options.systemPrompt = narrativePrompt;
                }

                const response = await provider.sendMessage(messages, options);

                const message: IMessage = {
                    role: 'assistant',
                    content: response.content,
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

    /**
     * Legacy game engine handler (fallback)
     */
    private async legacyGameEngine(req: express.Request, res: express.Response) {
        try {
            if (Array.isArray(req.body)) {
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

            const { context, language = 'es', storyState, systemPrompt } = req.body;
            const messages: IMessage[] = [];

            if (!context) {
                messages.push({
                    role: 'user',
                    content: initialSetup,
                });
            } else {
                const promptTemplate = new PromptTemplate();
                const originId = storyState?.selectedOrigin?.id;
                const companionName = storyState?.selectedOrigin?.startingCompanion?.name;

                const narrativePrompt = await promptTemplate.load('narrativeArchitect', {
                    language: LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES],
                    languageInstruction: LANGUAGE_INSTRUCTIONS[language as keyof typeof LANGUAGE_INSTRUCTIONS],
                    mainCharacter: getMainCharacterName(originId),
                    companionName: companionName || 'Companion'
                });

                messages.push({
                    role: 'user',
                    content: systemPrompt || narrativePrompt
                });

                const contextPrompt = this.buildContextPrompt(context, storyState);
                messages.push({
                    role: 'user',
                    content: contextPrompt
                });
            }

            await new Promise(r => setTimeout(r, 1000));
            const response = await sendMessage(messages);

            const message: IMessage = {
                role: 'assistant',
                content: response,
            };

            messages.push(message);
            res.send(messages);
        } catch (error) {
            FileLogger.error('Api - /gameEngine (legacy) - error:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : String(error)
            });
        }
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

                // Use plugin system or fallback to legacy
                let response: string;
                if (this.usePluginSystem) {
                    const provider = await this.providerManager.getActiveProvider();
                    const aiResponse = await provider.sendMessage(messages);
                    response = aiResponse.content;
                } else {
                    response = await sendMessage(messages);
                }

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

                // Add small delay
                await new Promise(r => setTimeout(r, 500));

                // Use plugin system or fallback to legacy
                let response: string;
                if (this.usePluginSystem) {
                    const provider = await this.providerManager.getActiveProvider();
                    const aiResponse = await provider.sendMessage(messages);
                    response = aiResponse.content;
                } else {
                    response = await sendMessage(messages);
                }

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

    private modelStatus() {
        this.app.get('/modelStatus', (_req, res) => {
            try {
                if (this.usePluginSystem) {
                    // Get status from all providers
                    const statuses = this.providerManager.getAllStatuses();
                    res.json({
                        pluginSystem: true,
                        providers: statuses
                    });
                } else {
                    // Use legacy model status
                    const status = getModelStatus();
                    res.json({
                        pluginSystem: false,
                        legacy: status
                    });
                }
            } catch (error) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    /**
     * New endpoint for provider status
     */
    private providerStatus() {
        this.app.get('/providers', (_req, res) => {
            try {
                const statuses = this.providerManager.getAllStatuses();
                res.json(statuses);
            } catch (error) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    /**
     * New endpoint for switching providers
     */
    private switchProvider() {
        this.app.post('/switchProvider', async (req, res) => {
            try {
                const { providerId } = req.body;

                if (!providerId) {
                    res.status(400).json({ error: 'Provider ID is required' });
                    return;
                }

                await this.providerManager.switchProvider(providerId);

                res.json({
                    success: true,
                    message: `Switched to provider: ${providerId}`,
                    currentStatus: this.providerManager.getAllStatuses()
                });
            } catch (error) {
                FileLogger.error('Api - /switchProvider - error:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    private buildStoryPlanPrompt(origin: IOriginStory, currentState?: IStoryState, playerDecisions?: string[]): string {
        // Implementation from original Api.ts
        let prompt = `# Story Planning Request\n\n`;
        prompt += `## Origin Story\n`;
        prompt += `Name: ${origin.name}\n`;
        prompt += `Description: ${origin.description}\n\n`;

        if (currentState) {
            prompt += `## Current State\n`;
            prompt += `Chapter: ${currentState.currentChapter || 1}\n\n`;
        }

        if (playerDecisions && playerDecisions.length > 0) {
            prompt += `## Player Decisions\n`;
            playerDecisions.forEach((decision, index) => {
                prompt += `${index + 1}. ${decision}\n`;
            });
        }

        prompt += `\n## Request\n`;
        prompt += `Generate a story plan with acts, missions, and narrative beats based on the origin story and current state.`;

        return prompt;
    }

    private buildSceneContextPrompt(missionId: string, visibleCharacters: ICharacter[], storyState: IStoryState): string {
        // Implementation from original Api.ts
        let prompt = `# Scene Context Request\n\n`;
        prompt += `## Mission ID: ${missionId}\n\n`;

        prompt += `## Visible Characters\n`;
        visibleCharacters.forEach(char => {
            prompt += `- ${char.name} (${char.race})\n`;
        });

        if (storyState.storyPlan) {
            prompt += `\n## Story Progress\n`;
            prompt += `Chapter: ${storyState.currentChapter || 1}\n`;
        }

        prompt += `\n## Request\n`;
        prompt += `Provide scene context, environmental details, and potential narrative developments for this mission.`;

        return prompt;
    }
}