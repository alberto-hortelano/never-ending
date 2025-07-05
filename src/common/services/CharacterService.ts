import { Direction, ICharacter } from "../interfaces";
import { ICoord } from "../interfaces";
import { DeepReadonly } from "../helpers/types";

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

export class CharacterService {
  private static readonly DIRECTION_CLASSES = [
    'rotate-0', 'rotate-45', 'rotate-90', 'rotate-135', 
    'rotate-180', 'rotate-225', 'rotate-270', 'rotate-315'
  ];

  private static readonly DIRECTION_MAP: Record<Direction, string> = {
    'down': 'rotate-0',
    'down-right': 'rotate-45',
    'right': 'rotate-90',
    'up-right': 'rotate-135',
    'up': 'rotate-180',
    'up-left': 'rotate-225',
    'left': 'rotate-270',
    'down-left': 'rotate-315'
  };

  private static readonly DEFAULT_PALETTE: CharacterPalette = {
    skin: 'black',
    helmet: 'black',
    suit: 'black'
  };

  public static getDirectionClasses(): string[] {
    return [...this.DIRECTION_CLASSES];
  }

  public static getDirectionClass(direction: Direction): string {
    return this.DIRECTION_MAP[direction] || 'rotate-0';
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

}