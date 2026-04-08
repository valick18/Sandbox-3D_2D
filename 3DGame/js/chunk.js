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
    
    generateData() {
        let worldXOffset = this.chunkX * CHUNK_SIZE;
        let worldZOffset = this.chunkZ * CHUNK_SIZE;
        const WATER_LEVEL = 58;
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;
                
                // Base noise maps
                let baseElev = fbm2D(wx * 0.002, wz * 0.002, 4, 0.5);
                let temp = fbm2D(wx * 0.004 + 100, wz * 0.004 + 100);
                let moist = fbm2D(wx * 0.004 - 100, wz * 0.004 - 100);

                // Smooth base curve from Y=40 (ocean floors) to Y=72 (high plains)
                let baseHeight = 40 + baseElev * 32; 
                
                // Exponential mountain boost when elevation goes past 0.55
                let mountainBoost = 0;
                if (baseElev > 0.55) {
                    mountainBoost = Math.pow((baseElev - 0.55) * 2.2, 2.5) * 90;
                }
                
                // Detail noise, scaling up intensity on mountains
                let detailNoise = fbm2D(wx*0.01, wz*0.01) * 5;
                if (baseElev > 0.55) detailNoise *= 1.0 + (baseElev - 0.55)*8;
                
                let surfaceY = Math.floor(baseHeight + mountainBoost + detailNoise);

                let isOcean = surfaceY <= WATER_LEVEL - 4; // deep water
                let isMountain = surfaceY > 75; // high elevation
                let isDesert = !isOcean && !isMountain && temp > 0.6 && moist < 0.5;
                let isPlains = !isOcean && !isMountain && !isDesert && moist < 0.4;
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let idx = this.getIndex(x, y, z);
                    
                    if (y > surfaceY) {
                        if (y <= WATER_LEVEL) {
                            this.data[idx] = BLOCKS.WATER;
                        } else {
                            this.data[idx] = BLOCKS.AIR;
                        }
                    } else if (y === surfaceY) {
                        // Sand near oceans or desert, Stone entirely for mountains
                        if (isDesert || (surfaceY <= WATER_LEVEL + 2 && !isMountain)) {
                            this.data[idx] = BLOCKS.SAND;
                        } else if (isMountain) {
                            this.data[idx] = BLOCKS.STONE;
                        } else {
                            this.data[idx] = BLOCKS.GRASS;
                        }
                    } else if (y > surfaceY - 4) {
                        this.data[idx] = (isDesert || isOcean) ? BLOCKS.SAND : (isMountain ? BLOCKS.STONE : BLOCKS.DIRT);
                    } else {
                        this.data[idx] = BLOCKS.STONE;
                    }
                    
                    // Caves (3D Noise)
                    if (y < surfaceY && y > 2) {
                        let caveNoise = noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                        if (caveNoise > 0.5) {
                            this.data[idx] = y <= WATER_LEVEL ? BLOCKS.WATER : BLOCKS.AIR;
                        }
                    }
                }
                
                // Flora (Trees and Cacti)
                let hash = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453;
                let treeRng = hash - Math.floor(hash);

                if (surfaceY >= WATER_LEVEL) { // Don't spawn plants underwater
                    if (isDesert && treeRng < 0.02) {
                        // Cactus
                        let cactusHeight = 2 + Math.floor((hash * 10) % 3);
                        for(let ty = 1; ty <= cactusHeight; ty++) {
                            if (surfaceY + ty < CHUNK_HEIGHT)
                                this.data[this.getIndex(x, surfaceY + ty, z)] = BLOCKS.CACTUS;
                        }
                    } else if (!isDesert && !isPlains && !isOcean && !isMountain && treeRng < 0.015) {
                        // Regular Tree
                        let hash2 = Math.sin(wx * 39.346 + wz * 11.135) * 43758.5453;
                        let hRng = hash2 - Math.floor(hash2);
                        let treeHeight = 4 + Math.floor(hRng * 3);
                        for(let ty = 1; ty <= treeHeight; ty++) {
                            if (surfaceY + ty < CHUNK_HEIGHT)
                                this.data[this.getIndex(x, surfaceY + ty, z)] = BLOCKS.WOOD;
                        }
                        // Leaves
                        for (let lx = -2; lx <= 2; lx++) {
                            for (let ly = -2; ly <= 2; ly++) {
                                for (let lz = -2; lz <= 2; lz++) {
                                    if (lx*lx + ly*ly + lz*lz <= 6) {
                                        let tx = x + lx;
                                        let tz = z + lz;
                                        let ty = surfaceY + treeHeight + ly;
                                        if (tx>=0 && tx<CHUNK_SIZE && tz>=0 && tz<CHUNK_SIZE && ty>=0 && ty<CHUNK_HEIGHT) {
                                            if (this.data[this.getIndex(tx, ty, tz)] === BLOCKS.AIR) {
                                                this.data[this.getIndex(tx, ty, tz)] = BLOCKS.LEAVES;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Apply modified blocks
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
                        
                        if (shouldRender) {
                            
                            // Determine material index. If Grass Top (index 2) -> GRASS MAT. If Grass Side -> GRASS SIDE
                            let matId = blockId;
                            if (blockId === BLOCKS.GRASS && index !== 2 && index !== 3) matId = 100; // side
                            if (blockId === BLOCKS.GRASS && index === 3) matId = BLOCKS.DIRT; // bottom

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
            this.scene.add(this.waterMesh);
        }
    }
}
