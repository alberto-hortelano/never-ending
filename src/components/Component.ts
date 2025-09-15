import { EventBus, EventsMap } from "../common/events";
import type { State } from "../common/State";

export abstract class Component extends HTMLElement {
    protected name = this.constructor.name;
    protected hasCss: boolean | string[] = false;
    protected hasHtml: boolean | string[] = false;
    protected eventBus = new EventBus<EventsMap, EventsMap>();
    protected listen = this.eventBus.listen.bind(this.eventBus);
    protected dispatch = this.eventBus.dispatch.bind(this.eventBus);

    // Store shadow root reference for testing purposes
    private _testingShadowRoot?: ShadowRoot;

    // Static caches shared by all subclasses
    private static styleSheetCache = new Map<string, Promise<CSSStyleSheet>>();
    private static templateCache = new Map<string, Promise<HTMLTemplateElement>>();

    // Static state reference shared by all components
    protected static gameState: State | null = null;

    // Instance-specific state (for preview components)
    private instanceState: State | null = null;

    // Static method to set the game state (called from web.ts)
    public static setGameState(state: State | null): void {
        Component.gameState = state;
    }

    // Method to set instance-specific state (for preview components)
    public setInstanceState(state: State | null): void {
        this.instanceState = state;
    }

    // Protected getter for components to access state
    protected getState(): State | null {
        // Instance state takes precedence over global state
        return this.instanceState || Component.gameState;
    }

    async connectedCallback() {
        try {
            // Check if already initialized
            if (this.shadowRoot) {
                return this.shadowRoot;
            }

            const root = this.attachShadow({ mode: 'closed' });

            // Store reference for testing and internal use
            this._testingShadowRoot = root;

            // Try to load CSS and HTML
            // Load CSS and HTML resources - let errors propagate for critical failures
            const styleSheetPromise = this.loadCss();
            const templatePromise = this.loadHtml();

            const [styleSheet, template] = await Promise.all([
                styleSheetPromise,
                templatePromise,
            ]);

            if (template) {
                root.append(template.content.cloneNode(true));
            } else if (this.hasHtml) {
                // Add a fallback template
                root.innerHTML = '<div>Component loading...</div>';
            }

            if (styleSheet) {
                root.adoptedStyleSheets = [styleSheet];
            }

            return root;
        } catch (error) {
            // Component initialization is critical - fail fast with clear error
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize component ${this.name}: ${errorMessage}`);
        }
    }

    // Method to access shadow root in tests
    public getTestingShadowRoot(): ShadowRoot | null {
        // Note: Using unknown type for Playwright test flag on window
        if (typeof window !== 'undefined' && (window as Window & { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__) {
            return this._testingShadowRoot || null;
        }
        return null;
    }

    private loadCss() {
        if (!this.hasCss) {
            return;
        }
        // Skip loading CSS in test environment
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
            return Promise.resolve(new CSSStyleSheet());
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - import.meta is available at runtime
        const cssUrl = new URL(`./${this.name.toLowerCase()}/${this.name}.css`, import.meta.url).href.replace('/js/components/', '/css/components/');
        let cssPromise = Component.styleSheetCache.get(this.name);
        if (!cssPromise) {
            cssPromise = this.createStyleSheet(cssUrl);
            Component.styleSheetCache.set(this.name, cssPromise);
        }
        return cssPromise;
    }

    private loadHtml() {
        if (!this.hasHtml) {
            return;
        }
        // Skip loading HTML in test environment
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
            const tmpl = document.createElement('template');
            tmpl.id = this.name;
            tmpl.innerHTML = '<div>Test Template</div>';
            return Promise.resolve(tmpl);
        }
        let templatePromise = Component.templateCache.get(this.name);
        if (!templatePromise) {
            templatePromise = this.createTemplate();
            Component.templateCache.set(this.name, templatePromise);
        }
        return templatePromise;
    }

    // Helper to fetch and build a CSSStyleSheet
    private async createStyleSheet(url: string): Promise<CSSStyleSheet> {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to load stylesheet for ${this.name} from ${url}: HTTP ${res.status}`);
        }
        const cssText = await res.text();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        return sheet;
    }

    // Helper to fetch and build an HTMLTemplateElement
    private async createTemplate(): Promise<HTMLTemplateElement> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - import.meta is available at runtime
        const url = new URL(`./${this.name.toLowerCase()}/${this.name}.html`, import.meta.url).href.replace('/js/components/', '/html/components/');
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to load HTML template for ${this.name} from ${url}: HTTP ${res.status}`);
        }
        const html = await res.text();
        const tmpl = document.createElement('template');
        tmpl.id = this.name;
        tmpl.innerHTML = html;
        return tmpl;
    }
}