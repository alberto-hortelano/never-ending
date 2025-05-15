// import { BaseEvent } from "../../common/events";
import { Component } from "../Component";

export default class Container extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
}

customElements.define('container-component', Container);
