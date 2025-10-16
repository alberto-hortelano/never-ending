import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Template engine for loading and processing prompt markdown files
 * Supports variable replacement with {{variable}} syntax
 */
export class PromptTemplate {
    private cache: Map<string, string> = new Map();
    private _dirname: string;

    constructor() {
        this._dirname = dirname(fileURLToPath(import.meta.url));
    }

    /**
     * Load a prompt template from markdown file and replace variables
     * @param name - Name of the markdown file (without .md extension)
     * @param variables - Object containing variable replacements
     * @returns Processed prompt string
     */
    public async load(name: string, variables: Record<string, string | number | undefined> = {}): Promise<string> {
        const cacheKey = `${name}:${JSON.stringify(variables)}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            // Load the markdown file
            const filePath = resolve(this._dirname, `./${name}.md`);
            let template = await fs.readFile(filePath, 'utf8');

            // Replace variables in the template
            template = this.replaceVariables(template, variables);

            // Cache the result
            this.cache.set(cacheKey, template);

            return template;
        } catch (error) {
            console.error(`Failed to load prompt template: ${name}`, error);
            throw new Error(`Failed to load prompt template: ${name}`);
        }
    }

    /**
     * Replace {{variable}} placeholders in the template
     * @param template - The template string
     * @param variables - Variables to replace
     * @returns Processed string
     */
    private replaceVariables(template: string, variables: Record<string, string | number | undefined>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            if (key in variables) {
                const value = variables[key];
                return value !== undefined ? String(value) : match;
            }
            // Keep the placeholder if variable not provided
            return match;
        });
    }

    /**
     * Clear the template cache
     */
    public clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get a raw template without variable replacement (for debugging)
     * @param name - Name of the markdown file
     * @returns Raw template string
     */
    public async getRawTemplate(name: string): Promise<string> {
        const filePath = resolve(this._dirname, `./${name}.md`);
        return fs.readFile(filePath, 'utf8');
    }
}