import type { DeepReadonly } from "./helpers/types";
import type { ICharacter } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
    ActionEvent, ActionEventsMap,
    StateChangeEventsMap,
    GameEvent, GameEventsMap,
} from "./events";
import { InteractionModeManager } from "./InteractionModeManager";
import { DirectionsService } from "./services/DirectionsService";
import {
    MeleeCombatService,
    MELEE_ATTACKS,
    type MeleeAttackType,
    type VisibleMeleeTarget
} from "./services/MeleeCombatService";

export interface MeleeCombatData {
    attacker: DeepReadonly<ICharacter>;
    defender: DeepReadonly<ICharacter>;
    attackType: MeleeAttackType;
    defenseType?: MeleeAttackType;
    damage?: number;
    blocked?: boolean;
}

export class MeleeCombat extends EventBus<
    ControlsEventsMap & StateChangeEventsMap & ActionEventsMap,
    ControlsEventsMap & UpdateStateEventsMap & ActionEventsMap & GameEventsMap
> {
    private static instance: MeleeCombat | null = null;
    private attackingCharacter?: DeepReadonly<ICharacter>;
    private selectedAttackType?: MeleeAttackType;
    private validTargets: VisibleMeleeTarget[] = [];
    private modeManager: InteractionModeManager;
    private pendingCombat?: MeleeCombatData;

    private constructor(
        private state: State,
    ) {
        super();
        this.modeManager = InteractionModeManager.getInstance();

        this.modeManager.registerCleanupHandler('melee', () => {
            this.cleanupMeleeMode();
        });

        this.setupEventListeners();
    }

    public static initialize(state: State): void {
        if (!MeleeCombat.instance) {
            MeleeCombat.instance = new MeleeCombat(state);
        }
    }

    public static getInstance(): MeleeCombat {
        if (!MeleeCombat.instance) {
            throw new Error('MeleeCombat not initialized. Call MeleeCombat.initialize(state) first.');
        }
        return MeleeCombat.instance;
    }

    public static resetInstance(): void {
        if (MeleeCombat.instance) {
            MeleeCombat.instance = null;
        }
    }

    private setupEventListeners() {
        // Listen for melee toggle
        this.listen(ControlsEvent.toggleMelee, (/*characterName: string*/) => {
            // Toggle melee is handled by the BottomBar, just dispatch the event
            // The bottom bar will show/hide melee actions
        });

        MELEE_ATTACKS.forEach(attack => {
            const eventKey = ControlsEvent[attack.type];

            this.listen(eventKey, (data) => {
                if (typeof data === 'string') {
                    this.onMeleeAttackSelected(data, attack.type);
                }
            });
        });

        this.listen(ControlsEvent.characterClick, data => this.onCharacterClick(data));

        this.listen(ControlsEvent.meleeDefenseSelected, data => {
            this.resolveMeleeCombat(data.defenseType);
        });

        this.listen(ControlsEvent.mousePositionUpdate, data => this.onMousePositionUpdate(data));
    }

    private onMeleeAttackSelected(characterName: string, attackType: MeleeAttackType) {
        const character = this.state.findCharacter(characterName);
        if (!character) {
            return;
        }

        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            return;
        }

        const attack = MeleeCombatService.getAttackOption(attackType);
        if (!attack) {
            return;
        }

        if (!MeleeCombatService.canPerformAttack(character, attackType)) {
            this.dispatch(ActionEvent.error, `Not enough action points. Need ${attack.apCost}, have ${character.actions.pointsLeft}`);
            return;
        }

        this.attackingCharacter = character;
        this.selectedAttackType = attackType;
        this.validTargets = MeleeCombatService.findMeleeTargets(character, this.state.characters);

        if (this.validTargets.length === 0) {
            this.dispatch(ActionEvent.error, 'No valid targets in melee range');
            this.cleanupMeleeMode();
            return;
        }

        this.modeManager.requestModeChange({ type: 'melee', data: undefined });

        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: characterName,
            cost: attack.apCost
        });

        this.showMeleeTargets();
    }

    private showMeleeTargets() {
        if (!this.attackingCharacter || this.validTargets.length === 0) return;

        const weapon = MeleeCombatService.getMeleeWeapon(this.attackingCharacter);
        const weaponClass = weapon?.class || 'unarmed';

        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.attackingCharacter.name,
            visualState: {
                temporaryClasses: ['melee-ready'],
                weaponClass: weaponClass
            }
        });

        const highlights = this.validTargets.map(target => ({
            position: target.character.position,
            type: 'melee-target' as const
        }));

        this.dispatch(UpdateStateEvent.uiHighlights, {
            meleeTargets: highlights
        });

        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'melee',
            data: {
                attacker: this.attackingCharacter.name,
                attackType: this.selectedAttackType,
                targets: this.validTargets.map(t => t.character.name)
            }
        });
    }

    private onMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]) {
        const { characterName, mouseCoord } = data;

        if (!this.attackingCharacter || this.attackingCharacter.name !== characterName) {
            return;
        }

        if (this.modeManager.getCurrentMode()?.type !== 'melee') {
            return;
        }

        const character = this.state.findCharacter(characterName);
        if (!character) {
            return;
        }

        const newDirection = DirectionsService.getDirectionFromCoords(
            character.position,
            mouseCoord
        );

        if (character.direction === newDirection) {
            return;
        }

        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName: characterName,
            direction: newDirection
        });

        const updatedCharacter = this.state.findCharacter(characterName);
        if (updatedCharacter) {
            this.attackingCharacter = updatedCharacter;
            this.showMeleeTargets();
        }
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        if (this.modeManager.getCurrentMode()?.type !== 'melee') {
            return;
        }

        if (!this.attackingCharacter || !this.selectedAttackType) {
            return;
        }

        const target = this.validTargets.find(t => t.character.name === data.characterName);
        if (!target) {
            this.dispatch(ActionEvent.error, 'Invalid target for melee attack');
            return;
        }

        this.initiateMeleeCombat(this.attackingCharacter, target.character, this.selectedAttackType);
    }

    private initiateMeleeCombat(
        attacker: DeepReadonly<ICharacter>,
        defender: DeepReadonly<ICharacter>,
        attackType: MeleeAttackType
    ) {
        this.pendingCombat = {
            attacker,
            defender,
            attackType
        };

        const weapon = MeleeCombatService.getMeleeWeapon(attacker);
        const weaponClass = weapon?.class || 'unarmed';

        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: attacker.name,
            visualState: {
                temporaryClasses: ['melee-ready', 'melee-attack', attackType],
                weaponClass: weaponClass
            }
        });

        setTimeout(() => {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: attacker.name,
                visualState: {
                    temporaryClasses: [],
                    weaponClass: undefined
                }
            });
        }, 800);

        this.dispatch(UpdateStateEvent.uiMeleeDefense, {
            attacker: attacker.name,
            defender: defender.name,
            attackType: attackType,
            weaponInfo: {
                attackerWeapon: MeleeCombatService.getMeleeWeapon(attacker)?.name || 'Unarmed',
                defenderWeapon: MeleeCombatService.getMeleeWeapon(defender)?.name || 'Unarmed'
            }
        });

        this.cleanupMeleeMode();
    }

    private resolveMeleeCombat(defenseType: MeleeAttackType) {
        if (!this.pendingCombat) {
            return;
        }

        const { attacker, defender, attackType } = this.pendingCombat;
        const { damage, blocked } = MeleeCombatService.calculateMeleeDamage(
            attacker,
            defender,
            attackType,
            defenseType
        );

        const attack = MeleeCombatService.getAttackOption(attackType);
        if (attack) {
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: attacker.name,
                actionId: attackType,
                cost: attack.apCost
            });
        }

        if (!blocked && damage > 0) {
            this.dispatch(UpdateStateEvent.damageCharacter, {
                targetName: defender.name,
                damage: damage,
                attackerName: attacker.name
            });

            // Dispatch successful melee hit for AI context
            this.dispatch(GameEvent.combatEvent, {
                type: 'combat',
                actor: attacker.name,
                target: defender.name,
                description: `${attacker.name} hit ${defender.name} with melee attack (${attackType}) for ${damage} damage`,
                turn: this.state.game.turn
            });
        } else if (blocked) {
            // Dispatch blocked attack for AI context
            this.dispatch(GameEvent.combatEvent, {
                type: 'combat',
                actor: attacker.name,
                target: defender.name,
                description: `${defender.name} blocked ${attacker.name}'s melee attack (${attackType} vs ${defenseType})`,
                turn: this.state.game.turn
            });
        }

        this.dispatch(UpdateStateEvent.uiMeleeCombatResult, {
            attacker: attacker.name,
            defender: defender.name,
            attackType,
            defenseType,
            damage,
            blocked
        });

        this.pendingCombat = undefined;
    }

    private cleanupMeleeMode() {
        if (this.attackingCharacter) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: this.attackingCharacter.name,
                visualState: {
                    temporaryClasses: [],
                    weaponClass: undefined
                }
            });

            this.dispatch(UpdateStateEvent.setPendingActionCost, {
                characterName: this.attackingCharacter.name,
                cost: 0
            });
        }

        this.attackingCharacter = undefined;
        this.selectedAttackType = undefined;
        this.validTargets = [];

        this.dispatch(UpdateStateEvent.uiHighlights, {
            meleeTargets: []
        });
    }
}