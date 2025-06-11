import OpenAI from "openai";

import { getPrompt } from "../prompts";

export const openai = new OpenAI({
    organization: 'org-ux0tAIdPcIBuvja2fdgRbLQQ',
    project: 'proj_PEmD62c3Men0DMuBgmolVI9f',
});

const svgGenerator = getPrompt('svgGenerator');

export const generateImg = async (prompt: string) => {
    const img = await openai.images.generate({
        prompt,
        model: 'dall-e-3',
        response_format: 'b64_json', // or url
        n: 1,
        quality: 'standard',
        size: '1024x1024',
        style: 'natural',
    });
    return img.data
}
export const generateSvg = async (content: string) => {
    const systemPrompt = await svgGenerator;
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "developer", content: systemPrompt },
            { role: 'user', content }
        ],
        model: "gpt-4o",
        store: true,
        n: 1,
    });

    const svg = completion.choices[0]
    console.log(svg)

    return svg;
}

generateSvg(`A floor panel using dark blue (#0a0f2c) with metal borders or accents.`);
