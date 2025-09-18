import { appendFileSync } from 'fs';
import { join } from 'path';

/**
 * Simple file logger that appends to serverLogs.txt
 */
export class FileLogger {
    private static logPath = join(process.cwd(), 'serverLogs.txt');

    /**
     * Write a message to both console and file
     */
    static log(...args: unknown[]): void {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;

        // Write to file
        try {
            appendFileSync(FileLogger.logPath, logEntry);
        } catch (error) {
            // Silently fail file writing to not disrupt the application
            console.error('Failed to write to log file:', error);
        }

        // Also write to console (preserving original behavior)
        console.log(...args);
    }

    /**
     * Write an error message to both console and file
     */
    static error(...args: unknown[]): void {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [ERROR] ${message}\n`;

        // Write to file
        try {
            appendFileSync(FileLogger.logPath, logEntry);
        } catch (error) {
            // Silently fail file writing to not disrupt the application
            console.error('Failed to write to log file:', error);
        }

        // Also write to console (preserving original behavior)
        console.error(...args);
    }

    /**
     * Write a separator line to both console and file
     */
    static separator(): void {
        const separator = '═══════════════════════════════════════════════════════════════';

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${separator}\n`;

        // Write to file
        try {
            appendFileSync(FileLogger.logPath, logEntry);
        } catch (error) {
            // Silently fail file writing to not disrupt the application
            console.error('Failed to write to log file:', error);
        }

        // Also write to console (preserving original behavior)
        console.log(separator);
    }
}