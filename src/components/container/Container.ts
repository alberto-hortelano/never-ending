import { Component } from "../Component";
import { StateChangeEvent } from "../../common/events";
import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter } from "../../common/interfaces";

export default class Container extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Initialize character manager (singleton will handle events)
        // The character manager is created as a singleton and will start listening to events automatically

        // Listen for selected character to show/hide rotate selector
        this.listen(StateChangeEvent.selectedCharacter, (character: DeepReadonly<ICharacter> | null) => {
            const rotateSelector = root.querySelector('.fixed-rotate') as HTMLElement;
            if (rotateSelector) {
                rotateSelector.style.display = character ? 'block' : 'none';
            }
        });

        return root;
    }
}

customElements.define('container-component', Container);
