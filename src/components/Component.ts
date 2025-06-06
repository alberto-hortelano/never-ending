import { EventBus, GUIEventsMap, GameEventsMap, ControlsEventsMap, StateChangeEventsMap, UpdateStateEventsMap } from "../common/events";

export abstract class Component extends HTMLElement {
    protected name = this.constructor.name.toLowerCase();
    protected hasCss: boolean | string[] = false;
    protected hasHtml: boolean | string[] = false;
    protected eventBus = new EventBus<
        GUIEventsMap & GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
        GUIEventsMap & GameEventsMap & ControlsEventsMap & UpdateStateEventsMap
    >();
    protected listen = this.eventBus.listen.bind(this.eventBus);
    protected dispatch = this.eventBus.dispatch.bind(this.eventBus);

    // Static caches shared by all subclasses
    private static styleSheetCache = new Map<string, Promise<CSSStyleSheet>>();
    private static templateCache = new Map<string, Promise<HTMLTemplateElement>>();

    async connectedCallback() {
        if (this.shadowRoot) return;  // already initialized

        const root = this.attachShadow({ mode: 'closed' });
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

    private loadCss() {
        if (!this.hasCss) {
            return;
        }
        const cssUrl = new URL(`./${this.name}/${this.name}.css`, import.meta.url).href.replace('/js/', '/css/');
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
        const url = new URL(`./${this.name}/${this.name}.html`, import.meta.url).href.replace('/js/', '/html/');
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