import { Component } from "../Component";
import { StateChangeEvent } from "../../common/events";

export default class Container extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Listen for bottom bar expansion state changes
        this.listen(StateChangeEvent.uiBottomBarExpanded, (isExpanded: boolean) => {
            if (isExpanded) {
                this.classList.add('bottom-bar-expanded');
            } else {
                this.classList.remove('bottom-bar-expanded');
            }
        });
        
        return root;
    }
}

customElements.define('container-component', Container);
