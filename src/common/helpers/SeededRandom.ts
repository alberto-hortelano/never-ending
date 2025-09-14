/**
 * A seeded pseudo-random number generator using Linear Congruential Generator (LCG) algorithm.
 * This ensures reproducible random sequences when using the same seed.
 */
export class SeededRandom {
    private seed: number;
    private initialSeed: number;
    
    // LCG parameters (from Numerical Recipes)
    private readonly a = 1664525;
    private readonly c = 1013904223;
    private readonly m = Math.pow(2, 32);
    
    constructor(seed?: number) {
        // If no seed provided, use current timestamp with some randomness
        this.initialSeed = seed ?? Math.floor(Math.random() * 2147483647);
        this.seed = this.initialSeed;
    }
    
    /**
     * Generate next random integer in the sequence
     * @returns A pseudo-random integer
     */
    next(): number {
        this.seed = (this.a * this.seed + this.c) % this.m;
        return this.seed;
    }
    
    /**
     * Generate a float between 0 (inclusive) and 1 (exclusive)
     * @returns A pseudo-random float [0, 1)
     */
    nextFloat(): number {
        return this.next() / this.m;
    }
    
    /**
     * Generate an integer between 0 (inclusive) and max (exclusive)
     * @param max The upper bound (exclusive)
     * @returns A pseudo-random integer [0, max)
     */
    nextInt(max: number): number {
        if (max <= 1) return 0;
        return Math.floor(this.nextFloat() * max);
    }
    
    /**
     * Reset the generator to its initial seed or a new seed
     * @param newSeed Optional new seed to use
     */
    reset(newSeed?: number): void {
        if (newSeed !== undefined) {
            this.initialSeed = newSeed;
        }
        this.seed = this.initialSeed;
    }
    
    /**
     * Get the current seed value
     * @returns The current seed
     */
    getSeed(): number {
        return this.initialSeed;
    }
}