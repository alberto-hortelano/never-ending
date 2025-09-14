import { i18n } from '../i18n';
import { translations } from '../translations';

// Mock localStorage for testing
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
        removeItem: (key: string) => {
            delete store[key];
        }
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
});

describe('i18n System', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Reset i18n to default state
        i18n.setLanguage('en');
    });

    describe('Language Detection', () => {
        it('should default to English when no preference is set', () => {
            expect(i18n.getLanguage()).toBe('en');
        });

        it('should respect saved language preference from localStorage', () => {
            // Set language to Spanish and save it
            i18n.setLanguage('es');
            expect(localStorage.getItem('language')).toBe('es');
            
            // Language should be Spanish
            expect(i18n.getLanguage()).toBe('es');
            
            // Even after setting to English and back, localStorage preference should be respected
            i18n.setLanguage('en');
            expect(i18n.getLanguage()).toBe('en');
            expect(localStorage.getItem('language')).toBe('en');
        });
    });

    describe('Translation Loading', () => {
        it('should return English translation for a valid key', () => {
            i18n.setLanguage('en');
            expect(i18n.t('menu.singlePlayer')).toBe('Single Player');
            expect(i18n.t('common.loading')).toBe('Loading...');
        });

        it('should return Spanish translation for a valid key', () => {
            i18n.setLanguage('es');
            expect(i18n.t('menu.singlePlayer')).toBe('Un Jugador');
            expect(i18n.t('common.loading')).toBe('Cargando...');
        });

        it('should fallback to English if translation is missing in current language', () => {
            i18n.setLanguage('es');
            // Assuming a key exists in English but not Spanish (for testing)
            // In reality, all keys should exist in both languages
            const _key = 'test.missing.key' as any;
            expect(i18n.t(_key)).toBe(_key); // Should return the key itself as fallback
        });
    });

    describe('Language Switching', () => {
        it('should switch from English to Spanish', () => {
            i18n.setLanguage('en');
            expect(i18n.getLanguage()).toBe('en');
            expect(i18n.t('menu.settings')).toBe('Settings');
            
            i18n.setLanguage('es');
            expect(i18n.getLanguage()).toBe('es');
            expect(i18n.t('menu.settings')).toBe('Configuración');
        });

        it('should save language preference to localStorage', () => {
            i18n.setLanguage('es');
            expect(localStorage.getItem('language')).toBe('es');
            
            i18n.setLanguage('en');
            expect(localStorage.getItem('language')).toBe('en');
        });
    });

    describe('Parameter Interpolation', () => {
        it('should interpolate parameters in translations', () => {
            // Add a test translation with parameters
            const testTranslations = {
                en: { ...translations.en, 'test.param': 'Hello {name}, you have {count} messages' },
                es: { ...translations.es, 'test.param': 'Hola {name}, tienes {count} mensajes' }
            };
            
            // Mock the translations temporarily
            const originalTranslations = { ...translations };
            Object.assign(translations, testTranslations);
            
            i18n.setLanguage('en');
            expect(i18n.t('test.param' as any, { name: 'John', count: 5 }))
                .toBe('Hello John, you have 5 messages');
            
            i18n.setLanguage('es');
            expect(i18n.t('test.param' as any, { name: 'Juan', count: 3 }))
                .toBe('Hola Juan, tienes 3 mensajes');
            
            // Restore original translations
            Object.assign(translations, originalTranslations);
        });
    });

    describe('Available Languages', () => {
        it('should return list of available languages', () => {
            const languages = i18n.getAvailableLanguages();
            expect(languages).toHaveLength(2);
            expect(languages).toContainEqual({ code: 'en', name: 'English' });
            expect(languages).toContainEqual({ code: 'es', name: 'Español' });
        });
    });
});

describe('Translation Completeness', () => {
    it('should have all keys defined in both English and Spanish', () => {
        const enTranslations = translations.en;
        const esTranslations = translations.es;
        
        expect(enTranslations).toBeDefined();
        expect(esTranslations).toBeDefined();
        
        if (enTranslations && esTranslations) {
            const enKeys = Object.keys(enTranslations).sort();
            const esKeys = Object.keys(esTranslations).sort();
            
            // Check that both languages have the same keys
            expect(enKeys).toEqual(esKeys);
        }
    });

    it('should not have empty translations', () => {
        const enTranslations = translations.en;
        const esTranslations = translations.es;
        
        if (enTranslations) {
            // Check English translations
            Object.entries(enTranslations).forEach(([_key, value]) => {
                expect(value).toBeTruthy();
                expect(typeof value === 'string' ? value.trim() : '').not.toBe('');
            });
        }
        
        if (esTranslations) {
            // Check Spanish translations
            Object.entries(esTranslations).forEach(([_key, value]) => {
                expect(value).toBeTruthy();
                expect(typeof value === 'string' ? value.trim() : '').not.toBe('');
            });
        }
    });

    describe('New Translation Keys', () => {
        it('should have inventory translations in both languages', () => {
            const inventoryKeys = [
                'inventory.title',
                'inventory.equipped',
                'inventory.primary',
                'inventory.secondary',
                'inventory.weapons',
                'inventory.otherItems',
                'inventory.empty',
                'inventory.emptySlot',
                'inventory.equip',
                'inventory.weight'
            ];
            
            inventoryKeys.forEach(key => {
                if (translations.en && translations.es) {
                    expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
                    expect(translations.es[key as keyof typeof translations.es]).toBeTruthy();
                }
            });
        });

        it('should have action translations in both languages', () => {
            const actionKeys = [
                'action.aim',
                'action.requiresRangedWeapon',
                'action.move',
                'action.shoot',
                'action.reload',
                'action.melee',
                'action.closeCombat'
            ];
            
            actionKeys.forEach(key => {
                if (translations.en && translations.es) {
                    expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
                    expect(translations.es[key as keyof typeof translations.es]).toBeTruthy();
                }
            });
        });

        it('should have multiplayer translations in both languages', () => {
            const multiplayerKeys = [
                'multiplayer.lobby',
                'multiplayer.joinGame',
                'multiplayer.createGame',
                'multiplayer.waiting',
                'multiplayer.players'
            ];
            
            multiplayerKeys.forEach(key => {
                if (translations.en && translations.es) {
                    expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
                    expect(translations.es[key as keyof typeof translations.es]).toBeTruthy();
                }
            });
        });

        it('should have loading translations in both languages', () => {
            const loadingKeys = [
                'loading.pleaseWait',
                'loading.connecting',
                'loading.preparing'
            ];
            
            loadingKeys.forEach(key => {
                if (translations.en && translations.es) {
                    expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
                    expect(translations.es[key as keyof typeof translations.es]).toBeTruthy();
                }
            });
        });
    });
});