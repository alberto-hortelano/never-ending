import type { IInventory, IWeapon, Race, Direction, Action } from "../interfaces";


// Type guard for IInventory
export function isInventory(obj: unknown): obj is IInventory {
    if (!obj || typeof obj !== 'object') return false;
    const inv = obj as Record<string, unknown>;
    
    return Array.isArray(inv.items) &&
           typeof inv.weight === 'number' &&
           typeof inv.maxWeight === 'number';
}

// Type guard for IWeapon
export function isWeapon(obj: unknown): obj is IWeapon {
    if (!obj || typeof obj !== 'object') return false;
    const weapon = obj as Record<string, unknown>;
    
    return typeof weapon.name === 'string' &&
           typeof weapon.damage === 'number' &&
           typeof weapon.range === 'number' &&
           typeof weapon.accuracyModifier === 'number' &&
           typeof weapon.apCost === 'number';
}

// Type validators
export function isValidRace(value: unknown): value is Race {
    return value === 'human' || value === 'alien' || value === 'robot';
}

export function isValidDirection(value: unknown): value is Direction {
    return value === 'down' || value === 'right' || value === 'up' || value === 'left' ||
           value === 'down-right' || value === 'up-right' || value === 'up-left' || value === 'down-left';
}

export function isValidAction(value: unknown): value is Action {
    return value === 'walk' || value === 'idle';
}

export function isValidLanguage(value: unknown): value is 'en' | 'es' {
    return value === 'en' || value === 'es';
}

// Safe enum conversion with validation
export function toRace(value: unknown): Race {
    if (isValidRace(value)) {
        return value;
    }
    throw new Error(`Invalid Race value: ${value}`);
}

export function toDirection(value: unknown): Direction {
    if (isValidDirection(value)) {
        return value;
    }
    throw new Error(`Invalid Direction value: ${value}`);
}

export function toAction(value: unknown): Action {
    if (isValidAction(value)) {
        return value;
    }
    throw new Error(`Invalid Action value: ${value}`);
}

export function toLanguage(value: unknown): 'en' | 'es' {
    if (isValidLanguage(value)) {
        return value;
    }
    throw new Error(`Invalid Language value: ${value}`);
}

// Type guard for checking if object has a property
export function hasProperty<T extends object, K extends PropertyKey>(
    obj: T,
    key: K
): obj is T & Record<K, unknown> {
    return key in obj;
}

// Type guard for non-null values
export function isNotNull<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}