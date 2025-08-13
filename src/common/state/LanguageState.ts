import { EventBus, UpdateStateEvent, UpdateStateEventsMap, StateChangeEvent, StateChangeEventsMap } from '../events';
import { DeepReadonly } from '../helpers/types';

export class LanguageState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    private _language: 'en' | 'es' = 'en';
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
        // Try to load from localStorage first
        const savedLang = localStorage.getItem('language');
        if (savedLang && (savedLang === 'en' || savedLang === 'es')) {
            this._language = savedLang as 'en' | 'es';
            return;
        }

        // Otherwise detect browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('es')) {
            this._language = 'es';
        } else {
            this._language = 'en';
        }
        
        this.saveLanguagePreference();
    }

    private saveLanguagePreference(): void {
        localStorage.setItem('language', this._language);
    }

    get language(): DeepReadonly<'en' | 'es'> {
        return this._language;
    }

    setLanguage(language: 'en' | 'es'): void {
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

    serialize(): 'en' | 'es' {
        return this._language;
    }

    deserialize(language?: 'en' | 'es'): void {
        if (language) {
            this._language = language;
            this.saveLanguagePreference();
        }
    }
}