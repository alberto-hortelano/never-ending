/**
 * Example usage of the Logger system
 * This file demonstrates how to use the modular logging system
 */

import { Logger } from './LoggerService';
import { LogTheme } from '../types/LoggerTypes';

export class ExampleLoggerUsage {
    
    demonstrateLogging() {
        // Direct usage with specific themes
        Logger.info(LogTheme.AI, 'AI system initialized');
        Logger.debug(LogTheme.UI, 'Component rendered', { id: 'test-component' });
        Logger.warn(LogTheme.NETWORK, 'Network latency detected', { latency: 500 });
        Logger.error(LogTheme.GAME, 'Failed to load character', new Error('Character not found'));
        
        // Performance tracking
        const startTime = performance.now();
        // ... some operation ...
        const duration = performance.now() - startTime;
        if (duration > 100) {
            Logger.warn(LogTheme.PERFORMANCE, `Operation slow: ${duration.toFixed(1)}ms`);
        }
        
        // State changes
        Logger.trace(LogTheme.STATE, 'State updated', { 
            action: 'UPDATE_CHARACTER',
            payload: { id: 'player1', health: 80 }
        });
        
        // Event dispatching
        Logger.debug(LogTheme.EVENT, 'Event dispatched', { 
            type: 'GameStart',
            timestamp: Date.now()
        });
        
        // Build/Development
        Logger.info(LogTheme.BUILD, 'Build completed successfully');
        
        // Test execution
        Logger.debug(LogTheme.TEST, 'Test suite started', { suite: 'unit-tests' });
        
        // General debugging
        Logger.debug(LogTheme.DEBUG, 'Debug checkpoint reached');
    }
    
    // Example of migrating from console.log
    oldMethod() {
        // Before:
        // console.log('[Service] Processing data:', data);
        // console.error('Failed to process:', error);
        
        // After:
        const data = { example: 'data' };
        Logger.info(LogTheme.DEBUG, '[Service] Processing data:', data);
        
        const error = new Error('Example error');
        Logger.error(LogTheme.ERROR, 'Failed to process:', error);
    }
    
    // Example with conditional logging
    conditionalLogging(_verbose: boolean) {
        // Logger automatically filters based on enabled themes and log level
        // No need for if (verbose) checks
        Logger.trace(LogTheme.DEBUG, 'Detailed trace information');
        Logger.debug(LogTheme.DEBUG, 'Debug information');
        Logger.info(LogTheme.DEBUG, 'Info level message');
    }
}

// Note: Existing console.log/error/warn calls are automatically intercepted
// and routed through the Logger with theme detection based on content