/**
 * Browser-compatible AI response cache using memory and localStorage
 */

/**
 * Generic AI request structure
 */
export interface AIRequest {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Generic AI response structure
 */
export interface AIResponse {
    content?: string;
    choices?: Array<{ message: { content: string } }>;
    data?: unknown;
    [key: string]: unknown;
}

/**
 * Cached response with generic types
 */
export interface CachedResponse<TRequest = AIRequest, TResponse = AIResponse> {
    request: string;
    response: TResponse;
    timestamp: number;
    hash: string;
    _requestType?: TRequest; // For type reference only
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
    count: number;
    memorySize: number;
    enabled: boolean;
}

/**
 * Type guard to check if an object is a valid CachedResponse
 */
export function isCachedResponse(obj: unknown): obj is CachedResponse {
    if (!obj || typeof obj !== 'object') return false;
    const candidate = obj as Record<string, unknown>;
    return (
        typeof candidate.request === 'string' &&
        typeof candidate.timestamp === 'number' &&
        typeof candidate.hash === 'string' &&
        'response' in candidate
    );
}

export class AIBrowserCacheService {
    private static memoryCache = new Map<string, CachedResponse<AIRequest, AIResponse>>();
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

            keys.forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (isCachedResponse(parsed)) {
                            const cached = parsed as CachedResponse<AIRequest, AIResponse>;
                            // Check if expired
                            if (Date.now() - cached.timestamp < this.CACHE_TTL) {
                                this.memoryCache.set(cached.hash, cached);
                            } else {
                                // Remove expired entry
                                localStorage.removeItem(key);
                            }
                        } else {
                            // Remove invalid entry
                            console.warn('[AICache] Invalid cache entry format, removing:', key);
                            localStorage.removeItem(key);
                        }
                    }
                } catch (error) {
                    console.error('[AICache] corrupted entry:', error);
                    // Remove corrupted entry
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('[AICache] Error initializing cache:', error);
        }
    }

    /**
     * Get a cached response if it exists and is valid
     */
    public static getCachedResponse<TRequest extends AIRequest = AIRequest, TResponse extends AIResponse = AIResponse>(
        request: TRequest
    ): TResponse | null {
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
            return cached.response as TResponse;
        } catch (error) {
            console.error('[AICache] Error reading cache:', error);
            return null;
        }
    }

    /**
     * Save a response to cache
     */
    public static cacheResponse<TRequest extends AIRequest = AIRequest, TResponse extends AIResponse = AIResponse>(
        request: TRequest,
        response: TResponse
    ): void {
        if (!this.CACHE_ENABLED) return;

        try {
            const hash = this.generateHash(request);
            const cacheData: CachedResponse<TRequest, TResponse> = {
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
    public static getCacheStats(): CacheStats {
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
    private static generateHash<TRequest extends AIRequest>(request: TRequest): string {
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