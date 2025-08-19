import { Conversation } from '../Conversation';

describe('Conversation Response Parsing', () => {
    let conversation: Conversation;
    
    beforeAll(() => {
        // Mock console to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterAll(() => {
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        conversation = new Conversation();
    });
    
    describe('parseResponse', () => {
        it('should handle speech responses correctly', () => {
            const speechResponse = JSON.stringify({
                type: 'speech',
                source: 'Data',
                content: 'Hola comandante',
                answers: ['Hola', 'Adiós']
            });
            
            const result = (conversation as any).parseResponse(speechResponse);
            
            expect(result).toEqual({
                type: 'speech',
                source: 'Data',
                content: 'Hola comandante',
                answers: ['Hola', 'Adiós'],
                action: undefined
            });
        });
        
        it('should handle storyline responses by converting to speech format', () => {
            const storylineResponse = JSON.stringify({
                type: 'storyline',
                content: 'Las alarmas de la nave resuenan por los pasillos...',
                description: 'The bridge of a military spaceship'
            });
            
            const result = (conversation as any).parseResponse(storylineResponse);
            
            expect(result.type).toBe('speech');
            expect(result.source).toBe('Narrador');
            expect(result.content).toBe('Las alarmas de la nave resuenan por los pasillos...');
            expect(result.answers).toEqual(['Continuar', 'Entendido']);
        });
        
        it('should handle speech without answers by providing defaults', () => {
            const speechNoAnswers = JSON.stringify({
                type: 'speech',
                source: 'NPC',
                content: 'Un mensaje sin respuestas'
            });
            
            const result = (conversation as any).parseResponse(speechNoAnswers);
            
            expect(result.type).toBe('speech');
            expect(result.source).toBe('NPC');
            expect(result.content).toBe('Un mensaje sin respuestas');
            expect(result.answers).toEqual(['Continuar']);
        });
        
        it('should truncate content that exceeds max length', () => {
            const longContent = 'a'.repeat(1005); // Exceeds 1000 char limit
            const longResponse = JSON.stringify({
                type: 'speech',
                source: 'Test',
                content: longContent,
                answers: ['OK']
            });
            
            const result = (conversation as any).parseResponse(longResponse);
            
            expect(result.content.length).toBeLessThanOrEqual(1003); // 1000 + '...'
            expect(result.content.endsWith('...')).toBe(true);
        });
        
        it('should handle invalid JSON gracefully', () => {
            const invalidResponse = 'This is not JSON';
            
            const result = (conversation as any).parseResponse(invalidResponse);
            
            expect(result.type).toBe('speech');
            expect(result.source).toBe('Data');  // Default when currentTarget is null
            expect(result.content).toBe('This is not JSON');  // Returns the raw text
            expect(result.answers).toEqual(['Entendido', 'Dime más', 'Cambiar de tema']);  // Default non-narrative answers
        });
        
        it('should handle unknown response types', () => {
            const unknownType = JSON.stringify({
                type: 'unknown',
                content: 'Some content',
                someField: 'value'
            });
            
            const result = (conversation as any).parseResponse(unknownType);
            
            expect(result.type).toBe('speech');
            expect(result.content).toBe('Some content');
            expect(result.answers).toEqual(['Continue']);
        });
        
        it('should preserve action field when present', () => {
            const responseWithAction = JSON.stringify({
                type: 'speech',
                source: 'NPC',
                content: 'Message with action',
                answers: ['Yes', 'No'],
                action: 'movement'
            });
            
            const result = (conversation as any).parseResponse(responseWithAction);
            
            expect(result.action).toBe('movement');
        });
        
        it('should handle missing content in speech gracefully', () => {
            const speechNoContent = JSON.stringify({
                type: 'speech',
                source: 'NPC',
                answers: ['OK']
            });
            
            const result = (conversation as any).parseResponse(speechNoContent);
            
            // Should fall back to error handling
            expect(result.content).toBeDefined();
            expect(result.source).toBeDefined();
        });
    });
});