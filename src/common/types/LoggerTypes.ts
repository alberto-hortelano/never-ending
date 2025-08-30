export enum LogTheme {
    AI = 'AI',
    UI = 'UI',
    NETWORK = 'NETWORK',
    GAME = 'GAME',
    PERFORMANCE = 'PERFORMANCE',
    STATE = 'STATE',
    EVENT = 'EVENT',
    BUILD = 'BUILD',
    TEST = 'TEST',
    DEBUG = 'DEBUG',
    ERROR = 'ERROR'  // For general errors without specific theme
}

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

export interface LogConfig {
    enabledThemes: Set<LogTheme>;
    logLevel: LogLevel;
    showTimestamp: boolean;
    showThemePrefix: boolean;
    persistLogs: boolean;
    maxLogEntries: number;
}

export interface LogEntry {
    theme: LogTheme;
    level: LogLevel;
    message: string;
    data?: unknown[];
    timestamp: number;
    stackTrace?: string;
}

export interface LogStats {
    totalLogs: number;
    byTheme: Record<LogTheme, number>;
    byLevel: Record<LogLevel, number>;
    errors: number;
    warnings: number;
}

export interface LoggerThemeConfig {
    theme: LogTheme;
    color: string;
    icon: string;
    description: string;
}

export const THEME_CONFIGS: Record<LogTheme, LoggerThemeConfig> = {
    [LogTheme.AI]: {
        theme: LogTheme.AI,
        color: '#00ff88',
        icon: '🤖',
        description: 'AI processing, commands, and responses'
    },
    [LogTheme.UI]: {
        theme: LogTheme.UI,
        color: '#88aaff',
        icon: '🎨',
        description: 'Component lifecycle and UI updates'
    },
    [LogTheme.NETWORK]: {
        theme: LogTheme.NETWORK,
        color: '#ffa500',
        icon: '🌐',
        description: 'Network requests and multiplayer'
    },
    [LogTheme.GAME]: {
        theme: LogTheme.GAME,
        color: '#ff88ff',
        icon: '🎮',
        description: 'Game logic and mechanics'
    },
    [LogTheme.PERFORMANCE]: {
        theme: LogTheme.PERFORMANCE,
        color: '#ffff00',
        icon: '⚡',
        description: 'Performance metrics and timing'
    },
    [LogTheme.STATE]: {
        theme: LogTheme.STATE,
        color: '#00ffff',
        icon: '📊',
        description: 'State changes and updates'
    },
    [LogTheme.EVENT]: {
        theme: LogTheme.EVENT,
        color: '#ff00ff',
        icon: '📢',
        description: 'Event dispatching and handling'
    },
    [LogTheme.BUILD]: {
        theme: LogTheme.BUILD,
        color: '#888888',
        icon: '🔨',
        description: 'Build process and file operations'
    },
    [LogTheme.TEST]: {
        theme: LogTheme.TEST,
        color: '#00ff00',
        icon: '🧪',
        description: 'Test execution and debugging'
    },
    [LogTheme.DEBUG]: {
        theme: LogTheme.DEBUG,
        color: '#ff6464',
        icon: '🐛',
        description: 'General debugging information'
    },
    [LogTheme.ERROR]: {
        theme: LogTheme.ERROR,
        color: '#ff0000',
        icon: '❌',
        description: 'Error messages and exceptions'
    }
};

export const LEVEL_CONFIGS = {
    [LogLevel.ERROR]: { name: 'ERROR', color: '#ff0000', icon: '❌' },
    [LogLevel.WARN]: { name: 'WARN', color: '#ffa500', icon: '⚠️' },
    [LogLevel.INFO]: { name: 'INFO', color: '#00aaff', icon: 'ℹ️' },
    [LogLevel.DEBUG]: { name: 'DEBUG', color: '#888888', icon: '🔍' },
    [LogLevel.TRACE]: { name: 'TRACE', color: '#666666', icon: '📝' }
};