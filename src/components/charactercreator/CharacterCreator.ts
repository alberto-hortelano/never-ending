import { Component } from '../Component.js';
import { ControlsEvent, StateChangeEvent } from '../../common/events/index.js';
import { CharacterCreationService } from '../../common/services/CharacterCreationService.js';
import Character from '../character/Character.js';
import type { Direction, ICreatorData } from '../../common/interfaces.js';
import { weapons } from '../../data/state.js';
import { DirectionsService } from '../../common/services/DirectionsService.js';
import { i18n } from '../../common/i18n/i18n.js';

export default class CharacterCreator extends Component {
  protected override hasCss = true;
  protected override hasHtml = true;
  private shadowRootRef: ShadowRoot | null = null;

  private characterPreview: Character | null = null;
  private currentDirection: Direction = 'down';
  private currentAction: string = 'idle';

  // Local state management
  private characterData: ICreatorData = CharacterCreationService.createDefaultCharacterData();
  
  constructor() {
    super();
    // Listen for language changes
    this.listen(StateChangeEvent.language, () => {
      this.updateTranslations();
    });
  }

  override async connectedCallback() {
    const root = await super.connectedCallback();
    if (!root) return root;
    
    // Store the root reference
    this.shadowRootRef = root;

    this.setupEventListeners(root);
    this.initializeAppearance(root);
    this.initializeAbilities(root);
    this.initializeEquipment(root);
    this.updateCreateButton(root);

    // Create character preview immediately
    this.createCharacterPreview(root);
    
    // Update translations immediately and after a frame to ensure DOM is ready
    this.updateTranslations();
    requestAnimationFrame(() => {
      this.updateTranslations();
    });

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
    // Mark as standalone so it doesn't try to access state
    this.characterPreview.setAttribute('data-standalone', 'true');

    previewContainer.appendChild(this.characterPreview);

    // Wait for the character component to be ready
    // Since we're using closed shadow DOM, we can't check shadowRoot
    // Instead, we'll wait a bit and then call updateAppearance
    setTimeout(() => {
      this.updateCharacterPreview();
    }, 100);
  }

  private updateCharacterPreview() {
    if (!this.characterPreview) return;

    // Call the character's update method
    if (typeof this.characterPreview.updateAppearance === 'function') {
      const palette = {
        skin: this.characterData.colors.skin,
        helmet: this.characterData.colors.helmet,
        suit: this.characterData.colors.suit
      };

      // Get the weapon class from the selected weapon
      let weaponClass: string | undefined;
      if (this.characterData.primaryWeapon) {
        const weapon = weapons.find(w => w.id === this.characterData.primaryWeapon);
        weaponClass = weapon?.class;
      }

      this.characterPreview.updateAppearance(
        this.characterData.race,
        palette,
        this.currentDirection,
        this.currentAction,
        weaponClass
      );
      
      // Since we can't access the closed shadow DOM, the action classes
      // are handled by the Character component via updateAppearance
    }
  }

  private rotateCharacter(direction: number) {
    const directions = DirectionsService.getAllDirectionValues();
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

    // Group weapons by category
    const meleeWeapons = weapons.filter(w => w.category === 'melee');
    const rangedWeapons = weapons.filter(w => w.category === 'ranged');
    
    // Add melee weapons group
    if (meleeWeapons.length > 0) {
      const meleeGroup1 = document.createElement('optgroup');
      meleeGroup1.label = '⚔️ Melee Weapons';
      const meleeGroup2 = document.createElement('optgroup');
      meleeGroup2.label = '⚔️ Melee Weapons';
      
      meleeWeapons.forEach(weapon => {
        const option1 = document.createElement('option');
        option1.value = weapon.id;
        option1.textContent = `${weapon.name} (${i18n.t('ui.damage')}: ${weapon.damage}, ${i18n.t('ui.range')}: ${weapon.range}, ${weapon.weight}${i18n.t('ui.weight')}, ${weapon.cost}${i18n.t('ui.cost')})`;
        meleeGroup1.appendChild(option1);

        const option2 = option1.cloneNode(true) as HTMLOptionElement;
        meleeGroup2.appendChild(option2);
      });
      
      primarySelect?.appendChild(meleeGroup1);
      secondarySelect?.appendChild(meleeGroup2);
    }
    
    // Add ranged weapons group
    if (rangedWeapons.length > 0) {
      const rangedGroup1 = document.createElement('optgroup');
      rangedGroup1.label = '🔫 Ranged Weapons';
      const rangedGroup2 = document.createElement('optgroup');
      rangedGroup2.label = '🔫 Ranged Weapons';
      
      rangedWeapons.forEach(weapon => {
        const option1 = document.createElement('option');
        option1.value = weapon.id;
        option1.textContent = `${weapon.name} (${i18n.t('ui.damage')}: ${weapon.damage}, ${i18n.t('ui.range')}: ${weapon.range}, ${weapon.weight}${i18n.t('ui.weight')}, ${weapon.cost}${i18n.t('ui.cost')})`;
        rangedGroup1.appendChild(option1);

        const option2 = option1.cloneNode(true) as HTMLOptionElement;
        rangedGroup2.appendChild(option2);
      });
      
      primarySelect?.appendChild(rangedGroup1);
      secondarySelect?.appendChild(rangedGroup2);
    }

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
        statsDiv.innerHTML = `<span>${item.weight}${i18n.t('ui.weight')}</span><span>${item.cost}${i18n.t('ui.cost')}</span>`;

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
  
  private updateTranslations() {
    const root = this.shadowRootRef;
    if (!root) return;
    
    // Update title
    const title = root.querySelector('.creator-header h2');
    if (title) title.textContent = i18n.t('character.createTitle');
    
    // Update section headers
    const sectionHeaders = root.querySelectorAll('h3');
    sectionHeaders.forEach(header => {
      const text = header.textContent?.toLowerCase();
      if (text?.includes('name')) header.textContent = i18n.t('character.name');
      else if (text?.includes('race')) header.textContent = i18n.t('character.race');
      else if (text?.includes('action')) header.textContent = i18n.t('character.actions');
      else if (text?.includes('color')) header.textContent = i18n.t('character.colors');
      else if (text?.includes('equipment')) header.textContent = i18n.t('character.equipment');
      else if (text?.includes('abilit')) header.textContent = i18n.t('character.abilities');
      else if (text?.includes('description')) header.textContent = i18n.t('character.description');
    });
    
    // Update labels
    const labels = root.querySelectorAll('label');
    labels.forEach(label => {
      const text = label.textContent?.toLowerCase();
      if (text?.includes('skin') && label.childNodes[0]) label.childNodes[0].textContent = i18n.t('character.skin') + ' ';
      else if (text?.includes('helmet') && label.childNodes[0]) label.childNodes[0].textContent = i18n.t('character.helmet') + ' ';
      else if (text?.includes('suit') && label.childNodes[0]) label.childNodes[0].textContent = i18n.t('character.suit') + ' ';
      else if (text?.includes('primary') && label.childNodes[0]) label.childNodes[0].textContent = i18n.t('character.primary') + ' ';
      else if (text?.includes('secondary') && label.childNodes[0]) label.childNodes[0].textContent = i18n.t('character.secondary') + ' ';
    });
    
    // Update action buttons
    const actionButtons = root.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
      const text = button.textContent?.toLowerCase();
      if (text?.includes('idle')) button.textContent = i18n.t('character.idle');
      else if (text?.includes('walk')) button.textContent = i18n.t('character.walk');
      else if (text?.includes('shoot')) button.textContent = i18n.t('character.shoot');
      else if (text?.includes('slash')) button.textContent = i18n.t('character.slash');
      else if (text?.includes('death')) button.textContent = i18n.t('character.death');
    });
    
    // Update equipment headers
    const weightSpan = root.querySelector('.weight-display');
    if (weightSpan && weightSpan.textContent) {
      const match = weightSpan.textContent.match(/\d+\/\d+/);
      if (match) {
        weightSpan.textContent = i18n.t('character.weight') + ' ' + match[0];
      }
    }
    
    const budgetSpan = root.querySelector('.budget-display');
    if (budgetSpan && budgetSpan.textContent) {
      const match = budgetSpan.textContent.match(/\d+\/\d+/);
      if (match) {
        budgetSpan.textContent = i18n.t('character.budget') + ' ' + match[0] + ' ' + i18n.t('character.points');
      }
    }
    
    // Update equipment tabs
    const weaponsTab = root.querySelector('.tab-btn[data-tab="weapons"]');
    const itemsTab = root.querySelector('.tab-btn[data-tab="items"]');
    if (weaponsTab) weaponsTab.textContent = i18n.t('character.weapons');
    if (itemsTab) itemsTab.textContent = i18n.t('character.items');
    
    // Update ability labels
    const abilityLabels = root.querySelectorAll('.ability-item label');
    abilityLabels.forEach(label => {
      const text = label.textContent?.toLowerCase();
      if (text?.includes('move')) label.textContent = i18n.t('character.moveCost');
      else if (text?.includes('fire')) label.textContent = i18n.t('character.fireCost');
      else if (text?.includes('melee')) label.textContent = i18n.t('character.meleeCost');
      else if (text?.includes('vision')) label.textContent = i18n.t('character.visionRange');
      else if (text?.includes('action points')) label.textContent = i18n.t('character.actionPoints');
      else if (text?.includes('base damage')) label.textContent = i18n.t('character.baseDamage');
      else if (text?.includes('shooting')) label.textContent = i18n.t('character.shootingAccuracy');
      else if (text?.includes('melee accuracy')) label.textContent = i18n.t('character.meleeAccuracy');
      else if (text?.includes('armor')) label.textContent = i18n.t('character.armor');
    });
    
    // Update buttons
    const cancelBtn = root.querySelector('#cancelBtn');
    const createBtn = root.querySelector('#createBtn');
    if (cancelBtn) cancelBtn.textContent = i18n.t('character.cancel');
    if (createBtn) createBtn.textContent = i18n.t('character.confirm');
    
    // Update race button labels
    const raceButtons = root.querySelectorAll('.race-btn');
    raceButtons.forEach(btn => {
      const race = btn.getAttribute('data-race');
      const textSpan = btn.querySelector('span:last-child');
      if (textSpan && race) {
        if (race === 'human') textSpan.textContent = i18n.t('character.races.human');
        else if (race === 'alien') textSpan.textContent = i18n.t('character.races.alien');
        else if (race === 'robot') textSpan.textContent = i18n.t('character.races.robot');
      }
    });
    
    // Update rotate label
    const rotateLabel = root.querySelector('.rotation-label');
    if (rotateLabel) rotateLabel.textContent = i18n.t('character.rotate');
    
    // Update presets header
    const presetsHeader = root.querySelector('.preset-colors h3');
    if (presetsHeader) presetsHeader.textContent = i18n.t('character.presets');
    
    // Update "None" option in weapon selects
    const noneOptions = root.querySelectorAll('select option[value=""]');
    noneOptions.forEach(option => {
      option.textContent = i18n.t('character.none');
    });
    
    // Update credits label
    const creditsSpan = root.querySelector('.equipment-budget span:nth-child(5)');
    if (creditsSpan) creditsSpan.textContent = i18n.t('character.credits');
    
    // Update points label
    const pointsSpan = root.querySelector('.points-display > span:last-child');
    if (pointsSpan) pointsSpan.textContent = ' ' + i18n.t('character.pointsLabel');
    
    // Update placeholders
    const nameInput = root.querySelector('#characterName') as HTMLInputElement;
    if (nameInput) nameInput.placeholder = i18n.t('character.namePlaceholder');
    
    const descTextarea = root.querySelector('#characterDesc') as HTMLTextAreaElement;
    if (descTextarea) descTextarea.placeholder = i18n.t('character.descriptionPlaceholder');
    
    // Update abilities note
    const abilitiesNote = root.querySelector('.abilities-note small');
    if (abilitiesNote) abilitiesNote.textContent = i18n.t('character.abilitiesNote');
  }
}

customElements.define('character-creator', CharacterCreator);