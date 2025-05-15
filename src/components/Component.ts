import { EventBus } from "../common/events";

export abstract class Component extends HTMLElement {
    protected hasCss = false;
    protected hasHtml = false;
    protected eventBus = new EventBus();
    protected listen = this.eventBus.listen.bind(this.eventBus);
    protected dispatch = this.eventBus.dispatch.bind(this.eventBus);

    // Static caches shared by all subclasses
    private static styleSheetCache = new Map<string, Promise<CSSStyleSheet>>();
    private static templateCache = new Map<string, Promise<HTMLTemplateElement>>();

    async connectedCallback() {
        if (this.shadowRoot) return;  // already initialized

        const root = this.attachShadow({ mode: 'closed' });
        const name = this.constructor.name.toLowerCase();
        const cssPromise = this.loadCss(name);
        const templatePromise = this.loadHtml(name);
        // Await both in parallel
        const [styleSheets, template] = await Promise.all([cssPromise, templatePromise]);

        if (styleSheets) {
            if (Array.isArray(styleSheets)) {
                root.adoptedStyleSheets = styleSheets;
            } else {
                root.adoptedStyleSheets = [styleSheets];
            }
        }
        if (template) {
            root.append(template.content.cloneNode(true));
        }
        return root;
    }

    private loadCss(name: string) {
        if (!this.hasCss) {
            return;
        }

        const cssUrl = new URL(`./${name}/${name}.css`, import.meta.url).href.replace('/js/', '/css/');
        let cssPromise = Component.styleSheetCache.get(name);
        if (!cssPromise) {
            cssPromise = this.createStyleSheet(cssUrl);
            Component.styleSheetCache.set(name, cssPromise);
        }

        return cssPromise;
    }

    private loadHtml(name: string) {
        if (!this.hasHtml) {
            return;
        }
        const templateUrl = new URL(`./${name}/${name}.html`, import.meta.url).href.replace('/js/', '/html/');
        let templatePromise = Component.templateCache.get(templateUrl);
        if (!templatePromise) {
            templatePromise = this.createTemplate(templateUrl);
            Component.templateCache.set(templateUrl, templatePromise);
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
    private async createTemplate(url: string): Promise<HTMLTemplateElement> {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed to load template ${url}: ${res.statusText}`);
            throw new Error(`Template load error: ${res.status}`);
        }
        const html = await res.text();
        const tmpl = document.createElement('template');
        tmpl.innerHTML = html;
        return tmpl;
    }
}