export interface ColorPreset {
  name: string;
  skin: string;
  helmet: string;
  suit: string;
}

export interface AbilityCost {
  move: number;
  shoot: number;
  reload: number;
  pickup: number;
}

export interface CharacterColors {
  skin: string;
  helmet: string;
  suit: string;
}

export interface CreatorData {
  name: string;
  race: 'human' | 'alien' | 'robot';
  description: string;
  colors: CharacterColors;
  abilities: AbilityCost;
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  items: string[];
}

import { weapons, items } from '../../data/state';

export interface SimplifiedWeapon {
  id: string;
  name: string;
  weight: number;
  cost: number;
}

export interface SimplifiedItem {
  id: string;
  name: string;
  weight: number;
  cost: number;
}

export class CharacterCreationService {
  static readonly TOTAL_ABILITY_POINTS = 10;
  static readonly EQUIPMENT_BUDGET = 1000;
  static readonly MAX_WEIGHT = 100;
  
  static readonly DEFAULT_ABILITIES: AbilityCost = {
    move: 10,
    shoot: 20,
    reload: 15,
    pickup: 5
  };
  
  static readonly COLOR_PRESETS: readonly ColorPreset[] = [
    { name: 'Default Human', skin: '#E5B887', helmet: '#4A5568', suit: '#2D3748' },
    { name: 'Pale Human', skin: '#F5DEB3', helmet: '#2C5282', suit: '#1A365D' },
    { name: 'Dark Human', skin: '#8B6F47', helmet: '#744210', suit: '#5D4E37' },
    { name: 'Alien Green', skin: '#90EE90', helmet: '#228B22', suit: '#006400' },
    { name: 'Alien Purple', skin: '#DDA0DD', helmet: '#8B008B', suit: '#4B0082' },
    { name: 'Robot Steel', skin: '#C0C0C0', helmet: '#708090', suit: '#2F4F4F' },
    { name: 'Robot Gold', skin: '#FFD700', helmet: '#B8860B', suit: '#8B7500' },
    { name: 'Robot Copper', skin: '#CD7F32', helmet: '#8B4513', suit: '#654321' }
  ];
  
  // Get weapons and items from state.ts and map to simplified format
  static readonly AVAILABLE_WEAPONS: readonly SimplifiedWeapon[] = weapons.map(w => ({
    id: w.id,
    name: w.name,
    weight: w.weight,
    cost: w.cost
  }));
  
  static readonly AVAILABLE_ITEMS: readonly SimplifiedItem[] = items.map(i => ({
    id: i.id,
    name: i.name,
    weight: i.weight,
    cost: i.cost
  }));

  static createDefaultCharacterData(): CreatorData {
    return {
      name: '',
      race: 'human',
      description: '',
      colors: {
        skin: '#E5B887',
        helmet: '#4A5568',
        suit: '#2D3748'
      },
      abilities: { ...this.DEFAULT_ABILITIES },
      primaryWeapon: null,
      secondaryWeapon: null,
      items: []
    };
  }

  static getPresetForRace(race: 'human' | 'alien' | 'robot'): ColorPreset {
    const presetIndex = race === 'alien' ? 3 : race === 'robot' ? 5 : 0;
    // Always return a valid preset - COLOR_PRESETS has 8 items so index 0, 3, 5 are always valid
    return this.COLOR_PRESETS[presetIndex] as ColorPreset;
  }

  static calculateUsedAbilityPoints(abilities: AbilityCost): number {
    let used = 0;
    
    Object.keys(this.DEFAULT_ABILITIES).forEach(key => {
      const ability = key as keyof AbilityCost;
      const diff = this.DEFAULT_ABILITIES[ability] - abilities[ability];
      if (diff > 0) used += diff;
    });
    
    return used;
  }

  static canSpendAbilityPoints(abilities: AbilityCost, pointsToSpend: number): boolean {
    return this.calculateUsedAbilityPoints(abilities) + pointsToSpend <= this.TOTAL_ABILITY_POINTS;
  }

  static getAbilityLimits(ability: keyof AbilityCost): { min: number; max: number } {
    const defaultCost = this.DEFAULT_ABILITIES[ability];
    return {
      min: Math.max(1, defaultCost - 5),
      max: defaultCost + 5
    };
  }

  static calculateTotalWeight(data: CreatorData): number {
    let weight = 0;
    
    if (data.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.primaryWeapon);
      if (weapon) weight += weapon.weight;
    }
    
    if (data.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.secondaryWeapon);
      if (weapon) weight += weapon.weight;
    }
    
    data.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) weight += item.weight;
    });
    
    return weight;
  }

  static calculateTotalCost(data: CreatorData): number {
    let cost = 0;
    
    if (data.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.primaryWeapon);
      if (weapon) cost += weapon.cost;
    }
    
    if (data.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.secondaryWeapon);
      if (weapon) cost += weapon.cost;
    }
    
    data.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) cost += item.cost;
    });
    
    return cost;
  }

  static validateCharacterName(name: string): { valid: boolean; error?: string } {
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Name is required' };
    }
    
    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (!/^[a-zA-Z0-9\s-_]+$/.test(trimmed)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }
    
    return { valid: true };
  }

  static validateCreatorData(data: CreatorData): boolean {
    const nameValidation = this.validateCharacterName(data.name);
    if (!nameValidation.valid) return false;
    
    const weight = this.calculateTotalWeight(data);
    if (weight > this.MAX_WEIGHT) return false;
    
    const cost = this.calculateTotalCost(data);
    if (cost > this.EQUIPMENT_BUDGET) return false;
    
    return true;
  }

  static buildCharacterData(data: CreatorData) {
    const weapons: SimplifiedWeapon[] = [];
    const items: SimplifiedItem[] = [];
    
    if (data.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.primaryWeapon);
      if (weapon) weapons.push(weapon);
    }
    
    if (data.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === data.secondaryWeapon);
      if (weapon) weapons.push(weapon);
    }
    
    data.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) items.push(item);
    });
    
    return {
      name: data.name,
      race: data.race,
      description: data.description,
      palette: data.colors,
      initialWeapons: weapons,
      initialItems: items,
      abilities: data.abilities
    };
  }
}