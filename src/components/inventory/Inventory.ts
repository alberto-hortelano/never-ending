import type { ICharacter, IItem, IWeapon } from "../../common/interfaces";
import type { DeepReadonly } from "../../common/helpers/types";

import { Component } from "../Component";
import { UpdateStateEvent } from "../../common/events";
import { Inventory as InventoryService } from "../../common/services/Inventory";

interface InventoryOptions {
    character: DeepReadonly<ICharacter>;
}

export class Inventory extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private options?: InventoryOptions;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Render with current options if they exist
        if (this.options) {
            this.renderContent(root);
        }
        return root;
    }

    public setOptions(options: InventoryOptions) {
        this.options = options;

        // Try to render immediately if shadowRoot exists
        const root = this.shadowRoot;
        if (root) {
            root.innerHTML = '';
            this.renderContent(root);
        }
    }

    private renderContent(root: ShadowRoot | HTMLElement) {
        if (!this.options) return;

        const { character } = this.options;
        const inventory = character.inventory;

        // Calculate total weight
        const totalWeight = InventoryService.calculateTotalWeight(inventory.items);

        // Create inventory container
        const container = document.createElement('div');
        container.className = 'inventory-container';

        // Header with weight info
        const header = document.createElement('div');
        header.className = 'inventory-header';
        header.innerHTML = `
            <h3>Inventory</h3>
            <div class="weight-info">
                <span class="weight-icon">⚖️</span>
                <span class="weight-text">${totalWeight} / ${inventory.maxWeight} kg</span>
            </div>
        `;
        container.appendChild(header);

        // Equipped weapons section
        const equippedSection = document.createElement('div');
        equippedSection.className = 'equipped-section';
        equippedSection.innerHTML = '<h4>Equipped Weapons</h4>';

        const weaponSlots = document.createElement('div');
        weaponSlots.className = 'weapon-slots';

        // Primary weapon slot
        const primarySlot = this.createWeaponSlot('Primary', inventory.equippedWeapons.primary, 'primary');
        weaponSlots.appendChild(primarySlot);

        // Secondary weapon slot
        const secondarySlot = this.createWeaponSlot('Secondary', inventory.equippedWeapons.secondary, 'secondary');
        weaponSlots.appendChild(secondarySlot);

        equippedSection.appendChild(weaponSlots);
        container.appendChild(equippedSection);

        // Items list section
        const itemsSection = document.createElement('div');
        itemsSection.className = 'items-section';
        itemsSection.innerHTML = '<h4>Items</h4>';

        const itemsList = document.createElement('div');
        itemsList.className = 'items-list';

        // Group items by type
        const { weapons: weaponItems, otherItems } = InventoryService.groupItemsByType(inventory.items);

        // Render weapons
        if (weaponItems.length > 0) {
            const weaponsGroup = document.createElement('div');
            weaponsGroup.className = 'item-group';
            weaponsGroup.innerHTML = '<h5>Weapons</h5>';

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
            otherGroup.innerHTML = '<h5>Other Items</h5>';

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
            emptyMessage.textContent = 'Your inventory is empty';
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
                <div class="empty-slot">Empty</div>
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
            equipBtn.textContent = 'Equip';
            equipBtn.addEventListener('click', () => this.handleEquip(weapon));
            itemElement.appendChild(equipBtn);
        }

        return itemElement;
    }

    private handleEquip(weapon: IWeapon) {
        if (!this.options) return;

        const character = this.options.character;
        const slot = InventoryService.determineWeaponSlot(weapon, character.inventory.equippedWeapons);

        // Dispatch equip event
        this.dispatch(UpdateStateEvent.equipWeapon, {
            characterName: character.name,
            weaponId: weapon.id,
            slot: slot
        });
    }

    private handleUnequip(slot: 'primary' | 'secondary') {
        if (!this.options) return;

        // Dispatch unequip event (null weaponId means unequip)
        this.dispatch(UpdateStateEvent.equipWeapon, {
            characterName: this.options.character.name,
            weaponId: null,
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