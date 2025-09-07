import { Component } from '../Component';
import { ControlsEvent, UpdateStateEvent } from '../../common/events';
import { MELEE_ATTACKS, type MeleeAttackType } from '../../common/services/MeleeCombatService';
import { NetworkService } from '../../common/services/NetworkService';
import { i18n } from '../../common/i18n/i18n';

interface DefenseData {
    attacker: string;
    defender: string;
    attackType: MeleeAttackType;
    weaponInfo: {
        attackerWeapon: string;
        defenderWeapon: string;
    };
}

export class DefenseWheel extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private defenseData?: DefenseData;
    private root?: ShadowRoot;
    private networkService: NetworkService = NetworkService.getInstance();

    override async connectedCallback() {
        // Listen for events BEFORE initializing shadow DOM (following Inventory pattern)
        this.setupEventListeners();
        
        // Initialize shadow DOM
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Store the shadow root reference
        this.root = root;
        
        // Hide component by default
        this.classList.add('hidden');
        
        // If we have pending data, render it now
        if (this.defenseData) {
            this.renderContent();
        }
        
        return root;
    }

    private setupEventListeners() {
        this.listen(UpdateStateEvent.uiMeleeDefense, (data) => {
            console.log('[DefenseWheel] Received melee defense event:', data);
            console.log('[DefenseWheel] Event data:', JSON.stringify(data));
            
            // In multiplayer mode, only show defense wheel if we are the defender
            const networkPlayerId = this.networkService.getPlayerId();
            if (networkPlayerId) {
                // Multiplayer mode - check if we're the defender
                const state = this.getState();
                const defenderCharacter = state?.findCharacter(data.defender);
                
                console.log('[DefenseWheel] Multiplayer check - Network player:', networkPlayerId);
                console.log('[DefenseWheel] Defender character:', defenderCharacter?.name, 'Player:', defenderCharacter?.player);
                
                if (!defenderCharacter || defenderCharacter.player !== networkPlayerId) {
                    console.log('[DefenseWheel] Not the defender in multiplayer, ignoring event');
                    return;
                }
                console.log('[DefenseWheel] We are the defender! Showing defense wheel');
            }
            // In single player mode, always show the defense wheel
            
            // Store the defense data
            this.defenseData = {
                attacker: data.attacker,
                defender: data.defender,
                attackType: data.attackType as MeleeAttackType,
                weaponInfo: {
                    attackerWeapon: data.weaponInfo.attackerWeapon,
                    defenderWeapon: data.weaponInfo.defenderWeapon
                }
            };
            
            // Show the component
            this.classList.remove('hidden');
            
            // Render if shadow root exists
            if (this.root) {
                this.renderContent();
            }
        });

        this.listen(UpdateStateEvent.uiMeleeCombatResult, () => {
            this.hide();
        });
    }

    private hide() {
        this.classList.add('hidden');
        this.defenseData = undefined;
    }

    private renderContent() {
        if (!this.root || !this.defenseData) {
            console.log('[DefenseWheel] Cannot render - root:', !!this.root, 'data:', !!this.defenseData);
            return;
        }

        const container = this.root.querySelector('.defense-wheel-container');
        if (!container) {
            console.error('[DefenseWheel] Container not found in shadow DOM');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create title section
        const title = document.createElement('div');
        title.className = 'defense-title';
        title.innerHTML = `
            <h2>${i18n.t('defense.title')}</h2>
            <p class="attacker-info">${this.defenseData.attacker} ${i18n.t('defense.attackerInfo')} ${this.defenseData.weaponInfo.attackerWeapon}</p>
            <p class="defender-info">${this.defenseData.defender} ${i18n.t('defense.defenderInfo')} ${this.defenseData.weaponInfo.defenderWeapon}</p>
            <p class="instruction">${i18n.t('defense.selectDefense')}</p>
        `;
        container.appendChild(title);

        // Create defense wheel
        const wheel = document.createElement('div');
        wheel.className = 'defense-wheel';
        
        // Add center circle
        const centerCircle = document.createElement('div');
        centerCircle.className = 'center-circle';
        wheel.appendChild(centerCircle);

        // Create defense option buttons
        MELEE_ATTACKS.forEach((attack) => {
            const button = this.createDefenseButton(attack);
            wheel.appendChild(button);
        });

        container.appendChild(wheel);

        // Create info panel
        const infoPanel = this.createInfoPanel();
        container.appendChild(infoPanel);
    }

    private createDefenseButton(attack: typeof MELEE_ATTACKS[0]): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'defense-option';
        button.dataset.attackType = attack.type;
        
        // Calculate position on the wheel
        const angle = attack.angle;
        const radius = 120;
        const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
        const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
        
        button.style.transform = `translate(${x}px, ${y}px)`;
        
        // Add damage indicator class
        const damageIndicator = this.calculateDamageIndicator(attack.type);
        button.classList.add(`damage-${damageIndicator}`);
        
        // Set button content
        button.innerHTML = `
            <span class="attack-name">${attack.displayName}</span>
            <span class="damage-hint">${this.getDamageHint(damageIndicator)}</span>
        `;
        
        // Add click handler
        button.addEventListener('click', () => this.selectDefense(attack.type));
        
        return button;
    }

    private createInfoPanel(): HTMLElement {
        const infoPanel = document.createElement('div');
        infoPanel.className = 'info-panel';
        infoPanel.innerHTML = `
            <div class="legend">
                <div class="legend-item">
                    <span class="indicator block"></span>${i18n.t('defense.perfectBlock')} (${i18n.t('defense.noDamage')})
                </div>
                <div class="legend-item">
                    <span class="indicator low"></span>${i18n.t('defense.goodDefense')} (${i18n.t('defense.lowDamage')})
                </div>
                <div class="legend-item">
                    <span class="indicator medium"></span>${i18n.t('defense.partialDefense')} (${i18n.t('defense.mediumDamage')})
                </div>
                <div class="legend-item">
                    <span class="indicator high"></span>${i18n.t('defense.poorDefense')} (${i18n.t('defense.highDamage')})
                </div>
            </div>
        `;
        return infoPanel;
    }

    private calculateDamageIndicator(defenseType: MeleeAttackType): string {
        if (!this.defenseData) return 'unknown';
        
        const attackAngle = MELEE_ATTACKS.find(a => a.type === this.defenseData!.attackType)?.angle || 0;
        const defenseAngle = MELEE_ATTACKS.find(a => a.type === defenseType)?.angle || 0;
        
        let angleDiff = Math.abs(attackAngle - defenseAngle);
        if (angleDiff > 180) {
            angleDiff = 360 - angleDiff;
        }
        
        if (angleDiff === 0) return 'block';
        if (angleDiff <= 60) return 'low';
        if (angleDiff <= 120) return 'medium';
        return 'high';
    }

    private getDamageHint(indicator: string): string {
        switch (indicator) {
            case 'block': return 'Block!';
            case 'low': return '33%';
            case 'medium': return '66%';
            case 'high': return '100%';
            default: return '?';
        }
    }

    private selectDefense(defenseType: MeleeAttackType) {
        console.log('[DefenseWheel] Defense selected:', defenseType);
        
        // Dispatch the defense selection
        this.dispatch(ControlsEvent.meleeDefenseSelected, {
            defenseType: defenseType
        });
        
        // Update button visual state
        if (this.root) {
            const buttons = this.root.querySelectorAll('.defense-option');
            buttons.forEach(button => {
                if (button instanceof HTMLElement) {
                    if (button.dataset.attackType === defenseType) {
                        button.classList.add('selected');
                    } else {
                        button.classList.remove('selected');
                    }
                }
            });
        }
    }

    static {
        if (!customElements.get('defense-wheel')) {
            customElements.define('defense-wheel', DefenseWheel);
        }
    }
}