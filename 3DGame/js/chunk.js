import * as THREE from 'three';
import { noise2D, fbm2D, noise3D } from './math.js';
import { BLOCKS } from './textures.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;

export class Chunk {
    constructor(chunkX, chunkZ, scene, materialArray) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.materialArray = materialArray;
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.mesh = null;
        this.waterMesh = null;
        
        this.generateData();
        this.buildMesh();
    }
    
    getIndex(x, y, z) {
        return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z);
    }
    
    getBlock(x, y, z) {
        if (y < 0 || y >= CHUNK_HEIGHT) return y <= 58 ? BLOCKS.WATER : BLOCKS.AIR;
        
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
            if (window.getBlockGlobal) {
                let wx = this.chunkX * CHUNK_SIZE + x;
                let wz = this.chunkZ * CHUNK_SIZE + z;
                return window.getBlockGlobal(wx, y, wz);
            }
            return y <= 58 ? BLOCKS.WATER : BLOCKS.AIR;
        }
        return this.data[this.getIndex(x, y, z)];
    }
    
    // Helper: compute surface Y and tree spawn info for ANY world position (cross-chunk safe)
    getTreeInfoAtWorld(wx, wz) {
        const WATER_LEVEL = 58;
        const TREE_GRID = 7;

        let baseElev = fbm2D(wx * 0.002, wz * 0.002, 4, 0.5);
        let temp     = fbm2D(wx * 0.004 + 100, wz * 0.004 + 100);
        let moist    = fbm2D(wx * 0.004 - 100, wz * 0.004 - 100);
        let baseHeight = 40 + baseElev * 32;
        let mountainBoost = 0;
        if (baseElev > 0.55) {
            mountainBoost = Math.pow((baseElev - 0.55) * 2.2, 2.5) * 90;
        }
        let detailNoise = fbm2D(wx*0.01, wz*0.01) * 5;
        if (baseElev > 0.55) detailNoise *= 1.0 + (baseElev - 0.55)*8;
        let dist = Math.sqrt(wx*wx + wz*wz);
        if (dist < 20) { baseElev = Math.min(baseElev, 0.50); mountainBoost = 0; }
        let surfaceY = Math.floor(baseHeight + mountainBoost + detailNoise);

        let isOcean    = surfaceY <= WATER_LEVEL - 4;
        let isMountain = surfaceY > 75;
        let isDesert   = !isOcean && !isMountain && temp > 0.6 && moist < 0.5;
        let isSand     = isDesert || (surfaceY <= WATER_LEVEL + 2 && !isMountain); // beach sand
        if (surfaceY < WATER_LEVEL || isOcean || isMountain || isSand) return null;

        let cellX = Math.floor(wx / TREE_GRID);
        let cellZ = Math.floor(wz / TREE_GRID);
        let h1 = Math.sin(cellX * 127.1 + cellZ * 311.7) * 43758.5453; h1 -= Math.floor(h1);
        let h2 = Math.sin(cellX * 269.5 + cellZ * 183.3) * 43758.5453; h2 -= Math.floor(h2);
        let candWX = cellX * TREE_GRID + Math.floor(h1 * TREE_GRID);
        let candWZ = cellZ * TREE_GRID + Math.floor(h2 * TREE_GRID);
        if (wx !== candWX || wz !== candWZ) return null;

        let cellProb = Math.sin(cellX * 73.47 + cellZ * 512.91) * 43758.5453;
        cellProb -= Math.floor(cellProb);
        if (cellProb >= 0.65) return null;

        return { surfaceY, treeHeight: 4 + Math.floor(h2 * 3) };
    }

    generateData() {
        let worldXOffset = this.chunkX * CHUNK_SIZE;
        let worldZOffset = this.chunkZ * CHUNK_SIZE;
        const WATER_LEVEL = 58;
        const TREE_GRID = 7;
        
        // ---- PASS 1: Terrain + Trunks ----
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;
                
                let baseElev = fbm2D(wx * 0.002, wz * 0.002, 4, 0.5);
                let temp = fbm2D(wx * 0.004 + 100, wz * 0.004 + 100);
                let moist = fbm2D(wx * 0.004 - 100, wz * 0.004 - 100);
                let baseHeight = 40 + baseElev * 32;
                let mountainBoost = 0;
                if (baseElev > 0.55) {
                    mountainBoost = Math.pow((baseElev - 0.55) * 2.2, 2.5) * 90;
                }
                let detailNoise = fbm2D(wx*0.01, wz*0.01) * 5;
                if (baseElev > 0.55) detailNoise *= 1.0 + (baseElev - 0.55)*8;

                // Flat spawn zone
                let distFromOrigin = Math.sqrt(wx*wx + wz*wz);
                if (distFromOrigin < 20) {
                    baseElev = Math.min(baseElev, 0.50);
                    mountainBoost = 0;
                }
                let surfaceY = Math.floor(baseHeight + mountainBoost + detailNoise);

                let isOcean    = surfaceY <= WATER_LEVEL - 4;
                let isMountain = surfaceY > 75;
                let isDesert   = !isOcean && !isMountain && temp > 0.6 && moist < 0.5;
                let isPlains   = !isOcean && !isMountain && !isDesert && moist < 0.4;

                // Terrain blocks
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let idx = this.getIndex(x, y, z);
                    if (y > surfaceY) {
                        this.data[idx] = y <= WATER_LEVEL ? BLOCKS.WATER : BLOCKS.AIR;
                    } else if (y === surfaceY) {
                        if (isDesert || (surfaceY <= WATER_LEVEL + 2 && !isMountain)) {
                            this.data[idx] = BLOCKS.SAND;
                        } else if (isMountain) {
                            this.data[idx] = BLOCKS.STONE;
                        } else {
                            this.data[idx] = BLOCKS.GRASS;
                        }
                    } else if (y > surfaceY - 4) {
                        let isClay = false;
                        if (!isDesert && !isOcean && !isMountain) {
                            let depth = surfaceY - y;
                            if ((depth === 2 || depth === 3) && Math.random() < 0.4) {
                                isClay = noise3D(wx * 0.15, y * 0.15, wz * 0.15) > 0.6;
                            }
                        }
                        this.data[idx] = (isDesert || isOcean) ? BLOCKS.SAND : (isMountain ? BLOCKS.STONE : (isClay ? BLOCKS.CLAY : BLOCKS.DIRT));
                    } else {
                        this.data[idx] = BLOCKS.STONE;
                    }
                    // Caves
                    if (y < surfaceY && y > 2) {
                        let caveNoise = noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                        if (caveNoise > 0.5) {
                            this.data[idx] = y <= WATER_LEVEL ? BLOCKS.WATER : BLOCKS.AIR;
                        }
                    }
                }

                // Tree trunk placement (only for the grid candidate position)
                if (surfaceY >= WATER_LEVEL) {
                    let cellX = Math.floor(wx / TREE_GRID);
                    let cellZ = Math.floor(wz / TREE_GRID);
                    let h1 = Math.sin(cellX * 127.1 + cellZ * 311.7) * 43758.5453; h1 -= Math.floor(h1);
                    let h2 = Math.sin(cellX * 269.5 + cellZ * 183.3) * 43758.5453; h2 -= Math.floor(h2);
                    let candWX = cellX * TREE_GRID + Math.floor(h1 * TREE_GRID);
                    let candWZ = cellZ * TREE_GRID + Math.floor(h2 * TREE_GRID);
                    let cellProb = Math.sin(cellX * 73.47 + cellZ * 512.91) * 43758.5453;
                    cellProb -= Math.floor(cellProb);

                    if (wx === candWX && wz === candWZ) {
                        if (isDesert && cellProb < 0.3) {
                            // Cactus
                            let cH = 2 + Math.floor(h1 * 3);
                            for (let ty = 1; ty <= cH; ty++) {
                                if (surfaceY + ty < CHUNK_HEIGHT)
                                    this.data[this.getIndex(x, surfaceY + ty, z)] = BLOCKS.CACTUS;
                            }
                        } else if (!isDesert && !isOcean && !isMountain && surfaceY > WATER_LEVEL + 2 && cellProb < 0.65) {
                            // Tree trunk only (not on sand/beach)
                            let treeHeight = 4 + Math.floor(h2 * 3);
                            for (let ty = 1; ty <= treeHeight; ty++) {
                                if (surfaceY + ty < CHUNK_HEIGHT)
                                    this.data[this.getIndex(x, surfaceY + ty, z)] = BLOCKS.WOOD;
                            }
                        }
                    } else {
                        // Scattering: Use coordinates to prevent clustering
                        if (this.data[this.getIndex(x, surfaceY, z)] === BLOCKS.GRASS && surfaceY < CHUNK_HEIGHT - 1) {
                            // Only spawn if coordinates match a sparse grid (e.g. 5x4)
                            let isScatterSpot = (wx % 5 === 0 && wz % 4 === 0) || (wx % 9 === 0 && wz % 7 === 0);
                            if (isScatterSpot && Math.random() < 0.7) {
                                let type = Math.sin(wx * 2.1 + wz * 1.3) * 0.5 + 0.5;
                                let block = BLOCKS.TALL_GRASS;
                                if (type > 0.8) block = BLOCKS.FLOWER_RED;
                                else if (type > 0.6) block = BLOCKS.FLOWER_YELLOW;
                                this.data[this.getIndex(x, surfaceY + 1, z)] = block;
                            }
                        }
                    }
                }
            }
        }

        // ---- PASS 2: Leaves (cross-chunk aware) ----
        // For each column, check all tree-grid cells within canopy reach.
        // This correctly handles trees whose canopy extends from a neighboring chunk.
        const LEAF_H_RADIUS = 2;
        // Canopy layers relative to trunk top: lower start = less exposed trunk
        const treeLayers = [
            { dy: -2, r: 2, sk: true  }, // 5×5 - corners
            { dy: -1, r: 2, sk: true  }, // 5×5 - corners
            { dy:  0, r: 1, sk: false }, // 3×3
            { dy: +1, r: 1, sk: true  }, // cross (3×3 - corners)
        ];

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;

                // Find grid cells whose candidate could have a canopy over (wx,wz)
                let cMinX = Math.floor((wx - LEAF_H_RADIUS) / TREE_GRID);
                let cMaxX = Math.floor((wx + LEAF_H_RADIUS) / TREE_GRID);
                let cMinZ = Math.floor((wz - LEAF_H_RADIUS) / TREE_GRID);
                let cMaxZ = Math.floor((wz + LEAF_H_RADIUS) / TREE_GRID);

                for (let tcX = cMinX; tcX <= cMaxX; tcX++) {
                    for (let tcZ = cMinZ; tcZ <= cMaxZ; tcZ++) {
                        // Derive candidate world position for this cell
                        let h1 = Math.sin(tcX * 127.1 + tcZ * 311.7) * 43758.5453; h1 -= Math.floor(h1);
                        let h2 = Math.sin(tcX * 269.5 + tcZ * 183.3) * 43758.5453; h2 -= Math.floor(h2);
                        let cWX = tcX * TREE_GRID + Math.floor(h1 * TREE_GRID);
                        let cWZ = tcZ * TREE_GRID + Math.floor(h2 * TREE_GRID);

                        let dx = wx - cWX;
                        let dz = wz - cWZ;
                        if (Math.abs(dx) > LEAF_H_RADIUS || Math.abs(dz) > LEAF_H_RADIUS) continue;

                        // Get tree info at the candidate (recomputes biome — deterministic + fast)
                        let info = this.getTreeInfoAtWorld(cWX, cWZ);
                        if (!info) continue;

                        let trunkTop = info.surfaceY + info.treeHeight;

                        // Place leaves for layers that cover this (dx, dz) offset
                        for (const layer of treeLayers) {
                            if (Math.abs(dx) > layer.r || Math.abs(dz) > layer.r) continue;
                            if (layer.sk && Math.abs(dx) === layer.r && Math.abs(dz) === layer.r) continue;
                            let leafY = trunkTop + layer.dy;
                            if (leafY < 0 || leafY >= CHUNK_HEIGHT) continue;
                            let existing = this.data[this.getIndex(x, leafY, z)];
                            if (existing === BLOCKS.AIR || existing === BLOCKS.LEAVES) {
                                this.data[this.getIndex(x, leafY, z)] = BLOCKS.LEAVES;
                            }
                        }
                    }
                }
            }
        }
        
        // Apply player modifications (saved blocks)
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let modKey = `${wx},${y},${wz}`;
                    if (window.modifiedBlocks && window.modifiedBlocks[modKey] !== undefined) {
                        this.data[this.getIndex(x, y, z)] = window.modifiedBlocks[modKey];
                    }
                }
            }
        }
    }

    // Re-applies modifiedBlocks to chunk data (called on second pass for cross-chunk leaves)
    applyModifiedBlocks() {
        let worldXOffset = this.chunkX * CHUNK_SIZE;
        let worldZOffset = this.chunkZ * CHUNK_SIZE;
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let modKey = `${wx},${y},${wz}`;
                    if (window.modifiedBlocks && window.modifiedBlocks[modKey] !== undefined) {
                        this.data[this.getIndex(x, y, z)] = window.modifiedBlocks[modKey];
                    }
                }
            }
        }
    }
    
    buildMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh = null;
        }
        
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        
        // Material groups mapping to materials array
        // However, standard BufferGeometry handles groups if using array of materials.
        // Even easier: We just push groups.
        
        let counter = 0;
        
        // Define faces mapping: dir is normal, corners are 4 vertices
        const faces = [
            { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], index: 2, uvRow: 0 }, // top
            { dir: [0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], index: 3, uvRow: 1 }, // bottom
            { dir: [1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], index: 0, uvRow: 2 }, // right
            { dir: [-1,0, 0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], index: 1, uvRow: 2 }, // left
            { dir: [0, 0, 1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], index: 4, uvRow: 2 }, // front
            { dir: [0, 0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], index: 5, uvRow: 2 }, // back
        ];
        
        // Separate solid and water face groups
        let solidFaces = {};
        let waterFaces = { pos: [], norm: [], uv: [], idx: [] };

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    let blockId = this.data[this.getIndex(x, y, z)];
                    if (blockId === BLOCKS.AIR) continue;
                    
                    for (const {dir, corners, index} of faces) {
                        let nx = x + dir[0];
                        let ny = y + dir[1];
                        let nz = z + dir[2];
                        let nBlock = this.getBlock(nx, ny, nz);
                        
                        // Translucency culling
                        let shouldRender = false;
                        if (nBlock === BLOCKS.AIR) shouldRender = true;
                        else if (nBlock === BLOCKS.LEAVES && blockId !== BLOCKS.LEAVES) shouldRender = true;
                        else if (nBlock === BLOCKS.WATER && blockId !== BLOCKS.WATER) shouldRender = true;
                        else if (nBlock === BLOCKS.CACTUS && blockId !== BLOCKS.CACTUS) shouldRender = true;
                        else if (nBlock >= 13 && nBlock <= 15) shouldRender = true; 
                        else if (nBlock === BLOCKS.GLASS && blockId !== BLOCKS.GLASS) shouldRender = true;
                        
                        if (shouldRender) {
                            
                            // Determine material index. If Grass Top (index 2) -> GRASS MAT. If Grass Side -> GRASS SIDE
                            let matId = blockId;
                            if (blockId === BLOCKS.GRASS && index !== 2 && index !== 3) matId = 100; // side
                            if (blockId === BLOCKS.GRASS && index === 3) matId = BLOCKS.DIRT; // bottom
                            // Furnace: front face from stored orientation shows fire opening
                            if (blockId === BLOCKS.FURNACE) {
                                let wx = this.chunkX * CHUNK_SIZE + x;
                                let wy = y;
                                let wz = this.chunkZ * CHUNK_SIZE + z;
                                let frontIdx = (window.furnaceOrientations && window.furnaceOrientations[`${wx},${wy},${wz}`]);
                                if (frontIdx === undefined) frontIdx = 4; // default +Z
                                if (index === frontIdx) matId = 101;
                            }

                            const uvSeq = [[0,0],[1,0],[1,1],[0,1]];

                            if (blockId === BLOCKS.WATER) {
                                // Water goes to separate transparent mesh
                                let startV = waterFaces.pos.length / 3;
                                let cv = 0;
                                for (let c of corners) {
                                    waterFaces.pos.push(x + c[0], y + c[1], z + c[2]);
                                    waterFaces.norm.push(dir[0], dir[1], dir[2]);
                                    waterFaces.uv.push(uvSeq[cv][0], uvSeq[cv][1]);
                                    cv++;
                                }
                                waterFaces.idx.push(startV, startV+1, startV+2, startV, startV+2, startV+3);
                            } else if (blockId === BLOCKS.SNOW_LAYER) {
                                // 3D Minecraft-style Snow Layer: Thin cuboid (Top + 4 Sides)
                                if (index === 0) { 
                                     if(!solidFaces[matId]) solidFaces[matId] = { pos: [], norm: [], uv: [], idx: [] };
                                     let mf = solidFaces[matId];
                                     const h = 0.125; // 2 pixels high
                                     
                                     let startV = mf.pos.length / 3;
                                     const top = [[0,h,0],[1,h,0],[1,h,1],[0,h,1]];
                                     for(let p of top) { 
                                         mf.pos.push(x + p[0], y + p[1], z + p[2]); 
                                         mf.norm.push(0, 1, 0); 
                                     }
                                     mf.uv.push(0,0, 1,0, 1,1, 0,1);
                                     mf.idx.push(startV, startV+1, startV+2, startV, startV+2, startV+3);

                                     const sides = [
                                         [[0,0,1],[1,0,1],[1,h,1],[0,h,1]], // Z+
                                         [[1,0,0],[0,0,0],[0,h,0],[1,h,0]], // Z-
                                         [[1,0,1],[1,0,0],[1,h,0],[1,h,1]], // X+
                                         [[0,0,0],[0,0,1],[0,h,1],[0,h,0]]  // X-
                                     ];
                                     const norms = [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0]];
                                     for(let si=0; si<4; si++) {
                                         startV = mf.pos.length / 3;
                                         for(let p of sides[si]) {
                                             mf.pos.push(x + p[0], y + p[1], z + p[2]);
                                             mf.norm.push(norms[si][0], norms[si][1], norms[si][2]);
                                         }
                                         mf.uv.push(0,1, 1,1, 1,0, 0,0); 
                                         mf.idx.push(startV, startV+1, startV+2, startV, startV+2, startV+3);
                                     }
                                }
                            } else if (blockId >= 13 && blockId <= 15) {
                                // Cross-Quad for Flora (Flowers, Grass)
                                if (index === 0) {
                                    if(!solidFaces[matId]) solidFaces[matId] = { pos: [], norm: [], uv: [], idx: [] };
                                    let mf = solidFaces[matId];
                                    const uvSeq = [[0,0],[1,0],[1,1],[0,1]];
                                    const plantPlanes = [
                                        [[0,0,0],[1,0,1],[1,1,1],[0,1,0]],
                                        [[0,0,1],[1,0,0],[1,1,0],[0,1,1]]
                                    ];
                                    for (let plane of plantPlanes) {
                                        let startV = mf.pos.length / 3;
                                        let cv = 0;
                                        for (let p of plane) {
                                            mf.pos.push(x + p[0], y + p[1], z + p[2]);
                                            mf.norm.push(0, 1, 0);
                                            mf.uv.push(uvSeq[cv][0], uvSeq[cv][1]);
                                            cv++;
                                        }
                                        mf.idx.push(startV, startV+1, startV+2, startV, startV+2, startV+3);
                                    }
                                }
                            } else {
                                if(!solidFaces[matId]) solidFaces[matId] = { pos: [], norm: [], uv: [], idx: [] };
                                let mf = solidFaces[matId];
                                let startV = mf.pos.length / 3;
                                let cv = 0;
                                for (let c of corners) {
                                    mf.pos.push(x + c[0], y + c[1], z + c[2]);
                                    mf.norm.push(dir[0], dir[1], dir[2]);
                                    mf.uv.push(uvSeq[cv][0], uvSeq[cv][1]);
                                    cv++;
                                }
                                mf.idx.push(startV, startV+1, startV+2, startV, startV+2, startV+3);
                            }
                        }
                    }
                }
            }
        }
        
        // Build solid mesh
        let solidGroupStart = 0;
        let finalPos = [];
        let finalNorm = [];
        let finalUV = [];
        let finalIdx = [];
        let materialOrder = [];
        
        for (let matId in solidFaces) {
            let mf = solidFaces[matId];
            if (mf.idx.length === 0) continue;
            let mappedIdx = mf.idx.map(i => i + (finalPos.length / 3));
            finalIdx.push(...mappedIdx);
            finalPos.push(...mf.pos);
            finalNorm.push(...mf.norm);
            finalUV.push(...mf.uv);
            geometry.addGroup(solidGroupStart, mf.idx.length, materialOrder.length);
            solidGroupStart += mf.idx.length;
            materialOrder.push(this.materialArray[matId]);
        }
        
        if (finalPos.length > 0) {
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPos, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNorm, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUV, 2));
            geometry.setIndex(finalIdx);
            
            this.mesh = new THREE.Mesh(geometry, materialOrder);
            this.mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
            this.scene.add(this.mesh);
        }
        
        // Build water mesh (separate from solid so transparency sorts correctly)
        if (waterFaces.idx.length > 0) {
            const wGeom = new THREE.BufferGeometry();
            wGeom.setAttribute('position', new THREE.Float32BufferAttribute(waterFaces.pos, 3));
            wGeom.setAttribute('normal', new THREE.Float32BufferAttribute(waterFaces.norm, 3));
            wGeom.setAttribute('uv', new THREE.Float32BufferAttribute(waterFaces.uv, 2));
            wGeom.setIndex(waterFaces.idx);
            
            this.waterMesh = new THREE.Mesh(wGeom, this.materialArray[BLOCKS.WATER]);
            this.waterMesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
            this.waterMesh.userData = { ignoreRaycast: true };
            this.scene.add(this.waterMesh);
        }
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.scene.remove(this.waterMesh);
            if (this.waterMesh.geometry) this.waterMesh.geometry.dispose();
            this.waterMesh = null;
        }
        // Free data array
        this.data = null;
    }
}
