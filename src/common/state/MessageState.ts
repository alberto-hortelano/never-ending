import type { IState } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

export class MessageState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #messages: IState['messages'] = [];
    private onSave?: () => void;

    constructor(onSave?: () => void) {
        super();
        this.onSave = onSave;
        this.listen(UpdateStateEvent.updateMessages, (messages) => this.onUpdateMessages(messages));
    }

    private onUpdateMessages(messages: UpdateStateEventsMap[UpdateStateEvent.updateMessages]) {
        this.#messages = [...messages];
        this.dispatch(StateChangeEvent.messages, structuredClone(this.#messages));
        this.onSave?.();
    }

    set messages(messages: IState['messages']) {
        this.#messages = messages;
        this.onSave?.();
    }

    get messages(): DeepReadonly<IState['messages']> {
        return this.#messages;
    }
}