import { promises } from 'fs';
import { resolve, dirname } from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

export const getPrompt = async (name: string) => {
    const _dirname = dirname(fileURLToPath(import.meta.url));
    await new Promise((resolve, reject) => exec('ls', (err, stdout) => {
        if (err) {
            reject(err);
        } else {
            resolve(stdout);
        }
    }));
    return await promises.readFile(resolve(_dirname, `./${name}.md`), 'utf8');
};
