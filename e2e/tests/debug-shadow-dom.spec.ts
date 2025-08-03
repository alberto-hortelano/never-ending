import { test, expect } from '@playwright/test';

test.describe('Debug Shadow DOM Initialization', () => {
  test('analyze web component lifecycle', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });
    
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    // Navigate to the page
    await page.goto('/');
    
    // Wait for basic page load
    await page.waitForLoadState('domcontentloaded');
    console.log('DOM content loaded');
    
    // Check if main-menu element exists
    const mainMenuExists = await page.evaluate(() => {
      return document.querySelector('main-menu') !== null;
    });
    console.log('Main menu element exists:', mainMenuExists);
    
    // Check if custom elements are defined
    const customElementsStatus = await page.evaluate(() => {
      return {
        mainMenu: customElements.get('main-menu') !== undefined,
        container: customElements.get('container-component') !== undefined,
        turnIndicator: customElements.get('turn-indicator') !== undefined,
      };
    });
    console.log('Custom elements defined:', customElementsStatus);
    
    // Wait for components module to load
    await page.waitForLoadState('networkidle');
    
    // Check shadow DOM status over time
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      
      const shadowDOMStatus = await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        return {
          menuExists: menu !== null,
          hasShadowRoot: menu?.shadowRoot !== null,
          shadowRootMode: menu?.shadowRoot?.mode,
          menuClass: menu?.constructor.name,
          isConnected: menu?.isConnected,
        };
      });
      
      console.log(`Shadow DOM check ${i + 1}:`, shadowDOMStatus);
      
      if (shadowDOMStatus.hasShadowRoot) {
        console.log('Shadow DOM initialized!');
        
        // Check shadow DOM content
        const shadowContent = await page.evaluate(() => {
          const menu = document.querySelector('main-menu');
          const shadowRoot = menu?.shadowRoot;
          return {
            hasContent: shadowRoot?.innerHTML ? shadowRoot.innerHTML.length > 0 : false,
            hasButtons: shadowRoot?.querySelector('#singlePlayerBtn') !== null,
            buttonCount: shadowRoot?.querySelectorAll('button').length,
          };
        });
        
        console.log('Shadow DOM content:', shadowContent);
        break;
      }
    }
    
    // Check Component class implementation
    const componentInfo = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (!menu) return null;
      
      // Try to access component methods
      return {
        hasConnectedCallback: typeof (menu as any).connectedCallback === 'function',
        hasConstructor: menu.constructor !== HTMLElement,
        prototypeChain: Object.getPrototypeOf(menu).constructor.name,
      };
    });
    
    console.log('Component implementation:', componentInfo);
    
    // Final assertion - at least the element should exist
    expect(mainMenuExists).toBe(true);
  });

  test('check JavaScript module loading', async ({ page }) => {
    const modulesLoaded: string[] = [];
    
    // Intercept network requests
    page.on('response', response => {
      if (response.url().includes('.js')) {
        modulesLoaded.push(`${response.status()} - ${response.url()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('JavaScript modules loaded:');
    modulesLoaded.forEach(module => console.log(module));
    
    // Check if Component base class is available
    const componentClassExists = await page.evaluate(() => {
      return typeof (window as any).Component !== 'undefined';
    });
    
    console.log('Component class exists in window:', componentClassExists);
    
    // Check module imports
    const importsWorking = await page.evaluate(async () => {
      try {
        // Check if the components module loaded
        const result = await import('./js/components/index.js');
        return { success: true, exports: Object.keys(result) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Module import test:', importsWorking);
  });
});