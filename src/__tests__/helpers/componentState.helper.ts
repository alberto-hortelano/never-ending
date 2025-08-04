import { Component } from '../../components/Component';
import type { State } from '../../common/State';

/**
 * Helper function to set up Component state for tests
 * @param state The state instance to set
 * @returns Cleanup function to reset state
 */
export function setupComponentState(state: State): () => void {
    Component.setGameState(state);
    
    return () => {
        Component.setGameState(null);
    };
}

/**
 * Jest mock helper for Component.setGameState
 * Use this in test files that need to mock the state
 */
export function mockComponentState() {
    jest.spyOn(Component, 'setGameState').mockImplementation(() => {
        // Mock implementation - do nothing
    });
}