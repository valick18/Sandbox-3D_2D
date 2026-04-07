import { BLOCKS, CONST } from './constants.js';
import { noise1D, noise2D, random, getBiome, BIOMES, runCellularAutomata } from './math.js';

export class World {
    constructor() {
        this.chunks = {}; // Format: "chunkX": [data array]
        this.blockMods = {}; // Format: "x,y": blockID for player placed/mined blocks overriding gen
    }

    // Convert pixel to tile coords
    toTileXY(px, py) {
        return { x: Math.floor(px / CONST.TILE_SIZE), y: Math.floor(py / CONST.TILE_SIZE) };
    }

    // Convert tile to chunk index
    getChunkX(tileX) {
        return Math.floor(tileX / CONST.CHUNK_W);
    }

    // L-System Tree Generation Utility
    generateTree(data, x, y, chunkX) {
        let trunkHeight = 4 + Math.floor(random() * 5);
        // Build trunk
        for (let th = 0; th < trunkHeight; th++) {
            if (y - th >= 0) data[(y - th) * CONST.CHUNK_W + x] = BLOCKS.WOOD;
        }
        
        // Blobs of leaves
        let leafCenterY = y - trunkHeight;
        for (let ly = -3; ly <= 3; ly++) {
            for (let lx = -3; lx <= 3; lx++) {
                if (lx*lx + ly*ly <= 9) { // Circle approx
                    let targetX = x + lx;
                    let targetY = leafCenterY + ly;
                    if (targetX >= 0 && targetX < CONST.CHUNK_W && targetY >= 0) {
                        let idx = targetY * CONST.CHUNK_W + targetX;
                        if (data[idx] === BLOCKS.AIR) {
                            // High chance for dense leaves instead of sparse noise
                            if (random() > 0.15) {
                                data[idx] = BLOCKS.LEAVES;
                            }
                        }
                    }
                }
            }
        }
    }

    // Generate a new chunk procedurally
    generateChunk(chunkX) {
        const data = new Uint8Array(CONST.CHUNK_W * CONST.CHUNK_H);
        const pad = 2; // For cellular automata seamless edges
        const paddedW = CONST.CHUNK_W + pad * 2;
        const paddedCaData = new Uint8Array(paddedW * CONST.CHUNK_H);

        // Pre-fill padded CA map for caves
        for (let px = 0; px < paddedW; px++) {
            for (let py = 0; py < CONST.CHUNK_H; py++) {
                let worldX = chunkX * CONST.CHUNK_W + px - pad;
                let caveNoise = noise2D(worldX, py, 0.04, 1, 2);
                let threshold = 0.55 + (py / CONST.CHUNK_H) * 0.1; // Cave size scales with depth
                paddedCaData[py * paddedW + px] = caveNoise > threshold ? 0 : 1; 
                // 1 = solid, 0 = air
            }
        }

        // Run CA
        runCellularAutomata(paddedCaData, paddedW, CONST.CHUNK_H, 4);

        for (let x = 0; x < CONST.CHUNK_W; x++) {
            const worldX = chunkX * CONST.CHUNK_W + x;
            const biome = getBiome(worldX);
            
            // Terrain noise parameters modified by biome
            let baseFreq = 0.02;
            let baseAmp = 15;
            let surfaceVar = noise1D(worldX, 0.1, 5); // higher freq

            if (biome === BIOMES.DESERT) { baseAmp = 5; surfaceVar = noise1D(worldX, 0.05, 3); }
            if (biome === BIOMES.SNOW) { baseAmp = 20; surfaceVar = noise1D(worldX, 0.05, 8); }
            if (biome === BIOMES.JUNGLE) { baseAmp = 25; surfaceVar = noise1D(worldX, 0.15, 10); }

            let n = noise1D(worldX, baseFreq, 1, 3);
            let surfaceY = Math.floor((CONST.CHUNK_H / 2) + (n * baseAmp) + surfaceVar - 30);
            
            for (let y = 0; y < CONST.CHUNK_H; y++) {
                const i = y * CONST.CHUNK_W + x;
                
                if (y >= CONST.CHUNK_H - 2) {
                    data[i] = BLOCKS.BEDROCK;
                    continue;
                }
                
                if (y > surfaceY) {
                    let depth = y - surfaceY;
                    let block = BLOCKS.STONE;
                    
                    if (depth < 5) {
                        block = BIOMES.DESERT === biome ? BLOCKS.SAND : BLOCKS.DIRT;
                        if (depth === 1) {
                            block = BIOMES.DESERT === biome ? BLOCKS.SAND : BLOCKS.GRASS;
                        }
                    } else if (y > CONST.CHUNK_H - 20) {
                        block = BLOCKS.BEDROCK; // Deep stone/bedrock
                    }

                    // Apply CA Cave
                    if (paddedCaData[y * paddedW + (x + pad)] === 0 && depth > 5) {
                        block = BLOCKS.AIR;
                    }

                    // Ores
                    if (block === BLOCKS.STONE) {
                        if (random() < 0.015) block = BLOCKS.COAL;
                        else if (depth > 20 && random() < 0.008) block = BLOCKS.IRON;
                        else if (depth > 40 && random() < 0.003) block = BLOCKS.GOLD;
                    }
                    data[i] = block;
                } else {
                    data[i] = BLOCKS.AIR;
                }
            }
            
            // Trees based on biome rules
            if (biome === BIOMES.FOREST || biome === BIOMES.JUNGLE || biome === BIOMES.SNOW || biome === BIOMES.CORRUPTION) {
                let treeChance = biome === BIOMES.JUNGLE ? 0.15 : 0.05;
                if (biome === BIOMES.SNOW) treeChance = 0.02;
                
                if (random() < treeChance) {
                    for(let y=0; y<CONST.CHUNK_H; y++) {
                        if (data[y * CONST.CHUNK_W + x] === BLOCKS.GRASS || data[y * CONST.CHUNK_W + x] === BLOCKS.DIRT) {
                            this.generateTree(data, x, y, chunkX);
                            break;
                        }
                    }
                }
            }
        }
        
        this.chunks[chunkX] = data;
    }

    ensureChunkLoaded(chunkX) {
        if (!this.chunks[chunkX]) {
            this.generateChunk(chunkX);
        }
    }

    getBlock(tx, ty) {
        if (ty < 0 || ty >= CONST.CHUNK_H) return BLOCKS.AIR;
        
        let cx = this.getChunkX(tx);
        this.ensureChunkLoaded(cx);
        
        // Mod overrides
        let modKey = `${tx},${ty}`;
        if (this.blockMods[modKey] !== undefined) {
            return this.blockMods[modKey];
        }
        
        let localX = tx % CONST.CHUNK_W;
        if (localX < 0) localX += CONST.CHUNK_W; // Handle negative chunks correctly
        
        let index = ty * CONST.CHUNK_W + localX;
        return this.chunks[cx][index];
    }

    setBlock(tx, ty, id) {
        if (ty < 0 || ty >= CONST.CHUNK_H) return;
        let modKey = `${tx},${ty}`;
        this.blockMods[modKey] = id; // O(1) override without regenerating arrays
    }
}
