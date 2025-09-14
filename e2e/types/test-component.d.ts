// Type definitions for components with testing methods
// The Window interface extensions are now in src/types/window.d.ts
/// <reference path="../../src/types/window.d.ts" />

export interface TestableComponent extends HTMLElement {
  getTestingShadowRoot(): ShadowRoot | null;
}

export interface TestableWindow extends Window {
  // All window properties are now defined in src/types/window.d.ts
}