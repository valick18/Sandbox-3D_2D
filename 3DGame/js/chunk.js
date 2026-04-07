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
        
        this.generateData();
        this.buildMesh();
    }
    
    getIndex(x, y, z) {
        return x + CHUNK_SIZE * (y + CHUNK_HEIGHT * z);
    }
    
    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return BLOCKS.AIR; // Out of bounds for this chunk (Ideally query neighbor chunks, but air is fine for basic culling edge)
        }
        return this.data[this.getIndex(x, y, z)];
    }
    
    generateData() {
        let worldXOffset = this.chunkX * CHUNK_SIZE;
        let worldZOffset = this.chunkZ * CHUNK_SIZE;
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                let wx = worldXOffset + x;
                let wz = worldZOffset + z;
                
                // Height map
                let noiseVal = fbm2D(wx * 0.01, wz * 0.01, 4, 0.5);
                let surfaceY = Math.floor(64 + noiseVal * 40);
                
                // Determine biome (temp/humid)
                let temp = fbm2D(wx * 0.005, wz * 0.005);
                let isDesert = temp > 0.6;
                let isSnow = temp < 0.3;
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let idx = this.getIndex(x, y, z);
                    
                    if (y > surfaceY) {
                        this.data[idx] = BLOCKS.AIR;
                    } else if (y === surfaceY) {
                        this.data[idx] = isDesert ? BLOCKS.SAND : (isSnow ? BLOCKS.SNOW : BLOCKS.GRASS);
                    } else if (y > surfaceY - 4) {
                        this.data[idx] = isDesert ? BLOCKS.SAND : BLOCKS.DIRT;
                    } else {
                        this.data[idx] = BLOCKS.STONE;
                    }
                    
                    // Caves (3D Noise)
                    if (y < surfaceY && y > 2) {
                        let caveNoise = noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                        if (caveNoise > 0.5) {
                            this.data[idx] = BLOCKS.AIR;
                        }
                    }
                }
                
                // Trees
                if (!isDesert && !isSnow && Math.random() < 0.02) {
                    let treeHeight = 4 + Math.floor(Math.random() * 3);
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
        
        // Group faces by material ID
        let materialFaces = {};

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
                        
                        // Transparent leaf check shouldn't cull neighbors completely, but let's keep it simple: cull if solid
                        if (nBlock === BLOCKS.AIR || nBlock === BLOCKS.LEAVES && blockId !== BLOCKS.LEAVES) {
                            
                            // Determine material index. If Grass Top (index 2) -> GRASS MAT. If Grass Side -> GRASS SIDE
                            let matId = blockId;
                            if (blockId === BLOCKS.GRASS && index !== 2 && index !== 3) matId = 100; // side
                            if (blockId === BLOCKS.GRASS && index === 3) matId = BLOCKS.DIRT; // bottom
                            
                            if(!materialFaces[matId]) materialFaces[matId] = { pos: [], norm: [], uv: [], idx: [] };
                            let mf = materialFaces[matId];
                            
                            let startV = mf.pos.length / 3;
                            // UV projection based on face direction for consistent look on all sides
                            let u0, u1, u2, u3;
                            const [dx2, dy2, dz2] = dir;
                            if (dy2 !== 0) {
                                // Top / Bottom: project XZ
                                u0 = [0,0]; u1 = [1,0]; u2 = [1,1]; u3 = [0,1];
                            } else if (dz2 !== 0) {
                                // Front / Back: project XY
                                u0 = [0,0]; u1 = [1,0]; u2 = [1,1]; u3 = [0,1];
                            } else {
                                // Left / Right: project ZY
                                u0 = [0,0]; u1 = [1,0]; u2 = [1,1]; u3 = [0,1];
                            }
                            const uvSeq = [u0, u1, u2, u3];
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
        
        // Assemble geometry and groups
        let groupStart = 0;
        let finalPos = [];
        let finalNorm = [];
        let finalUV = [];
        let finalIdx = [];
        let materialOrder = [];
        
        for (let matId in materialFaces) {
            let mf = materialFaces[matId];
            if (mf.idx.length === 0) continue;
            
            // Offset indices
            let mappedIdx = mf.idx.map(i => i + (finalPos.length / 3));
            finalIdx.push(...mappedIdx);
            
            finalPos.push(...mf.pos);
            finalNorm.push(...mf.norm);
            finalUV.push(...mf.uv);
            
            // Add group
            geometry.addGroup(groupStart, mf.idx.length, materialOrder.length);
            groupStart += mf.idx.length;
            
            materialOrder.push(this.materialArray[matId]);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPos, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(finalNorm, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUV, 2));
        geometry.setIndex(finalIdx);
        
        this.mesh = new THREE.Mesh(geometry, materialOrder);
        this.mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
        this.scene.add(this.mesh);
    }
}
