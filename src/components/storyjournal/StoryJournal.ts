import { Component } from '../Component';
import { StateChangeEvent } from '../../common/events';
import type { IJournalEntry } from '../../common/interfaces/IStory';
import { i18n } from '../../common/i18n/i18n';

export class StoryJournal extends Component {
    protected override hasHtml = true;
    protected override hasCss = true;
    
    private entries: IJournalEntry[] = [];
    private selectedEntry: IJournalEntry | null = null;
    
    constructor() {
        super();
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.renderJournal(this.shadowRoot!);
        });
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Listen for story state changes
        this.listen(StateChangeEvent.storyState as any, (storyState: any) => {
            if (storyState?.journalEntries) {
                this.entries = storyState.journalEntries;
                this.renderJournal(root);
            }
        });
        
        this.renderJournal(root);
        this.setupEventListeners(root);
        
        return root;
    }

    private renderJournal(root: ShadowRoot) {
        const entriesList = root.querySelector('.journal-entries');
        const entryContent = root.querySelector('.entry-content');
        
        if (!entriesList) return;
        
        // Group entries by type
        const mainEntries = this.entries.filter(e => e.type === 'main');
        const sideEntries = this.entries.filter(e => e.type === 'side');
        const factionEntries = this.entries.filter(e => e.type === 'faction');
        const personalEntries = this.entries.filter(e => e.type === 'personal');
        
        entriesList.innerHTML = `
            ${this.renderSection(i18n.t('journal.mainMission'), mainEntries)}
            ${this.renderSection(i18n.t('journal.sideMissions'), sideEntries)}
            ${this.renderSection(i18n.t('journal.characters'), factionEntries)}
            ${this.renderSection(i18n.t('journal.notes'), personalEntries)}
        `;
        
        // Show selected entry or placeholder
        if (entryContent) {
            if (this.selectedEntry) {
                entryContent.innerHTML = `
                    <h2>${this.selectedEntry.title}</h2>
                    <div class="entry-date">${new Date(this.selectedEntry.date).toLocaleDateString('es-ES')}</div>
                    <div class="entry-text">${this.selectedEntry.content}</div>
                `;
            } else {
                entryContent.innerHTML = `
                    <div class="placeholder">
                        <p>${i18n.t('journal.empty')}</p>
                    </div>
                `;
            }
        }
    }
    
    private renderSection(title: string, entries: IJournalEntry[]): string {
        if (entries.length === 0) return '';
        
        return `
            <div class="journal-section">
                <h3 class="section-title">${title}</h3>
                <ul class="entry-list">
                    ${entries.map(entry => `
                        <li class="entry-item ${!entry.isRead ? 'unread' : ''}" data-entry-id="${entry.id}">
                            <span class="entry-title">${entry.title}</span>
                            ${!entry.isRead ? '<span class="unread-indicator">●</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        // Handle entry selection
        root.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const entryItem = target.closest('.entry-item');
            
            if (entryItem) {
                const entryId = entryItem.getAttribute('data-entry-id');
                this.selectEntry(entryId || '', root);
            }
        });
        
        // Close button
        const closeBtn = root.querySelector('.close-button');
        closeBtn?.addEventListener('click', () => {
            this.hide();
        });
    }
    
    private selectEntry(entryId: string, root: ShadowRoot) {
        // Find the entry
        this.selectedEntry = this.entries.find(e => e.id === entryId) || null;
        
        if (this.selectedEntry && !this.selectedEntry.isRead) {
            // Mark as read
            this.selectedEntry.isRead = true;
            // Here you would dispatch an event to update the state
        }
        
        // Update UI
        const allItems = root.querySelectorAll('.entry-item');
        allItems.forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-entry-id') === entryId);
        });
        
        // Render content
        this.renderJournal(root);
    }
    
    public show() {
        this.style.display = 'block';
    }
    
    public hide() {
        this.style.display = 'none';
    }
}

customElements.define('story-journal', StoryJournal);