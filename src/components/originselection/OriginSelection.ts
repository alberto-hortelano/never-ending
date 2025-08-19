import { Component } from '../Component';
import { originStories } from '../../common/data/originStories';
import type { IOriginStory } from '../../common/interfaces';
import { ControlsEvent } from '../../common/events';

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
                if (originId) {
                    const origin = originStories.find(o => o.id === originId);
                    if (origin) {
                        this.selectedOrigin = origin;
                        this.startGame();
                    }
                }
            });
        });
    }



    private startGame() {
        if (!this.selectedOrigin) {
            console.log('[OriginSelection] No origin selected, cannot start game');
            return;
        }

        this.eventBus.dispatch(ControlsEvent.selectOrigin, this.selectedOrigin);

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

}

customElements.define('origin-selection', OriginSelection);