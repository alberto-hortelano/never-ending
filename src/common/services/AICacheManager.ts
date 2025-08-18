/**
 * Cache management utilities that can be called from browser console
 */
import { AIBrowserCacheService } from './AIBrowserCacheService';

// Make cache utilities available globally in development
if (typeof window !== 'undefined') {
    (window as any).AICache = {
        /**
         * Get cache statistics
         */
        stats: () => {
            const stats = AIBrowserCacheService.getCacheStats();
            const sizeKB = (stats.memorySize / 1024).toFixed(2);
            console.log('=== AI Cache Statistics ===');
            console.log(`Enabled: ${stats.enabled ? 'Yes' : 'No'}`);
            console.log(`Cached responses: ${stats.count}`);
            console.log(`Memory usage: ${sizeKB} KB`);
            if (stats.count > 0) {
                console.log(`Average size: ${(stats.memorySize / stats.count / 1024).toFixed(2)} KB`);
            }
            return stats;
        },
        
        /**
         * Clear all cached responses
         */
        clear: () => {
            AIBrowserCacheService.clearCache();
            console.log('✓ Cache cleared successfully');
        },
        
        /**
         * Enable/disable caching
         */
        toggle: (enabled?: boolean) => {
            const stats = AIBrowserCacheService.getCacheStats();
            const newState = enabled !== undefined ? enabled : !stats.enabled;
            localStorage.setItem('ai_cache_enabled', String(newState));
            console.log(`Cache ${newState ? 'enabled' : 'disabled'} (requires page reload)`);
            return newState;
        },
        
        /**
         * Show help
         */
        help: () => {
            console.log('=== AI Cache Commands ===');
            console.log('AICache.stats()     - Show cache statistics');
            console.log('AICache.clear()     - Clear all cached responses');  
            console.log('AICache.toggle()    - Toggle cache on/off');
            console.log('AICache.toggle(true/false) - Set cache state');
            console.log('');
            console.log('Cache is stored in memory and localStorage.');
            console.log('Responses expire after 7 days.');
        }
    };
    
    // Show cache stats on load in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('AI Cache loaded. Type AICache.help() for commands.');
    }
}

export default AIBrowserCacheService;