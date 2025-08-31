import { Component } from "../Component";
import { AIBrowserCacheService } from "../../common/services/AIBrowserCacheService";
import type { CacheStats } from "../../common/services/AIBrowserCacheService";
import { AIMockService } from "../../common/services/AIMockService";
import { Logger } from "../../common/services/LoggerService";
import { LogTheme, LogLevel, THEME_CONFIGS } from "../../common/types/LoggerTypes";
import type { StoryDebug } from "../storydebug/StoryDebug";

export default class DevelopmentUI extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    private cacheStats: CacheStats | null = null;
    private isAIMockEnabled: boolean = false;
    private cacheBarVisible: boolean = false;
    private logsBarVisible: boolean = false;
    private storyBarVisible: boolean = false;
    private storyDebugComponent?: StoryDebug;
    private updateLogsInterval?: number;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Load AI mock state from localStorage
        this.isAIMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';

        this.setupEventListeners(root);
        this.setupLoggingUI(root);
        this.setupStoryDebug(root);
        this.updateCacheStats(root);
        this.updateAIMockStatus(root);
        this.updateLogsStats(root);

        setInterval(() => this.updateCacheStats(root), 5000);
        this.updateLogsInterval = window.setInterval(() => this.updateLogsStats(root), 1000);

        // Add listener for log updates
        Logger.addListener(() => {
            this.updateLogsStats(root);
        });

        return root;
    }

    disconnectedCallback() {
        if (this.updateLogsInterval) {
            clearInterval(this.updateLogsInterval);
        }
    }

    private setupEventListeners(root: ShadowRoot) {
        const aiMockToggleBtn = root.querySelector('#ai-mock-toggle-btn') as HTMLButtonElement;
        const cacheBarToggleBtn = root.querySelector('#cache-bar-toggle') as HTMLButtonElement;
        const logsBarToggleBtn = root.querySelector('#logs-bar-toggle') as HTMLButtonElement;
        const storyBarToggleBtn = root.querySelector('#story-bar-toggle') as HTMLButtonElement;
        const cacheToggleBtn = root.querySelector('#cache-toggle-btn') as HTMLButtonElement;
        const cacheClearBtn = root.querySelector('#cache-clear-btn') as HTMLButtonElement;
        const cacheStatsBtn = root.querySelector('#cache-stats-btn') as HTMLButtonElement;
        const cacheClearProbBtn = root.querySelector('#cache-clear-problematic-btn') as HTMLButtonElement;

        if (cacheBarToggleBtn) {
            cacheBarToggleBtn.addEventListener('click', () => {
                this.toggleCacheBar(root);
            });
        }

        if (logsBarToggleBtn) {
            logsBarToggleBtn.addEventListener('click', () => {
                this.toggleLogsBar(root);
            });
        }

        if (storyBarToggleBtn) {
            storyBarToggleBtn.addEventListener('click', () => {
                this.toggleStoryBar(root);
            });
        }

        if (aiMockToggleBtn) {
            aiMockToggleBtn.addEventListener('click', () => {
                this.isAIMockEnabled = !this.isAIMockEnabled;
                localStorage.setItem('ai_mock_enabled', String(this.isAIMockEnabled));

                if (this.isAIMockEnabled) {
                    // Reset the mock service when enabling
                    AIMockService.getInstance().reset();
                }

                this.showNotification(root, `AI Mock ${this.isAIMockEnabled ? 'enabled' : 'disabled'}`);
                this.updateAIMockStatus(root);

                Logger.info(LogTheme.AI, `Mock mode ${this.isAIMockEnabled ? 'ENABLED' : 'DISABLED'}`);
            });
        }

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

                Logger.info(LogTheme.DEBUG, '=== AI Cache Statistics ===');
                Logger.info(LogTheme.DEBUG, `Enabled: ${stats.enabled ? 'Yes' : 'No'}`);
                Logger.info(LogTheme.DEBUG, `Cached responses: ${stats.count}`);
                Logger.info(LogTheme.DEBUG, `Memory usage: ${sizeKB} KB`);
                if (stats.count > 0) {
                    Logger.info(LogTheme.DEBUG, `Average size: ${avgSize} KB`);
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

    private updateAIMockStatus(root: ShadowRoot) {
        const statusIndicator = root.querySelector('#ai-mode-status') as HTMLElement;
        const toggleBtn = root.querySelector('#ai-mock-toggle-btn') as HTMLButtonElement;

        if (statusIndicator) {
            statusIndicator.textContent = this.isAIMockEnabled ? 'MOCK' : 'REAL';
            statusIndicator.className = `status-indicator ${this.isAIMockEnabled ? 'mock' : 'real'}`;
        }

        if (toggleBtn) {
            toggleBtn.textContent = this.isAIMockEnabled ? 'Real' : 'Mock';
        }
    }

    private toggleCacheBar(root: ShadowRoot) {
        const cacheBar = root.querySelector('#cache-bar') as HTMLElement;
        const toggleBtn = root.querySelector('#cache-bar-toggle') as HTMLButtonElement;

        if (cacheBar) {
            this.cacheBarVisible = !this.cacheBarVisible;
            cacheBar.classList.toggle('hidden', !this.cacheBarVisible);

            if (toggleBtn) {
                toggleBtn.classList.toggle('active', this.cacheBarVisible);
            }
            
            this.updateBarPositions(root);
        }
    }

    private setupLoggingUI(root: ShadowRoot) {
        // Generate theme checkboxes
        const themesGrid = root.querySelector('#themes-grid');
        if (themesGrid) {
            themesGrid.innerHTML = '';
            const config = Logger.getConfig();
            
            Object.values(LogTheme).forEach(theme => {
                const themeConfig = THEME_CONFIGS[theme];
                const isEnabled = config.enabledThemes.has(theme);
                
                const label = document.createElement('label');
                label.className = `theme-checkbox ${isEnabled ? 'theme-enabled' : ''}`;
                label.title = themeConfig.description;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isEnabled;
                checkbox.dataset.theme = theme;
                
                const icon = document.createElement('span');
                icon.className = 'theme-icon';
                icon.textContent = themeConfig.icon;
                
                const text = document.createElement('span');
                text.className = 'theme-label';
                text.textContent = theme;
                text.style.color = isEnabled ? themeConfig.color : '';
                
                label.appendChild(checkbox);
                label.appendChild(icon);
                label.appendChild(text);
                themesGrid.appendChild(label);
                
                checkbox.addEventListener('change', () => {
                    Logger.setThemeEnabled(theme, checkbox.checked);
                    label.classList.toggle('theme-enabled', checkbox.checked);
                    text.style.color = checkbox.checked ? themeConfig.color : '';
                    this.updateLogsStats(root);
                });
            });
        }

        // Setup logging control event listeners
        const levelSelect = root.querySelector('#log-level-select') as HTMLSelectElement;
        if (levelSelect) {
            levelSelect.value = String(Logger.getConfig().logLevel);
            levelSelect.addEventListener('change', () => {
                Logger.setLogLevel(parseInt(levelSelect.value) as LogLevel);
                const selectedOption = levelSelect.selectedOptions[0];
                if (selectedOption) {
                    this.showNotification(root, `Log level set to ${selectedOption.text}`);
                }
            });
        }

        const timestampCheckbox = root.querySelector('#logs-timestamp') as HTMLInputElement;
        if (timestampCheckbox) {
            timestampCheckbox.checked = Logger.getConfig().showTimestamp;
            timestampCheckbox.addEventListener('change', () => {
                Logger.setShowTimestamp(timestampCheckbox.checked);
            });
        }

        const prefixCheckbox = root.querySelector('#logs-prefix') as HTMLInputElement;
        if (prefixCheckbox) {
            prefixCheckbox.checked = Logger.getConfig().showThemePrefix;
            prefixCheckbox.addEventListener('change', () => {
                Logger.setShowThemePrefix(prefixCheckbox.checked);
            });
        }

        const allThemesBtn = root.querySelector('#logs-themes-all') as HTMLButtonElement;
        if (allThemesBtn) {
            allThemesBtn.addEventListener('click', () => {
                Object.values(LogTheme).forEach(theme => {
                    Logger.setThemeEnabled(theme, true);
                });
                this.setupLoggingUI(root); // Refresh UI
                this.updateLogsStats(root);
                this.showNotification(root, 'All themes enabled');
            });
        }

        const noneThemesBtn = root.querySelector('#logs-themes-none') as HTMLButtonElement;
        if (noneThemesBtn) {
            noneThemesBtn.addEventListener('click', () => {
                Object.values(LogTheme).forEach(theme => {
                    Logger.setThemeEnabled(theme, false);
                });
                this.setupLoggingUI(root); // Refresh UI
                this.updateLogsStats(root);
                this.showNotification(root, 'All themes disabled');
            });
        }

        const clearBtn = root.querySelector('#logs-clear-btn') as HTMLButtonElement;
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                Logger.clearLogs();
                this.updateLogsStats(root);
                this.showNotification(root, 'Logs cleared');
            });
        }

        const exportJsonBtn = root.querySelector('#logs-export-json-btn') as HTMLButtonElement;
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                this.exportLogs('json');
            });
        }

        const exportTextBtn = root.querySelector('#logs-export-text-btn') as HTMLButtonElement;
        if (exportTextBtn) {
            exportTextBtn.addEventListener('click', () => {
                this.exportLogs('text');
            });
        }

        const statsBtn = root.querySelector('#logs-stats-btn') as HTMLButtonElement;
        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                const stats = Logger.getStats();
                const message = `Logs: ${stats.totalLogs} total, ${stats.errors} errors, ${stats.warnings} warnings`;
                this.showNotification(root, message, 5000);
                
                Logger.info(LogTheme.DEBUG, '=== Logger Statistics ===');
                Logger.info(LogTheme.DEBUG, `Total logs: ${stats.totalLogs}`);
                Logger.info(LogTheme.DEBUG, `Errors: ${stats.errors}`);
                Logger.info(LogTheme.DEBUG, `Warnings: ${stats.warnings}`);
                Logger.info(LogTheme.DEBUG, 'By theme:', stats.byTheme);
                Logger.info(LogTheme.DEBUG, 'By level:', stats.byLevel);
            });
        }
    }

    private toggleLogsBar(root: ShadowRoot) {
        const logsBar = root.querySelector('#logs-bar') as HTMLElement;
        const toggleBtn = root.querySelector('#logs-bar-toggle') as HTMLButtonElement;

        if (logsBar) {
            this.logsBarVisible = !this.logsBarVisible;
            logsBar.classList.toggle('hidden', !this.logsBarVisible);

            if (toggleBtn) {
                toggleBtn.classList.toggle('active', this.logsBarVisible);
            }
            
            this.updateBarPositions(root);
        }
    }

    private updateLogsStats(root: ShadowRoot) {
        const stats = Logger.getStats();
        const config = Logger.getConfig();

        const statusIndicator = root.querySelector('#logs-status') as HTMLElement;
        const totalBadge = root.querySelector('#logs-total') as HTMLElement;
        const errorsBadge = root.querySelector('#logs-errors') as HTMLElement;
        const warningsBadge = root.querySelector('#logs-warnings') as HTMLElement;

        if (statusIndicator) {
            const hasEnabled = config.enabledThemes.size > 0;
            statusIndicator.textContent = hasEnabled ? 'ON' : 'OFF';
            statusIndicator.className = `status-indicator ${hasEnabled ? 'enabled' : 'disabled'}`;
        }

        if (totalBadge) {
            totalBadge.textContent = String(stats.totalLogs);
        }

        if (errorsBadge) {
            errorsBadge.textContent = String(stats.errors);
        }

        if (warningsBadge) {
            warningsBadge.textContent = String(stats.warnings);
        }
    }

    private exportLogs(format: 'json' | 'text') {
        const logs = Logger.exportLogs(format);
        const blob = new Blob([logs], { type: format === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(
            this.shadowRoot as ShadowRoot,
            `Logs exported as ${format.toUpperCase()}`
        );
    }

    private setupStoryDebug(root: ShadowRoot) {
        const storyBar = root.querySelector('#story-bar') as HTMLElement;
        if (storyBar && !this.storyDebugComponent) {
            this.storyDebugComponent = document.createElement('story-debug') as StoryDebug;
            storyBar.appendChild(this.storyDebugComponent);
        }
    }

    private toggleStoryBar(root: ShadowRoot) {
        const storyBar = root.querySelector('#story-bar') as HTMLElement;
        const toggleBtn = root.querySelector('#story-bar-toggle') as HTMLButtonElement;

        if (storyBar) {
            this.storyBarVisible = !this.storyBarVisible;
            storyBar.classList.toggle('hidden', !this.storyBarVisible);

            if (toggleBtn) {
                toggleBtn.classList.toggle('active', this.storyBarVisible);
            }
            
            this.updateBarPositions(root);
        }
    }
    
    private updateBarPositions(root: ShadowRoot) {
        const mainBarHeight = 28; // Height of main bar
        const subBarHeight = 32; // Height of each sub bar
        
        const cacheBar = root.querySelector('#cache-bar') as HTMLElement;
        const logsBar = root.querySelector('#logs-bar') as HTMLElement;
        const storyBar = root.querySelector('#story-bar') as HTMLElement;
        
        let currentTop = mainBarHeight;
        
        // Position cache bar
        if (cacheBar && !cacheBar.classList.contains('hidden')) {
            cacheBar.style.top = `${currentTop}px`;
            currentTop += subBarHeight;
        }
        
        // Position logs bar
        if (logsBar && !logsBar.classList.contains('hidden')) {
            logsBar.style.top = `${currentTop}px`;
            currentTop += subBarHeight;
        }
        
        // Position story bar
        if (storyBar && !storyBar.classList.contains('hidden')) {
            storyBar.style.top = `${currentTop}px`;
        }
    }
}

customElements.define('development-ui', DevelopmentUI);