import { EventBus, ComponentEventsMap, GameEventsMap, ControlsEventsMap } from "../../common/events";

export abstract class Component extends HTMLElement {
    protected hasCss = false;
    protected hasHtml = false;
    protected eventBus = new EventBus<ComponentEventsMap & GameEventsMap & ControlsEventsMap, ComponentEventsMap & GameEventsMap & ControlsEventsMap>();
    protected listen = this.eventBus.listen.bind(this.eventBus);
    protected dispatch = this.eventBus.dispatch.bind(this.eventBus);

    // Static caches shared by all subclasses
    private static styleSheetCache = new Map<string, Promise<CSSStyleSheet>>();
    private static templateCache = new Map<string, Promise<HTMLTemplateElement>>();

    async connectedCallback() {
        if (this.shadowRoot) return;  // already initialized

        const root = this.attachShadow({ mode: 'closed' });
        const ancestors = this.getParents();
        const styleSheetPromises: Promise<CSSStyleSheet>[] = [];
        const templatePromises: Promise<HTMLTemplateElement>[] = [];

        ancestors.forEach(componentName => {
            const component = document.createElement(`${componentName}-component`) as Component;
            if (!component) return;

            if (component.hasCss) {
                const styleSheet = this.loadCss(componentName);
                if (styleSheet) styleSheetPromises.push(styleSheet);
            }
            if (component.hasHtml) {
                const template = this.loadHtml(componentName);
                if (template) templatePromises.push(template);
            }
        });

        const [styleSheets, templates] = await Promise.all([
            Promise.all(styleSheetPromises),
            Promise.all(templatePromises),
        ]);

        if (styleSheets.length > 0) {
            root.adoptedStyleSheets = styleSheets;
        }

        templates.forEach(template => {
            const slots = root.querySelectorAll('slot');
            if (slots.length > 0) {
                // Use the last unnamed slot for inserting child content
                const targetSlot = slots[slots.length - 1];
                const fragment = template.content.cloneNode(true);

                // Replace the slot with the new content
                targetSlot?.parentNode?.replaceChild(fragment, targetSlot);
            } else {
                // No slots found, just append to the root
                root.append(template.content.cloneNode(true));
            }
        });
        return root;
    }

    private getParents() {
        const ctorChain: string[] = [];
        let ctor = this.constructor;
        while (ctor.prototype instanceof Component) {
            ctorChain.unshift(ctor.name.toLowerCase());
            ctor = Object.getPrototypeOf(ctor.prototype).constructor;
        }
        return ctorChain;
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
        let templatePromise = Component.templateCache.get(name);
        if (!templatePromise) {
            templatePromise = this.createTemplate(name);
            Component.templateCache.set(name, templatePromise);
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
    private async createTemplate(name: string): Promise<HTMLTemplateElement> {
        const url = new URL(`./${name}/${name}.html`, import.meta.url).href.replace('/js/', '/html/');
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed to load template ${url}: ${res.statusText}`);
            throw new Error(`Template load error: ${res.status}`);
        }
        const html = await res.text();
        const tmpl = document.createElement('template');
        tmpl.id = name;
        tmpl.innerHTML = html;
        return tmpl;
    }
}
