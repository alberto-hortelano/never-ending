import { Component } from '../Component';
import { originStories } from '../../common/data/originStories';
import type { IOriginStory } from '../../common/interfaces/IStory';
import { ControlsEvent, UpdateStateEvent } from '../../common/events';

export class OriginSelection extends Component {
    protected override hasHtml = true;
    protected override hasCss = true;
    
    private selectedOrigin: IOriginStory | null = null;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.renderOrigins(root);
        this.setupEventListeners(root);
        
        return root;
    }

    private renderOrigins(root: ShadowRoot) {
        const container = root.querySelector('.origins-container');
        if (!container) return;

        container.innerHTML = originStories.map(origin => `
            <div class="origin-card" data-origin-id="${origin.id}">
                <h3 class="origin-title">${origin.nameES}</h3>
                <p class="origin-english">${origin.name}</p>
                <p class="origin-description">${origin.descriptionES}</p>
                <div class="origin-traits">
                    ${origin.specialTraits.map(trait => 
                        `<span class="trait">${trait.replace(/_/g, ' ')}</span>`
                    ).join('')}
                </div>
                <div class="origin-companion">
                    <span class="companion-label">Compañero:</span>
                    <span class="companion-name">${origin.startingCompanion?.name || 'Ninguno'}</span>
                </div>
                <div class="faction-relations">
                    <h4>Relaciones Iniciales:</h4>
                    ${Object.entries(origin.factionRelations)
                        .filter(([_, value]) => value !== 0)
                        .map(([faction, value]) => `
                            <div class="faction-relation">
                                <span class="faction-name">${this.getFactionName(faction)}</span>
                                <span class="faction-value ${value > 0 ? 'positive' : 'negative'}">${value > 0 ? '+' : ''}${value}</span>
                            </div>
                        `).join('')}
                </div>
            </div>
        `).join('');
    }

    private setupEventListeners(root: ShadowRoot) {
        const cards = root.querySelectorAll('.origin-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const originId = target.dataset.originId;
                this.selectOrigin(originId || '', root);
            });
        });

        const startButton = root.querySelector('.start-button');
        startButton?.addEventListener('click', () => {
            if (this.selectedOrigin) {
                this.startGame();
            }
        });
    }

    private selectOrigin(originId: string, root: ShadowRoot) {
        // Update visual selection
        const cards = root.querySelectorAll('.origin-card');
        cards.forEach(card => {
            card.classList.toggle('selected', card.getAttribute('data-origin-id') === originId);
        });

        // Store selected origin
        this.selectedOrigin = originStories.find(o => o.id === originId) || null;

        // Enable start button
        const startButton = root.querySelector('.start-button') as HTMLButtonElement;
        if (startButton) {
            startButton.disabled = !this.selectedOrigin;
        }

        // Show origin details
        this.showOriginDetails(root);
    }

    private showOriginDetails(root: ShadowRoot) {
        const detailsPanel = root.querySelector('.origin-details');
        if (!detailsPanel || !this.selectedOrigin) return;

        detailsPanel.innerHTML = `
            <h2>${this.selectedOrigin.nameES}</h2>
            <div class="detail-section">
                <h3>Historia:</h3>
                <p>${this.selectedOrigin.descriptionES}</p>
            </div>
            <div class="detail-section">
                <h3>Inventario Inicial:</h3>
                <ul class="inventory-list">
                    ${this.selectedOrigin.initialInventory.map(item => 
                        `<li>${this.getItemName(item)}</li>`
                    ).join('')}
                </ul>
            </div>
            <div class="detail-section">
                <h3>Ganchos Narrativos:</h3>
                <ul class="hooks-list">
                    ${this.selectedOrigin.narrativeHooks.map(hook => 
                        `<li>${hook}</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    }

    private startGame() {
        if (!this.selectedOrigin) return;

        // Dispatch origin selection event
        this.eventBus.dispatch(ControlsEvent.selectOrigin, this.selectedOrigin);

        // Update game state with selected origin
        this.eventBus.dispatch(UpdateStateEvent.storyState, {
            selectedOrigin: this.selectedOrigin,
            currentChapter: 1,
            completedMissions: [],
            majorDecisions: [],
            factionReputation: this.selectedOrigin.factionRelations,
            storyFlags: new Set<string>(this.selectedOrigin.specialTraits),
            journalEntries: [{
                id: 'origin_' + this.selectedOrigin.id,
                title: `Inicio: ${this.selectedOrigin.nameES}`,
                content: this.selectedOrigin.descriptionES,
                date: new Date().toISOString(),
                type: 'main' as const,
                isRead: false
            }]
        });

        // Hide origin selection
        this.remove();
    }

    private getFactionName(factionId: string): string {
        const factionNames: Record<string, string> = {
            'rogue_military': 'Militares Rebeldes',
            'rebel_coalition': 'Coalición Rebelde',
            'free_worlds': 'Mundos Libres',
            'syndicate': 'El Sindicato',
            'technomancers': 'Tecnomantes'
        };
        return factionNames[factionId] || factionId;
    }

    private getItemName(itemId: string): string {
        const itemNames: Record<string, string> = {
            'military_rifle': 'Rifle Militar',
            'combat_armor': 'Armadura de Combate',
            'encrypted_datapad': 'Datapad Encriptado',
            'plasma_cutter': 'Cortador de Plasma',
            'scanner_array': 'Matriz de Escaneo',
            'ancient_artifact': 'Artefacto Antiguo',
            'concealed_pistol': 'Pistola Oculta',
            'evidence_scanner': 'Escáner de Evidencia',
            'syndicate_dossier': 'Expediente del Sindicato',
            'explosives': 'Explosivos',
            'rebel_uniform': 'Uniforme Rebelde',
            'resistance_codes': 'Códigos de Resistencia',
            'survival_kit': 'Kit de Supervivencia',
            'colony_records': 'Registros Coloniales',
            'family_heirloom': 'Reliquia Familiar'
        };
        return itemNames[itemId] || itemId.replace(/_/g, ' ');
    }
}

customElements.define('origin-selection', OriginSelection);