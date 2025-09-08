import { Component } from '../Component';
import { ControlsEvent, StateChangeEvent } from '../../common/events';
import { ISaveMetadata } from '../../common/services/SaveGameService';

export class SaveLoadMenu extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private saves: ISaveMetadata[] = [];
    private mode: 'save' | 'load' = 'save';

    constructor() {
        super();
        
        // Start hidden by default
        this.classList.add('hidden');
        
        // Listen for saves list updates
        this.listen(StateChangeEvent.savesListed, (saves) => {
            this.saves = saves;
            this.updateSavesList();
        });

        // Listen for save/load results
        this.listen(StateChangeEvent.gameSaved, (data) => {
            if (data.success) {
                this.showMessage(`Game saved to slot: ${data.slotName}`);
                this.refreshSaves();
            } else {
                this.showMessage(`Failed to save: ${data.error || 'Unknown error'}`, true);
            }
        });

        this.listen(StateChangeEvent.gameLoaded, (data) => {
            if (data.success) {
                this.showMessage(`Game loaded from slot: ${data.slotName}`);
                this.hide();
            } else {
                this.showMessage(`Failed to load: ${data.error || 'Unknown error'}`, true);
            }
        });

        this.listen(StateChangeEvent.saveDeleted, (data) => {
            if (data.success) {
                this.showMessage(`Save deleted: ${data.slotName}`);
                this.refreshSaves();
            } else {
                this.showMessage(`Failed to delete save`, true);
            }
        });
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        this.setupEventListeners(root);
        this.refreshSaves();
        
        return root;
    }

    private setupEventListeners(root: ShadowRoot) {
        // Close button
        const closeBtn = root.querySelector('.close-button');
        closeBtn?.addEventListener('click', () => this.hide());

        // Tab buttons
        const saveTab = root.querySelector('[data-tab="save"]');
        const loadTab = root.querySelector('[data-tab="load"]');
        
        saveTab?.addEventListener('click', () => this.setMode('save'));
        loadTab?.addEventListener('click', () => this.setMode('load'));

        // New save button and input
        const newSaveBtn = root.querySelector('.new-save-button');
        const newSaveInput = root.querySelector('.new-save-input');
        const saveNameInput = root.querySelector('.save-name-input') as HTMLInputElement;
        const confirmSaveBtn = root.querySelector('.confirm-save-btn');
        const cancelSaveBtn = root.querySelector('.cancel-save-btn');
        
        newSaveBtn?.addEventListener('click', () => {
            newSaveBtn.classList.add('hidden');
            newSaveInput?.classList.remove('hidden');
            saveNameInput?.focus();
        });
        
        confirmSaveBtn?.addEventListener('click', () => {
            const slotName = saveNameInput?.value.trim();
            if (slotName) {
                this.saveToSlot(slotName);
                saveNameInput.value = '';
                newSaveInput?.classList.add('hidden');
                newSaveBtn?.classList.remove('hidden');
            }
        });
        
        cancelSaveBtn?.addEventListener('click', () => {
            saveNameInput.value = '';
            newSaveInput?.classList.add('hidden');
            newSaveBtn?.classList.remove('hidden');
        });
        
        saveNameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                confirmSaveBtn?.dispatchEvent(new Event('click'));
            } else if (e.key === 'Escape') {
                cancelSaveBtn?.dispatchEvent(new Event('click'));
            }
        });

        // Quick save/load buttons
        const quickSaveBtn = root.querySelector('.quick-save-button');
        const quickLoadBtn = root.querySelector('.quick-load-button');
        
        quickSaveBtn?.addEventListener('click', () => this.quickSave());
        quickLoadBtn?.addEventListener('click', () => this.quickLoad());

        // Confirm dialog buttons
        const confirmYes = root.querySelector('.confirm-yes');
        const confirmNo = root.querySelector('.confirm-no');
        
        confirmYes?.addEventListener('click', () => this.handleConfirmYes());
        confirmNo?.addEventListener('click', () => this.handleConfirmNo());

        // Handle clicks outside to close
        this.addEventListener('click', (e) => {
            if (e.target === this) {
                this.hide();
            }
        });
    }

    private setMode(mode: 'save' | 'load') {
        this.mode = mode;
        const root = this.shadowRoot;
        if (!root) return;

        // Update tab active states
        root.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === mode);
        });

        // Update content visibility
        const saveContent = root.querySelector('.save-content');
        const loadContent = root.querySelector('.load-content');
        
        if (saveContent) saveContent.classList.toggle('hidden', mode !== 'save');
        if (loadContent) loadContent.classList.toggle('hidden', mode !== 'load');

        this.updateSavesList();
    }

    private refreshSaves() {
        // Request updated saves list
        this.dispatch(ControlsEvent.listSaves, {});
    }

    private updateSavesList() {
        const root = this.shadowRoot;
        if (!root) return;

        const container = root.querySelector('.saves-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.saves.length === 0) {
            container.innerHTML = '<div class="no-saves">No saved games</div>';
            return;
        }

        // Sort saves by timestamp (newest first)
        const sortedSaves = [...this.saves].sort((a, b) => b.timestamp - a.timestamp);

        sortedSaves.forEach(save => {
            const saveElement = this.createSaveElement(save);
            container.appendChild(saveElement);
        });
    }

    private createSaveElement(save: ISaveMetadata): HTMLElement {
        const div = document.createElement('div');
        div.className = 'save-item';
        
        const date = new Date(save.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        div.innerHTML = `
            <div class="save-info">
                <div class="save-name">${save.slotName}</div>
                <div class="save-details">
                    <span>Turn: ${save.turn}</span>
                    <span>Characters: ${save.characterCount}</span>
                    <span>${dateStr}</span>
                </div>
            </div>
            <div class="save-actions">
                ${this.mode === 'save' ? 
                    `<button class="overwrite-btn" data-slot="${save.slotName}">Overwrite</button>` :
                    `<button class="load-btn" data-slot="${save.slotName}">Load</button>`
                }
                <button class="delete-btn" data-slot="${save.slotName}">Delete</button>
            </div>
        `;

        // Add event listeners
        const overwriteBtn = div.querySelector('.overwrite-btn');
        const loadBtn = div.querySelector('.load-btn');
        const deleteBtn = div.querySelector('.delete-btn');

        overwriteBtn?.addEventListener('click', () => this.saveToSlot(save.slotName));
        loadBtn?.addEventListener('click', () => this.loadFromSlot(save.slotName));
        deleteBtn?.addEventListener('click', () => this.deleteSlot(save.slotName));

        return div;
    }


    private saveToSlot(slotName: string) {
        this.dispatch(ControlsEvent.saveGame, { slotName });
    }

    private confirmCallback?: () => void;
    
    private showConfirm(message: string, callback: () => void) {
        const root = this.shadowRoot;
        if (!root) return;
        
        const dialog = root.querySelector('.confirm-dialog');
        const messageEl = root.querySelector('.confirm-message');
        
        if (dialog && messageEl) {
            messageEl.textContent = message;
            dialog.classList.remove('hidden');
            this.confirmCallback = callback;
        }
    }
    
    private handleConfirmYes() {
        const root = this.shadowRoot;
        if (!root) return;
        
        const dialog = root.querySelector('.confirm-dialog');
        dialog?.classList.add('hidden');
        
        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = undefined;
        }
    }
    
    private handleConfirmNo() {
        const root = this.shadowRoot;
        if (!root) return;
        
        const dialog = root.querySelector('.confirm-dialog');
        dialog?.classList.add('hidden');
        this.confirmCallback = undefined;
    }
    
    private loadFromSlot(slotName: string) {
        this.showConfirm(
            `Load game from "${slotName}"? Current progress will be lost.`,
            () => this.dispatch(ControlsEvent.loadGame, { slotName })
        );
    }

    private deleteSlot(slotName: string) {
        this.showConfirm(
            `Delete save "${slotName}"? This cannot be undone.`,
            () => this.dispatch(ControlsEvent.deleteSave, { slotName })
        );
    }

    private quickSave() {
        this.dispatch(ControlsEvent.quickSave, {});
    }

    private quickLoad() {
        this.showConfirm(
            'Quick load? Current progress will be lost.',
            () => this.dispatch(ControlsEvent.quickLoad, {})
        );
    }

    private showMessage(message: string, isError = false) {
        const root = this.shadowRoot;
        if (!root) return;

        const messageEl = root.querySelector('.message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.classList.toggle('error', isError);
        messageEl.classList.add('show');

        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }

    public show() {
        this.classList.remove('hidden');
        this.refreshSaves();
    }

    public hide() {
        this.classList.add('hidden');
    }
    
    public setInitialMode(mode: 'save' | 'load') {
        this.mode = mode;
        // Wait for next tick to ensure shadowRoot is available
        requestAnimationFrame(() => {
            this.setMode(mode);
        });
    }

    // Support for Playwright tests
    public override getTestingShadowRoot() {
        if ((window as any).__PLAYWRIGHT_TEST__) {
            return this.shadowRoot;
        }
        return null;
    }
}

customElements.define('save-load-menu', SaveLoadMenu);