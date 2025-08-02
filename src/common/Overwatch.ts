import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, IOverwatchData, IOverwatchModeData } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
    ActionEvent, ActionEventsMap, GameEvent, GameEventsMap,
    StateChangeEvent
} from "./events";
import { ShootingService, SHOOT_CONSTANTS, VisibleCell } from "./services/ShootingService";
import { DirectionsService } from "./services/DirectionsService";

// Type aliases for better readability
type CharacterName = string;
type CellKey = string;

// Constants
const OVERWATCH_CONSTANTS = {
    LOG_PREFIX: '[Overwatch]',
    CELL_KEY_SEPARATOR: ',',
    NO_AIM_BONUS: 0
} as const;

// Interfaces for complex data structures
interface TrackedPosition {
    x: number;
    y: number;
}


interface CellVisualUpdate {
    cellKey: CellKey;
    visualState: {
        isHighlighted: boolean;
        highlightTypes: Array<'overwatch'>;
        highlightIntensity: number;
        classList: string[];
    } | null;
}

// Helper functions
const createCellKey = (coord: ICoord): CellKey =>
    `${coord.x}${OVERWATCH_CONSTANTS.CELL_KEY_SEPARATOR}${coord.y}`;

const addShotCellIfNotExists = (shotCells: string[], cellKey: string): string[] => {
    if (!shotCells.includes(cellKey)) {
        return [...shotCells, cellKey];
    }
    return shotCells;
};


export class Overwatch extends EventBus<
    GUIEventsMap & ControlsEventsMap & StateChangeEventsMap & GameEventsMap & ActionEventsMap,
    GUIEventsMap & ControlsEventsMap & UpdateStateEventsMap & ActionEventsMap
> {
    private activeOverwatchCharacter?: DeepReadonly<ICharacter>;
    private visibleCells?: VisibleCell[];
    private readonly trackedCharacterPositions = new Map<CharacterName, TrackedPosition>();

    constructor(
        private readonly state: State,
    ) {
        super();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Controls events
        this.listen(ControlsEvent.showOverwatch, this.handleShowOverwatch.bind(this));
        this.listen(ControlsEvent.cellClick, this.handleCellClick.bind(this));
        this.listen(ControlsEvent.mousePositionUpdate, this.handleMousePositionUpdate.bind(this));

        // State change events
        this.listen(StateChangeEvent.characterPosition, this.handleCharacterMove.bind(this));
        this.listen(StateChangeEvent.characterHealth, this.handleCharacterHealthChange.bind(this));
        this.listen(StateChangeEvent.uiVisualStates, this.handleVisualStatesChange.bind(this));

        // Game events
        this.listen(GameEvent.changeTurn, this.handleTurnChange.bind(this));

        // State events
        this.listen(StateChangeEvent.overwatchData, this.renderAllOverwatchHighlights.bind(this));
        this.listen(StateChangeEvent.game, this.renderAllOverwatchHighlights.bind(this));

        // Clear overwatch mode when popup is shown
        this.listen(GUIEvent.popupShow, () => this.clearOverwatchMode());

        // Initial render of any existing overwatch highlights
        this.renderAllOverwatchHighlights();
    }

    // Event Handlers
    private handleShowOverwatch(characterName: CharacterName): void {
        const character = this.state.findCharacter(characterName);
        if (!character) {
            this.logError('Character not found');
            return;
        }

        // Validate turn
        if (!this.isCharacterTurn(character)) {
            this.logError('Not current turn');
            return;
        }

        // Validate action points
        if (!this.hasActionPoints(character)) {
            this.dispatch(ActionEvent.error, 'No action points remaining for overwatch');
            return;
        }

        this.showOverwatchRange(character);
    }

    private handleCellClick(coord: DeepReadonly<ICoord>): void {
        if (!this.activeOverwatchCharacter || !this.visibleCells) {
            return;
        }

        const isInVisibleCell = this.isCoordInVisibleCells(coord, this.visibleCells);

        if (isInVisibleCell) {
            this.activateOverwatch(this.activeOverwatchCharacter);
        }
    }

    private handleMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]): void {
        const { characterName, mouseCoord } = data;

        // Only process if this is for the current overwatch setup
        if (!this.isActiveOverwatchCharacter(characterName)) {
            return;
        }

        const character = this.state.findCharacter(characterName);
        if (!character) {
            return;
        }

        const newDirection = this.calculateDirectionToCoord(character.position, mouseCoord);

        if (character.direction === newDirection) {
            return;
        }

        this.updateCharacterDirection(characterName, newDirection);

        // Update visual range if in setup mode
        if (this.activeOverwatchCharacter) {
            const updatedCharacter = this.state.findCharacter(characterName);
            if (updatedCharacter) {
                this.showOverwatchRange(updatedCharacter);
            }
        }
    }

    private handleVisualStatesChange(visualStates: StateChangeEventsMap[StateChangeEvent.uiVisualStates]): void {
        for (const [characterId, visualState] of Object.entries(visualStates.characters)) {
            if (!visualState?.styles) continue;

            const position = this.extractPositionFromStyles(visualState.styles);
            if (!position) continue;

            const lastPos = this.trackedCharacterPositions.get(characterId);

            if (!this.hasPositionChanged(lastPos, position)) continue;

            this.trackedCharacterPositions.set(characterId, position);

            const character = this.state.findCharacter(characterId);
            if (character) {
                const characterAtPosition: DeepReadonly<ICharacter> = {
                    ...character,
                    position
                };
                this.checkOverwatchTriggers(characterAtPosition);
            }
        }
    }

    private handleCharacterMove(character: DeepReadonly<ICharacter>): void {
        this.trackedCharacterPositions.set(character.name, {
            x: character.position.x,
            y: character.position.y
        });

        this.checkOverwatchTriggers(character);
    }

    private handleCharacterHealthChange(character: DeepReadonly<ICharacter>): void {
        if (character.health <= 0) {
            const overwatchData = this.getOverwatchData(character.name);
            if (overwatchData?.active) {
                this.clearCharacterOverwatch(character.name);
            }
        }
    }

    private handleTurnChange(data: GameEventsMap[GameEvent.changeTurn]): void {
        const overwatchesToClear: CharacterName[] = [];

        // Collect overwatch information
        this.state.characters.forEach(character => {
            const overwatchData = this.getOverwatchData(character.name);
            if (overwatchData?.active) {
                if (character.player === data.turn) {
                    overwatchesToClear.push(character.name);
                }
            }
        });

        // Clear overwatches for characters whose turn is starting
        overwatchesToClear.forEach(characterName => {
            this.clearCharacterOverwatch(characterName);
            this.clearInteractionModeIfNeeded(characterName);
        });

        // Re-render all active overwatches after turn change
        this.renderAllOverwatchHighlights();
    }

    // Core Overwatch Logic
    private showOverwatchRange(character: DeepReadonly<ICharacter>): void {
        const range = ShootingService.getWeaponRange(character);
        const angleOfVision = SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION;

        this.clearVisibleCells();

        this.activeOverwatchCharacter = character;
        this.visibleCells = ShootingService.calculateVisibleCells(
            this.state.map,
            character.position,
            character.direction,
            range,
            angleOfVision
        );

        this.updateCharacterVisuals(character);
        this.updateInteractionMode(character);
        this.updateHighlights();
        this.updateCellVisuals();
    }

    private activateOverwatch(character: DeepReadonly<ICharacter>): void {
        const pointsToConsume = character.actions.pointsLeft;

        this.dispatch(UpdateStateEvent.setOverwatchData, {
            characterName: character.name,
            active: true,
            direction: character.direction,
            position: character.position,
            range: ShootingService.getWeaponRange(character),
            shotsRemaining: pointsToConsume,
            watchedCells: this.visibleCells!.map(vc => vc.coord),
            shotCells: []
        });

        this.dispatch(UpdateStateEvent.deductActionPoints, {
            characterName: character.name,
            actionId: 'overwatch',
            cost: pointsToConsume
        });

        this.activeOverwatchCharacter = undefined;
        this.visibleCells = undefined;

        this.dispatch(UpdateStateEvent.uiInteractionMode, { type: 'normal' });
    }

    private checkOverwatchTriggers(character: DeepReadonly<ICharacter>): void {
        // Skip checking triggers for defeated characters
        if (character.health <= 0) {
            this.log(`Skipping overwatch triggers for defeated character ${character.name}`);
            return;
        }

        const overwatchData = this.state.overwatchData;
        if (!overwatchData || Object.keys(overwatchData).length === 0) {
            return;
        }

        // Iterate over the object entries
        Object.entries(overwatchData).forEach(([overwatcherName, data]) => {
            this.processOverwatchTrigger(overwatcherName, data, character);
        });

        this.updateMovingCharacterOverwatch(character);
    }

    private processOverwatchTrigger(
        overwatcherName: CharacterName,
        data: DeepReadonly<IOverwatchData>,
        target: DeepReadonly<ICharacter>
    ): void {
        if (!this.canExecuteOverwatch(overwatcherName, data, target)) {
            return;
        }

        const cellKey = createCellKey(target.position);

        if (this.hasAlreadyShotAtCell(data, cellKey)) {
            this.log(`Already shot at cell ${cellKey}`);
            return;
        }

        if (!this.hasLineOfSight(data.position, target.position)) {
            this.log('No line of sight');
            return;
        }

        this.executeOverwatchShot(overwatcherName, data, target);
    }

    private executeOverwatchShot(
        overwatcherName: CharacterName,
        overwatchData: DeepReadonly<IOverwatchData>,
        target: DeepReadonly<ICharacter>
    ): void {
        const overwatcher = this.state.findCharacter(overwatcherName);
        if (!overwatcher) {
            return;
        }

        this.showProjectileAnimation(overwatcher, overwatchData.position, target.position);

        const shotResult = this.calculateShot(overwatcher, overwatchData, target);

        // Shot always hits now, apply damage
        this.applyDamage(overwatcherName, target, { damage: shotResult.damage, isCritical: shotResult.isCritical });

        this.updateOverwatchAfterShot(overwatcherName, overwatchData, target.position);
    }

    // Helper Methods
    private isCharacterTurn(character: DeepReadonly<ICharacter>): boolean {
        return character.player === this.state.game.turn;
    }

    private hasActionPoints(character: DeepReadonly<ICharacter>): boolean {
        return character.actions.pointsLeft > 0;
    }

    private isActiveOverwatchCharacter(characterName: CharacterName): boolean {
        return this.activeOverwatchCharacter?.name === characterName;
    }

    private isCoordInVisibleCells(coord: DeepReadonly<ICoord>, cells: VisibleCell[]): boolean {
        return cells.some(vc => vc.coord.x === coord.x && vc.coord.y === coord.y);
    }

    private calculateDirectionToCoord(from: ICoord, to: ICoord): ReturnType<typeof DirectionsService.getDirectionFromAngle> {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return DirectionsService.getDirectionFromAngle(angle);
    }

    private extractPositionFromStyles(styles: Record<string, string>): TrackedPosition | null {
        if (!('--x' in styles && '--y' in styles)) return null;

        const xStr = styles['--x'];
        const yStr = styles['--y'];
        if (!xStr || !yStr) return null;

        return {
            x: Math.round(parseFloat(xStr)),
            y: Math.round(parseFloat(yStr))
        };
    }

    private hasPositionChanged(lastPos: TrackedPosition | undefined, newPos: TrackedPosition): boolean {
        return !lastPos || lastPos.x !== newPos.x || lastPos.y !== newPos.y;
    }

    private getOverwatchData(characterName: CharacterName): DeepReadonly<IOverwatchData> | undefined {
        return this.state.overwatchData[characterName];
    }

    private canExecuteOverwatch(
        overwatcherName: CharacterName,
        data: DeepReadonly<IOverwatchData>,
        target: DeepReadonly<ICharacter>
    ): boolean {
        // Check if target is already defeated
        if (target.health <= 0) {
            this.log(`${target.name} is already defeated, skipping overwatch`);
            return false;
        }

        if (!data.active || data.shotsRemaining <= 0) {
            this.log(`${overwatcherName} is inactive or out of shots`);
            return false;
        }

        const overwatcher = this.state.findCharacter(overwatcherName);
        if (!overwatcher || overwatcher.player === target.player) {
            this.log(`${overwatcherName} won't shoot at friendly ${target.name} (${target.player})`);
            return false;
        }

        const isInWatchedCell = data.watchedCells?.some(cell =>
            cell.x === target.position.x && cell.y === target.position.y
        );

        return !!isInWatchedCell;
    }

    private hasAlreadyShotAtCell(data: DeepReadonly<IOverwatchData>, cellKey: CellKey): boolean {
        if (!data.shotCells) return false;
        return data.shotCells.includes(cellKey);
    }

    private hasLineOfSight(from: ICoord, to: ICoord): boolean {
        return ShootingService.checkLineOfSight(this.state.map, from, to);
    }

    private calculateShot(
        overwatcher: DeepReadonly<ICharacter>,
        overwatchData: DeepReadonly<IOverwatchData>,
        target: DeepReadonly<ICharacter>
    ) {
        const distance = ShootingService.getDistance(overwatchData.position, target.position);
        const baseDamage = ShootingService.getWeaponDamage(overwatcher);
        const critChance = ShootingService.calculateCriticalChance(OVERWATCH_CONSTANTS.NO_AIM_BONUS);
        const isCritical = ShootingService.rollCritical(critChance);
        const finalDamage = ShootingService.calculateDamage(
            baseDamage,
            distance,
            overwatchData.range,
            isCritical
        );

        return { hit: true, damage: finalDamage, isCritical };
    }

    private showProjectileAnimation(
        overwatcher: DeepReadonly<ICharacter>,
        from: ICoord,
        to: ICoord
    ): void {
        const weapon = ShootingService.getEquippedRangedWeapon(overwatcher);
        const projectileType = ShootingService.getProjectileType(weapon);

        this.dispatch(GUIEvent.shootProjectile, {
            from,
            to,
            type: projectileType
        });
    }

    private applyDamage(
        attackerName: CharacterName,
        target: DeepReadonly<ICharacter>,
        shotResult: { damage: number; isCritical: boolean }
    ): void {
        this.dispatch(GUIEvent.damageNumber, {
            position: target.position,
            damage: shotResult.damage,
            isCritical: shotResult.isCritical
        });

        this.dispatch(UpdateStateEvent.damageCharacter, {
            targetName: target.name,
            damage: shotResult.damage,
            attackerName
        });
    }

    private updateOverwatchAfterShot(
        overwatcherName: CharacterName,
        overwatchData: DeepReadonly<IOverwatchData>,
        targetPosition: ICoord
    ): void {
        const cellKey = createCellKey(targetPosition);
        const existingShotCells = overwatchData.shotCells || [];

        const updatedShotCells = addShotCellIfNotExists([...existingShotCells], cellKey);

        const newShotsRemaining = overwatchData.shotsRemaining - 1;

        if (newShotsRemaining <= 0) {
            this.clearCharacterOverwatch(overwatcherName);
            this.dispatch(UpdateStateEvent.uiInteractionMode, { type: 'normal' });
        } else {
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: overwatcherName,
                active: true,
                shotsRemaining: newShotsRemaining,
                shotCells: updatedShotCells
            });

            this.updateInteractionModeShots(overwatcherName, newShotsRemaining);
        }
    }

    private updateMovingCharacterOverwatch(character: DeepReadonly<ICharacter>): void {
        const movingCharacterOverwatch = this.getOverwatchData(character.name);
        if (!movingCharacterOverwatch?.active) return;

        const newWatchedCells = ShootingService.calculateVisibleCells(
            this.state.map,
            character.position,
            character.direction,
            movingCharacterOverwatch.range,
            SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION
        );

        this.dispatch(UpdateStateEvent.setOverwatchData, {
            characterName: character.name,
            active: true,
            position: character.position,
            watchedCells: newWatchedCells.map(vc => vc.coord)
        });
    }

    // UI Update Methods
    private updateCharacterDirection(characterName: CharacterName, direction: ReturnType<typeof DirectionsService.getDirectionFromAngle>): void {
        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName,
            direction
        });
    }

    private updateCharacterVisuals(character: DeepReadonly<ICharacter>): void {
        const weapon = ShootingService.getEquippedRangedWeapon(character);
        const weaponClass = weapon?.class || 'unarmed';

        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: character.name,
            visualState: {
                temporaryClasses: ['overwatch'],
                weaponClass
            }
        });
    }

    private updateInteractionMode(character: DeepReadonly<ICharacter>): void {
        const weapon = ShootingService.getEquippedRangedWeapon(character);
        if (!weapon) return;

        const modeData: IOverwatchModeData = {
            characterId: character.name,
            weapon,
            remainingPoints: character.actions.pointsLeft
        };

        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'overwatch',
            data: modeData
        });
    }

    private updateInteractionModeShots(characterName: CharacterName, shotsRemaining: number): void {
        const currentMode = this.state.ui.interactionMode;
        if (currentMode.type !== 'overwatch' || !currentMode.data) return;

        // Type guard to ensure we have overwatch mode data
        const currentData = currentMode.data as IOverwatchModeData;
        if (currentData.shotsRemaining === shotsRemaining) return;

        const character = this.state.findCharacter(characterName);
        if (!character) return;

        const weapon = ShootingService.getEquippedRangedWeapon(character);
        if (!weapon) return;

        const modeData: IOverwatchModeData = {
            characterId: characterName,
            weapon,
            shotsRemaining
        };

        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'overwatch',
            data: modeData
        });
    }

    private updateHighlights(): void {
        if (!this.visibleCells) return;

        this.dispatch(UpdateStateEvent.uiHighlights, {
            targetableCells: this.visibleCells.map(vc => vc.coord)
        });
    }

    private updateCellVisuals(): void {
        if (!this.visibleCells) return;

        const cellUpdates: CellVisualUpdate[] = this.visibleCells.map(vc => ({
            cellKey: createCellKey(vc.coord),
            visualState: {
                isHighlighted: true,
                highlightTypes: ['overwatch'],
                highlightIntensity: vc.intensity,
                classList: ['highlight', 'overwatch']
            }
        }));

        this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
    }

    private clearVisibleCells(): void {
        if (!this.visibleCells) return;

        const clearUpdates: CellVisualUpdate[] = this.visibleCells.map(vc => ({
            cellKey: createCellKey(vc.coord),
            visualState: null
        }));

        this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: clearUpdates });
    }

    private renderAllOverwatchHighlights(): void {
        // Skip if we're actively setting up overwatch for a character
        if (this.activeOverwatchCharacter) {
            return;
        }

        const overwatchData = this.state.overwatchData;
        if (!overwatchData || Object.keys(overwatchData).length === 0) {
            return;
        }

        const allCellUpdates: CellVisualUpdate[] = [];

        // Process each character's overwatch
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(overwatchData).forEach(([_, data]) => {
            if (!data.active) return;

            // Calculate visible cells for this overwatch
            const visibleCells = ShootingService.calculateVisibleCells(
                this.state.map,
                data.position,
                data.direction,
                data.range,
                SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION
            );

            // Add cell updates for this overwatch
            visibleCells.forEach(vc => {
                allCellUpdates.push({
                    cellKey: createCellKey(vc.coord),
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['overwatch'],
                        highlightIntensity: vc.intensity,
                        classList: ['highlight', 'overwatch']
                    }
                });
            });
        });

        // Batch update all overwatch cells
        if (allCellUpdates.length > 0) {
            this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: allCellUpdates });
        }
    }

    private clearOverwatchMode(): void {
        if (!this.visibleCells) return;

        this.dispatch(UpdateStateEvent.uiHighlights, { targetableCells: [] });
        this.clearVisibleCells();

        if (this.activeOverwatchCharacter) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: this.activeOverwatchCharacter.name,
                visualState: { temporaryClasses: [] }
            });
        }

        this.visibleCells = undefined;
        this.activeOverwatchCharacter = undefined;
        this.dispatch(UpdateStateEvent.uiInteractionMode, { type: 'normal' });
    }

    private clearCharacterOverwatch(characterName: CharacterName): void {
        const overwatchData = this.getOverwatchData(characterName);

        if (overwatchData?.watchedCells) {
            const cellUpdates: CellVisualUpdate[] = overwatchData.watchedCells.map(coord => ({
                cellKey: createCellKey(coord),
                visualState: null
            }));

            this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
        }

        this.dispatch(UpdateStateEvent.setOverwatchData, {
            characterName,
            active: false
        });

        this.dispatch(UpdateStateEvent.uiHighlights, { targetableCells: [] });

        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: characterName,
            visualState: { temporaryClasses: [] }
        });

        this.clearInteractionModeIfNeeded(characterName);
    }

    private clearInteractionModeIfNeeded(characterName: CharacterName): void {
        const interactionMode = this.state.ui.interactionMode;
        if (interactionMode.type !== 'overwatch' || !interactionMode.data) return;

        const overwatchModeData = interactionMode.data as IOverwatchModeData;
        if (overwatchModeData.characterId === characterName) {
            this.dispatch(UpdateStateEvent.uiInteractionMode, { type: 'normal' });
        }
    }

    // Logging helpers
    private log(message: string): void {
        console.log(`${OVERWATCH_CONSTANTS.LOG_PREFIX} ${message}`);
    }

    private logError(message: string): void {
        console.error(`${OVERWATCH_CONSTANTS.LOG_PREFIX} ${message}`);
    }
}