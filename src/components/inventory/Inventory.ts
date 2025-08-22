import type { IItem, IWeapon } from "../../common/interfaces";
import type { InventoryUpdateData } from "../../common/events";

import { Component } from "../Component";
import { InventoryEvent, StateChangeEvent } from "../../common/events";
import { i18n } from "../../common/i18n/i18n";

export class Inventory extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private inventoryData?: InventoryUpdateData;
    private characterName?: string;
    private root?: ShadowRoot;

    override async connectedCallback() {
        // Listen for inventory updates BEFORE initializing shadow DOM
        this.listen(InventoryEvent.update, data => this.onInventoryUpdate(data));
        this.listen(InventoryEvent.error, error => this.onError(error));
        
        // Initialize shadow DOM
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Store the shadow root reference
        this.root = root;
        
        // Get selected character from state
        const state = this.getState();
        if (state?.ui.selectedCharacter) {
            this.characterName = state.ui.selectedCharacter;
            this.dispatch(InventoryEvent.request, this.characterName);
        }
        
        // Listen for selected character changes
        this.listen(StateChangeEvent.uiSelectedCharacter, (characterName) => {
            if (characterName && characterName !== this.characterName) {
                this.characterName = characterName;
                this.dispatch(InventoryEvent.request, characterName);
            }
        });
        
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            if (this.root && this.inventoryData) {
                this.root.innerHTML = '';
                this.renderContent(this.root);
            }
        });
        
        return root;
    }

    private onInventoryUpdate(data: InventoryUpdateData) {
        // Only update if this is for our character (case-insensitive comparison)
        if (data.character.name.toLowerCase() !== this.characterName?.toLowerCase()) return;
        
        this.inventoryData = data;
        if (this.root) {
            this.root.innerHTML = '';
            this.renderContent(this.root);
        }
    }
    
    private onError(error: string) {
        console.error('Inventory error:', error);
    }

    private renderContent(root: ShadowRoot | HTMLElement) {
        if (!this.inventoryData) return;

        const { character, totalWeight, groupedItems } = this.inventoryData;
        const inventory = character.inventory;

        // Create inventory container
        const container = document.createElement('div');
        container.className = 'inventory-container';

        // Header with weight info
        const header = document.createElement('div');
        header.className = 'inventory-header';
        header.innerHTML = `
            <h3>${i18n.t('inventory.title')}</h3>
            <div class="weight-info">
                <span class="weight-icon">⚖️</span>
                <span class="weight-text">${totalWeight} / ${inventory.maxWeight} kg</span>
            </div>
        `;
        container.appendChild(header);

        // Equipped weapons section
        const equippedSection = document.createElement('div');
        equippedSection.className = 'equipped-section';
        equippedSection.innerHTML = `<h4>${i18n.t('inventory.equipped')}</h4>`;

        const weaponSlots = document.createElement('div');
        weaponSlots.className = 'weapon-slots';

        // Primary weapon slot
        const primarySlot = this.createWeaponSlot(i18n.t('inventory.primary'), inventory.equippedWeapons.primary, 'primary');
        weaponSlots.appendChild(primarySlot);

        // Secondary weapon slot
        const secondarySlot = this.createWeaponSlot(i18n.t('inventory.secondary'), inventory.equippedWeapons.secondary, 'secondary');
        weaponSlots.appendChild(secondarySlot);

        equippedSection.appendChild(weaponSlots);
        container.appendChild(equippedSection);

        // Items list section
        const itemsSection = document.createElement('div');
        itemsSection.className = 'items-section';
        itemsSection.innerHTML = `<h4>${i18n.t('character.items')}</h4>`;

        const itemsList = document.createElement('div');
        itemsList.className = 'items-list';

        // Use pre-grouped items from service
        const { weapons: weaponItems, otherItems } = groupedItems;

        // Render weapons
        if (weaponItems.length > 0) {
            const weaponsGroup = document.createElement('div');
            weaponsGroup.className = 'item-group';
            weaponsGroup.innerHTML = `<h5>${i18n.t('inventory.weapons')}</h5>`;

            weaponItems.forEach(weapon => {
                const itemElement = this.createItemElement(weapon, true);
                weaponsGroup.appendChild(itemElement);
            });

            itemsList.appendChild(weaponsGroup);
        }

        // Render other items
        if (otherItems.length > 0) {
            const otherGroup = document.createElement('div');
            otherGroup.className = 'item-group';
            otherGroup.innerHTML = `<h5>${i18n.t('inventory.otherItems')}</h5>`;

            otherItems.forEach(item => {
                const itemElement = this.createItemElement(item, false);
                otherGroup.appendChild(itemElement);
            });

            itemsList.appendChild(otherGroup);
        }

        // Empty message if no items
        if (inventory.items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = i18n.t('inventory.empty');
            itemsList.appendChild(emptyMessage);
        }

        itemsSection.appendChild(itemsList);
        container.appendChild(itemsSection);

        root.appendChild(container);
    }

    private createWeaponSlot(label: string, weapon: IWeapon | null, slot: 'primary' | 'secondary'): HTMLElement {
        const slotElement = document.createElement('div');
        slotElement.className = 'weapon-slot';

        if (weapon) {
            slotElement.innerHTML = `
                <div class="slot-label">${label}</div>
                <div class="equipped-weapon">
                    <span class="weapon-icon">${weapon.icon}</span>
                    <span class="weapon-name">${weapon.name}</span>
                    <button class="unequip-btn" data-slot="${slot}">Unequip</button>
                </div>
                <div class="weapon-stats">
                    <span>Damage: ${weapon.damage}</span>
                    <span>Range: ${weapon.range}</span>
                </div>
            `;

            // Add unequip listener
            const unequipBtn = slotElement.querySelector('.unequip-btn') as HTMLButtonElement;
            unequipBtn.addEventListener('click', () => this.handleUnequip(slot));
        } else {
            slotElement.innerHTML = `
                <div class="slot-label">${label}</div>
                <div class="empty-slot">${i18n.t('inventory.emptySlot')}</div>
            `;
        }

        return slotElement;
    }

    private createItemElement(item: IItem, isWeapon: boolean): HTMLElement {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';

        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';
        itemInfo.innerHTML = `
            <span class="item-icon">${item.icon}</span>
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-description">${item.description}</div>
                ${isWeapon ? `<div class="item-stats">Damage: ${(item as IWeapon).damage} | Range: ${(item as IWeapon).range}</div>` : ''}
            </div>
            <div class="item-weight">${item.weight} kg</div>
        `;

        itemElement.appendChild(itemInfo);

        // Add equip button for weapons
        if (isWeapon) {
            const weapon = item as IWeapon;
            const equipBtn = document.createElement('button');
            equipBtn.className = 'equip-btn';
            equipBtn.textContent = i18n.t('inventory.equip');
            equipBtn.addEventListener('click', () => this.handleEquip(weapon));
            itemElement.appendChild(equipBtn);
        }

        return itemElement;
    }

    private handleEquip(weapon: IWeapon) {
        if (!this.characterName) return;

        // Dispatch equip event - let service determine the slot
        this.dispatch(InventoryEvent.equipWeapon, {
            characterName: this.characterName,
            weaponId: weapon.id
        });
    }

    private handleUnequip(slot: 'primary' | 'secondary') {
        if (!this.characterName) return;

        // Dispatch unequip event
        this.dispatch(InventoryEvent.unequipWeapon, {
            characterName: this.characterName,
            slot: slot
        });
    }

    // Custom element setup
    static {
        if (!customElements.get('inventory-component')) {
            customElements.define('inventory-component', Inventory);
        }
    }
}