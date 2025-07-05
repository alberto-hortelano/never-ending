import { ControlsEvent } from "../events";

export interface ActionItem {
    id: string;
    label: string;
    icon: string;
    event: ControlsEvent;
}

export interface ActionCategory {
    name: string;
    actions: ActionItem[];
}

export class ActionsRegistry {
    private static readonly DEFAULT_ACTIONS: ActionCategory[] = [
        {
            name: "General",
            actions: [
                { id: "move", label: "Move", icon: "🚶", event: ControlsEvent.showMovement },
                { id: "talk", label: "Talk", icon: "💬", event: ControlsEvent.talk },
                { id: "use", label: "Use", icon: "✋", event: ControlsEvent.use },
                { id: "rotate", label: "Rotate", icon: "🔄", event: ControlsEvent.rotate },
                { id: "inventory", label: "Inventory", icon: "🎒", event: ControlsEvent.inventory }
            ]
        },
        {
            name: "Ranged Combat",
            actions: [
                { id: "shoot", label: "Shoot", icon: "🔫", event: ControlsEvent.showShooting },
                { id: "aim", label: "Aim", icon: "🎯", event: ControlsEvent.showMovement },
                { id: "suppress", label: "Suppress", icon: "💥", event: ControlsEvent.showMovement },
                { id: "cover", label: "Cover", icon: "🛡️", event: ControlsEvent.showMovement },
                { id: "throw", label: "Throw", icon: "🤾", event: ControlsEvent.showMovement }
            ]
        },
        {
            name: "Close Combat",
            actions: [
                { id: "power-strike", label: "Power Strike", icon: "💪", event: ControlsEvent.showMovement },
                { id: "slash", label: "Slash", icon: "⚔️", event: ControlsEvent.showMovement },
                { id: "fast-attack", label: "Fast Attack", icon: "⚡", event: ControlsEvent.showMovement },
                { id: "feint", label: "Feint", icon: "🎭", event: ControlsEvent.showMovement },
                { id: "break-guard", label: "Break Guard", icon: "🔨", event: ControlsEvent.showMovement }
            ]
        }
    ];

    public static getDefaultActions(): ActionCategory[] {
        // Return a deep copy to prevent mutation
        return JSON.parse(JSON.stringify(this.DEFAULT_ACTIONS));
    }
}