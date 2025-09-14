import { SeededRandom } from '../SeededRandom';

describe('SeededRandom', () => {
    describe('constructor and basic generation', () => {
        it('should generate consistent sequences with the same seed', () => {
            const seed = 12345;
            const rng1 = new SeededRandom(seed);
            const rng2 = new SeededRandom(seed);
            
            const sequence1 = [];
            const sequence2 = [];
            
            for (let i = 0; i < 10; i++) {
                sequence1.push(rng1.next());
                sequence2.push(rng2.next());
            }
            
            expect(sequence1).toEqual(sequence2);
        });
        
        it('should generate different sequences with different seeds', () => {
            const rng1 = new SeededRandom(12345);
            const rng2 = new SeededRandom(67890);
            
            const sequence1 = [];
            const sequence2 = [];
            
            for (let i = 0; i < 10; i++) {
                sequence1.push(rng1.next());
                sequence2.push(rng2.next());
            }
            
            expect(sequence1).not.toEqual(sequence2);
        });
        
        it('should generate a random seed if none is provided', () => {
            const rng1 = new SeededRandom();
            const rng2 = new SeededRandom();
            
            const sequence1 = [];
            const sequence2 = [];
            
            for (let i = 0; i < 10; i++) {
                sequence1.push(rng1.next());
                sequence2.push(rng2.next());
            }
            
            // Very unlikely to be equal with random seeds
            expect(sequence1).not.toEqual(sequence2);
        });
    });
    
    describe('nextFloat', () => {
        it('should generate values between 0 and 1', () => {
            const rng = new SeededRandom(42);
            
            for (let i = 0; i < 100; i++) {
                const value = rng.nextFloat();
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(1);
            }
        });
        
        it('should generate consistent float sequences', () => {
            const rng1 = new SeededRandom(999);
            const rng2 = new SeededRandom(999);
            
            const floats1 = [];
            const floats2 = [];
            
            for (let i = 0; i < 5; i++) {
                floats1.push(rng1.nextFloat());
                floats2.push(rng2.nextFloat());
            }
            
            expect(floats1).toEqual(floats2);
        });
    });
    
    describe('nextInt', () => {
        it('should generate integers within specified range', () => {
            const rng = new SeededRandom(100);
            const max = 10;
            
            for (let i = 0; i < 100; i++) {
                const value = rng.nextInt(max);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(max);
                expect(Number.isInteger(value)).toBe(true);
            }
        });
        
        it('should generate consistent integer sequences', () => {
            const rng1 = new SeededRandom(777);
            const rng2 = new SeededRandom(777);
            
            const ints1 = [];
            const ints2 = [];
            
            for (let i = 0; i < 10; i++) {
                ints1.push(rng1.nextInt(100));
                ints2.push(rng2.nextInt(100));
            }
            
            expect(ints1).toEqual(ints2);
        });
        
        it('should handle edge case of max = 1', () => {
            const rng = new SeededRandom(123);
            
            for (let i = 0; i < 10; i++) {
                expect(rng.nextInt(1)).toBe(0);
            }
        });
    });
    
    describe('reset', () => {
        it('should reset to initial seed and reproduce same sequence', () => {
            const seed = 54321;
            const rng = new SeededRandom(seed);
            
            const firstSequence = [];
            for (let i = 0; i < 5; i++) {
                firstSequence.push(rng.next());
            }
            
            // Generate some more values
            for (let i = 0; i < 10; i++) {
                rng.next();
            }
            
            // Reset and generate again
            rng.reset();
            const secondSequence = [];
            for (let i = 0; i < 5; i++) {
                secondSequence.push(rng.next());
            }
            
            expect(secondSequence).toEqual(firstSequence);
        });
        
        it('should reset with a new seed', () => {
            const rng = new SeededRandom(111);
            
            const firstValue = rng.next();
            
            rng.reset(222);
            const secondValue = rng.next();
            
            expect(firstValue).not.toEqual(secondValue);
            
            // Verify new seed works consistently
            rng.reset(222);
            const thirdValue = rng.next();
            
            expect(thirdValue).toEqual(secondValue);
        });
    });
    
    describe('getSeed', () => {
        it('should return the current seed', () => {
            const seed = 98765;
            const rng = new SeededRandom(seed);
            
            expect(rng.getSeed()).toBe(seed);
        });
        
        it('should return the seed after reset', () => {
            const rng = new SeededRandom(111);
            rng.reset(999);
            
            expect(rng.getSeed()).toBe(999);
        });
    });
    
    describe('distribution', () => {
        it('should generate reasonably distributed values', () => {
            const rng = new SeededRandom(1337);
            const buckets = [0, 0, 0, 0, 0]; // 5 buckets for 0-1 range
            const samples = 1000;
            
            for (let i = 0; i < samples; i++) {
                const value = rng.nextFloat();
                const bucketIndex = Math.min(Math.floor(value * 5), 4);
                buckets[bucketIndex] = (buckets[bucketIndex] || 0) + 1;
            }
            
            // Each bucket should have roughly 200 values (±50%)
            buckets.forEach(count => {
                expect(count).toBeGreaterThan(100);
                expect(count).toBeLessThan(300);
            });
        });
    });
});