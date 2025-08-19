import { EventBus, UpdateStateEvent, UpdateStateEventsMap, StateChangeEvent, StateChangeEventsMap } from '../events';
import { DeepReadonly } from '../helpers/types';

type LanguageCode = 'en' | 'es';

function isValidLanguage(value: unknown): value is LanguageCode {
    return value === 'en' || value === 'es';
}

export class LanguageState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    private _language: LanguageCode = 'en';
    private saveCallback?: () => void;
    private isPreview: boolean;

    constructor(saveCallback?: () => void, isPreview = false) {
        super();
        this.saveCallback = saveCallback;
        this.isPreview = isPreview;

        // Load language preference from localStorage
        this.loadLanguagePreference();

        // Listen for language updates
        this.listen(UpdateStateEvent.language, (language) => {
            this.setLanguage(language);
        });
    }

    private loadLanguagePreference(): void {
        // Check if we're in a browser environment
        if (typeof localStorage !== 'undefined') {
            // Try to load from localStorage first
            const savedLang = localStorage.getItem('language');
            if (isValidLanguage(savedLang)) {
                this._language = savedLang;
                return;
            }
        }

        // Check if navigator is available (browser environment)
        if (typeof navigator !== 'undefined' && navigator.language) {
            // Otherwise detect browser language
            const browserLang = navigator.language.toLowerCase();
            if (browserLang.startsWith('es')) {
                this._language = 'es';
            } else {
                this._language = 'en';
            }
        } else {
            // Default to English in test environment
            this._language = 'en';
        }
        
        this.saveLanguagePreference();
    }

    private saveLanguagePreference(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('language', this._language);
        }
    }

    get language(): DeepReadonly<LanguageCode> {
        return this._language;
    }

    // Internal getter for mutable access
    getInternalLanguage(): LanguageCode {
        return this._language;
    }

    setLanguage(language: LanguageCode): void {
        if (this._language !== language) {
            this._language = language;
            this.saveLanguagePreference();
            
            // Dispatch state change event
            if (!this.isPreview) {
                this.dispatch(StateChangeEvent.language, language);
            }
            
            // Trigger save
            if (this.saveCallback) {
                this.saveCallback();
            }
        }
    }

    serialize(): LanguageCode {
        return this._language;
    }

    deserialize(language?: LanguageCode): void {
        if (language && isValidLanguage(language)) {
            this._language = language;
            this.saveLanguagePreference();
        }
    }
}