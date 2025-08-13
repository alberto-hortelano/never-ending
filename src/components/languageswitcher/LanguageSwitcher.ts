import { Component } from '../Component';
import { i18n } from '../../common/i18n/i18n';
import { StateChangeEvent } from '../../common/events';

export class LanguageSwitcher extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    constructor() {
        super();
        
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateSelection();
        });
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.renderContent(root);
        this.setupEventListeners(root);
        this.updateSelection();
        
        return root;
    }
    
    private renderContent(root: ShadowRoot) {
        const container = root.querySelector('.language-switcher');
        if (!container) return;
        
        const languages = i18n.getAvailableLanguages();
        const currentLang = i18n.getLanguage();
        
        container.innerHTML = `
            <label for="language-select">${i18n.t('settings.language')}:</label>
            <select id="language-select" class="language-select">
                ${languages.map(lang => `
                    <option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>
                        ${lang.name}
                    </option>
                `).join('')}
            </select>
        `;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        const select = root.querySelector('#language-select') as HTMLSelectElement;
        if (!select) return;
        
        select.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const newLang = target.value as 'en' | 'es';
            i18n.setLanguage(newLang);
            
            // Re-render to update the label
            this.renderContent(root);
            this.setupEventListeners(root);
        });
    }
    
    private updateSelection() {
        const root = this.shadowRoot;
        if (!root) return;
        
        const select = root.querySelector('#language-select') as HTMLSelectElement;
        if (select) {
            select.value = i18n.getLanguage();
        }
        
        // Update label
        const label = root.querySelector('label');
        if (label) {
            label.textContent = i18n.t('settings.language') + ':';
        }
    }
}

customElements.define('language-switcher', LanguageSwitcher);