// Seedable PRNG (Mulberry32)
export function seedPRNG(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Global random function holder
export let random = Math.random;

export function setSeed(seed) {
    random = seedPRNG(seed);
}

// Simple 1D Value Noise
export function noise1D(x, freq, amp, octaves = 1) {
    let result = 0;
    let max = 0;
    let f = freq;
    let a = amp;
    
    for(let i=0; i<octaves; i++) {
        let xf = x * f;
        let xi = Math.floor(xf);
        let xfrac = xf - xi;
        
        // Pseudo-random hash for 1D
        let h1 = hash(xi);
        let h2 = hash(xi + 1);
        
        // Smoothstep interpolation
        let u = xfrac * xfrac * (3.0 - 2.0 * xfrac);
        
        result += (h1 + u * (h2 - h1)) * a;
        max += a;
        f *= 2.0;
        a *= 0.5;
    }
    return result / max;
}

// Simple 2D Value Noise
export function noise2D(x, y, freq, amp, octaves = 1) {
    let result = 0;
    let max = 0;
    let f = freq;
    let a = amp;
    
    for(let i=0; i<octaves; i++) {
        let xf = x * f;
        let yf = y * f;
        let xi = Math.floor(xf);
        let yi = Math.floor(yf);
        let xfrac = xf - xi;
        let yfrac = yf - yi;
        
        let h00 = hash(xi, yi);
        let h10 = hash(xi + 1, yi);
        let h01 = hash(xi, yi + 1);
        let h11 = hash(xi + 1, yi + 1);
        
        let ux = xfrac * xfrac * (3.0 - 2.0 * xfrac);
        let uy = yfrac * yfrac * (3.0 - 2.0 * yfrac);
        
        let i1 = h00 + ux * (h10 - h00);
        let i2 = h01 + ux * (h11 - h01);
        
        result += (i1 + uy * (i2 - i1)) * a;
        max += a;
        
        f *= 2.0;
        a *= 0.5;
    }
    return result / max;
}

// Deterministic Hash function based on seed
let _seedOffset = 0;
export function initHashOffset(seed) {
    _seedOffset = seed % 10000;
}

function hash(x, y = 0) {
    let n = Math.imul(x + _seedOffset, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}

export function smoothStep(edge0, edge1, x) {
    let t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
}

// Biome mappings based on Temp/Humid
export const BIOMES = {
    FOREST: 0,
    DESERT: 1,
    SNOW: 2,
    JUNGLE: 3,
    CORRUPTION: 4
};

export function getBiome(worldX) {
    // Very low frequency noise for wide biomes
    let temp = noise1D(worldX, 0.002, 1, 2);
    let humid = noise1D(worldX + 5000, 0.002, 1, 2); // offset for different noise
    
    // Sometimes random corruption spikes
    if (noise1D(worldX + 10000, 0.01, 1, 1) > 0.85) return BIOMES.CORRUPTION;
    
    if (temp < 0.3) return BIOMES.SNOW;
    if (temp > 0.7 && humid < 0.4) return BIOMES.DESERT;
    if (temp > 0.6 && humid > 0.6) return BIOMES.JUNGLE;
    return BIOMES.FOREST;
}

// Cellular Automata smoothing for caves
export function runCellularAutomata(map, width, height, iterations = 3) {
    let buffer = new Uint8Array(width * height);
    
    for (let it = 0; it < iterations; it++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let walls = 0;
                for (let ny = -1; ny <= 1; ny++) {
                    for (let nx = -1; nx <= 1; nx++) {
                        let cx = x + nx;
                        let cy = y + ny;
                        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                            if (map[cy * width + cx] > 0) walls++;
                        } else {
                            walls++; // edges are walls
                        }
                    }
                }
                
                let idx = y * width + x;
                if (map[idx] > 0) {
                    buffer[idx] = walls >= 4 ? 1 : 0;
                } else {
                    buffer[idx] = walls >= 5 ? 1 : 0;
                }
            }
        }
        // swap
        for (let i = 0; i < map.length; i++) map[i] = buffer[i];
    }
}
