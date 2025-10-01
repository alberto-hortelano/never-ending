import { appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Simple file logger that appends to serverLogs.txt
 */
export class FileLogger {
    private static logPath = join(process.cwd(), 'serverLogs.txt');
    private static initialized = false;

    /**
     * Initialize the logger and clear the log file for a new session
     */
    static initialize(): void {
        if (FileLogger.initialized) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const header = `════════════════════════════════════════════════════════════════\n` +
                          `Session started: ${timestamp}\n` +
                          `════════════════════════════════════════════════════════════════\n\n`;
            writeFileSync(FileLogger.logPath, header);
            FileLogger.initialized = true;
            console.log('Log file cleared for new session:', FileLogger.logPath);
        } catch (error) {
            console.error('Failed to initialize log file:', error);
        }
    }

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

    /**
     * Write different messages to console and file
     * @param consoleMessage - Message to display in console (can be truncated)
     * @param fileMessage - Full message to write to file (optional, defaults to consoleMessage)
     */
    static logWithTruncation(consoleMessage: string, fileMessage?: string): void {
        const timestamp = new Date().toISOString();
        const fullMessage = fileMessage ?? consoleMessage;
        const logEntry = `[${timestamp}] ${fullMessage}\n`;

        // Write full message to file
        try {
            appendFileSync(FileLogger.logPath, logEntry);
        } catch (error) {
            // Silently fail file writing to not disrupt the application
            console.error('Failed to write to log file:', error);
        }

        // Write potentially truncated message to console
        console.log(consoleMessage);
    }
}