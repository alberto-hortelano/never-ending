import { Component } from "../Component";
import { AIBrowserCacheService } from "../../common/services/AIBrowserCacheService";
import type { CacheStats } from "../../common/services/AIBrowserCacheService";

export default class DevelopmentUI extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private cacheStats: CacheStats | null = null;
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        this.updateCacheStats(root);
        
        setInterval(() => this.updateCacheStats(root), 5000);
        
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        const cacheToggleBtn = root.querySelector('#cache-toggle-btn') as HTMLButtonElement;
        const cacheClearBtn = root.querySelector('#cache-clear-btn') as HTMLButtonElement;
        const cacheStatsBtn = root.querySelector('#cache-stats-btn') as HTMLButtonElement;
        const cacheClearProbBtn = root.querySelector('#cache-clear-problematic-btn') as HTMLButtonElement;
        
        if (cacheToggleBtn) {
            cacheToggleBtn.addEventListener('click', () => {
                const stats = AIBrowserCacheService.getCacheStats();
                const newState = !stats.enabled;
                localStorage.setItem('ai_cache_enabled', String(newState));
                
                this.showNotification(root, `Cache ${newState ? 'enabled' : 'disabled'} (refresh page to apply)`);
                this.updateCacheStats(root);
            });
        }
        
        if (cacheClearBtn) {
            cacheClearBtn.addEventListener('click', () => {
                AIBrowserCacheService.clearCache();
                this.showNotification(root, 'Cache cleared successfully');
                this.updateCacheStats(root);
            });
        }
        
        if (cacheStatsBtn) {
            cacheStatsBtn.addEventListener('click', () => {
                const stats = AIBrowserCacheService.getCacheStats();
                const sizeKB = (stats.memorySize / 1024).toFixed(2);
                const avgSize = stats.count > 0 ? (stats.memorySize / stats.count / 1024).toFixed(2) : '0';
                
                const message = `Cache: ${stats.count} responses, ${sizeKB} KB total, ${avgSize} KB avg`;
                this.showNotification(root, message, 5000);
                
                console.log('=== AI Cache Statistics ===');
                console.log(`Enabled: ${stats.enabled ? 'Yes' : 'No'}`);
                console.log(`Cached responses: ${stats.count}`);
                console.log(`Memory usage: ${sizeKB} KB`);
                if (stats.count > 0) {
                    console.log(`Average size: ${avgSize} KB`);
                }
            });
        }
        
        if (cacheClearProbBtn) {
            cacheClearProbBtn.addEventListener('click', () => {
                AIBrowserCacheService.clearProblematicCache();
                this.showNotification(root, 'Problematic cache entries cleared');
                this.updateCacheStats(root);
            });
        }
    }
    
    private updateCacheStats(root: ShadowRoot) {
        this.cacheStats = AIBrowserCacheService.getCacheStats();
        
        const statusIndicator = root.querySelector('#cache-status') as HTMLElement;
        const countBadge = root.querySelector('#cache-count') as HTMLElement;
        const sizeBadge = root.querySelector('#cache-size') as HTMLElement;
        const toggleBtn = root.querySelector('#cache-toggle-btn') as HTMLButtonElement;
        
        if (statusIndicator) {
            statusIndicator.textContent = this.cacheStats.enabled ? 'ON' : 'OFF';
            statusIndicator.className = `status-indicator ${this.cacheStats.enabled ? 'enabled' : 'disabled'}`;
        }
        
        if (countBadge) {
            countBadge.textContent = String(this.cacheStats.count);
        }
        
        if (sizeBadge) {
            const sizeKB = (this.cacheStats.memorySize / 1024).toFixed(1);
            sizeBadge.textContent = `${sizeKB} KB`;
        }
        
        if (toggleBtn) {
            toggleBtn.textContent = this.cacheStats.enabled ? 'Disable' : 'Enable';
        }
    }
    
    private showNotification(root: ShadowRoot, message: string, duration: number = 3000) {
        const notification = root.querySelector('#notification') as HTMLElement;
        if (!notification) return;
        
        notification.textContent = message;
        notification.classList.add('visible');
        
        setTimeout(() => {
            notification.classList.remove('visible');
        }, duration);
    }
}

customElements.define('development-ui', DevelopmentUI);