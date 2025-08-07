import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, IWeapon } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
    ActionEvent, ActionEventsMap,
    StateChangeEventsMap,
} from "./events";
import { InteractionModeManager } from "./InteractionModeManager";
import { DirectionsService } from "./services/DirectionsService";

export type MeleeAttackType = 'power-strike' | 'slash' | 'fast-attack' | 'feint' | 'break-guard' | 'special';

export interface MeleeAttackOption {
    type: MeleeAttackType;
    displayName: string;
    angle: number;
    apCost: number;
    description: string;
}

export interface MeleeCombatData {
    attacker: DeepReadonly<ICharacter>;
    defender: DeepReadonly<ICharacter>;
    attackType: MeleeAttackType;
    defenseType?: MeleeAttackType;
    damage?: number;
    blocked?: boolean;
}

export interface VisibleMeleeTarget {
    character: DeepReadonly<ICharacter>;
    distance: number;
    canAttack: boolean;
}

const MELEE_CONSTANTS = {
    DEFAULT_UNARMED_DAMAGE: 5,
    DEFAULT_UNARMED_RANGE: 1,
    BLOCK_DAMAGE_MULTIPLIER: 0,
    OPPOSITE_DAMAGE_MULTIPLIER: 1.0,
    ADJACENT_DAMAGE_MULTIPLIER: 0.33,
    TWO_AWAY_DAMAGE_MULTIPLIER: 0.66,
    UNARMED_DEFENSE_PENALTY: 2.0,
    WEAPON_CLASS_MODIFIERS: {
        'sword': { 'sword': 1.0, 'polearm': 0.8, 'knife': 1.2 },
        'polearm': { 'sword': 1.2, 'polearm': 1.0, 'knife': 1.4 },
        'knife': { 'sword': 0.8, 'polearm': 0.6, 'knife': 1.0 },
    } as Record<string, Record<string, number>>,
} as const;

export const MELEE_ATTACKS: MeleeAttackOption[] = [
    { type: 'power-strike', displayName: 'Power Strike', angle: 0, apCost: 20, description: 'Heavy overhead strike' },
    { type: 'slash', displayName: 'Slash', angle: 60, apCost: 20, description: 'Horizontal slash' },
    { type: 'fast-attack', displayName: 'Fast Attack', angle: 120, apCost: 15, description: 'Quick jab' },
    { type: 'break-guard', displayName: 'Break Guard', angle: 180, apCost: 20, description: 'Guard-breaking thrust' },
    { type: 'feint', displayName: 'Feint', angle: 240, apCost: 15, description: 'Deceptive attack' },
    { type: 'special', displayName: 'Special', angle: 300, apCost: 25, description: 'Unique weapon technique' },
];

export class MeleeCombat extends EventBus<
    ControlsEventsMap & StateChangeEventsMap & ActionEventsMap,
    ControlsEventsMap & UpdateStateEventsMap & ActionEventsMap
> {
    private attackingCharacter?: DeepReadonly<ICharacter>;
    private selectedAttackType?: MeleeAttackType;
    private validTargets: VisibleMeleeTarget[] = [];
    private modeManager: InteractionModeManager;
    private pendingCombat?: MeleeCombatData;

    constructor(
        private state: State,
    ) {
        super();
        this.modeManager = InteractionModeManager.getInstance();

        this.modeManager.registerCleanupHandler('melee', () => {
            this.cleanupMeleeMode();
        });

        this.setupEventListeners();
    }

    private setupEventListeners() {
        console.log('[MeleeCombat] Setting up event listeners for attacks:', MELEE_ATTACKS.map(a => a.type));
        
        MELEE_ATTACKS.forEach(attack => {
            const eventKey = ControlsEvent[attack.type as keyof typeof ControlsEvent];
            console.log('[MeleeCombat] Registering listener for:', attack.type, 'event key:', eventKey);
            
            this.listen(eventKey as any, (characterName: string) => {
                console.log('[MeleeCombat] Event received for attack:', attack.type);
                this.onMeleeAttackSelected(characterName, attack.type);
            });
        });

        this.listen(ControlsEvent.characterClick, data => this.onCharacterClick(data));
        
        this.listen(ControlsEvent.meleeDefenseSelected, data => {
            this.resolveMeleeCombat(data.defenseType as MeleeAttackType);
        });

        // Listen for mouse position updates to rotate character in melee mode
        this.listen(ControlsEvent.mousePositionUpdate, data => this.onMousePositionUpdate(data));
    }

    private getMeleeWeapon(character: DeepReadonly<ICharacter>): DeepReadonly<IWeapon> | null {
        const primaryWeapon = character.inventory.equippedWeapons.primary;
        const secondaryWeapon = character.inventory.equippedWeapons.secondary;

        console.log('[MeleeCombat] Checking weapons for', character.name);
        console.log('[MeleeCombat] Primary weapon:', primaryWeapon?.name, primaryWeapon?.category);
        console.log('[MeleeCombat] Secondary weapon:', secondaryWeapon?.name, secondaryWeapon?.category);

        if (primaryWeapon?.category === 'melee') return primaryWeapon;
        if (secondaryWeapon?.category === 'melee') return secondaryWeapon;
        return null;
    }

    private getMeleeRange(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getMeleeWeapon(character);
        return weapon?.range || MELEE_CONSTANTS.DEFAULT_UNARMED_RANGE;
    }

    private getBaseDamage(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getMeleeWeapon(character);
        return weapon?.damage || MELEE_CONSTANTS.DEFAULT_UNARMED_DAMAGE;
    }

    private calculateDistance(pos1: ICoord, pos2: ICoord): number {
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        return Math.max(dx, dy);
    }

    private findMeleeTargets(
        attacker: DeepReadonly<ICharacter>,
        characters: DeepReadonly<ICharacter[]>
    ): VisibleMeleeTarget[] {
        const range = this.getMeleeRange(attacker);
        console.log('[MeleeCombat] Finding targets - Attacker weapon range:', range);
        const targets: VisibleMeleeTarget[] = [];

        for (const character of characters) {
            if (character.name === attacker.name) continue;
            if (character.health <= 0) {
                console.log('[MeleeCombat] Skipping dead character:', character.name);
                continue;
            }
            if (character.player === attacker.player) {
                console.log('[MeleeCombat] Skipping ally:', character.name);
                continue;
            }

            const distance = this.calculateDistance(attacker.position, character.position);
            console.log('[MeleeCombat] Character', character.name, 'at distance', distance, 'from attacker');
            
            if (distance <= range) {
                console.log('[MeleeCombat] Target in range:', character.name);
                targets.push({
                    character,
                    distance,
                    canAttack: true
                });
            } else {
                console.log('[MeleeCombat] Target out of range:', character.name);
            }
        }

        console.log('[MeleeCombat] Total valid targets:', targets.length);
        return targets;
    }

    private calculateDamageMultiplier(attackAngle: number, defenseAngle: number): number {
        let angleDiff = Math.abs(attackAngle - defenseAngle);
        if (angleDiff > 180) {
            angleDiff = 360 - angleDiff;
        }

        if (angleDiff === 0) {
            return MELEE_CONSTANTS.BLOCK_DAMAGE_MULTIPLIER;
        } else if (angleDiff === 180) {
            return MELEE_CONSTANTS.OPPOSITE_DAMAGE_MULTIPLIER;
        } else if (angleDiff <= 60) {
            return MELEE_CONSTANTS.ADJACENT_DAMAGE_MULTIPLIER;
        } else if (angleDiff <= 120) {
            return MELEE_CONSTANTS.TWO_AWAY_DAMAGE_MULTIPLIER;
        } else {
            return MELEE_CONSTANTS.OPPOSITE_DAMAGE_MULTIPLIER;
        }
    }

    private calculateWeaponModifier(
        attackerWeapon: DeepReadonly<IWeapon> | null,
        defenderWeapon: DeepReadonly<IWeapon> | null
    ): number {
        if (!attackerWeapon || !defenderWeapon) {
            return 1.0;
        }

        const attackerClass = attackerWeapon.class;
        const defenderClass = defenderWeapon.class;

        const modifiers = MELEE_CONSTANTS.WEAPON_CLASS_MODIFIERS[attackerClass as keyof typeof MELEE_CONSTANTS.WEAPON_CLASS_MODIFIERS];
        if (modifiers && defenderClass in modifiers) {
            return modifiers[defenderClass as keyof typeof modifiers] || 1.0;
        }

        return 1.0;
    }

    public calculateMeleeDamage(
        attacker: DeepReadonly<ICharacter>,
        defender: DeepReadonly<ICharacter>,
        attackType: MeleeAttackType,
        defenseType: MeleeAttackType
    ): { damage: number; blocked: boolean } {
        const baseDamage = this.getBaseDamage(attacker);
        const attackerWeapon = this.getMeleeWeapon(attacker);
        const defenderWeapon = this.getMeleeWeapon(defender);

        const attackAngle = MELEE_ATTACKS.find(a => a.type === attackType)?.angle || 0;
        const defenseAngle = MELEE_ATTACKS.find(a => a.type === defenseType)?.angle || 0;

        let damageMultiplier = this.calculateDamageMultiplier(attackAngle, defenseAngle);
        const blocked = damageMultiplier === 0;

        if (!defenderWeapon && !blocked) {
            damageMultiplier = MELEE_CONSTANTS.UNARMED_DEFENSE_PENALTY;
        }

        const weaponModifier = this.calculateWeaponModifier(attackerWeapon, defenderWeapon);

        const finalDamage = Math.round(baseDamage * damageMultiplier * weaponModifier);

        return { damage: finalDamage, blocked };
    }

    private onMeleeAttackSelected(characterName: string, attackType: MeleeAttackType) {
        console.log('[MeleeCombat] Attack selected:', attackType, 'by', characterName);
        
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[MeleeCombat] Character not found:', characterName);
            return;
        }
        console.log('[MeleeCombat] Character found:', character.name, 'at position', character.position);

        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.error('[MeleeCombat] Not current turn - character player:', character.player, 'current turn:', currentTurn);
            return;
        }
        console.log('[MeleeCombat] Turn check passed');

        const attack = MELEE_ATTACKS.find(a => a.type === attackType);
        if (!attack) {
            console.error('[MeleeCombat] Attack type not found:', attackType);
            return;
        }
        console.log('[MeleeCombat] Attack found:', attack);

        if (character.actions.pointsLeft < attack.apCost) {
            console.error('[MeleeCombat] Not enough AP:', character.actions.pointsLeft, '<', attack.apCost);
            this.dispatch(ActionEvent.error, `Not enough action points. Need ${attack.apCost}, have ${character.actions.pointsLeft}`);
            return;
        }
        console.log('[MeleeCombat] AP check passed');

        this.attackingCharacter = character;
        this.selectedAttackType = attackType;
        this.validTargets = this.findMeleeTargets(character, this.state.characters);
        console.log('[MeleeCombat] Valid targets found:', this.validTargets.length, this.validTargets.map(t => ({
            name: t.character.name,
            position: t.character.position,
            distance: t.distance
        })));

        if (this.validTargets.length === 0) {
            console.error('[MeleeCombat] No valid targets in melee range');
            this.dispatch(ActionEvent.error, 'No valid targets in melee range');
            this.cleanupMeleeMode();
            return;
        }

        console.log('[MeleeCombat] Setting interaction mode to melee');
        this.modeManager.requestModeChange({ type: 'melee', data: undefined });

        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: characterName,
            cost: attack.apCost
        });

        this.showMeleeTargets();
    }

    private showMeleeTargets() {
        if (!this.attackingCharacter || this.validTargets.length === 0) return;

        // Add melee weapon class and combat stance visual
        const weapon = this.getMeleeWeapon(this.attackingCharacter);
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

        // Only process if this is for the current melee attacking character
        if (!this.attackingCharacter || this.attackingCharacter.name !== characterName) {
            return;
        }

        // Only process if we're in melee mode
        if (this.modeManager.getCurrentMode()?.type !== 'melee') {
            return;
        }

        // Get character position from state
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[MeleeCombat] Character not found in state:', characterName);
            return;
        }

        // Get the direction from character to mouse position
        const newDirection = DirectionsService.getDirectionFromCoords(
            character.position,
            mouseCoord
        );

        // Check if the direction actually changed
        if (character.direction === newDirection) {
            return;
        }

        // Update the character's direction
        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName: characterName,
            direction: newDirection
        });

        // Recalculate valid targets with new direction (in case we add directional melee later)
        const updatedCharacter = this.state.findCharacter(characterName);
        if (updatedCharacter) {
            this.attackingCharacter = updatedCharacter;
            // For now, melee targets don't change with direction, but we update the visual
            this.showMeleeTargets();
        }
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        console.log('[MeleeCombat] Character clicked:', data.characterName, 'at', data.position);
        console.log('[MeleeCombat] Current mode:', this.modeManager.getCurrentMode());
        
        if (this.modeManager.getCurrentMode()?.type !== 'melee') {
            console.log('[MeleeCombat] Not in melee mode, ignoring click');
            return;
        }
        
        if (!this.attackingCharacter || !this.selectedAttackType) {
            console.log('[MeleeCombat] No attacker or attack type selected');
            return;
        }

        console.log('[MeleeCombat] Looking for target:', data.characterName);
        console.log('[MeleeCombat] Valid targets:', this.validTargets.map(t => t.character.name));
        
        const target = this.validTargets.find(t => t.character.name === data.characterName);
        if (!target) {
            console.error('[MeleeCombat] Invalid target for melee attack:', data.characterName);
            this.dispatch(ActionEvent.error, 'Invalid target for melee attack');
            return;
        }

        console.log('[MeleeCombat] Valid target found, initiating combat');
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

        this.dispatch(UpdateStateEvent.uiMeleeDefense, {
            attacker: attacker.name,
            defender: defender.name,
            attackType: attackType,
            weaponInfo: {
                attackerWeapon: this.getMeleeWeapon(attacker)?.name || 'Unarmed',
                defenderWeapon: this.getMeleeWeapon(defender)?.name || 'Unarmed'
            }
        });

        this.cleanupMeleeMode();
    }

    public resolveMeleeCombat(defenseType: MeleeAttackType) {
        if (!this.pendingCombat) {
            console.error('[MeleeCombat] No pending combat to resolve');
            return;
        }

        const { attacker, defender, attackType } = this.pendingCombat;
        const { damage, blocked } = this.calculateMeleeDamage(attacker, defender, attackType, defenseType);

        const attack = MELEE_ATTACKS.find(a => a.type === attackType);
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
        // Clear visual state and pending cost for the attacking character
        if (this.attackingCharacter) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: this.attackingCharacter.name,
                visualState: {
                    temporaryClasses: [],
                    weaponClass: undefined
                }
            });

            // Clear pending action cost
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

    public static getInstance(state: State): MeleeCombat {
        return new MeleeCombat(state);
    }
}