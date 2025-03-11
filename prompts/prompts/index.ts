import { promises } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';

export const getPrompt = async (name: string) => {
    await new Promise((resolve, reject) => exec('ls', (err, stdout) => {
        if (err) {
            reject(err);
        } else {
            resolve(stdout);
        }
    }));
    return await promises.readFile(resolve(__dirname, `./${name}.md`), 'utf8');
};
