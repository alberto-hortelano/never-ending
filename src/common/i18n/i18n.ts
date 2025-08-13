import { translations, Language, TranslationKey } from './translations';
import { EventBus } from '../events/EventBus';
import { StateChangeEvent, UpdateStateEvent } from '../events/StateEvents';

export class I18n {
  private static instance: I18n;
  private currentLanguage: Language = 'en';
  private eventBus = new EventBus<any, any>();

  private constructor() {
    this.loadLanguagePreference();
    this.listenForLanguageChanges();
  }

  static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  private loadLanguagePreference(): void {
    // Try to load from localStorage first
    const savedLang = localStorage.getItem('language');
    if (savedLang && (savedLang === 'en' || savedLang === 'es')) {
      this.currentLanguage = savedLang as Language;
      return;
    }

    // Otherwise detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('es')) {
      this.currentLanguage = 'es';
    } else {
      this.currentLanguage = 'en';
    }
    
    this.saveLanguagePreference();
  }

  private saveLanguagePreference(): void {
    localStorage.setItem('language', this.currentLanguage);
  }

  private listenForLanguageChanges(): void {
    this.eventBus.listen(StateChangeEvent.language, (language: Language) => {
      if (language && (language === 'en' || language === 'es')) {
        this.currentLanguage = language;
        this.saveLanguagePreference();
      }
    });
  }

  /**
   * Get a translated string for the given key
   * @param key The translation key
   * @param params Optional parameters for interpolation
   * @returns The translated string
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const currentTranslations = translations[this.currentLanguage];
    const fallbackTranslations = translations['en'];
    const translation = (currentTranslations && currentTranslations[key]) || 
                       (fallbackTranslations && fallbackTranslations[key]) || 
                       key;
    
    if (params) {
      return this.interpolate(translation, params);
    }
    
    return translation;
  }

  /**
   * Interpolate parameters into a translation string
   * @param str The translation string with placeholders like {name}
   * @param params The parameters to interpolate
   * @returns The interpolated string
   */
  private interpolate(str: string, params: Record<string, string | number>): string {
    return str.replace(/{(\w+)}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  /**
   * Get the current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set the current language
   */
  setLanguage(language: Language): void {
    if (language === 'en' || language === 'es') {
      this.currentLanguage = language;
      this.saveLanguagePreference();
      
      // Dispatch state update event to notify all components
      this.eventBus.dispatch(UpdateStateEvent.language, language);
    }
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): Array<{ code: Language; name: string }> {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' }
    ];
  }
}

// Export a singleton instance for easy access
export const i18n = I18n.getInstance();

// Export a convenience function for translations
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}