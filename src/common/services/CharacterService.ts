import { Direction, ICharacter } from "../interfaces";
import { ICoord } from "../interfaces";
import { DeepReadonly } from "../helpers/types";
import { State } from "../State";
import { EventBus } from "../events";
import { DirectionsService } from "./DirectionsService";

export interface CharacterPalette {
  skin: string;
  helmet: string;
  suit: string;
}

export interface MovementData {
  isMoving: boolean;
  directionClass: string;
  position: ICoord;
}

export class CharacterService extends EventBus {
  private static instance: CharacterService | null = null;
  
  private static readonly DIRECTION_CLASSES = [
    'rotate-0', 'rotate-45', 'rotate-90', 'rotate-135', 
    'rotate-180', 'rotate-225', 'rotate-270', 'rotate-315'
  ];


  private static readonly DEFAULT_PALETTE: CharacterPalette = {
    skin: 'black',
    helmet: 'black',
    suit: 'black'
  };

  private constructor(private state: State) {
    super();
  }

  public static initialize(state: State): void {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService(state);
    }
  }

  public static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      throw new Error('CharacterService not initialized. Call CharacterService.initialize(state) first.');
    }
    return CharacterService.instance;
  }

  public static getDirectionClasses(): string[] {
    return [...this.DIRECTION_CLASSES];
  }

  public static getDirectionClass(direction: Direction): string {
    return DirectionsService.getRotationClass(direction) || 'rotate-0';
  }

  public static parseCharacterPalette(paletteString?: string): CharacterPalette {
    if (!paletteString) {
      return { ...this.DEFAULT_PALETTE };
    }

    try {
      const parsed = JSON.parse(paletteString);
      return {
        ...this.DEFAULT_PALETTE,
        ...parsed
      };
    } catch (error) {
      console.error('CharacterService - parseCharacterPalette - error:', error);
      return { ...this.DEFAULT_PALETTE };
    }
  }

  public static calculateMovementData(
    currentPosition: ICoord,
    targetPosition: ICoord,
    direction: Direction
  ): MovementData {
    const isMoving = currentPosition.x !== targetPosition.x || currentPosition.y !== targetPosition.y;
    const directionClass = this.getDirectionClass(direction);

    return {
      isMoving,
      directionClass,
      position: targetPosition
    };
  }


  public static filterCharacters(
    characters: DeepReadonly<ICharacter[]>,
    options: {
      excludeByName?: string;
      includeOnlyNames?: string[];
      excludeNames?: string[];
      race?: ICharacter['race'];
      hasWeapon?: boolean;
    } = {}
  ): DeepReadonly<ICharacter[]> {
    return characters.filter(character => {
      // Exclude by specific name
      if (options.excludeByName && character.name === options.excludeByName) {
        return false;
      }

      // Include only specific names
      if (options.includeOnlyNames && !options.includeOnlyNames.includes(character.name)) {
        return false;
      }

      // Exclude multiple names
      if (options.excludeNames && options.excludeNames.includes(character.name)) {
        return false;
      }

      // Filter by race
      if (options.race && character.race !== options.race) {
        return false;
      }

      // Filter by weapon possession
      if (options.hasWeapon !== undefined) {
        const hasEquippedWeapon = Boolean(
          character.inventory.equippedWeapons.primary || 
          character.inventory.equippedWeapons.secondary
        );
        if (options.hasWeapon !== hasEquippedWeapon) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if a character can be controlled based on the current turn
   */
  public static canControlCharacter(characterPlayer: string, currentTurn: string): boolean {
    return characterPlayer === currentTurn;
  }

  /**
   * Get the initial position from dataset attributes
   */
  public static getPositionFromDataset(dataset: DOMStringMap): ICoord {
    return {
      x: parseInt(dataset.x || '0'),
      y: parseInt(dataset.y || '0')
    };
  }

  /**
   * Initialize character data from dataset attributes
   */
  public static initializeFromDataset(dataset: DOMStringMap): {
    race: ICharacter['race'];
    player: string;
    palette: CharacterPalette;
    direction?: Direction;
    position: ICoord;
  } {
    const race = (dataset.race || 'human') as ICharacter['race'];
    const player = dataset.player || '';
    const palette = this.parseCharacterPalette(dataset.palette);
    const direction = dataset.direction as Direction | undefined;
    const position = this.getPositionFromDataset(dataset);

    return {
      race,
      player,
      palette,
      direction,
      position
    };
  }

  /**
   * Apply palette styles to an element
   */
  public static applyPaletteStyles(element: HTMLElement, palette: CharacterPalette): void {
    element.style.setProperty('--skin', palette.skin);
    element.style.setProperty('--helmet', palette.helmet);
    element.style.setProperty('--suit', palette.suit);
    element.style.backgroundColor = palette.helmet;
  }

  /**
   * Check if character should show current turn indicator
   */
  public static shouldShowTurnIndicator(characterPlayer: string, currentTurn: string): boolean {
    return characterPlayer === currentTurn;
  }

  /**
   * Get current turn from game state
   */
  public getCurrentTurn(): string | null {
    return this.state.game.turn || null;
  }

  /**
   * Find a character by name from state
   */
  public findCharacter(name: string): DeepReadonly<ICharacter> | undefined {
    return this.state.findCharacter(name);
  }

  /**
   * Calculate health bar color based on percentage
   */
  public static calculateHealthColor(percentage: number): string {
    if (percentage > 60) return '#4ade80'; // Green
    if (percentage > 30) return '#ffa726'; // Orange
    return '#f44336'; // Red
  }

}