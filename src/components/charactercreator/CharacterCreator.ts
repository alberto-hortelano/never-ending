import { Component } from '../Component.js';
import { ControlsEvent } from '../../common/events/index.js';
import Character from '../character/Character.js';
import type { Direction } from '../../common/interfaces.js';

interface ColorPreset {
  name: string;
  skin: string;
  helmet: string;
  suit: string;
}

interface AbilityCost {
  move: number;
  shoot: number;
  reload: number;
  pickup: number;
}

interface CharacterColors {
  skin: string;
  helmet: string;
  suit: string;
}

interface CreatorData {
  name: string;
  race: 'human' | 'alien' | 'robot';
  description: string;
  colors: CharacterColors;
  abilities: AbilityCost;
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  items: string[];
}

interface SimplifiedWeapon {
  id: string;
  name: string;
  weight: number;
  cost: number;
}

interface SimplifiedItem {
  id: string;
  name: string;
  weight: number;
  cost: number;
}

export default class CharacterCreator extends Component {
  protected override hasCss = true;
  protected override hasHtml = true;
  
  private characterData: CreatorData = {
    name: '',
    race: 'human',
    description: '',
    colors: {
      skin: '#E5B887',
      helmet: '#4A5568',
      suit: '#2D3748'
    },
    abilities: {
      move: 10,
      shoot: 20,
      reload: 15,
      pickup: 5
    },
    primaryWeapon: null,
    secondaryWeapon: null,
    items: []
  };
  
  private characterPreview: Character | null = null;
  private currentDirection: Direction = 'down';
  
  private readonly TOTAL_ABILITY_POINTS = 10;
  private readonly EQUIPMENT_BUDGET = 1000;
  private readonly MAX_WEIGHT = 100;
  
  private readonly COLOR_PRESETS: ColorPreset[] = [
    { name: 'Default Human', skin: '#E5B887', helmet: '#4A5568', suit: '#2D3748' },
    { name: 'Pale Human', skin: '#F5DEB3', helmet: '#2C5282', suit: '#1A365D' },
    { name: 'Dark Human', skin: '#8B6F47', helmet: '#744210', suit: '#5D4E37' },
    { name: 'Alien Green', skin: '#90EE90', helmet: '#228B22', suit: '#006400' },
    { name: 'Alien Purple', skin: '#DDA0DD', helmet: '#8B008B', suit: '#4B0082' },
    { name: 'Robot Steel', skin: '#C0C0C0', helmet: '#708090', suit: '#2F4F4F' },
    { name: 'Robot Gold', skin: '#FFD700', helmet: '#B8860B', suit: '#8B7500' },
    { name: 'Robot Copper', skin: '#CD7F32', helmet: '#8B4513', suit: '#654321' }
  ];
  
  // Simplified weapons for prototype - in a real game these would come from data
  private readonly AVAILABLE_WEAPONS: Array<SimplifiedWeapon> = [
    { id: 'pistol', name: 'Pistol', weight: 5, cost: 100 },
    { id: 'rifle', name: 'Rifle', weight: 10, cost: 300 },
    { id: 'shotgun', name: 'Shotgun', weight: 12, cost: 250 },
    { id: 'smg', name: 'SMG', weight: 8, cost: 200 }
  ];
  
  // Simplified items for prototype - in a real game these would come from data
  private readonly AVAILABLE_ITEMS: Array<SimplifiedItem> = [
    { id: 'medkit', name: 'Medkit', weight: 2, cost: 50 },
    { id: 'ammo_box', name: 'Ammo Box', weight: 5, cost: 30 },
    { id: 'grenade', name: 'Grenade', weight: 1, cost: 75 },
    { id: 'armor', name: 'Body Armor', weight: 15, cost: 200 },
    { id: 'scope', name: 'Scope', weight: 1, cost: 100 }
  ];
  
  override async connectedCallback() {
    const root = await super.connectedCallback();
    if (!root) return root;
    
    this.setupEventListeners(root);
    this.initializeTabs(root);
    this.initializeAppearance(root);
    this.initializeAbilities(root);
    this.initializeEquipment(root);
    this.updateCreateButton(root);
    
    // Create character preview immediately since appearance is the first tab
    this.createCharacterPreview(root);
    
    return root;
  }
  
  private setupEventListeners(root: ShadowRoot) {
    // Close button
    const closeBtn = root.querySelector('#closeBtn');
    closeBtn?.addEventListener('click', () => this.close());
    
    // Cancel button
    const cancelBtn = root.querySelector('#cancelBtn');
    cancelBtn?.addEventListener('click', () => this.close());
    
    // Create button
    const createBtn = root.querySelector('#createBtn');
    createBtn?.addEventListener('click', () => this.createCharacter());
    
    // Character name input
    const nameInput = root.querySelector('#characterName') as HTMLInputElement;
    nameInput?.addEventListener('input', (e) => {
      this.characterData.name = (e.target as HTMLInputElement).value;
      this.validateName(root);
      this.updateCreateButton(root);
    });
    
    // Race selection
    const raceBtns = root.querySelectorAll('.race-btn');
    raceBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const race = (e.currentTarget as HTMLElement).dataset.race as 'human' | 'alien' | 'robot';
        this.selectRace(root, race);
      });
    });
    
    // Description
    const descInput = root.querySelector('#characterDesc') as HTMLTextAreaElement;
    descInput?.addEventListener('input', (e) => {
      this.characterData.description = (e.target as HTMLTextAreaElement).value;
    });
  }
  
  private initializeTabs(root: ShadowRoot) {
    const tabBtns = root.querySelectorAll('.tab-btn');
    const tabPanels = root.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab!;
        
        // Update active states
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const panel = root.querySelector(`[data-panel="${tab}"]`);
        panel?.classList.add('active');
      });
    });
  }
  
  private initializeAppearance(root: ShadowRoot) {
    // Color inputs
    const skinColor = root.querySelector('#skinColor') as HTMLInputElement;
    const helmetColor = root.querySelector('#helmetColor') as HTMLInputElement;
    const suitColor = root.querySelector('#suitColor') as HTMLInputElement;
    
    // Setup color change handlers
    const updateColor = (type: keyof CharacterColors, input: HTMLInputElement) => {
      input.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        this.characterData.colors[type] = color;
        
        // Update color value display
        const valueSpan = input.nextElementSibling as HTMLElement;
        if (valueSpan) valueSpan.textContent = color.toUpperCase();
        
        // Update preview
        this.updateCharacterPreview();
      });
    };
    
    if (skinColor) updateColor('skin', skinColor);
    if (helmetColor) updateColor('helmet', helmetColor);
    if (suitColor) updateColor('suit', suitColor);
    
    // Rotation controls
    const rotateLeft = root.querySelector('#rotateLeft');
    const rotateRight = root.querySelector('#rotateRight');
    
    rotateLeft?.addEventListener('click', () => this.rotateCharacter(-1));
    rotateRight?.addEventListener('click', () => this.rotateCharacter(1));
    
    // Create preset buttons
    this.createPresetButtons(root);
  }
  
  private createPresetButtons(root: ShadowRoot) {
    const presetGrid = root.querySelector('#presetGrid');
    if (!presetGrid) return;
    
    this.COLOR_PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.title = preset.name;
      
      const colorsDiv = document.createElement('div');
      colorsDiv.className = 'preset-colors-display';
      
      ['skin', 'helmet', 'suit'].forEach(type => {
        const colorDiv = document.createElement('div');
        colorDiv.style.backgroundColor = preset[type as keyof ColorPreset];
        colorsDiv.appendChild(colorDiv);
      });
      
      btn.appendChild(colorsDiv);
      btn.addEventListener('click', () => this.applyPreset(root, preset));
      presetGrid.appendChild(btn);
    });
  }
  
  private applyPreset(root: ShadowRoot, preset: ColorPreset) {
    // Update data
    this.characterData.colors = {
      skin: preset.skin,
      helmet: preset.helmet,
      suit: preset.suit
    };
    
    // Update UI
    const skinInput = root.querySelector('#skinColor') as HTMLInputElement;
    const helmetInput = root.querySelector('#helmetColor') as HTMLInputElement;
    const suitInput = root.querySelector('#suitColor') as HTMLInputElement;
    
    if (skinInput) {
      skinInput.value = preset.skin;
      (skinInput.nextElementSibling as HTMLElement).textContent = preset.skin.toUpperCase();
    }
    if (helmetInput) {
      helmetInput.value = preset.helmet;
      (helmetInput.nextElementSibling as HTMLElement).textContent = preset.helmet.toUpperCase();
    }
    if (suitInput) {
      suitInput.value = preset.suit;
      (suitInput.nextElementSibling as HTMLElement).textContent = preset.suit.toUpperCase();
    }
    
    // Update preview
    this.updateCharacterPreview();
  }
  
  private async createCharacterPreview(root: ShadowRoot) {
    console.log('[CharacterCreator] createCharacterPreview called');
    
    const previewContainer = root.querySelector('#characterPreview');
    if (!previewContainer) {
      console.error('[CharacterCreator] No preview container found');
      return;
    }
    
    // Check if preview already exists
    if (this.characterPreview) {
      console.log('[CharacterCreator] Preview already exists, skipping creation');
      return;
    }
    
    this.characterPreview = document.createElement('character-component') as Character;
    this.characterPreview.id = 'preview-character';
    
    // Set initial dataset attributes
    this.characterPreview.dataset.race = this.characterData.race;
    this.characterPreview.dataset.player = 'preview';
    this.characterPreview.dataset.isPreview = 'true'; // Flag to prevent state events
    // Character component expects palette as JSON string
    const paletteData = {
      skin: this.characterData.colors.skin,
      helmet: this.characterData.colors.helmet,
      suit: this.characterData.colors.suit
    };
    this.characterPreview.dataset.palette = JSON.stringify(paletteData);
    this.characterPreview.dataset.direction = this.currentDirection;
    
    console.log('[CharacterCreator] Creating character with dataset:', {
      race: this.characterPreview.dataset.race,
      player: this.characterPreview.dataset.player,
      palette: this.characterPreview.dataset.palette,
      direction: this.characterPreview.dataset.direction,
      isPreview: this.characterPreview.dataset.isPreview
    });
    
    previewContainer.appendChild(this.characterPreview);
    
    // Wait a bit for the character component to initialize
    setTimeout(() => {
      this.updateCharacterPreview();
    }, 100);
  }
  
  private updateCharacterPreview() {
    console.log('[CharacterCreator] updateCharacterPreview called');
    
    if (!this.characterPreview) {
      console.error('[CharacterCreator] No character preview to update');
      return;
    }
    
    // Call the character's update method
    if (typeof (this.characterPreview as any).updateAppearance === 'function') {
      const palette = {
        skin: this.characterData.colors.skin,
        helmet: this.characterData.colors.helmet,
        suit: this.characterData.colors.suit
      };
      
      (this.characterPreview as any).updateAppearance(
        this.characterData.race,
        palette,
        this.currentDirection
      );
      
      console.log('[CharacterCreator] Called updateAppearance on character');
    } else {
      console.error('[CharacterCreator] Character component does not have updateAppearance method');
    }
  }
  
  private rotateCharacter(direction: number) {
    const directions: Direction[] = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left'];
    const currentIndex = directions.indexOf(this.currentDirection);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = directions.length - 1;
    if (newIndex >= directions.length) newIndex = 0;
    
    this.currentDirection = directions[newIndex] || 'down';
    this.updateCharacterPreview();
  }
  
  private initializeAbilities(root: ShadowRoot) {
    const abilityItems = root.querySelectorAll('.ability-item');
    
    abilityItems.forEach(item => {
      const ability = item.getAttribute('data-ability') as keyof AbilityCost;
      const decreaseBtn = item.querySelector('[data-action="decrease"]') as HTMLButtonElement;
      const increaseBtn = item.querySelector('[data-action="increase"]') as HTMLButtonElement;
      const costSpan = item.querySelector('.ability-cost') as HTMLElement;
      
      const defaultCost = parseInt(costSpan.getAttribute('data-default') || '10');
      const minCost = Math.max(1, defaultCost - 5);
      const maxCost = defaultCost + 5;
      
      decreaseBtn?.addEventListener('click', () => {
        const currentCost = this.characterData.abilities[ability];
        if (currentCost > minCost && this.canSpendPoints(1)) {
          this.characterData.abilities[ability]--;
          this.updateAbilityDisplay(root);
        }
      });
      
      increaseBtn?.addEventListener('click', () => {
        const currentCost = this.characterData.abilities[ability];
        if (currentCost < maxCost && this.getUsedPoints() > 0) {
          this.characterData.abilities[ability]++;
          this.updateAbilityDisplay(root);
        }
      });
    });
    
    this.updateAbilityDisplay(root);
  }
  
  private getUsedPoints(): number {
    const defaults = { move: 10, shoot: 20, reload: 15, pickup: 5 };
    let used = 0;
    
    Object.keys(defaults).forEach(key => {
      const ability = key as keyof AbilityCost;
      const diff = defaults[ability] - this.characterData.abilities[ability];
      if (diff > 0) used += diff;
    });
    
    return used;
  }
  
  private canSpendPoints(points: number): boolean {
    return this.getUsedPoints() + points <= this.TOTAL_ABILITY_POINTS;
  }
  
  private updateAbilityDisplay(root: ShadowRoot) {
    // Update points display
    const pointsUsed = root.querySelector('#pointsUsed');
    const pointsTotal = root.querySelector('#pointsTotal');
    if (pointsUsed) pointsUsed.textContent = this.getUsedPoints().toString();
    if (pointsTotal) pointsTotal.textContent = this.TOTAL_ABILITY_POINTS.toString();
    
    // Update ability costs and button states
    const abilityItems = root.querySelectorAll('.ability-item');
    abilityItems.forEach(item => {
      const ability = item.getAttribute('data-ability') as keyof AbilityCost;
      const costSpan = item.querySelector('.ability-cost') as HTMLElement;
      const decreaseBtn = item.querySelector('[data-action="decrease"]') as HTMLButtonElement;
      const increaseBtn = item.querySelector('[data-action="increase"]') as HTMLButtonElement;
      
      const currentCost = this.characterData.abilities[ability];
      const defaultCost = parseInt(costSpan.getAttribute('data-default') || '10');
      const minCost = Math.max(1, defaultCost - 5);
      const maxCost = defaultCost + 5;
      
      costSpan.textContent = currentCost.toString();
      
      // Update button states
      decreaseBtn.disabled = currentCost <= minCost || !this.canSpendPoints(1);
      increaseBtn.disabled = currentCost >= maxCost || this.getUsedPoints() <= 0;
    });
  }
  
  private initializeEquipment(root: ShadowRoot) {
    // Populate weapon selects
    const primarySelect = root.querySelector('#primaryWeapon') as HTMLSelectElement;
    const secondarySelect = root.querySelector('#secondaryWeapon') as HTMLSelectElement;
    
    this.AVAILABLE_WEAPONS.forEach(weapon => {
      const option1 = document.createElement('option');
      option1.value = weapon.id;
      option1.textContent = `${weapon.name} (${weapon.weight}kg, ${weapon.cost} credits)`;
      primarySelect?.appendChild(option1);
      
      const option2 = option1.cloneNode(true) as HTMLOptionElement;
      secondarySelect?.appendChild(option2);
    });
    
    // Weapon change handlers
    primarySelect?.addEventListener('change', () => {
      this.characterData.primaryWeapon = primarySelect.value || null;
      this.updateEquipmentDisplay(root);
      this.updateCreateButton(root);
    });
    
    secondarySelect?.addEventListener('change', () => {
      this.characterData.secondaryWeapon = secondarySelect.value || null;
      this.updateEquipmentDisplay(root);
      this.updateCreateButton(root);
    });
    
    // Create item checkboxes
    const itemsGrid = root.querySelector('#itemsGrid');
    if (itemsGrid) {
      this.AVAILABLE_ITEMS.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `item-${item.id}`;
        checkbox.value = item.id;
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'item-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = item.name;
        
        const statsDiv = document.createElement('div');
        statsDiv.className = 'item-stats';
        statsDiv.innerHTML = `<span>${item.weight}kg</span><span>${item.cost}c</span>`;
        
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(statsDiv);
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(infoDiv);
        
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            this.characterData.items.push(item.id);
            itemDiv.classList.add('selected');
          } else {
            this.characterData.items = this.characterData.items.filter(id => id !== item.id);
            itemDiv.classList.remove('selected');
          }
          this.updateEquipmentDisplay(root);
          this.updateCreateButton(root);
        });
        
        itemsGrid.appendChild(itemDiv);
      });
    }
    
    this.updateEquipmentDisplay(root);
  }
  
  private updateEquipmentDisplay(root: ShadowRoot) {
    // Calculate weight
    let totalWeight = 0;
    
    if (this.characterData.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.primaryWeapon);
      if (weapon) totalWeight += weapon.weight;
    }
    
    if (this.characterData.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.secondaryWeapon);
      if (weapon) totalWeight += weapon.weight;
    }
    
    this.characterData.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) totalWeight += item.weight;
    });
    
    // Calculate cost
    let totalCost = 0;
    
    if (this.characterData.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.primaryWeapon);
      if (weapon) totalCost += weapon.cost;
    }
    
    if (this.characterData.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.secondaryWeapon);
      if (weapon) totalCost += weapon.cost;
    }
    
    this.characterData.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) totalCost += item.cost;
    });
    
    // Update displays
    const currentWeight = root.querySelector('#currentWeight');
    const maxWeight = root.querySelector('#maxWeight');
    const budgetUsed = root.querySelector('#budgetUsed');
    const budgetTotal = root.querySelector('#budgetTotal');
    
    if (currentWeight) {
      currentWeight.textContent = totalWeight.toString();
      (currentWeight as HTMLElement).style.color = totalWeight > this.MAX_WEIGHT ? 'var(--color-danger)' : '';
    }
    if (maxWeight) maxWeight.textContent = this.MAX_WEIGHT.toString();
    
    if (budgetUsed) {
      budgetUsed.textContent = totalCost.toString();
      (budgetUsed as HTMLElement).style.color = totalCost > this.EQUIPMENT_BUDGET ? 'var(--color-danger)' : '';
    }
    if (budgetTotal) budgetTotal.textContent = this.EQUIPMENT_BUDGET.toString();
  }
  
  private selectRace(root: ShadowRoot, race: 'human' | 'alien' | 'robot') {
    this.characterData.race = race;
    
    // Update UI
    const raceBtns = root.querySelectorAll('.race-btn');
    raceBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-race') === race);
    });
    
    // Apply race-specific preset colors
    const presetIndex = race === 'alien' ? 3 : race === 'robot' ? 5 : 0;
    const preset = this.COLOR_PRESETS[presetIndex];
    if (preset) {
      this.applyPreset(root, preset);
    }
    
    // Update preview race
    if (this.characterPreview) {
      this.characterPreview.dataset.race = race;
      this.updateCharacterPreview();
    }
  }
  
  private validateName(root: ShadowRoot): boolean {
    const nameInput = root.querySelector('#characterName') as HTMLInputElement;
    const nameError = root.querySelector('#nameError') as HTMLElement;
    
    if (!nameInput || !nameError) return false;
    
    const name = nameInput.value.trim();
    
    if (name.length === 0) {
      nameError.textContent = 'Name is required';
      return false;
    }
    
    if (name.length < 2) {
      nameError.textContent = 'Name must be at least 2 characters';
      return false;
    }
    
    if (!/^[a-zA-Z0-9\s-_]+$/.test(name)) {
      nameError.textContent = 'Name contains invalid characters';
      return false;
    }
    
    nameError.textContent = '';
    return true;
  }
  
  private updateCreateButton(root: ShadowRoot) {
    const createBtn = root.querySelector('#createBtn') as HTMLButtonElement;
    if (!createBtn) return;
    
    // Check all validation conditions
    const hasValidName = this.validateName(root);
    const hasValidWeight = this.getCurrentWeight() <= this.MAX_WEIGHT;
    const hasValidBudget = this.getCurrentCost() <= this.EQUIPMENT_BUDGET;
    
    createBtn.disabled = !hasValidName || !hasValidWeight || !hasValidBudget;
  }
  
  private getCurrentWeight(): number {
    let weight = 0;
    
    if (this.characterData.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.primaryWeapon);
      if (weapon) weight += weapon.weight;
    }
    
    if (this.characterData.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.secondaryWeapon);
      if (weapon) weight += weapon.weight;
    }
    
    this.characterData.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) weight += item.weight;
    });
    
    return weight;
  }
  
  private getCurrentCost(): number {
    let cost = 0;
    
    if (this.characterData.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.primaryWeapon);
      if (weapon) cost += weapon.cost;
    }
    
    if (this.characterData.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.secondaryWeapon);
      if (weapon) cost += weapon.cost;
    }
    
    this.characterData.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) cost += item.cost;
    });
    
    return cost;
  }
  
  private createCharacter() {
    // Build the character object
    const weapons: SimplifiedWeapon[] = [];
    const items: SimplifiedItem[] = [];
    
    if (this.characterData.primaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.primaryWeapon);
      if (weapon) {
        weapons.push(weapon);
      }
    }
    
    if (this.characterData.secondaryWeapon) {
      const weapon = this.AVAILABLE_WEAPONS.find(w => w.id === this.characterData.secondaryWeapon);
      if (weapon) {
        weapons.push(weapon);
      }
    }
    
    this.characterData.items.forEach(itemId => {
      const item = this.AVAILABLE_ITEMS.find(i => i.id === itemId);
      if (item) {
        items.push(item);
      }
    });
    
    // Create a partial character with the essential data
    // The game system will complete the character creation
    const characterData = {
      name: this.characterData.name,
      race: this.characterData.race,
      description: this.characterData.description,
      palette: this.characterData.colors,
      initialWeapons: weapons,
      initialItems: items,
      abilities: this.characterData.abilities
    };
    
    // Dispatch event to create character
    this.dispatch(ControlsEvent.createCharacter, characterData);
    
    // Close the creator
    this.close();
  }
  
  private close() {
    this.dispatch(ControlsEvent.closeCharacterCreator, null);
    this.remove();
  }
}

customElements.define('character-creator', CharacterCreator);