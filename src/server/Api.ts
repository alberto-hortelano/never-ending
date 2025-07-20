import type { Express } from 'express';

import express from 'express';
import { dirname, resolve, extname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { IMessage } from '../common/interfaces';
import { initialSetup } from '../prompts/shortPrompts';
import { Server } from 'http';
import { WebSocketServer } from './WebSocketServer';

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
                // const response = await sendMessage(messages);
                const response = JSON.stringify({
                    "type": "speech",
                    "source": "Data",
                    "content": "Capitán, mis sensores detectan múltiples señales de comunicación interceptadas desde que abandonamos la base. Creo que nos están rastreando activamente. Debemos tomar medidas evasivas inmediatas.",
                    "answers": ["¿Qué tipo de señales?", "¿Cuánto tiempo tenemos?", "Prepara un salto de emergencia", "Déjalo por ahora"]
                });

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
}
