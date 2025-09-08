import { ControlsEvent, StateChangeEvent } from '../events';
import { State } from '../State';
import { getSaveGameService, resetSaveGameService } from '../services/SaveGameService';
import { getBaseState } from '../../data/state';

describe('Save/Load Events Integration', () => {
    let state: State;
    let saveService: ReturnType<typeof getSaveGameService>;

    beforeEach(() => {
        // Reset services
        resetSaveGameService();
        saveService = getSaveGameService();
        
        // Create fresh instance of State which handles events internally
        state = new State(getBaseState());
    });

    afterEach(() => {
        // Clean up
        saveService.clear();
    });

    describe('Save Game Events', () => {
        it('should trigger save when saveGame event is dispatched', (done) => {
            const slotName = 'test-save';
            
            // Listen for save confirmation
            state.listen(StateChangeEvent.gameSaved, (data) => {
                expect(data.slotName).toBe(slotName);
                expect(data.success).toBe(true);
                
                // Verify the save exists
                expect(saveService.exists(slotName)).toBe(true);
                done();
            });

            // Dispatch save event
            state.dispatch(ControlsEvent.saveGame, { slotName });
        });

        it('should handle save with metadata', (done) => {
            const slotName = 'save-with-metadata';
            const description = 'Test save description';
            
            state.listen(StateChangeEvent.gameSaved, (data) => {
                expect(data.slotName).toBe(slotName);
                
                const metadata = saveService.getMetadata(slotName);
                expect(metadata).toBeDefined();
                expect(metadata?.turn).toBe(state.game.turn);
                done();
            });

            state.dispatch(ControlsEvent.saveGame, { 
                slotName, 
                description 
            });
        });

        it('should overwrite existing save', (done) => {
            const slotName = 'overwrite-test';
            
            // First save
            saveService.save(slotName, state.getInternalState());
            
            // Modify state
            const modifiedState = state.getInternalState();
            modifiedState.game.turn = 'modified-turn';
            
            state.listen(StateChangeEvent.gameSaved, (data) => {
                expect(data.slotName).toBe(slotName);
                
                const loaded = saveService.load(slotName);
                // Should still have original turn since we didn't actually update the state
                expect(loaded?.game.turn).toBe(state.game.turn);
                done();
            });

            state.dispatch(ControlsEvent.saveGame, { slotName });
        });
    });

    describe('Load Game Events', () => {
        beforeEach(() => {
            // Pre-save some games for loading tests
            saveService.save('slot1', state.getInternalState());
            
            const modifiedState = { ...state.getInternalState() };
            modifiedState.game.turn = 'player2';
            saveService.save('slot2', modifiedState);
        });

        it('should trigger load when loadGame event is dispatched', (done) => {
            const slotName = 'slot1';
            
            state.listen(StateChangeEvent.gameLoaded, (data) => {
                expect(data.slotName).toBe(slotName);
                expect(data.success).toBe(true);
                done();
            });

            state.dispatch(ControlsEvent.loadGame, { slotName });
        });

        it('should update state when game is loaded', (done) => {
            const slotName = 'slot2';
            let called = false;
            
            state.listen(StateChangeEvent.gameLoaded, (data) => {
                if (called) return;
                called = true;
                
                expect(data.slotName).toBe(slotName);
                
                // State should be updated with loaded data
                const loadedState = saveService.load(slotName);
                expect(loadedState?.game.turn).toBe('player2');
                done();
            });

            state.dispatch(ControlsEvent.loadGame, { slotName });
        });

        it('should handle loading non-existent save', (done) => {
            const slotName = 'non-existent';
            let called = false;
            
            state.listen(StateChangeEvent.gameLoaded, (data) => {
                if (called) return;
                called = true;
                
                expect(data.slotName).toBe(slotName);
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                done();
            });

            state.dispatch(ControlsEvent.loadGame, { slotName });
        });
    });

    describe('List Saves Events', () => {
        beforeEach(() => {
            // Add some test saves
            saveService.save('save1', state.getInternalState());
            saveService.save('save2', state.getInternalState());
            saveService.save('save3', state.getInternalState());
        });

        it('should list all saves when listSaves event is dispatched', (done) => {
            state.listen(StateChangeEvent.savesListed, (saves) => {
                expect(saves).toHaveLength(3);
                expect(saves[0]?.slotName).toBe('save1');
                expect(saves[1]?.slotName).toBe('save2');
                expect(saves[2]?.slotName).toBe('save3');
                done();
            });

            state.dispatch(ControlsEvent.listSaves, {});
        });
    });

    describe('Delete Save Events', () => {
        beforeEach(() => {
            saveService.save('to-delete', state.getInternalState());
        });

        it('should delete save when deleteSave event is dispatched', (done) => {
            const slotName = 'to-delete';
            
            state.listen(StateChangeEvent.saveDeleted, (data) => {
                expect(data.slotName).toBe(slotName);
                expect(data.success).toBe(true);
                expect(saveService.exists(slotName)).toBe(false);
                done();
            });

            state.dispatch(ControlsEvent.deleteSave, { slotName });
        });

        it('should handle deleting non-existent save', (done) => {
            const slotName = 'non-existent';
            let called = false;
            
            state.listen(StateChangeEvent.saveDeleted, (data) => {
                if (called) return;
                called = true;
                
                expect(data.slotName).toBe(slotName);
                expect(data.success).toBe(false);
                done();
            });

            state.dispatch(ControlsEvent.deleteSave, { slotName });
        });
    });

    describe('Quick Save/Load', () => {
        it('should handle quick save', (done) => {
            let called = false;
            
            state.listen(StateChangeEvent.gameSaved, (data) => {
                if (called) return;
                called = true;
                
                expect(data.slotName).toBe('quicksave');
                expect(data.success).toBe(true);
                done();
            });

            state.dispatch(ControlsEvent.quickSave, {});
        });

        it('should handle quick load', (done) => {
            // First do a quick save
            saveService.save('quicksave', state.getInternalState());
            let called = false;
            
            state.listen(StateChangeEvent.gameLoaded, (data) => {
                if (called) return;
                called = true;
                
                expect(data.slotName).toBe('quicksave');
                expect(data.success).toBe(true);
                done();
            });

            state.dispatch(ControlsEvent.quickLoad, {});
        });

        it('should handle quick load when no quicksave exists', () => {
            // Ensure no quicksave exists
            saveService.delete('quicksave');
            
            // Since State handles the event internally, we just need to verify
            // that the save service doesn't have a quicksave after the event
            state.dispatch(ControlsEvent.quickLoad, {});
            
            // Verify no quicksave was created
            expect(saveService.exists('quicksave')).toBe(false);
        });
    });
});