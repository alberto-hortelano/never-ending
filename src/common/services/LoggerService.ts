import { LogTheme, LogLevel, LogConfig, LogEntry, LogStats, THEME_CONFIGS, LEVEL_CONFIGS } from '../types/LoggerTypes';

export class LoggerService {
    private static instance: LoggerService;
    private config: LogConfig;
    private logHistory: LogEntry[] = [];
    private listeners: Set<(entry: LogEntry) => void> = new Set();
    private originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    private constructor() {
        this.config = this.loadConfig();
        this.interceptConsoleMethods();
    }

    static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    private loadConfig(): LogConfig {
        const saved = localStorage.getItem('logger_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    ...parsed,
                    enabledThemes: new Set(parsed.enabledThemes || [])
                };
            } catch {
                // Fall through to default
            }
        }

        // Default configuration
        return {
            enabledThemes: new Set([LogTheme.AI, LogTheme.ERROR, LogTheme.GAME]),
            logLevel: LogLevel.INFO,
            showTimestamp: true,
            showThemePrefix: true,
            persistLogs: true,
            maxLogEntries: 1000
        };
    }

    private saveConfig(): void {
        const configToSave = {
            ...this.config,
            enabledThemes: Array.from(this.config.enabledThemes)
        };
        localStorage.setItem('logger_config', JSON.stringify(configToSave));
    }

    private interceptConsoleMethods(): void {
        // Intercept console methods to route through logger
        const self = this;
        
        console.log = function(...args: unknown[]) {
            const theme = self.detectTheme(args);
            self.log(theme, LogLevel.INFO, ...args);
        };

        console.error = function(...args: unknown[]) {
            const theme = self.detectTheme(args);
            self.log(theme, LogLevel.ERROR, ...args);
        };

        console.warn = function(...args: unknown[]) {
            const theme = self.detectTheme(args);
            self.log(theme, LogLevel.WARN, ...args);
        };

        console.info = function(...args: unknown[]) {
            const theme = self.detectTheme(args);
            self.log(theme, LogLevel.INFO, ...args);
        };

        console.debug = function(...args: unknown[]) {
            const theme = self.detectTheme(args);
            self.log(theme, LogLevel.DEBUG, ...args);
        };
    }

    private detectTheme(args: unknown[]): LogTheme {
        if (args.length === 0) return LogTheme.DEBUG;
        
        const firstArg = String(args[0]).toLowerCase();
        
        // Check for specific patterns
        if (firstArg.includes('[ai') || firstArg.includes('ai]') || 
            firstArg.includes('aicontroller') || firstArg.includes('aicommand') ||
            firstArg.includes('aigameengine')) {
            return LogTheme.AI;
        }
        if (firstArg.includes('[ui') || firstArg.includes('component') || 
            firstArg.includes('connectedcallback') || firstArg.includes('conversation]') ||
            firstArg.includes('bottombar]')) {
            return LogTheme.UI;
        }
        if (firstArg.includes('websocket') || firstArg.includes('player connected') ||
            firstArg.includes('room') || firstArg.includes('multiplayer')) {
            return LogTheme.NETWORK;
        }
        if (firstArg.includes('performance') || firstArg.includes('slow:') || 
            firstArg.includes('duration')) {
            return LogTheme.PERFORMANCE;
        }
        if (firstArg.includes('state') || firstArg.includes('update')) {
            return LogTheme.STATE;
        }
        if (firstArg.includes('event') || firstArg.includes('dispatch') || 
            firstArg.includes('listen')) {
            return LogTheme.EVENT;
        }
        if (firstArg.includes('sync') || firstArg.includes('copied') || 
            firstArg.includes('build')) {
            return LogTheme.BUILD;
        }
        if (firstArg.includes('test') || firstArg.includes('spec')) {
            return LogTheme.TEST;
        }
        if (firstArg.includes('[game') || firstArg.includes('character') || 
            firstArg.includes('action') || firstArg.includes('shoot')) {
            return LogTheme.GAME;
        }
        
        return LogTheme.DEBUG;
    }

    log(theme: LogTheme, level: LogLevel, ...args: unknown[]): void {
        // Check if this log should be shown
        if (!this.shouldLog(theme, level)) {
            return;
        }

        // Create log entry
        const entry: LogEntry = {
            theme,
            level,
            message: this.formatMessage(args),
            data: args.length > 1 ? args.slice(1) : undefined,
            timestamp: Date.now()
        };

        // Add to history
        if (this.config.persistLogs) {
            this.logHistory.push(entry);
            if (this.logHistory.length > this.config.maxLogEntries) {
                this.logHistory.shift();
            }
        }

        // Notify listeners
        this.listeners.forEach(listener => listener(entry));

        // Output to console
        this.outputToConsole(entry, args);
    }

    private shouldLog(theme: LogTheme, level: LogLevel): boolean {
        return this.config.enabledThemes.has(theme) && level <= this.config.logLevel;
    }

    private formatMessage(args: unknown[]): string {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    private outputToConsole(entry: LogEntry, originalArgs: unknown[]): void {
        const themeConfig = THEME_CONFIGS[entry.theme];
        const levelConfig = LEVEL_CONFIGS[entry.level];
        
        const prefix = [];
        if (this.config.showTimestamp) {
            prefix.push(`[${new Date(entry.timestamp).toLocaleTimeString()}]`);
        }
        if (this.config.showThemePrefix) {
            prefix.push(`${themeConfig.icon} [${entry.theme}:${levelConfig.name}]`);
        }

        const prefixStr = prefix.join(' ');
        const styles = `color: ${themeConfig.color}; font-weight: bold;`;

        // Use the appropriate console method based on level
        const consoleMethod = this.getConsoleMethod(entry.level);
        
        if (prefixStr) {
            consoleMethod.call(console, `%c${prefixStr}`, styles, ...originalArgs);
        } else {
            consoleMethod.call(console, ...originalArgs);
        }
    }

    private getConsoleMethod(level: LogLevel): Function {
        switch (level) {
            case LogLevel.ERROR:
                return this.originalConsole.error;
            case LogLevel.WARN:
                return this.originalConsole.warn;
            case LogLevel.DEBUG:
            case LogLevel.TRACE:
                return this.originalConsole.debug;
            default:
                return this.originalConsole.log;
        }
    }

    // Public API methods

    error(theme: LogTheme, ...args: unknown[]): void {
        this.log(theme, LogLevel.ERROR, ...args);
    }

    warn(theme: LogTheme, ...args: unknown[]): void {
        this.log(theme, LogLevel.WARN, ...args);
    }

    info(theme: LogTheme, ...args: unknown[]): void {
        this.log(theme, LogLevel.INFO, ...args);
    }

    debug(theme: LogTheme, ...args: unknown[]): void {
        this.log(theme, LogLevel.DEBUG, ...args);
    }

    trace(theme: LogTheme, ...args: unknown[]): void {
        this.log(theme, LogLevel.TRACE, ...args);
    }

    setThemeEnabled(theme: LogTheme, enabled: boolean): void {
        if (enabled) {
            this.config.enabledThemes.add(theme);
        } else {
            this.config.enabledThemes.delete(theme);
        }
        this.saveConfig();
    }

    setLogLevel(level: LogLevel): void {
        this.config.logLevel = level;
        this.saveConfig();
    }

    setShowTimestamp(show: boolean): void {
        this.config.showTimestamp = show;
        this.saveConfig();
    }

    setShowThemePrefix(show: boolean): void {
        this.config.showThemePrefix = show;
        this.saveConfig();
    }

    getConfig(): LogConfig {
        return { ...this.config, enabledThemes: new Set(this.config.enabledThemes) };
    }

    getStats(): LogStats {
        const stats: LogStats = {
            totalLogs: this.logHistory.length,
            byTheme: {} as Record<LogTheme, number>,
            byLevel: {} as Record<LogLevel, number>,
            errors: 0,
            warnings: 0
        };

        // Initialize counters
        Object.values(LogTheme).forEach(theme => {
            stats.byTheme[theme as LogTheme] = 0;
        });
        Object.values(LogLevel).filter(v => typeof v === 'number').forEach(level => {
            stats.byLevel[level as LogLevel] = 0;
        });

        // Count logs
        this.logHistory.forEach(entry => {
            stats.byTheme[entry.theme]++;
            stats.byLevel[entry.level]++;
            if (entry.level === LogLevel.ERROR) stats.errors++;
            if (entry.level === LogLevel.WARN) stats.warnings++;
        });

        return stats;
    }

    clearLogs(): void {
        this.logHistory = [];
    }

    exportLogs(format: 'json' | 'text' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.logHistory, null, 2);
        }

        return this.logHistory.map(entry => {
            const time = new Date(entry.timestamp).toLocaleString();
            const level = LEVEL_CONFIGS[entry.level].name;
            return `[${time}] [${entry.theme}:${level}] ${entry.message}`;
        }).join('\n');
    }

    addListener(listener: (entry: LogEntry) => void): void {
        this.listeners.add(listener);
    }

    removeListener(listener: (entry: LogEntry) => void): void {
        this.listeners.delete(listener);
    }

    getLogHistory(): LogEntry[] {
        return [...this.logHistory];
    }

    // Restore original console methods (useful for testing)
    restore(): void {
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug;
    }
}

// Export singleton instance
export const Logger = LoggerService.getInstance();