import { Component } from '../Component';
import { i18n } from '../../common/i18n/i18n';
import { StateChangeEvent } from '../../common/events';
import '../languageswitcher/LanguageSwitcher';

export class Settings extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    constructor() {
        super();
        
        // Listen for language changes to update UI
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        this.updateTranslations();
        
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        // Close button
        const closeBtn = root.querySelector('.close-button');
        closeBtn?.addEventListener('click', () => {
            this.hide();
        });
        
        // Back button
        const backBtn = root.querySelector('.back-button');
        backBtn?.addEventListener('click', () => {
            this.hide();
        });
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update title
        const title = root.querySelector('h2');
        if (title) title.textContent = i18n.t('settings.title');
        
        // Update section headers
        const languageHeader = root.querySelector('.language-section h3');
        if (languageHeader) languageHeader.textContent = i18n.t('settings.language');
        
        // Update back button
        const backBtn = root.querySelector('.back-button');
        if (backBtn) backBtn.textContent = i18n.t('common.back');
        
        // Update placeholder text
        const placeholderText = root.querySelector('.placeholder-section p');
        if (placeholderText) placeholderText.textContent = i18n.t('settings.comingSoon');
    }
    
    public show() {
        this.style.display = 'flex';
    }
    
    public hide() {
        this.style.display = 'none';
        // Dispatch event to show main menu again
        this.dispatchEvent(new CustomEvent('settingsClosed', { bubbles: true }));
    }
}

customElements.define('settings-component', Settings);