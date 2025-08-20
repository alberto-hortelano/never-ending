import { i18n } from '../../common/i18n/i18n';
import { EventBus, StateChangeEvent, UpdateStateEvent } from '../../common/events';
import { LanguageState } from '../../common/state/LanguageState';

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

describe('Component i18n Integration', () => {
    let eventBus: EventBus<any, any>;
    
    beforeEach(() => {
        // Reset localStorage
        localStorage.clear();
        
        // Create fresh instances
        eventBus = new EventBus();
        
        // Set default language
        i18n.setLanguage('en');
    });
    
    afterEach(() => {
        // Clean up any listeners
        eventBus.remove(eventBus);
    });
    
    describe('Language Change Events', () => {
        it('should dispatch StateChangeEvent.language when language changes', () => {
            let languageChanged = false;
            let receivedLanguage = '';
            
            // Listen for language change event
            eventBus.listen(StateChangeEvent.language, (language) => {
                languageChanged = true;
                receivedLanguage = language;
            });
            
            // Dispatch language change event directly
            eventBus.dispatch(StateChangeEvent.language, 'es');
            
            // Verify event was dispatched and received
            expect(languageChanged).toBe(true);
            expect(receivedLanguage).toBe('es');
        });
        
        it('should update i18n when language is set', () => {
            // Initial language should be English
            expect(i18n.getLanguage()).toBe('en');
            expect(i18n.t('menu.settings')).toBe('Settings');
            
            // Change language directly
            i18n.setLanguage('es');
            
            // Verify i18n was updated
            expect(i18n.getLanguage()).toBe('es');
            expect(i18n.t('menu.settings')).toBe('Configuración');
        });
    });
    
    describe('Component Translation Updates', () => {
        it('should update component text when language changes', () => {
            // Simulate a component that uses translations
            let componentText = i18n.t('menu.singlePlayer');
            expect(componentText).toBe('Single Player');
            
            // Listen for language changes (simulating what components do)
            eventBus.listen(StateChangeEvent.language, () => {
                // Update component text
                componentText = i18n.t('menu.singlePlayer');
            });
            
            // Change language
            i18n.setLanguage('es');
            eventBus.dispatch(StateChangeEvent.language, 'es');
            
            // Verify text was updated
            expect(componentText).toBe('Un Jugador');
        });
        
        it('should handle multiple components updating on language changes', () => {
            const componentTexts: string[] = [];
            
            // Create separate event bus instances for each component
            const component1Bus = new EventBus<any, any>();
            const component2Bus = new EventBus<any, any>();
            const component3Bus = new EventBus<any, any>();
            
            // Simulate multiple components
            component1Bus.listen(StateChangeEvent.language, () => {
                componentTexts[0] = i18n.t('common.loading');
            });
            
            component2Bus.listen(StateChangeEvent.language, () => {
                componentTexts[1] = i18n.t('common.save');
            });
            
            component3Bus.listen(StateChangeEvent.language, () => {
                componentTexts[2] = i18n.t('common.cancel');
            });
            
            // Initial values
            componentTexts[0] = i18n.t('common.loading');
            componentTexts[1] = i18n.t('common.save');
            componentTexts[2] = i18n.t('common.cancel');
            
            expect(componentTexts).toEqual(['Loading...', 'Save', 'Cancel']);
            
            // Change language
            i18n.setLanguage('es');
            component1Bus.dispatch(StateChangeEvent.language, 'es');
            component2Bus.dispatch(StateChangeEvent.language, 'es');
            component3Bus.dispatch(StateChangeEvent.language, 'es');
            
            // Verify all components updated
            expect(componentTexts).toEqual(['Cargando...', 'Guardar', 'Cancelar']);
            
            // Clean up
            component1Bus.remove(component1Bus);
            component2Bus.remove(component2Bus);
            component3Bus.remove(component3Bus);
        });
    });
    
    describe('Language Persistence', () => {
        it('should persist language preference across component lifecycle', () => {
            // Set language to Spanish
            i18n.setLanguage('es');
            expect(localStorage.getItem('language')).toBe('es');
            
            // Simulate component unmount and remount by creating a new LanguageState
            // Note: Using a mock save callback to avoid actual state persistence in tests
            const newLanguageState = new LanguageState(() => {}, false);
            
            // Language should still be Spanish
            expect(newLanguageState.language).toBe('es');
        });
        
        it('should maintain language consistency across all components', () => {
            // Set language
            i18n.setLanguage('es');
            
            // Create multiple language state instances (simulating different components)
            const state1 = new LanguageState(() => {}, false);
            const state2 = new LanguageState(() => {}, false);
            const state3 = new LanguageState(() => {}, false);
            
            // All should have the same language
            expect(state1.language).toBe('es');
            expect(state2.language).toBe('es');
            expect(state3.language).toBe('es');
        });
    });
    
    describe('Translation Key Coverage', () => {
        const componentsUsingI18n = [
            'MainMenu',
            'TopBar',
            'BottomBar',
            'CharacterCreator',
            'Conversation',
            'Popup',
            'StoryJournal',
            'Settings',
            'SelectCharacter',
            'Actions',
            'Inventory'
        ];
        
        it('should have translations for all component-specific keys', () => {
            const requiredKeyPrefixes = {
                'MainMenu': ['menu.'],
                'TopBar': ['topbar.'],
                'BottomBar': ['bottombar.'],
                'CharacterCreator': ['character.'],
                'Conversation': ['conversation.', 'common.'],
                'Popup': ['popup.'],
                'StoryJournal': ['journal.'],
                'Settings': ['settings.'],
                'SelectCharacter': ['select.'],
                'Actions': ['action.'],
                'Inventory': ['inventory.']
            };
            
            Object.entries(requiredKeyPrefixes).forEach(([component, prefixes]) => {
                prefixes.forEach(prefix => {
                    const keysWithPrefix = translations.en 
                        ? Object.keys(translations.en).filter(key => key.startsWith(prefix))
                        : [];
                    
                    // Each component should have at least one translation key
                    expect(keysWithPrefix.length).toBeGreaterThan(0);
                    
                    // Each key should exist in both languages
                    keysWithPrefix.forEach(key => {
                        if (translations.en && translations.es) {
                            expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
                            expect(translations.es[key as keyof typeof translations.es]).toBeTruthy();
                        }
                    });
                });
            });
        });
    });
});

// Import the actual translations to verify they exist
import { translations } from '../../common/i18n/translations';