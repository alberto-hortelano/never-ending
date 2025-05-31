import { EventBus, GUIEventsMap, GameEventsMap, ControlsEventsMap } from "../../common/events";

export abstract class Component extends HTMLElement {
    protected hasCss = false;
    protected hasHtml = false;
    protected eventBus = new EventBus<GUIEventsMap & GameEventsMap & ControlsEventsMap, GUIEventsMap & GameEventsMap & ControlsEventsMap>();
    protected listen = this.eventBus.listen.bind(this.eventBus);
    protected dispatch = this.eventBus.dispatch.bind(this.eventBus);

    // Static caches shared by all subclasses
    private static styleSheetCache = new Map<string, Promise<CSSStyleSheet>>();
    private static templateCache = new Map<string, Promise<HTMLTemplateElement>>();

    async connectedCallback() {
        const name = this.constructor.name.toLowerCase();
        console.log('>>> - Component - CREATE:', name)
        let root: ShadowRoot;
        try {
            root = this.attachShadow({ mode: 'closed' });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            console.log('>>> - Component - connectedCallback - error:', name, error)
            return;
        }

        const ancestors = this.getParents();
        console.log('>>> - Component - connectedCallback - ancestors:', this.constructor.name, ancestors)
        const styleSheetPromises: Promise<CSSStyleSheet>[] = [];
        const templatePromises: Promise<HTMLTemplateElement | Component>[] = [];

        const styleSheet = this.loadCss(name);
        if (styleSheet) styleSheetPromises.push(styleSheet);

        const ancestorComponents = ancestors.map(componentName => {
            const component = document.createElement(`${componentName}-component`) as Component;
            if (!component) return;

            if (component.hasCss) {
                const styleSheet = this.loadCss(componentName);
                if (styleSheet) styleSheetPromises.push(styleSheet);
            }
            if (component.hasHtml) {
                const template = this.loadHtml(componentName);
                if (template) templatePromises.push(template);
            } else {
                templatePromises.push(Promise.resolve(component))
            }
            return component;
        }).filter(c => !!c);

        const templatePromise = this.loadHtml(name);

        const [styleSheets, template] = await Promise.all([
            Promise.all(styleSheetPromises),
            templatePromise,
        ]);
        if (template) {
            root.append(template.content.cloneNode(true));
        }

        if (styleSheets.length > 0) {
            root.adoptedStyleSheets = styleSheets;
        }

        let parent: Component;

        ancestorComponents.forEach(ancestor => {
            if (parent) {
                parent.appendChild(ancestor);
            }
            parent = ancestor;
        });
        if (parent!) {
            console.log('>>> - Component - connectedCallback - ancestor:', parent.constructor.name)
            this.replaceWith(parent!);
            parent.appendChild(this);
            console.log('>>> - Component - connectedCallback - parent:', parent)
        }

        return root;
    }

    private getParents() {
        const ctorChain: string[] = [];
        let ctor = this.constructor;
        while (ctor.prototype instanceof Component) {
            const name = ctor.name.toLowerCase()
            if (name !== this.constructor.name.toLowerCase()) {
                ctorChain.unshift(name);
            }
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