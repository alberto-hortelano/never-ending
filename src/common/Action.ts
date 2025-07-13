import type { ICharacterActions, ICharacter } from "./interfaces";
import type { DeepReadonly } from "./helpers/types";

import {
    EventBus, StateChangeEvent, StateChangeEventsMap, UpdateStateEvent, UpdateStateEventsMap,
    ControlsEvent, ControlsEventsMap, ActionEvent, ActionEventsMap, ActionItem, ActionCategory, ActionUpdateData
} from "./events";
import { State } from "./State";

export class Action extends EventBus<
    StateChangeEventsMap & ActionEventsMap & ControlsEventsMap,
    UpdateStateEventsMap & ActionEventsMap & ControlsEventsMap
> {
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

    private state: State;
    private characterActionsMap = new Map<string, DeepReadonly<ICharacterActions>>();

    constructor(state: State) {
        super();
        this.state = state;

        // Listen for action requests (when component needs actions for a character)
        this.listen(ActionEvent.request, (characterName: string) => {
            console.log('>>> - ActionEvent.request - characterName:', characterName)
            this.handleActionRequest(characterName);
        });

        // Listen for character action updates from state
        this.listen(StateChangeEvent.characterActions, (character) => {
            console.log('>>> - this.listen - character:', character)
            // Update our cache
            this.characterActionsMap.set(character.name, character.actions);

            // Notify any listening components about this character's updated actions
            const updateData: ActionUpdateData = {
                categories: this.getActionsWithCosts(),
                characterName: character.name,
                characterActions: character.actions
            };
            this.dispatch(ActionEvent.update, updateData);
        });

        // Listen for action selection requests
        this.listen(ActionEvent.selected, (data) => {
            this.handleActionSelected(data.action, data.characterName);
        });
    }

    private handleActionRequest(characterName: string): void {
        // Try to get from cache first
        let characterActions = this.characterActionsMap.get(characterName);

        // If not in cache, try to find in state
        if (!characterActions) {
            const character = this.findCharacterInState(characterName);
            if (character) {
                characterActions = character.actions;
                this.characterActionsMap.set(characterName, characterActions);
            }
        }

        // Send update if we have the data
        if (characterActions) {
            const updateData: ActionUpdateData = {
                categories: this.getActionsWithCosts(),
                characterName: characterName,
                characterActions: characterActions
            };
            console.log('>>> - handleActionRequest - updateData:', updateData)
            this.dispatch(ActionEvent.update, updateData);
        } else {
            this.dispatch(ActionEvent.error, `Character ${characterName} not found`);
        }
    }

    private findCharacterInState(characterName: string): DeepReadonly<ICharacter> | undefined {
        return this.state.characters.find(char => char.name === characterName);
    }

    private getActionsWithCosts(): ActionCategory[] {
        // Return a deep copy with cost information included
        return JSON.parse(JSON.stringify(Action.DEFAULT_ACTIONS));
    }

    private getActionCost(actionId: string, characterActions: DeepReadonly<ICharacterActions>): number {
        const actionCosts: Record<string, number> = {
            // General
            'move': characterActions.general.move,
            'talk': characterActions.general.talk,
            'use': characterActions.general.use,
            'rotate': characterActions.general.rotate,
            'inventory': characterActions.general.inventory,
            // Ranged Combat
            'shoot': characterActions.rangedCombat.shoot,
            'aim': characterActions.rangedCombat.aim,
            'suppress': characterActions.rangedCombat.suppress,
            'cover': characterActions.rangedCombat.cover,
            'throw': characterActions.rangedCombat.throw,
            // Close Combat
            'power-strike': characterActions.closeCombat.powerStrike,
            'slash': characterActions.closeCombat.slash,
            'fast-attack': characterActions.closeCombat.fastAttack,
            'feint': characterActions.closeCombat.feint,
            'break-guard': characterActions.closeCombat.breakGuard
        };

        return actionCosts[actionId] || 0;
    }

    private handleActionSelected(actionId: string, characterName: string): void {
        const characterActions = this.characterActionsMap.get(characterName);
        if (!characterActions) {
            this.dispatch(ActionEvent.error, 'Character actions not found');
            return;
        }

        const cost = this.getActionCost(actionId, characterActions);
        const pointsLeft = characterActions.pointsLeft;

        // Check if player has enough points
        if (cost > pointsLeft) {
            console.warn(`Not enough action points for ${actionId}. Cost: ${cost}, Available: ${pointsLeft}`);
            this.dispatch(ActionEvent.error, `Not enough action points. Cost: ${cost}, Available: ${pointsLeft}`);
            return;
        }

        // Find the action item
        const action = this.findActionById(actionId);
        if (!action) {
            this.dispatch(ActionEvent.error, 'Action not found');
            return;
        }

        // For actions that don't have their own handlers yet, deduct points here
        if (cost > 0 && ['use', 'aim', 'suppress', 'cover', 'throw', 'power-strike', 'slash', 'fast-attack', 'feint', 'break-guard'].includes(actionId)) {
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: characterName,
                actionId: actionId,
                cost: cost
            });
        }

        // Dispatch the action's associated event
        this.dispatch(action.event, characterName);
    }

    private findActionById(actionId: string): ActionItem | undefined {
        for (const category of Action.DEFAULT_ACTIONS) {
            const action = category.actions.find(a => a.id === actionId);
            if (action) return action;
        }
        return undefined;
    }
}