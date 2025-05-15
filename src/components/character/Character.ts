import Movable from "../movable/Movable";

export default class Character extends Movable {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    // This ensures both parent (Movable) and this component's CSS and HTML are loaded
    override async connectedCallback(): Promise<ShadowRoot | undefined> {
        const shadowRoot = await super.connectedCallback();
        
        // Add any Character-specific initialization here
        console.log('Character component initialized');
        
        return shadowRoot;
    }
}

customElements.define('character-component', Character);
