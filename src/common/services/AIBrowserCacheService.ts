/**
 * Browser-compatible AI response cache using memory and localStorage
 */
export interface CachedResponse {
    request: string;
    response: any;
    timestamp: number;
    hash: string;
}

export class AIBrowserCacheService {
    private static memoryCache = new Map<string, CachedResponse>();
    private static readonly CACHE_ENABLED = typeof window !== 'undefined' && !!window.localStorage;
    private static readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    private static readonly STORAGE_KEY_PREFIX = 'ai_cache_';
    private static readonly MAX_CACHE_SIZE = 50; // Maximum number of cached responses
    private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB max localStorage
    
    /**
     * Initialize cache from localStorage on startup
     */
    public static initialize(): void {
        if (!this.CACHE_ENABLED) return;
        
        try {
            // Load from localStorage into memory
            const keys = Object.keys(localStorage).filter(k => k.startsWith(this.STORAGE_KEY_PREFIX));
            console.log(`[AICache] Loading ${keys.length} cached responses from localStorage`);
            
            keys.forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const cached: CachedResponse = JSON.parse(data);
                        // Check if expired
                        if (Date.now() - cached.timestamp < this.CACHE_TTL) {
                            this.memoryCache.set(cached.hash, cached);
                        } else {
                            // Remove expired entry
                            localStorage.removeItem(key);
                        }
                    }
                } catch (error) {
                    // Remove corrupted entry
                    localStorage.removeItem(key);
                }
            });
            
            console.log(`[AICache] Loaded ${this.memoryCache.size} valid cache entries`);
        } catch (error) {
            console.error('[AICache] Error initializing cache:', error);
        }
    }
    
    /**
     * Get a cached response if it exists and is valid
     */
    public static getCachedResponse(request: any): any | null {
        if (!this.CACHE_ENABLED) return null;
        
        try {
            const hash = this.generateHash(request);
            
            // Check memory cache first
            const cached = this.memoryCache.get(hash);
            if (!cached) {
                console.log(`[AICache] Cache miss for hash: ${hash.substring(0, 8)}...`);
                return null;
            }
            
            // Check if cache is still valid
            const now = Date.now();
            if (now - cached.timestamp > this.CACHE_TTL) {
                console.log(`[AICache] Cache expired for hash: ${hash.substring(0, 8)}...`);
                this.removeFromCache(hash);
                return null;
            }
            
            const ageSeconds = Math.round((now - cached.timestamp) / 1000);
            console.log(`[AICache] Cache hit for hash: ${hash.substring(0, 8)}... (age: ${ageSeconds}s)`);
            return cached.response;
        } catch (error) {
            console.error('[AICache] Error reading cache:', error);
            return null;
        }
    }
    
    /**
     * Save a response to cache
     */
    public static cacheResponse(request: any, response: any): void {
        if (!this.CACHE_ENABLED) return;
        
        try {
            const hash = this.generateHash(request);
            const cacheData: CachedResponse = {
                request: JSON.stringify(request),
                response: response,
                timestamp: Date.now(),
                hash: hash
            };
            
            // Add to memory cache
            this.memoryCache.set(hash, cacheData);
            
            // Enforce max cache size
            if (this.memoryCache.size > this.MAX_CACHE_SIZE) {
                // Remove oldest entries
                const sortedEntries = Array.from(this.memoryCache.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp);
                
                while (this.memoryCache.size > this.MAX_CACHE_SIZE) {
                    const [oldestHash] = sortedEntries.shift()!;
                    this.removeFromCache(oldestHash);
                }
            }
            
            // Try to persist to localStorage
            try {
                const storageKey = this.STORAGE_KEY_PREFIX + hash;
                const serialized = JSON.stringify(cacheData);
                
                // Check size before storing
                if (serialized.length < this.MAX_STORAGE_SIZE / 10) { // Don't store huge responses
                    localStorage.setItem(storageKey, serialized);
                    console.log(`[AICache] Cached response for hash: ${hash.substring(0, 8)}...`);
                } else {
                    console.log(`[AICache] Response too large for localStorage, kept in memory only`);
                }
            } catch (storageError) {
                // localStorage might be full or disabled
                console.warn('[AICache] Could not persist to localStorage:', storageError);
                // Still keep in memory cache
            }
        } catch (error) {
            console.error('[AICache] Error writing cache:', error);
        }
    }
    
    /**
     * Clear all cached responses
     */
    public static clearCache(): void {
        try {
            // Clear memory cache
            this.memoryCache.clear();
            
            // Clear localStorage
            if (this.CACHE_ENABLED) {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(this.STORAGE_KEY_PREFIX));
                keys.forEach(key => localStorage.removeItem(key));
                console.log(`[AICache] Cleared ${keys.length} cached responses`);
            }
        } catch (error) {
            console.error('[AICache] Error clearing cache:', error);
        }
    }
    
    /**
     * Get cache statistics
     */
    public static getCacheStats(): { count: number; memorySize: number; enabled: boolean } {
        const count = this.memoryCache.size;
        let memorySize = 0;
        
        // Estimate memory size
        this.memoryCache.forEach(entry => {
            memorySize += JSON.stringify(entry).length;
        });
        
        return {
            count,
            memorySize,
            enabled: this.CACHE_ENABLED
        };
    }
    
    /**
     * Generate a hash for the request to use as cache key
     */
    private static generateHash(request: any): string {
        const requestString = JSON.stringify(request);
        // Use simple hash for synchronous operation
        return this.simpleHash(requestString);
    }
    
    /**
     * Simple hash function for fallback
     */
    private static simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Remove entry from both memory and localStorage
     */
    private static removeFromCache(hash: string): void {
        this.memoryCache.delete(hash);
        if (this.CACHE_ENABLED) {
            localStorage.removeItem(this.STORAGE_KEY_PREFIX + hash);
        }
    }
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    AIBrowserCacheService.initialize();
}