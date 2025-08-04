// Type definitions for components with testing methods

export interface TestableComponent extends HTMLElement {
  getTestingShadowRoot(): ShadowRoot | null;
}

export interface TestableWindow extends Window {
  __PLAYWRIGHT_TEST__?: boolean;
}

declare global {
  interface Window {
    __PLAYWRIGHT_TEST__?: boolean;
  }
}