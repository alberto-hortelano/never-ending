export class EnvironmentService {
    private static isDevelopmentCache: boolean | null = null;
    
    static isDevelopment(): boolean {
        if (this.isDevelopmentCache !== null) {
            return this.isDevelopmentCache;
        }
        
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            
            const nodeEnv = typeof process !== 'undefined' && process?.env?.NODE_ENV;
            const isDev = nodeEnv === 'development';
            
            this.isDevelopmentCache = isLocalhost || isDev;
        } else {
            const nodeEnv = typeof process !== 'undefined' && process?.env?.NODE_ENV;
            this.isDevelopmentCache = nodeEnv === 'development' || nodeEnv === 'test';
        }
        
        return this.isDevelopmentCache || false;
    }
    
    static isProduction(): boolean {
        return !this.isDevelopment();
    }
    
    static getEnvironment(): 'development' | 'production' | 'test' {
        if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'test') {
            return 'test';
        }
        return this.isDevelopment() ? 'development' : 'production';
    }
    
    static clearCache(): void {
        this.isDevelopmentCache = null;
    }
}