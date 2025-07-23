import { Component } from '../Component.js';
import { ControlsEvent } from '../../common/events/index.js';
import { CharacterCreationService } from '../../common/services/CharacterCreationService.js';
import Character from '../character/Character.js';
import type { Direction, ICreatorData } from '../../common/interfaces.js';

export default class CharacterCreator extends Component {
  protected override hasCss = true;
  protected override hasHtml = true;
  
  private characterPreview: Character | null = null;
  private currentDirection: Direction = 'down';
  private currentAction: string = 'idle';
  
  // Local state management
  private characterData: ICreatorData = CharacterCreationService.createDefaultCharacterData();
  
  override async connectedCallback() {
    const root = await super.connectedCallback();
    if (!root) return root;
    
    this.setupEventListeners(root);
    this.initializeAppearance(root);
    this.initializeAbilities(root);
    this.initializeEquipment(root);
    this.updateCreateButton(root);
    
    // Create character preview immediately
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
  
  
  private initializeAppearance(root: ShadowRoot) {
    // Color inputs
    const skinColor = root.querySelector('#skinColor') as HTMLInputElement;
    const helmetColor = root.querySelector('#helmetColor') as HTMLInputElement;
    const suitColor = root.querySelector('#suitColor') as HTMLInputElement;
    
    // Setup color change handlers
    const updateColor = (type: keyof ICreatorData['colors'], input: HTMLInputElement) => {
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
    
    // Action controls
    const actionBtns = root.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action!;
        this.setCharacterAction(root, action);
      });
    });
    
    // Create preset buttons
    this.createPresetButtons(root);
  }
  
  private createPresetButtons(root: ShadowRoot) {
    const presetGrid = root.querySelector('#presetGrid');
    if (!presetGrid) return;
    
    CharacterCreationService.COLOR_PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.title = preset.name;
      
      const colorsDiv = document.createElement('div');
      colorsDiv.className = 'preset-colors-display';
      
      ['skin', 'helmet', 'suit'].forEach(type => {
        const colorDiv = document.createElement('div');
        colorDiv.style.backgroundColor = preset[type as keyof typeof preset];
        colorsDiv.appendChild(colorDiv);
      });
      
      btn.appendChild(colorsDiv);
      btn.addEventListener('click', () => this.applyPreset(root, preset));
      presetGrid.appendChild(btn);
    });
  }
  
  private applyPreset(root: ShadowRoot, preset: typeof CharacterCreationService.COLOR_PRESETS[0]) {
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
    const previewContainer = root.querySelector('#characterPreview');
    if (!previewContainer) return;
    
    // Check if preview already exists
    if (this.characterPreview) return;
    
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
    this.characterPreview.dataset.action = this.currentAction;
    
    previewContainer.appendChild(this.characterPreview);
    
    // Wait a bit for the character component to initialize
    setTimeout(() => {
      this.updateCharacterPreview();
    }, 100);
  }
  
  private updateCharacterPreview() {
    if (!this.characterPreview) return;
    
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
        this.currentDirection,
        this.currentAction,
        this.characterData.primaryWeapon
      );
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
  
  private setCharacterAction(root: ShadowRoot, action: string) {
    this.currentAction = action;
    
    // Update button states
    const actionBtns = root.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-action') === action);
    });
    
    // Update preview
    if (this.characterPreview) {
      this.characterPreview.dataset.action = action;
      this.updateCharacterPreview();
    }
  }
  
  private initializeAbilities(root: ShadowRoot) {
    const abilityItems = root.querySelectorAll('.ability-item');
    
    abilityItems.forEach(item => {
      const ability = item.getAttribute('data-ability') as keyof ICreatorData['abilities'];
      const decreaseBtn = item.querySelector('[data-action="decrease"]') as HTMLButtonElement;
      const increaseBtn = item.querySelector('[data-action="increase"]') as HTMLButtonElement;
      const costSpan = item.querySelector('.ability-cost') as HTMLElement;
      
      const defaultCost = parseInt(costSpan.getAttribute('data-default') || '10');
      const minCost = Math.max(1, defaultCost - 5);
      const maxCost = defaultCost + 5;
      
      decreaseBtn?.addEventListener('click', () => {
        const currentCost = this.characterData.abilities[ability];
        if (currentCost > minCost && CharacterCreationService.canSpendAbilityPoints(this.characterData.abilities, 1)) {
          this.characterData.abilities[ability]--;
          this.updateAbilityDisplay(root);
        }
      });
      
      increaseBtn?.addEventListener('click', () => {
        const currentCost = this.characterData.abilities[ability];
        if (currentCost < maxCost && CharacterCreationService.calculateUsedAbilityPoints(this.characterData.abilities) > 0) {
          this.characterData.abilities[ability]++;
          this.updateAbilityDisplay(root);
        }
      });
    });
    
    this.updateAbilityDisplay(root);
  }
  
  private updateAbilityDisplay(root: ShadowRoot) {
    // Update points display
    const pointsUsed = root.querySelector('#pointsUsed');
    const pointsTotal = root.querySelector('#pointsTotal');
    const usedPoints = CharacterCreationService.calculateUsedAbilityPoints(this.characterData.abilities);
    
    if (pointsUsed) pointsUsed.textContent = usedPoints.toString();
    if (pointsTotal) pointsTotal.textContent = CharacterCreationService.TOTAL_ABILITY_POINTS.toString();
    
    // Update ability costs and button states
    const abilityItems = root.querySelectorAll('.ability-item');
    abilityItems.forEach(item => {
      const ability = item.getAttribute('data-ability') as keyof ICreatorData['abilities'];
      const costSpan = item.querySelector('.ability-cost') as HTMLElement;
      const decreaseBtn = item.querySelector('[data-action="decrease"]') as HTMLButtonElement;
      const increaseBtn = item.querySelector('[data-action="increase"]') as HTMLButtonElement;
      
      const currentCost = this.characterData.abilities[ability];
      const defaultCost = parseInt(costSpan.getAttribute('data-default') || '10');
      const minCost = Math.max(1, defaultCost - 5);
      const maxCost = defaultCost + 5;
      
      costSpan.textContent = currentCost.toString();
      
      // Update button states
      decreaseBtn.disabled = currentCost <= minCost || !CharacterCreationService.canSpendAbilityPoints(this.characterData.abilities, 1);
      increaseBtn.disabled = currentCost >= maxCost || usedPoints <= 0;
    });
  }
  
  private initializeEquipment(root: ShadowRoot) {
    // Populate weapon selects
    const primarySelect = root.querySelector('#primaryWeapon') as HTMLSelectElement;
    const secondarySelect = root.querySelector('#secondaryWeapon') as HTMLSelectElement;
    
    CharacterCreationService.AVAILABLE_WEAPONS.forEach(weapon => {
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
      this.updateCharacterPreview();
    });
    
    secondarySelect?.addEventListener('change', () => {
      this.characterData.secondaryWeapon = secondarySelect.value || null;
      this.updateEquipmentDisplay(root);
      this.updateCreateButton(root);
    });
    
    // Create item checkboxes
    const itemsGrid = root.querySelector('#itemsGrid');
    if (itemsGrid) {
      CharacterCreationService.AVAILABLE_ITEMS.forEach(item => {
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
    // Calculate weight and cost
    const totalWeight = CharacterCreationService.calculateTotalWeight(this.characterData);
    const totalCost = CharacterCreationService.calculateTotalCost(this.characterData);
    
    // Update displays
    const currentWeight = root.querySelector('#currentWeight');
    const maxWeight = root.querySelector('#maxWeight');
    const budgetUsed = root.querySelector('#budgetUsed');
    const budgetTotal = root.querySelector('#budgetTotal');
    
    if (currentWeight) {
      currentWeight.textContent = totalWeight.toString();
      (currentWeight as HTMLElement).style.color = totalWeight > CharacterCreationService.MAX_WEIGHT ? 'var(--color-danger)' : '';
    }
    if (maxWeight) maxWeight.textContent = CharacterCreationService.MAX_WEIGHT.toString();
    
    if (budgetUsed) {
      budgetUsed.textContent = totalCost.toString();
      (budgetUsed as HTMLElement).style.color = totalCost > CharacterCreationService.EQUIPMENT_BUDGET ? 'var(--color-danger)' : '';
    }
    if (budgetTotal) budgetTotal.textContent = CharacterCreationService.EQUIPMENT_BUDGET.toString();
  }
  
  private selectRace(root: ShadowRoot, race: 'human' | 'alien' | 'robot') {
    this.characterData.race = race;
    
    // Update UI
    const raceBtns = root.querySelectorAll('.race-btn');
    raceBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-race') === race);
    });
    
    // Apply race-specific preset colors
    const preset = CharacterCreationService.getPresetForRace(race);
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
    
    const validation = CharacterCreationService.validateCharacterName(nameInput.value);
    
    nameError.textContent = validation.error || '';
    return validation.valid;
  }
  
  private updateCreateButton(root: ShadowRoot) {
    const createBtn = root.querySelector('#createBtn') as HTMLButtonElement;
    if (!createBtn) return;
    
    // Check all validation conditions
    const isValid = CharacterCreationService.validateCreatorData(this.characterData);
    createBtn.disabled = !isValid;
  }
  
  private createCharacter() {
    // Build the character data
    const characterData = CharacterCreationService.buildCharacterData(this.characterData);
    
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