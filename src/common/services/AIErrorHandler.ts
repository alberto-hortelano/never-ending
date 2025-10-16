import { State } from '../State';
import { AICommandValidator, ValidationResult } from './AICommandValidator';
import { AIGameEngineService, AIActionContext } from './AIGameEngineService';
import { AICommand } from './AICommandParser';
import type { LanguageCode } from '../constants';

export interface ErrorFeedback {
    originalCommand: unknown;
    errors: Array<{
        field: string;
        value: unknown;
        error: string;
        suggestions?: string[];
    }>;
    retryCount: number;
    maxRetries: number;
}

export interface RetryResult {
    success: boolean;
    command?: AICommand;
    finalErrors?: ErrorFeedback;
    attempts: number;
}

/**
 * Handles AI command validation errors and implements retry logic
 * with feedback to help the AI correct its mistakes
 */
export class AIErrorHandler {
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY_MS = 1000;

    constructor(
        private validator: AICommandValidator,
        private gameEngineService: AIGameEngineService
    ) {}

    /**
     * Attempts to execute an AI command with automatic retry on validation errors
     */
    public async executeWithRetry(
        command: unknown,
        context: AIActionContext,
        state: State,
        language: string = 'en'
    ): Promise<RetryResult> {
        let attempts = 0;
        let lastValidationResult: ValidationResult | null = null;
        let currentCommand = command;

        while (attempts < AIErrorHandler.MAX_RETRIES) {
            attempts++;

            // Validate the command
            const validationResult = this.validator.validateCommand(currentCommand);
            lastValidationResult = validationResult;

            if (validationResult.isValid) {
                console.log(`[AIErrorHandler] Command validated successfully on attempt ${attempts}`);
                return {
                    success: true,
                    command: validationResult.command,
                    attempts
                };
            }

            // Log validation errors
            console.error(`[AIErrorHandler] Validation failed on attempt ${attempts}`, {
                errors: validationResult.errors,
                command: currentCommand
            });

            // If we haven't exceeded retries, send error feedback to AI
            if (attempts < AIErrorHandler.MAX_RETRIES) {
                const errorFeedback = this.buildErrorFeedback(
                    currentCommand,
                    validationResult,
                    attempts
                );

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, AIErrorHandler.RETRY_DELAY_MS));

                // Request correction from AI
                try {
                    const correctedCommand = await this.requestCorrection(
                        errorFeedback,
                        context,
                        state,
                        language
                    );
                    currentCommand = correctedCommand;
                } catch (error) {
                    console.error('[AIErrorHandler] Failed to get correction from AI', error);
                    break;
                }
            }
        }

        // Max retries exceeded
        return {
            success: false,
            finalErrors: this.buildErrorFeedback(
                currentCommand,
                lastValidationResult!,
                attempts
            ),
            attempts
        };
    }

    /**
     * Builds error feedback message for the AI
     */
    private buildErrorFeedback(
        command: unknown,
        validationResult: ValidationResult,
        retryCount: number
    ): ErrorFeedback {
        return {
            originalCommand: command,
            errors: validationResult.errors,
            retryCount,
            maxRetries: AIErrorHandler.MAX_RETRIES
        };
    }

    /**
     * Requests a corrected command from the AI based on error feedback
     */
    private async requestCorrection(
        errorFeedback: ErrorFeedback,
        context: AIActionContext,
        _state: State,
        language: string
    ): Promise<unknown> {
        // Build error feedback prompt
        const errorPrompt = this.buildErrorPrompt(errorFeedback);

        // Create a modified context that includes the error information
        const contextWithErrors = {
            ...context,
            validationErrors: errorFeedback.errors,
            attemptNumber: errorFeedback.retryCount
        };

        // Use the existing requestAIAction method with a custom system prompt
        const systemPrompt = `
## IMPORTANT: Command Validation Error

Your previous command had validation errors. Please review the errors and provide a corrected command.

${errorPrompt}

Remember: Return ONLY the corrected JSON command, no explanation.
`;

        try {
            const response = await this.gameEngineService.requestAIAction(
                contextWithErrors,
                systemPrompt,
                undefined,
                language as LanguageCode
            );

            if (response.command) {
                return response.command;
            }

            // If no command in response, try to parse the raw content
            const parsedCommand = this.parseAIResponse(JSON.stringify(response));
            return parsedCommand;
        } catch (error) {
            console.error('[AIErrorHandler] Failed to get correction from AI', error);
            throw error;
        }
    }

    /**
     * Builds the error prompt for the AI
     */
    private buildErrorPrompt(errorFeedback: ErrorFeedback): string {
        let prompt = `## COMMAND VALIDATION ERRORS\n\n`;
        prompt += `Your previous command had ${errorFeedback.errors.length} validation error(s). `;
        prompt += `This is attempt ${errorFeedback.retryCount} of ${errorFeedback.maxRetries}.\n\n`;

        // Check if this is a "multiple commands" error and add special emphasis
        const hasMultipleCommandsError = errorFeedback.errors.some(e =>
            e.error.includes('Multiple commands') ||
            e.error.includes('commands array') ||
            e.error.includes('only ONE command')
        );

        if (hasMultipleCommandsError) {
            prompt += `### ⚠️ CRITICAL: SINGLE COMMAND REQUIRED ⚠️\n`;
            prompt += `You must return exactly ONE command object. Do not return:\n`;
            prompt += `- Arrays of commands []\n`;
            prompt += `- Multiple commands of the same type\n`;
            prompt += `- Commands wrapped in a "commands" field\n\n`;
        }

        prompt += `### Errors Found:\n`;
        errorFeedback.errors.forEach((error, index) => {
            prompt += `\n${index + 1}. **${error.field}**\n`;
            prompt += `   - Current value: ${JSON.stringify(error.value)}\n`;
            prompt += `   - Error: ${error.error}\n`;
            if (error.suggestions && error.suggestions.length > 0) {
                prompt += `   - Valid options: ${error.suggestions.join(', ')}\n`;
            }
        });

        prompt += `\n### Instructions:\n`;
        prompt += `1. Review each error carefully\n`;
        prompt += `2. Use ONLY the suggested values when provided\n`;
        prompt += `3. Ensure all required fields are present\n`;
        prompt += `4. Return a corrected JSON command\n`;
        prompt += `5. Do not include any explanation, just the JSON\n\n`;
        prompt += `Please provide the corrected command:`;

        return prompt;
    }


    /**
     * Parses the AI response to extract the command
     */
    private parseAIResponse(response: string): unknown {
        // Try to extract JSON from the response
        // AI might include markdown code blocks or extra text
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response;

        try {
            return JSON.parse(jsonString || response);
        } catch (_error) {
            // Try to find any JSON object in the response
            const objectMatch = response.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                return JSON.parse(objectMatch[0]);
            }
            throw new Error('No valid JSON found in AI response');
        }
    }

    /**
     * Formats error feedback for display or logging
     */
    public formatErrorFeedback(errorFeedback: ErrorFeedback): string {
        let output = `Command Validation Failed (Attempt ${errorFeedback.retryCount}/${errorFeedback.maxRetries})\n`;
        output += `═══════════════════════════════════════\n\n`;

        errorFeedback.errors.forEach((error, index) => {
            output += `Error ${index + 1}: ${error.field}\n`;
            output += `  Issue: ${error.error}\n`;
            output += `  Value: ${JSON.stringify(error.value)}\n`;
            if (error.suggestions && error.suggestions.length > 0) {
                output += `  Suggestions: ${error.suggestions.slice(0, 5).join(', ')}\n`;
            }
            output += '\n';
        });

        return output;
    }
}