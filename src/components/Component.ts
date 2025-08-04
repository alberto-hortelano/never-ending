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
        if (this.shadowRoot) return;  // already initialized

        const root = this.attachShadow({ mode: 'closed' });
        
        // Store reference for testing if in test environment
        if (typeof window !== 'undefined' && (window as any).__PLAYWRIGHT_TEST__) {
            this._testingShadowRoot = root;
        }
        
        const styleSheetPromise = this.loadCss();
        const templatePromise = this.loadHtml();

        const [styleSheet, template] = await Promise.all([
            styleSheetPromise,
            templatePromise,
        ]);
        if (template) {
            root.append(template.content.cloneNode(true));
        }

        if (styleSheet) {
            root.adoptedStyleSheets = [styleSheet];
        }

        return root;
    }
    
    // Method to access shadow root in tests
    public getTestingShadowRoot(): ShadowRoot | null {
        if (typeof window !== 'undefined' && (window as any).__PLAYWRIGHT_TEST__) {
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
        const cssUrl = new URL(`./${this.name.toLowerCase()}/${this.name}.css`, (import.meta as any).url).href.replace('/js/components/', '/css/components/');
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
            console.error(`Failed to load stylesheet ${url}: ${res.statusText}`);
            throw new Error(`Stylesheet load error: ${res.status}`);
        }
        const cssText = await res.text();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        return sheet;
    }

    // Helper to fetch and build an HTMLTemplateElement
    private async createTemplate(): Promise<HTMLTemplateElement> {
        const url = new URL(`./${this.name.toLowerCase()}/${this.name}.html`, (import.meta as any).url).href.replace('/js/components/', '/html/components/');
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed to load template ${url}: ${res.statusText}`);
            throw new Error(`Template load error: ${res.status}`);
        }
        const html = await res.text();
        const tmpl = document.createElement('template');
        tmpl.id = this.name;
        tmpl.innerHTML = html;
        return tmpl;
    }
}