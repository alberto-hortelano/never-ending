import type { IMessage } from '../common/interfaces';

import Anthropic from '@anthropic-ai/sdk';
import { getPrompt } from '../prompts';
import { initialSetup } from '../prompts/shortPrompts';

const anthropic = new Anthropic();

export interface AgentOptions {
    systemPrompt: string;
}

export type SendMessage = (messages: IMessage[]) => Promise<string>;

const cache = new Map<string, string>();
cache.set(initialSetup, JSON.stringify({
    "type": "speech",
    "source": "Data",
    "content": "Bienvenido a bordo, Jim. Me alegro de que hayamos logrado escapar. ¿Tienes alguna idea de hacia dónde deberíamos dirigirnos ahora? Nuestras opciones son limitadas, pero podríamos intentar llegar a un planeta en el borde exterior donde sea menos probable que nos encuentren.",
    "answers": [
        "Vayamos al planeta más cercano para reabastecernos.",
        "Busquemos un lugar para escondernos por un tiempo.",
        "Contactemos con la Coalición Rebelde en busca de ayuda.",
        "¿Qué sugieres tú, Data?"
    ],
    //     "type": "speech",
    //     "source": "Data",
    //     "content": "Welcome aboard, Jim. I'm Data, the service droid assigned to this vessel. We've successfully escaped from your former unit, but our situation remains precarious. What's our next move? Should we seek a safe haven, look for allies, or attempt to gather resources?",
    //     "answers": [
    //         "Let's head to the nearest populated planet.",
    //         "We need allies. Any rebel groups or independent colonies nearby?",
    //         "Resources are crucial. Where can we get supplies and fuel?"
    //     ]
}));

export const sendMessage: SendMessage = async (messages: IMessage[]) => {
    const lastMssg = messages.at(-1);
    if (lastMssg?.content && cache.has(lastMssg.content)) {
        return cache.get(lastMssg.content) || `Error: Missing content in cache for ${lastMssg.content}`;
    }
    if (lastMssg?.role === 'assistant') {
        throw new Error("Las message is from assistant, this won't return anything");
    }

    const narrativeArchitect = await getPrompt('narrativeArchitect');

    const msg: Anthropic.Messages.Message = await anthropic.messages.create({
        model: "claude-sonnet-4-0",
        max_tokens: 8192,
        system: narrativeArchitect,
        messages: messages,
    });

    const response = msg.content[0];
    if (!response || response.type !== 'text') {
        return 'Error: Wrong response type';
    }

    // Extract JSON from markdown code blocks if present
    const text = response.text;
    console.log(text)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }

    // Return as-is if no code block found
    return text;
}
