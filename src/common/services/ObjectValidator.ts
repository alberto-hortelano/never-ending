import type { IValidationResult, IValidationError } from '../interfaces';

/**
 * Base class for validating AI-generated objects
 * Provides common validation logic and retry mechanism
 * @template T The type of object being validated
 */
export abstract class ObjectValidator<T> {
    protected errors: IValidationError[] = [];

    /**
     * Validate an object and return validation result
     */
    public validate(obj: unknown): IValidationResult {
        this.errors = [];
        
        if (!obj || typeof obj !== 'object') {
            return {
                isValid: false,
                errors: ['Object is null or not an object type']
            };
        }

        // Perform specific validation
        const isValid = this.performValidation(obj);
        
        return {
            isValid,
            errors: this.errors.map(e => e.message),
            fixedObject: isValid ? (obj as T) : undefined
        };
    }

    /**
     * Generate a prompt for AI to fix validation errors
     */
    public generateFixPrompt(errors: string[], originalObject: unknown): string {
        const errorList = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
        
        return `The ${this.getObjectType()} object you provided is incomplete or invalid. Please fix these issues:

${errorList}

Original object received:
${JSON.stringify(originalObject, null, 2)}

Please return a complete and valid ${this.getObjectType()} object with all required fields properly filled. 
Ensure all arrays are initialized (even if empty) and all required properties are present.

Return the corrected object in valid JSON format.`;
    }

    /**
     * Attempt to fix common issues automatically
     */
    public attemptAutoFix(obj: Record<string, unknown>): Record<string, unknown> {
        const fixed = { ...obj };
        
        // Fix common array fields that might be undefined
        const arrayFields = this.getArrayFields();
        for (const field of arrayFields) {
            if (fixed[field] === undefined || fixed[field] === null) {
                fixed[field] = [];
            } else if (!Array.isArray(fixed[field])) {
                // If it's a single item, wrap it in an array
                fixed[field] = [fixed[field]];
            }
        }

        // Fix common string fields that might be undefined
        const stringFields = this.getStringFields();
        for (const field of stringFields) {
            if (fixed[field] === undefined || fixed[field] === null) {
                fixed[field] = '';
            } else if (typeof fixed[field] !== 'string') {
                fixed[field] = String(fixed[field]);
            }
        }

        return fixed;
    }

    /**
     * Validate with retry mechanism
     */
    public async validateWithRetry(
        obj: unknown,
        retryCallback: (prompt: string) => Promise<unknown>,
        maxRetries: number = 2
    ): Promise<IValidationResult> {
        let currentObj = obj;
        let attempts = 0;

        while (attempts <= maxRetries) {
            // Try auto-fix first
            if (currentObj && typeof currentObj === 'object') {
                currentObj = this.attemptAutoFix(currentObj as Record<string, unknown>);
            }

            const result = this.validate(currentObj);
            
            if (result.isValid) {
                return result;
            }

            if (attempts < maxRetries) {
                console.log(`[Validator] Validation failed, attempt ${attempts + 1}/${maxRetries}`);
                const fixPrompt = this.generateFixPrompt(result.errors, currentObj);
                
                try {
                    currentObj = await retryCallback(fixPrompt);
                } catch (error) {
                    console.error('[Validator] Retry failed:', error);
                }
            }

            attempts++;
        }

        // Final validation attempt
        return this.validate(currentObj);
    }

    // Protected helper methods

    protected addError(field: string, expectedType: string, actualType: string, message?: string): void {
        this.errors.push({
            field,
            expectedType,
            actualType,
            message: message || `Field '${field}' should be ${expectedType} but got ${actualType}`
        });
    }

    protected validateRequiredField(
        obj: Record<string, unknown>,
        field: string,
        expectedType: string
    ): boolean {
        if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
            this.addError(field, expectedType, 'undefined', `Required field '${field}' is missing`);
            return false;
        }

        const actualType = Array.isArray(obj[field]) ? 'array' : typeof obj[field];
        if (actualType !== expectedType) {
            this.addError(field, expectedType, actualType);
            return false;
        }

        return true;
    }

    protected validateOptionalField(
        obj: Record<string, unknown>,
        field: string,
        expectedType: string
    ): boolean {
        if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
            return true; // Optional field can be missing
        }

        const actualType = Array.isArray(obj[field]) ? 'array' : typeof obj[field];
        if (actualType !== expectedType) {
            this.addError(field, expectedType, actualType);
            return false;
        }

        return true;
    }

    protected validateArrayField(
        obj: Record<string, unknown>,
        field: string,
        required: boolean = true
    ): boolean {
        if (!required && (!(field in obj) || obj[field] === undefined || obj[field] === null)) {
            return true;
        }

        if (required && (!(field in obj) || obj[field] === undefined || obj[field] === null)) {
            this.addError(field, 'array', 'undefined', `Required array field '${field}' is missing`);
            return false;
        }

        if (!Array.isArray(obj[field])) {
            this.addError(field, 'array', typeof obj[field], `Field '${field}' should be an array`);
            return false;
        }

        return true;
    }

    // Abstract methods to be implemented by subclasses

    /**
     * Perform specific validation for the object type
     */
    protected abstract performValidation(obj: unknown): boolean;

    /**
     * Get the type name for error messages
     */
    protected abstract getObjectType(): string;

    /**
     * Get list of fields that should be arrays
     */
    protected abstract getArrayFields(): string[];

    /**
     * Get list of fields that should be strings
     */
    protected abstract getStringFields(): string[];
}