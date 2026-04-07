import * as THREE from 'three';

export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    SAND: 6,
    PLANKS: 7,
    MEAT: 8
};

// Colors for each block
const BASE_COLORS = {
    [BLOCKS.GRASS]: [80, 180, 80],
    [BLOCKS.DIRT]: [120, 75, 40],
    [BLOCKS.STONE]: [130, 130, 130],
    [BLOCKS.WOOD]: [90, 50, 20],
    [BLOCKS.LEAVES]: [40, 120, 40],
    [BLOCKS.SAND]: [238, 214, 150],
    [BLOCKS.PLANKS]: [180, 140, 90],
    [BLOCKS.MEAT]: [220, 60, 60]
};

const size = 64; // HD Textures
export const materials = [];
export const icons = {};

function createCanvasTex(blockId, blockFn) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    
    for (let i = 0; i < size * size; i++) {
        let x = i % size;
        let y = Math.floor(i / size);
        let color = blockFn(x, y);
        
        let idx = i * 4;
        data[idx] = Math.max(0, Math.min(255, color[0]));
        data[idx+1] = Math.max(0, Math.min(255, color[1]));
        data[idx+2] = Math.max(0, Math.min(255, color[2]));
        data[idx+3] = color[3] !== undefined ? color[3] : 255;
    }
    
    ctx.putImageData(imgData, 0, 0);
    
    // Extract base64 for HTML UI
    icons[blockId] = canvas.toDataURL();

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map: tex });
}

export function generateMaterials() {
    materials[BLOCKS.AIR] = null;
    
    // Dirt - clumpy texture
    materials[BLOCKS.DIRT] = createCanvasTex(BLOCKS.DIRT, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 15;
        let clumps = Math.sin(nx * 5) * Math.cos(ny * 5) * 20 + Math.sin(nx * 2 + ny * 3) * 15;
        if (Math.random() < 0.05) clumps -= 30; // pebbles
        let c = BASE_COLORS[BLOCKS.DIRT];
        return [c[0]+vary+clumps, c[1]+vary+clumps, c[2]+vary+clumps];
    });

    // Grass Top - rich pattern
    materials[BLOCKS.GRASS] = createCanvasTex(BLOCKS.GRASS, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 15;
        let pattern = Math.sin(nx * 4) * Math.sin(ny * 4) * 25 + Math.cos(nx * 7 + ny * 10) * 10;
        let c = BASE_COLORS[BLOCKS.GRASS];
        return [c[0]+vary+pattern, c[1]+vary+pattern+10, c[2]+vary+pattern];
    });
    
    // Grass Side - smooth transition
    materials[100] = createCanvasTex(100, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let drop = 20 + Math.sin(nx * 3) * 6 + Math.cos(nx * 7) * 4;
        let vary = (Math.random() - 0.5) * 20;
        if (y < drop) {
            let c = BASE_COLORS[BLOCKS.GRASS];
            let grad = (drop - y) / drop; 
            return [c[0]*grad + 20 + vary, c[1]*grad + 60 + vary, c[2]*grad + 20 + vary];
        } else {
            let c = BASE_COLORS[BLOCKS.DIRT];
            let clumps = Math.sin(nx * 5) * Math.cos(ny * 5) * 15;
            return [c[0]+vary+clumps, c[1]+vary+clumps, c[2]+vary+clumps];
        }
    });

    // Stone - cobbled look
    materials[BLOCKS.STONE] = createCanvasTex(BLOCKS.STONE, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        // procedural rocks using sine waves instead of hard grid cells for a tileable cobbled look
        let crack = Math.abs(Math.sin(nx * 4 + Math.cos(ny * 3)) + Math.cos(ny * 4 + Math.sin(nx * 3)));
        let shade = crack * 20;
        if (crack < 0.4) shade -= 40; // deep crack
        let c = BASE_COLORS[BLOCKS.STONE];
        return [c[0]-shade+vary, c[1]-shade+vary, c[2]-shade+vary];
    });

    // Wood - Tree Rings (side view)
    materials[BLOCKS.WOOD] = createCanvasTex(BLOCKS.WOOD, (x, y) => {
        let vary = (Math.random() - 0.5) * 15;
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let grain = Math.sin(nx * 3 + Math.sin(ny * 1) * 2) * 25;
        if (Math.sin(nx * 8) > 0.9) vary -= 40;
        let c = BASE_COLORS[BLOCKS.WOOD];
        return [c[0]+grain+vary, c[1]+grain+vary, c[2]+grain+vary];
    });

    // Leaves - Natural clumps
    let leafMat = createCanvasTex(BLOCKS.LEAVES, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 25;
        let a = 255;
        
        let cell = Math.sin(nx * 6) * Math.cos(ny * 6) + Math.sin(nx * 3 + ny * 5);
        if (cell < -0.3) {
            a = 0; // distinct holes
        } else {
            vary += cell * 30; // highlight leaves
        }
        let c = BASE_COLORS[BLOCKS.LEAVES];
        return [c[0]+vary, c[1]+vary, c[2]+vary, a];
    });
    // For alpha to work well in WebGL without sorting issues, alphaTest is critical
    leafMat.transparent = false; // Disable standard transparency
    leafMat.alphaTest = 0.5; // Only render pixels > 50% opacity (hard cut out)
    materials[BLOCKS.LEAVES] = leafMat;
    
    // Sand - very fine subtle noise
    materials[BLOCKS.SAND] = createCanvasTex(BLOCKS.SAND, (x, y) => {
        let vary = (Math.random() - 0.5) * 15;
        let c = BASE_COLORS[BLOCKS.SAND];
        return [c[0]+vary, c[1]+vary, c[2]+vary];
    });

    // Planks
    materials[BLOCKS.PLANKS] = createCanvasTex(BLOCKS.PLANKS, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        if (y % 16 === 0 || x % 32 === 0) vary -= 30;
        let c = BASE_COLORS[BLOCKS.PLANKS];
        return [c[0]+vary, c[1]+vary, c[2]+vary];
    });

    // Meat - realistic marbling
    materials[BLOCKS.MEAT] = createCanvasTex(BLOCKS.MEAT, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 15;
        let fat = Math.sin(nx * 3 + ny * 6) + Math.sin(nx * 7 - ny * 2);
        let c = BASE_COLORS[BLOCKS.MEAT];
        if (fat > 0.8) {
             return [240+vary, 220+vary, 220+vary];
        }
        return [c[0]+vary, c[1]+vary, c[2]+vary];
    });
}
