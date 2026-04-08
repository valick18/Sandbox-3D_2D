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
    MEAT: 8,
    WORKBENCH: 9,
    CHEST: 10
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
    [BLOCKS.MEAT]: [220, 60, 60],
    [BLOCKS.WORKBENCH]: [160, 110, 60], // lighter wood
    [BLOCKS.CHEST]: [140, 90, 40] // medium wood
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

    // Leaves - Minecraft-style: tiny leaf shapes on dark green bg
    let leafMat = createCanvasTex(BLOCKS.LEAVES, (x, y) => {
        // Small 4px cells — each cell randomly filled or empty
        const cell = 4;
        let cx = Math.floor(x / cell);
        let cy = Math.floor(y / cell);
        let lx = x % cell;
        let ly = y % cell;

        // Deterministic hash per cell
        const h = (a, b) => {
            let v = Math.sin(a * 57.3 + b * 231.7 + 3.1) * 85432.131;
            return v - Math.floor(v);
        };
        let hv = h(cx, cy);

        // Sub-cell for inner highlight variation
        const hv2 = h(cx * 2.1 + 0.7, cy * 1.9 + 0.3);

        // ~70% of cells are bright leaf patches
        let isLeaf = hv > 0.30;
        // 1-pixel border between cells (dark outline)
        let isBorder = (lx === 0 || ly === 0);

        let r, g, b;

        if (isLeaf && !isBorder) {
            // Leaf surface: range from mid-green to bright green
            let bright = Math.floor(hv2 * 40);
            r = 38 + bright;
            g = 110 + bright + Math.floor(hv * 30);
            b = 28 + Math.floor(hv2 * 10);
        } else if (isLeaf && isBorder) {
            // Leaf edge: darker
            r = 22; g = 75; b = 20;
        } else {
            // Gap between leaves: very dark green
            r = 14; g = 50; b = 14;
        }

        // High-frequency pixel noise for texture depth (like MC dithering)
        let noise = Math.floor((Math.sin(x * 13.7 + y * 9.3) * 0.5 + 0.5) * 14) - 7;
        r = Math.max(0, Math.min(255, r + noise));
        g = Math.max(0, Math.min(255, g + noise));
        b = Math.max(0, Math.min(255, b + noise));

        return [r, g, b, 255];
    });
    leafMat.transparent = false;
    leafMat.alphaTest = 0;
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

    // Workbench - grid/tools on top, planks on side
    materials[BLOCKS.WORKBENCH] = createCanvasTex(BLOCKS.WORKBENCH, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let c = BASE_COLORS[BLOCKS.WORKBENCH];
        // Grid pattern
        if (x % 32 < 2 || y % 32 < 2) {
            return [c[0]-40+vary, c[1]-40+vary, c[2]-40+vary];
        }
        // Simulated tools (pixels)
        if ((x > 10 && x < 20 && y > 10 && y < 15) || (x > 40 && x < 45 && y > 30 && y < 50)) {
            return [100+vary, 100+vary, 110+vary]; // metallic tool parts
        }
        return [c[0]+vary, c[1]+vary, c[2]+vary];
    });

    // Chest - wood with iron borders and lock
    materials[BLOCKS.CHEST] = createCanvasTex(BLOCKS.CHEST, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let c = BASE_COLORS[BLOCKS.CHEST];
        // Wood grain
        let grain = Math.sin((x / 64) * Math.PI * 10) * 10;
        
        // Iron borders
        if (x < 4 || x > 60 || y < 4 || y > 60) {
            return [60, 60, 65]; // iron rim
        }
        
        // Lock
        if (x > 28 && x < 36 && y > 24 && y < 36) {
            return [200+vary, 200+vary, 200+vary]; // silver lock
        }
        
        // horizontal plank lines
        if (y % 16 < 2) {
            return [c[0]-30+vary, c[1]-30+vary, c[2]-30+vary];
        }
        
        return [c[0]+grain+vary, c[1]+grain+vary, c[2]+grain+vary];
    });
}
