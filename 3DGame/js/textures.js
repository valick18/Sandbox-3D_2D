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
    CHEST: 10,
    WATER: 11,
    CACTUS: 12,
    FLOWER_RED: 13,
    FLOWER_YELLOW: 14,
    TALL_GRASS: 15,
    BRICK: 16,
    STONE_BRICK: 17,
    CLAY: 18,
    GLASS: 19,
    FURNACE: 20,
    SNOW_LAYER: 21,
    TILLED_SOIL: 22,
    // Crops (mature plants — rendered as cross-quads)
    WHEAT: 23,
    OATS: 24,
    TOMATO: 25,
    CARROT: 26,
    POTATO: 27,
    // Seeds / planting items (held in inventory only, NOT placed as solid blocks)
    WHEAT_SEED: 28,
    OATS_SEED: 29,
    TOMATO_SEED: 30,
    // New Trees
    APPLE_LEAVES: 31,
    BIRCH_WOOD: 32,
    BIRCH_LEAVES: 33,
    PINE_WOOD: 34,
    PINE_LEAVES: 35,
    JUNGLE_WOOD: 36,
    JUNGLE_LEAVES: 37,
    PALM_WOOD: 38,
    PALM_LEAVES: 39,
    // Tools
    HOE: 50
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
    [BLOCKS.CHEST]: [140, 90, 40], // medium wood
    [BLOCKS.WATER]: [40, 80, 220],
    [BLOCKS.CACTUS]: [30, 130, 40],
    [BLOCKS.BRICK]: [180, 80, 70],
    [BLOCKS.STONE_BRICK]: [115, 115, 115],
    [BLOCKS.CLAY]: [160, 160, 170],
    [BLOCKS.GLASS]: [200, 240, 255],
    [BLOCKS.FURNACE]: [80, 80, 80],
    [BLOCKS.TILLED_SOIL]: [80, 45, 18],
    [BLOCKS.SNOW_LAYER]: [245, 250, 255],
    [BLOCKS.APPLE_LEAVES]: [50, 160, 40], // vibrant green
    [BLOCKS.BIRCH_WOOD]: [225, 225, 220], // white bark
    [BLOCKS.BIRCH_LEAVES]: [100, 160, 60], // lighter yellowish green
    [BLOCKS.PINE_WOOD]: [60, 40, 20], // dark brown
    [BLOCKS.PINE_LEAVES]: [30, 80, 40], // dark evergreen
    [BLOCKS.JUNGLE_WOOD]: [130, 80, 40], // saturated cocoa brown
    [BLOCKS.JUNGLE_LEAVES]: [40, 150, 30], // vivid jungle green
    [BLOCKS.PALM_WOOD]: [160, 140, 100], // sandy tan
    [BLOCKS.PALM_LEAVES]: [60, 170, 50] // bright tropical green
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
        data[idx + 1] = Math.max(0, Math.min(255, color[1]));
        data[idx + 2] = Math.max(0, Math.min(255, color[2]));
        data[idx + 3] = color[3] !== undefined ? color[3] : 255;
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
        return [c[0] + vary + clumps, c[1] + vary + clumps, c[2] + vary + clumps];
    });

    // Grass Top - greyscale base for seasonal tinting
    materials[BLOCKS.GRASS] = createCanvasTex(BLOCKS.GRASS, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 15;
        let pattern = Math.sin(nx * 4) * Math.sin(ny * 4) * 25 + Math.cos(nx * 7 + ny * 10) * 10;
        // Even whiter snow base (increased from 200 to 240)
        let grey = 240 + vary + pattern;
        return [grey, grey, grey];
    });

    // Grass Side - whiter top part for tinting
    materials[100] = createCanvasTex(100, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let drop = 20 + Math.sin(nx * 3) * 6 + Math.cos(nx * 7) * 4;
        let vary = (Math.random() - 0.5) * 20;
        if (y < drop) {
            let grad = (drop - y) / drop;
            let grey = 230 * grad + 25 + vary; // Arctic white
            return [grey, grey, grey];
        } else {
            let c = BASE_COLORS[BLOCKS.DIRT];
            let clumps = Math.sin(nx * 5) * Math.cos(ny * 103 % 6.28) * 15; // fixed clumps lookup
            return [c[0] + vary + clumps, c[1] + vary + clumps, c[2] + vary + clumps];
        }
    });
    // Overwrite the Grass inventory icon to use the Grass Side texture so it looks exactly like "Dirt with Grass" to the user
    icons[BLOCKS.GRASS] = icons[100];

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
        return [c[0] - shade + vary, c[1] - shade + vary, c[2] - shade + vary];
    });

    // Wood Generator Helper
    const createWoodTex = (id) => createCanvasTex(id, (x, y) => {
        let vary = (Math.random() - 0.5) * 15;
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let grain = Math.sin(nx * 3 + Math.sin(ny * 1) * 2) * 25;
        if (Math.sin(nx * 8) > 0.9) vary -= 40;
        // Birch wood looks different: horizontal stripes
        if (id === BLOCKS.BIRCH_WOOD) {
            grain = Math.sin(ny * 10) * 10;
            if (Math.sin(ny * 4) > 0.8 && Math.sin(nx * 5) > 0.5) vary -= 60; // black marks
        }
        let c = BASE_COLORS[id];
        return [c[0] + grain + vary, c[1] + grain + vary, c[2] + grain + vary];
    });

    // Leaves Generator Helper
    const createLeafTex = (id) => {
        let mat = createCanvasTex(id, (x, y) => {
            const cell = id === BLOCKS.PINE_LEAVES ? 3 : 4; // Pine has finer needles
            let cx = Math.floor(x / cell), cy = Math.floor(y / cell);
            let lx = x % cell, ly = y % cell;
            const h = (a, b) => { let v = Math.sin(a * 57.3 + b * 231.7 + 3.1) * 85432.131; return v - Math.floor(v); };
            let hv = h(cx, cy), hv2 = h(cx * 2.1 + 0.7, cy * 1.9 + 0.3);
            let isLeaf = hv > 0.30, isBorder = (lx === 0 || ly === (id===BLOCKS.PINE_LEAVES?0:ly));
            let c = BASE_COLORS[id];
            let r, g, b;
            if (isLeaf && !isBorder) {
                let bright = Math.floor(hv2 * 40);
                r = c[0] + bright; g = c[1] + bright + Math.floor(hv * 30); b = c[2] + Math.floor(hv2 * 10);
            } else if (isLeaf && isBorder) {
                r = c[0] * 0.55; g = c[1] * 0.6; b = c[2] * 0.5;
            } else {
                r = c[0] * 0.35; g = c[1] * 0.4; b = c[2] * 0.35;
            }
            
            // Apples explicitly for APPLE_LEAVES
            if (id === BLOCKS.APPLE_LEAVES && h(cx*3, cy*3) > 0.96) {
                if(lx > 0 && ly > 0 && lx < 3 && ly < 3) return [220, 40, 40, 255]; // Red apples
            }

            let noise = Math.floor((Math.sin(x * 13.7 + y * 9.3) * 0.5 + 0.5) * 14) - 7;
            return [Math.max(0, Math.min(255, r + noise)), Math.max(0, Math.min(255, g + noise)), Math.max(0, Math.min(255, b + noise)), 255];
        });
        mat.transparent = false;
        mat.alphaTest = 0;
        return mat;
    };

    materials[BLOCKS.WOOD] = createWoodTex(BLOCKS.WOOD);
    materials[BLOCKS.BIRCH_WOOD] = createWoodTex(BLOCKS.BIRCH_WOOD);
    materials[BLOCKS.PINE_WOOD] = createWoodTex(BLOCKS.PINE_WOOD);
    materials[BLOCKS.JUNGLE_WOOD] = createWoodTex(BLOCKS.JUNGLE_WOOD);
    materials[BLOCKS.PALM_WOOD] = createWoodTex(BLOCKS.PALM_WOOD);

    materials[BLOCKS.LEAVES] = createLeafTex(BLOCKS.LEAVES);
    materials[BLOCKS.APPLE_LEAVES] = createLeafTex(BLOCKS.APPLE_LEAVES);
    materials[BLOCKS.BIRCH_LEAVES] = createLeafTex(BLOCKS.BIRCH_LEAVES);
    materials[BLOCKS.PINE_LEAVES] = createLeafTex(BLOCKS.PINE_LEAVES);
    materials[BLOCKS.JUNGLE_LEAVES] = createLeafTex(BLOCKS.JUNGLE_LEAVES);
    materials[BLOCKS.PALM_LEAVES] = createLeafTex(BLOCKS.PALM_LEAVES);

    // Sand - very fine subtle noise
    materials[BLOCKS.SAND] = createCanvasTex(BLOCKS.SAND, (x, y) => {
        let vary = (Math.random() - 0.5) * 15;
        let c = BASE_COLORS[BLOCKS.SAND];
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Snow - crisp white texture for snow layers
    materials[BLOCKS.SNOW_LAYER] = createCanvasTex(BLOCKS.SNOW_LAYER, (x, y) => {
        let vary = (Math.random() - 0.5) * 8;
        let c = BASE_COLORS[BLOCKS.SNOW_LAYER];
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Planks
    materials[BLOCKS.PLANKS] = createCanvasTex(BLOCKS.PLANKS, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        if (y % 16 === 0 || x % 32 === 0) vary -= 30;
        let c = BASE_COLORS[BLOCKS.PLANKS];
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Meat - realistic marbling
    materials[BLOCKS.MEAT] = createCanvasTex(BLOCKS.MEAT, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let vary = (Math.random() - 0.5) * 15;
        let fat = Math.sin(nx * 3 + ny * 6) + Math.sin(nx * 7 - ny * 2);
        let c = BASE_COLORS[BLOCKS.MEAT];
        if (fat > 0.8) {
            return [240 + vary, 220 + vary, 220 + vary];
        }
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Workbench - grid/tools on top, planks on side
    materials[BLOCKS.WORKBENCH] = createCanvasTex(BLOCKS.WORKBENCH, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let c = BASE_COLORS[BLOCKS.WORKBENCH];
        // Grid pattern
        if (x % 32 < 2 || y % 32 < 2) {
            return [c[0] - 40 + vary, c[1] - 40 + vary, c[2] - 40 + vary];
        }
        // Simulated tools (pixels)
        if ((x > 10 && x < 20 && y > 10 && y < 15) || (x > 40 && x < 45 && y > 30 && y < 50)) {
            return [100 + vary, 100 + vary, 110 + vary]; // metallic tool parts
        }
        return [c[0] + vary, c[1] + vary, c[2] + vary];
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
            return [200 + vary, 200 + vary, 200 + vary]; // silver lock
        }

        // horizontal plank lines
        if (y % 16 < 2) {
            return [c[0] - 30 + vary, c[1] - 30 + vary, c[2] - 30 + vary];
        }

        return [c[0] + grain + vary, c[1] + grain + vary, c[2] + grain + vary];
    });

    // Water - translucent animated feel
    let waterMat = createCanvasTex(BLOCKS.WATER, (x, y) => {
        let nx = (x / 64) * Math.PI * 2;
        let ny = (y / 64) * Math.PI * 2;
        let wave = Math.sin(nx * 2 + ny * 3) * 10;
        let c = BASE_COLORS[BLOCKS.WATER];
        return [c[0] + wave, c[1] + wave, c[2] + wave];
    });
    waterMat.transparent = true;
    waterMat.opacity = 0.75;
    waterMat.depthWrite = true;       // MUST be true to block solid geometry from bleeding through
    waterMat.side = THREE.DoubleSide;
    waterMat.polygonOffset = true;
    waterMat.polygonOffsetFactor = -2;
    waterMat.polygonOffsetUnits = -2;
    materials[BLOCKS.WATER] = waterMat;

    // Cactus - green with dark vertical lines and spine dots
    materials[BLOCKS.CACTUS] = createCanvasTex(BLOCKS.CACTUS, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let c = BASE_COLORS[BLOCKS.CACTUS];
        if (x % 16 < 2) return [c[0] - 30 + vary, c[1] - 30 + vary, c[2] - 30 + vary];
        if (Math.random() < 0.05) return [200, 200, 150]; // pale spike
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Snow Layer - pure white
    materials[BLOCKS.SNOW_LAYER] = createCanvasTex(BLOCKS.SNOW_LAYER, (x, y) => {
        let vary = (Math.random() - 0.5) * 5;
        let c = 255 + vary;
        return [c, c, c];
    });

    // --- FLORA (Flowers & Tall Grass) ---
    // Deterministic hash helper
    const fh = (a, b) => { let v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

    // ---- TALL GRASS ----
    (() => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        // Define 3 blades: left-lean, center, right-lean
        const blades = [
            { baseX: 18, topX: 10, baseY: 63, topY: 10, halfW: 2.5 },
            { baseX: 32, topX: 34, baseY: 63, topY: 6,  halfW: 3.0 },
            { baseX: 46, topX: 54, baseY: 63, topY: 14, halfW: 2.2 },
        ];

        for (let i = 0; i < size * size; i++) {
            let px = i % size, py = Math.floor(i / size);
            let bestA = 0, bestR = 0, bestG = 0, bestB = 0;

            for (const blade of blades) {
                // parametric t along blade (0=top, 1=base)
                let dy = blade.baseY - blade.topY;
                let t = (py - blade.topY) / dy;
                if (t < 0 || t > 1) continue;
                let midX = blade.topX + (blade.baseX - blade.topX) * t;
                let hw = blade.halfW * (0.3 + 0.7 * t); // tapers toward tip
                let dist = Math.abs(px - midX);
                if (dist > hw) continue;

                // Edge soft falloff
                let edge = dist / hw;
                if (edge > 0.85) continue; // crisp edge

                // Color: dark green at base → bright yellow-green at tip
                let bright = 1.0 - t; // bright at top
                let nr = Math.floor(30 + bright * 40 + fh(px, py) * 12);
                let ng = Math.floor(100 + bright * 60 + fh(py, px * 2) * 20);
                let nb = Math.floor(20 + bright * 10);

                // Midrib highlight (slight white stripe down center)
                if (dist < hw * 0.2) { nr += 15; ng += 20; nb += 8; }

                // Pixel dither noise
                let noise = Math.floor((fh(px * 3.1, py * 2.7) - 0.5) * 16);
                bestR = Math.max(0, Math.min(255, nr + noise));
                bestG = Math.max(0, Math.min(255, ng + noise));
                bestB = Math.max(0, Math.min(255, nb + noise));
                bestA = 255;
                break; // take the first matching blade
            }

            let idx = i * 4;
            data[idx] = bestR; data[idx+1] = bestG; data[idx+2] = bestB; data[idx+3] = bestA;
        }
        ctx.putImageData(imgData, 0, 0);
        icons[BLOCKS.TALL_GRASS] = canvas.toDataURL();
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        materials[BLOCKS.TALL_GRASS] = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    })();

    // ---- FLOWERS ----
    const createFlowerTex = (blockId, petalR, petalG, petalB) => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const imgData = canvas.getContext('2d').createImageData(size, size);
        const data = imgData.data;
        const cx = 32, cy = 22; // flower center

        for (let i = 0; i < size * size; i++) {
            let px = i % size, py = Math.floor(i / size);
            let r = 0, g = 0, b = 0, a = 0;

            // --- STEM ---
            // Slightly curved stem: leans left at top
            let stemCenterX = 32 + (py - 48) * 0.12;
            let stemDist = Math.abs(px - stemCenterX);
            if (py > 28 && py < 63 && stemDist < 2.5) {
                let shade = stemDist / 2.5;
                r = Math.floor(28 + shade * 10);
                g = Math.floor(105 + (1.0 - shade) * 35);
                b = Math.floor(18);
                a = 255;
                // Midrib highlight
                if (stemDist < 0.8) { r += 10; g += 20; }
            }

            // --- LEAVES on stem (2 small leaves) ---
            // Left leaf at y≈42
            {
                let lx = px - 32, ly = py - 42;
                let leafT = -(lx * 0.6 + ly * 0.4); // tilted axis
                let leafN = lx * 0.4 - ly * 0.6;
                if (leafT > 0 && leafT < 10 && Math.abs(leafN) < leafT * 0.45) {
                    let edge = Math.abs(leafN) / (leafT * 0.45);
                    r = Math.floor(28 + edge * 10);
                    g = Math.floor(118 + (1.0 - edge) * 30);
                    b = 20; a = 255;
                }
            }
            // Right leaf at y≈50
            {
                let lx = px - 32, ly = py - 50;
                let leafT = lx * 0.7 + ly * (-0.3);
                let leafN = lx * 0.3 + ly * 0.7;
                if (leafT > 0 && leafT < 9 && Math.abs(leafN) < leafT * 0.5) {
                    let edge = Math.abs(leafN) / (leafT * 0.5);
                    r = Math.floor(30 + edge * 10);
                    g = Math.floor(115 + (1.0 - edge) * 28);
                    b = 18; a = 255;
                }
            }

            // --- PETALS (6 petals radially around center) ---
            let dx = px - cx, dy = py - cy;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx);
            let numPetals = 6;
            let petalLen = 10, petalWidth = 0.45;

            for (let p = 0; p < numPetals; p++) {
                let pa = (p / numPetals) * Math.PI * 2;
                let adiff = angle - pa;
                // Normalize angle diff to [-PI, PI]
                while (adiff > Math.PI) adiff -= Math.PI * 2;
                while (adiff < -Math.PI) adiff += Math.PI * 2;
                let axial = dx * Math.cos(pa) + dy * Math.sin(pa);
                let radial = Math.abs(-dx * Math.sin(pa) + dy * Math.cos(pa));
                let petalHW = petalWidth * axial;
                if (axial > 2 && axial < petalLen && radial < petalHW) {
                    let t = axial / petalLen;
                    let edge = radial / petalHW;
                    let bright = (1.0 - t * 0.5) * (1.0 - edge * 0.4);
                    r = Math.floor(Math.min(255, petalR * bright + 20));
                    g = Math.floor(Math.min(255, petalG * bright));
                    b = Math.floor(Math.min(255, petalB * bright + 10));
                    a = 255;
                }
            }

            // --- CENTER ---
            if (dist < 5) {
                let shade = dist / 5;
                r = Math.floor(255 - shade * 40);
                g = Math.floor(220 - shade * 60);
                b = Math.floor(30 + shade * 10);
                a = 255;
            }
            // Center dark outline ring
            if (dist >= 4.5 && dist < 5.5) { r = Math.floor(r * 0.7); g = Math.floor(g * 0.7); b = Math.floor(b * 0.6); }

            // Pixel dither
            if (a > 0) {
                let noise = Math.floor((fh(px * 2.3 + 1, py * 1.7 + 2) - 0.5) * 10);
                r = Math.max(0, Math.min(255, r + noise));
                g = Math.max(0, Math.min(255, g + noise));
                b = Math.max(0, Math.min(255, b + noise));
            }

            let idx = i * 4;
            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
        }
        canvas.getContext('2d').putImageData(imgData, 0, 0);
        icons[blockId] = canvas.toDataURL();
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    };

    materials[BLOCKS.FLOWER_RED]    = createFlowerTex(BLOCKS.FLOWER_RED,    230, 30,  30);
    materials[BLOCKS.FLOWER_YELLOW] = createFlowerTex(BLOCKS.FLOWER_YELLOW, 240, 200, 20);

    // Brick
    materials[BLOCKS.BRICK] = createCanvasTex(BLOCKS.BRICK, (x, y) => {
        let vary = (Math.random() - 0.5) * 15;
        let c = BASE_COLORS[BLOCKS.BRICK];
        let row = Math.floor(y / 16);
        let offset = (row % 2 === 0) ? 0 : 16;
        let bx = (x + offset) % 32;
        if (y % 16 < 2 || bx < 2) return [200 + vary, 200 + vary, 200 + vary];
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Stone Brick
    materials[BLOCKS.STONE_BRICK] = createCanvasTex(BLOCKS.STONE_BRICK, (x, y) => {
        let vary = (Math.random() - 0.5) * 10;
        let c = BASE_COLORS[BLOCKS.STONE_BRICK];
        let row = Math.floor(y / 32);
        let offset = (row % 2 === 0) ? 0 : 32;
        let bx = (x + offset) % 64;
        if (y % 32 < 2 || bx < 2) return [60 + vary, 60 + vary, 60 + vary];
        if (y % 32 < 4 || bx < 4) vary += 15;
        if (y % 32 > 28 || bx > 60) vary -= 15;
        return [c[0] + vary, c[1] + vary, c[2] + vary];
    });

    // Clay
    materials[BLOCKS.CLAY] = createCanvasTex(BLOCKS.CLAY, (x, y) => {
        let vary = (Math.random() - 0.5) * 6;
        let swirl = Math.sin((x/64)*Math.PI*2 + (y/64)*Math.PI*2) * 5;
        let c = BASE_COLORS[BLOCKS.CLAY];
        return [c[0] + swirl + vary, c[1] + swirl + vary, c[2] + swirl + vary];
    });

    // Glass
    let glassMat = createCanvasTex(BLOCKS.GLASS, (x, y) => {
        let c = BASE_COLORS[BLOCKS.GLASS];
        if (x < 3 || x > 60 || y < 3 || y > 60) return [c[0], c[1], c[2], 255];
        return [c[0], c[1], c[2], 50]; 
    });
    glassMat.transparent = true;
    glassMat.depthWrite = false; // Allows multiple glass blocks to stack translucently
    materials[BLOCKS.GLASS] = glassMat;

    // Furnace - stone body
    materials[BLOCKS.FURNACE] = createCanvasTex(BLOCKS.FURNACE, (x, y) => {
        // Clean chiseled stone look
        let c = BASE_COLORS[BLOCKS.FURNACE];
        // Brick-like stone pattern
        let bx = x % 32;
        let by = y % 16;
        let mortar = (bx < 2 || by < 2) ? -30 : 0;
        // Stone variation
        let vary = Math.sin(x * 0.3 + y * 0.7) * 8 + Math.cos(x * 0.7 - y * 0.3) * 6;
        return [c[0] + mortar + vary, c[1] + mortar + vary, c[2] + mortar + vary];
    });

    // Furnace - front face (fire opening)
    materials[101] = createCanvasTex(101, (x, y) => {
        // Frame
        let c = BASE_COLORS[BLOCKS.FURNACE];
        let bx = x % 32;
        let by = y % 16;
        let mortar = (bx < 2 || by < 2) ? -30 : 0;
        let vary = Math.sin(x * 0.3 + y * 0.7) * 8 + Math.cos(x * 0.7 - y * 0.3) * 6;

        // Fire opening in center of face
        if (x >= 14 && x <= 50 && y >= 16 && y <= 50) {
            // Interior opening - dark with ember glow
            if (x >= 18 && x <= 46 && y >= 20 && y <= 46) {
                // Glowing embers at bottom
                if (y > 38) {
                    let glow = Math.abs(Math.sin(x * 0.3)) * 40 + Math.cos(y * 0.5) * 20;
                    return [180 + glow, 60 + glow * 0.4, 10, 255];
                }
                // Flames in middle
                let flame = Math.abs(Math.sin(x * 0.35 + 1.0)) * 50;
                if (y > 26) return [200 + flame, 100 + flame * 0.5, 20, 255];
                // Dark at top
                return [30, 20, 15, 255];
            }
            // Iron frame around opening
            return [45, 45, 50, 255];
        }
        return [c[0] + mortar + vary, c[1] + mortar + vary, c[2] + mortar + vary];
    });
    // Use front-face texture as the hotbar/inventory icon for furnace
    icons[BLOCKS.FURNACE] = icons[101];

    // ---- TILLED SOIL ----
    materials[BLOCKS.TILLED_SOIL] = createCanvasTex(BLOCKS.TILLED_SOIL, (x, y) => {
        let c = BASE_COLORS[BLOCKS.TILLED_SOIL];
        let vary = (Math.random() - 0.5) * 10;
        // Horizontal furrow grooves every 8 pixels
        let groove = (y % 8 < 2) ? -25 : 0;
        // Slight moisture darkening at groove bottoms
        let moisture = (y % 8 === 0) ? -15 : 5;
        return [c[0] + vary + groove, c[1] + vary + groove + moisture, c[2] + vary + groove];
    });

    // ---- CROP PLANTS (cross-quad flora, IDs 23-27) ----
    // UV layout: bottom of texture = seedling visible area, top = mature fruit
    // Stage 0 (seedling): shows y=44..63   Stage 1 (young): y=28..63   Stage 2 (mature): all

    const CROP_DEFS = [
        { id: BLOCKS.WHEAT,  stemR: 70, stemG: 145, stemB: 22, headR: 225, headG: 195, headB: 55 },
        { id: BLOCKS.OATS,   stemR: 65, stemG: 155, stemB: 28, headR: 200, headG: 210, headB: 90 },
        { id: BLOCKS.TOMATO, stemR: 38, stemG: 120, stemB: 20, headR: 220, headG: 50,  headB: 30 },
        { id: BLOCKS.CARROT, stemR: 40, stemG: 140, stemB: 22, headR: 230, headG: 110, headB: 20 },
        { id: BLOCKS.POTATO, stemR: 50, stemG: 122, stemB: 24, headR: 200, headG: 175, headB: 80 },
    ];

    for (const crop of CROP_DEFS) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        for (let i = 0; i < size * size; i++) {
            let x = i % size, y = Math.floor(i / size);
            let r = 0, g = 0, b = 0, a = 0;
            let pn = fh(x * 1.7 + 3, y * 2.3 + 1);
            let noise = Math.floor((pn - 0.5) * 12);

            // ================================================================
            // WHEAT / OATS — Minecraft style: 4 stalks + leaf blades + grain heads
            // y=44-63: short green stubs (seedling)
            // y=16-43: tall stalks with horizontal leaf blades (young)
            // y=0-15:  golden grain spike heads with berries + awns (mature)
            // ================================================================
            if (crop.id === BLOCKS.WHEAT || crop.id === BLOCKS.OATS) {
                const isOat = crop.id === BLOCKS.OATS;
                const stalkXs = [11, 24, 40, 53];

                // Draw stalks
                for (let si = 0; si < stalkXs.length; si++) {
                    let sx = stalkXs[si];
                    let sdist = Math.abs(x - sx);
                    let stalkW = 1.4 + (y / 63.0) * 1.0;
                    if (sdist < stalkW && y >= 10) {
                        let shade = sdist / stalkW;
                        // Color: green at bottom → golden at top
                        let gf = Math.max(0, 1.0 - y / 50.0);
                        let sr = Math.floor(crop.stemR + gf * (crop.headR - crop.stemR));
                        let sg = Math.floor(crop.stemG + gf * (crop.headG - crop.stemG));
                        let sb = Math.floor(crop.stemB * (1.0 - gf * 0.5));
                        r = Math.floor(sr * (0.68 + (1.0 - shade) * 0.32));
                        g = Math.floor(sg * (0.68 + (1.0 - shade) * 0.32));
                        b = sb; a = 255;
                        if (sdist < 0.55) { r = Math.min(255, r + 22); g = Math.min(255, g + 26); }
                    }
                }

                // Leaf blades — Minecraft horizontal style
                const leafRows = [
                    { ly: 54, si: 0, dir: -1, len: 9  }, { ly: 54, si: 1, dir:  1, len: 9  },
                    { ly: 54, si: 2, dir: -1, len: 9  }, { ly: 54, si: 3, dir:  1, len: 8  },
                    { ly: 40, si: 0, dir:  1, len: 12 }, { ly: 40, si: 1, dir: -1, len: 11 },
                    { ly: 40, si: 2, dir:  1, len: 12 }, { ly: 40, si: 3, dir: -1, len: 11 },
                    { ly: 27, si: 0, dir: -1, len: 10 }, { ly: 27, si: 1, dir:  1, len: 11 },
                    { ly: 27, si: 2, dir: -1, len: 10 }, { ly: 27, si: 3, dir:  1, len: 11 },
                ];
                let inLeaf = false;
                for (const lr of leafRows) {
                    let dy = Math.abs(y - lr.ly);
                    if (dy > 2.5) continue;
                    let sx = stalkXs[lr.si];
                    let lx = (x - sx) * lr.dir;
                    if (lx < 0 || lx > lr.len) continue;
                    let t = lx / lr.len;
                    if (dy / 2.5 > (1.0 - t * 0.55)) continue; // taper
                    let lum = (1.0 - (dy / 2.5) * 0.5) * (0.58 + (1.0 - t) * 0.42);
                    let gf = Math.max(0, 1.0 - lr.ly / 63.0);
                    r = Math.floor((crop.stemR * 0.7 + gf * (crop.headR * 0.6 - crop.stemR * 0.7)) * lum);
                    g = Math.floor((crop.stemG * 0.9 + gf * (crop.headG * 0.85 - crop.stemG * 0.9)) * lum);
                    b = Math.floor(crop.stemB * 0.7 * lum); a = 255;
                    inLeaf = true; break;
                }

                // Grain spike heads (top 15 pixels)
                if (y < 15 && !inLeaf) {
                    for (let si = 0; si < stalkXs.length; si++) {
                        let sx = stalkXs[si];
                        // Central spike
                        if (Math.abs(x - sx) < 1.4) {
                            let shade = Math.abs(x - sx) / 1.4;
                            r = Math.floor(crop.headR * (0.82 + (1.0 - shade) * 0.18));
                            g = Math.floor(crop.headG * (0.82 + (1.0 - shade) * 0.18));
                            b = Math.floor(42 * (1.0 - shade)); a = 255;
                        }
                        // Alternating grain berries
                        for (let gi = 0; gi < 5; gi++) {
                            let gy = 2 + gi * 2.5;
                            let gxOff = isOat ? (gi % 2 === 0 ? -4.5 : 4.5) : (gi % 2 === 0 ? -3.5 : 3.5);
                            let gdist = Math.sqrt((x - (sx + gxOff)) ** 2 + (y - gy) ** 2);
                            if (gdist < 2.1) {
                                let hl = 1.0 - gdist / 2.1;
                                r = Math.min(255, Math.floor(crop.headR * (0.82 + hl * 0.18) + hl * 22));
                                g = Math.min(255, Math.floor(crop.headG * (0.82 + hl * 0.18) + hl * 12));
                                b = Math.floor(38 + hl * 12); a = 255;
                                // Awns
                                let ad = gi % 2 === 0 ? -1 : 1;
                                for (let al = 1; al <= 4; al++) {
                                    if (x === Math.round(sx + gxOff + ad * al * 0.75) && y === Math.round(gy - al * 0.5)) {
                                        r = Math.min(255, crop.headR + 20); g = Math.min(255, crop.headG + 10); b = 42; a = 255;
                                    }
                                }
                            }
                        }
                    }
                }

            // ================================================================
            // TOMATO — layered bottom-to-top:
            // y=53-63: 2 round cotyledon leaves on tiny stem (seedling)
            // y=28-52: oval serrated leaves on climbing vine (young)
            // y=0-27:  3 hanging red tomatoes on thin vines (mature)
            // ================================================================
            } else if (crop.id === BLOCKS.TOMATO) {
                // Vine stem — snakes through middle
                {
                    let stemX = 32 + Math.sin((y / 63.0) * Math.PI * 1.8) * 1.5;
                    let sd = Math.abs(x - stemX);
                    let sw = 1.6 + (y / 63) * 0.6;
                    if (sd < sw && y >= 24 && y <= 62) {
                        let lum = 0.78 + (1.0 - sd / sw) * 0.22;
                        r = Math.floor(35 * lum); g = Math.floor(115 * lum); b = 20; a = 255;
                    }
                }

                // SEEDLING (y=53-63): 2 small oval cotyledon leaves
                {
                    const cotyls = [{ cx: 25, cy: 58 }, { cx: 39, cy: 58 }];
                    for (const ct of cotyls) {
                        let dx = x - ct.cx, dy = y - ct.cy;
                        if ((dx / 6.5) ** 2 + (dy / 4.0) ** 2 < 1.0) {
                            let hl = 1.0 - (dx / 6.5) ** 2 - (dy / 4.0) ** 2;
                            r = Math.floor(44 + hl * 18); g = Math.floor(142 + hl * 30); b = 28; a = 255;
                            if (Math.abs(dx) < 0.85) { g = Math.min(255, g + 14); }
                        }
                    }
                }

                // YOUNG (y=28-52): 3 pairs of oval tomato leaves
                {
                    const tLeaves = [
                        { oy: 50, ox: 20, rw: 9.5, rh: 4.2 }, { oy: 50, ox: 44, rw: 9.5, rh: 4.2 },
                        { oy: 40, ox: 18, rw:11.5, rh: 5.2 }, { oy: 40, ox: 46, rw:11.5, rh: 5.2 },
                        { oy: 31, ox: 21, rw: 9.0, rh: 4.0 }, { oy: 31, ox: 43, rw: 9.0, rh: 4.0 },
                    ];
                    for (const lf of tLeaves) {
                        let dx = x - lf.ox, dy = y - lf.oy;
                        let ov = (dx / lf.rw) ** 2 + (dy / lf.rh) ** 2;
                        if (ov < 1.0) {
                            let hl = 1.0 - ov;
                            r = Math.floor(30 + hl * 22); g = Math.floor(108 + hl * 36); b = Math.floor(14 + hl * 10); a = 255;
                            // Serration at edges
                            let ang = Math.atan2(dy, dx);
                            if (ov > 0.65 + Math.sin(ang * 6) * 0.12) { r = Math.floor(r * 0.7); g = Math.floor(g * 0.7); }
                            // Midrib
                            if (Math.abs(dy) < 0.6) { g = Math.min(255, g + 18); }
                        }
                    }
                }

                // MATURE (y=0-27): 3 hanging red tomatoes with speculars
                {
                    const fruits = [
                        { fx: 20, fy: 10, fr: 8 },
                        { fx: 35, fy:  5, fr: 9 },
                        { fx: 50, fy: 13, fr: 7 },
                    ];
                    for (const fr of fruits) {
                        // Vine from stem to fruit top
                        if (Math.abs(x - fr.fx) < 1.1 && y > fr.fy - fr.fr - 3 && y < fr.fy && a === 0) {
                            r = 32; g = 105; b = 18; a = 255;
                        }
                        let dist = Math.sqrt((x - fr.fx) ** 2 + (y - fr.fy) ** 2);
                        if (dist < fr.fr) {
                            let hl = 1.0 - dist / fr.fr;
                            let sx = fr.fx - fr.fr * 0.32, sy = fr.fy - fr.fr * 0.32;
                            let spec = Math.max(0, 1.0 - Math.sqrt((x - sx) ** 2 + (y - sy) ** 2) / (fr.fr * 0.42));
                            r = Math.min(255, Math.floor(212 * (0.62 + hl * 0.38) + spec * 52));
                            g = Math.floor(33 * hl + spec * 24);
                            b = Math.floor(18 * hl + spec * 10); a = 255;
                        }
                        // Calyx star
                        for (let ci = 0; ci < 5; ci++) {
                            let ca = (ci / 5) * Math.PI * 2 - Math.PI / 2;
                            let ccx = fr.fx + Math.cos(ca) * (fr.fr - 1.2);
                            let ccy = fr.fy - Math.abs(Math.sin(ca)) * (fr.fr * 0.28 + 0.8);
                            if (Math.sqrt((x - ccx) ** 2 + (y - ccy) ** 2) < 2.0) { r = 28; g = 108; b = 20; a = 255; }
                        }
                    }
                }

            // ================================================================
            // CARROT — feathery green tops + tapered orange taproot
            // ================================================================
            } else if (crop.id === BLOCKS.CARROT) {
                // Stem
                {
                    let stemCX = 32 + Math.sin((y / 64) * Math.PI * 1.5) * 1.5;
                    let sd = Math.abs(x - stemCX);
                    let sw = 1.8 + (y / 64) * 0.8;
                    if (y > 18 && y < 63 && sd < sw) {
                        let lum = (0.68 + (1.0 - sd / sw) * 0.32) * (1.0 - (y - 18) / 45 * 0.32);
                        r = Math.floor(crop.stemR * 0.48 * lum); g = Math.floor(crop.stemG * lum); b = Math.floor(crop.stemB * lum); a = 255;
                    }
                }
                // Feathery fronds (top area)
                for (let fi = 0; fi < 4; fi++) {
                    let baseX = 26 + fi * 4, topX = baseX + (fi % 2 === 0 ? -2 : 2);
                    let t = (y - 4) / 14.0;
                    if (t < 0 || t > 1) continue;
                    let midX = topX + (baseX - topX) * t;
                    let hw = 0.8 + t * 1.2;
                    if (Math.abs(x - midX) < hw) {
                        let shade = Math.abs(x - midX) / hw;
                        r = Math.floor(28 + shade * 12); g = Math.floor(128 + (1.0 - shade) * 42); b = 18; a = 255;
                    }
                }
                // Orange taproot at bottom
                {
                    let ch = y - 46, rw = Math.max(0, (18 - ch) * 0.43);
                    if (ch >= 0 && ch < 18 && Math.abs(x - 32) < rw) {
                        let shade = Math.abs(x - 32) / rw, hl = 1.0 - ch / 18;
                        r = Math.min(255, Math.floor(crop.headR * (0.74 + (1.0 - shade) * 0.26)));
                        g = Math.floor(crop.headG * (0.60 + hl * 0.26));
                        b = Math.floor(crop.headB); a = 255;
                        if (Math.abs(x - 32) < 1.4) { r = Math.min(255, r + 20); g = Math.min(255, g + 12); }
                    }
                }

            // ================================================================
            // POTATO — leafy bush + purple flower bud + lumpy tubers
            // ================================================================
            } else if (crop.id === BLOCKS.POTATO) {
                // Stem
                {
                    let stemCX = 32 + Math.sin((y / 64) * Math.PI * 1.5) * 1.5;
                    let sd = Math.abs(x - stemCX);
                    let sw = 1.8 + (y / 64) * 0.8;
                    if (y > 18 && y < 63 && sd < sw) {
                        let lum = (0.7 + (1.0 - sd / sw) * 0.3) * (1.0 - (y - 18) / 45 * 0.3);
                        r = Math.floor(crop.stemR * 0.52 * lum); g = Math.floor(crop.stemG * lum); b = Math.floor(crop.stemB * lum); a = 255;
                    }
                }
                // Leaves
                const potLeaves = [
                    { py: 48, dir: -1, len: 12, angle: 0.8 }, { py: 48, dir: 1, len: 10, angle: 0.8 },
                    { py: 36, dir: -1, len: 11, angle: 0.7 }, { py: 36, dir: 1, len: 10, angle: 0.7 },
                    { py: 26, dir: -1, len:  9, angle: 0.6 }, { py: 26, dir: 1, len:  8, angle: 0.6 },
                ];
                for (const lp of potLeaves) {
                    let lx = (x - 32) * lp.dir, ly = y - lp.py;
                    let ax = lx * Math.cos(lp.angle) - ly * Math.sin(lp.angle);
                    let nx = lx * Math.sin(lp.angle) + ly * Math.cos(lp.angle);
                    let lw = ax * 0.38;
                    if (ax > 0 && ax < lp.len && Math.abs(nx) < lw) {
                        let t = ax / lp.len;
                        let ef = 1.0 - Math.abs(nx) / Math.max(0.01, lw);
                        let lum = (0.6 + ef * 0.4) * (0.54 + (1.0 - t) * 0.46);
                        r = Math.floor(crop.stemR * 0.44 * lum); g = Math.floor(crop.stemG * lum); b = Math.floor(crop.stemB * 0.68 * lum); a = 255;
                    }
                }
                // Purple flower bud at top
                {
                    let fdist = Math.sqrt((x - 32) ** 2 + (y - 8) ** 2);
                    if (fdist < 5) { r = 148; g = 78; b = 178; a = 255; if (fdist < 2) { r = 198; g = 128; b = 228; } }
                }
                // Lumpy potato tubers at bottom
                const lumps = [{ lx: 27, ly: 55, lr: 7 }, { lx: 37, ly: 57, lr: 6 }, { lx: 32, ly: 51, lr: 5 }];
                for (const lp of lumps) {
                    let dist = Math.sqrt((x - lp.lx) ** 2 + (y - lp.ly) ** 2);
                    if (dist < lp.lr) {
                        let hl = 1.0 - dist / lp.lr;
                        let spec = Math.max(0, 1.0 - Math.sqrt((x - lp.lx + 2) ** 2 + (y - lp.ly - 2) ** 2) / (lp.lr * 0.38));
                        r = Math.min(255, Math.floor(crop.headR * (0.60 + hl * 0.40) + spec * 28));
                        g = Math.min(255, Math.floor(crop.headG * (0.60 + hl * 0.36) + spec * 18));
                        b = Math.floor(crop.headB * (0.70 + hl * 0.30)); a = 255;
                    }
                }
            }

            let idx2 = i * 4;
            data[idx2]   = Math.max(0, Math.min(255, r + (a > 0 ? noise : 0)));
            data[idx2+1] = Math.max(0, Math.min(255, g + (a > 0 ? noise : 0)));
            data[idx2+2] = Math.max(0, Math.min(255, b + (a > 0 ? Math.floor(noise * 0.4) : 0)));
            data[idx2+3] = a;
        }
        ctx.putImageData(imgData, 0, 0);
        icons[crop.id] = canvas.toDataURL();
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        materials[crop.id] = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    }

    // ---- SEEDS (small bag icons, not rendered as world blocks) ----
    const SEED_DEFS = [
        { id: BLOCKS.WHEAT_SEED,   r: 220, g: 200, b: 60  },
        { id: BLOCKS.OATS_SEED,    r: 200, g: 210, b: 90  },
        { id: BLOCKS.TOMATO_SEED,  r: 200, g: 60,  b: 40  },
    ];
    // Carrot and Potato use their own block icons as seeds

    for (const sd of SEED_DEFS) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;
        for (let i = 0; i < size * size; i++) {
            let x = i % size, y = Math.floor(i / size);
            let cx2 = 32, cy2 = 36;
            let oval = Math.pow((x - cx2) / 14, 2) + Math.pow((y - cy2) / 18, 2);
            let r = 0, g = 0, b = 0, a = 0;
            if (oval < 1.0) {
                let shade = oval * 30;
                r = sd.r - shade + (Math.random() - 0.5) * 10;
                g = sd.g - shade + (Math.random() - 0.5) * 10;
                b = sd.b - shade + (Math.random() - 0.5) * 10;
                a = 255;
            }
            // Small sprout
            if (x >= 30 && x <= 34 && y >= 10 && y <= 22) { r = 60; g = 150; b = 40; a = 255; }
            let idx3 = i * 4;
            data[idx3] = Math.max(0, Math.min(255, r));
            data[idx3+1] = Math.max(0, Math.min(255, g));
            data[idx3+2] = Math.max(0, Math.min(255, b));
            data[idx3+3] = a;
        }
        ctx.putImageData(imgData, 0, 0);
        icons[sd.id] = canvas.toDataURL();
        // Seeds are inventory-only items — no world material needed
        materials[sd.id] = null;
    }

    // ---- HOE ICON (tool — inventory only) ----
    (() => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;
        for (let i = 0; i < size * size; i++) {
            let x = i % size, y = Math.floor(i / size);
            let r = 0, g = 0, b = 0, a = 0;
            // Handle (wooden stick) — diagonal line bottom-left to middle
            let dx = x - 14, dy = y - 50;
            let along = dx * 0.707 + dy * (-0.707);
            let perp = Math.abs(-dx * 0.707 + dy * (-0.707));
            if (along >= 0 && along < 36 && perp < 3) {
                r = 160; g = 110; b = 60; a = 255;
            }
            // Blade (iron T-shape at top-right)
            if (x >= 30 && x <= 52 && y >= 12 && y <= 18) { r = 180; g = 185; b = 190; a = 255; } // horizontal
            if (x >= 44 && x <= 50 && y >= 12 && y <= 32) { r = 170; g = 175; b = 182; a = 255; } // tine
            let idx4 = i * 4;
            data[idx4] = r; data[idx4+1] = g; data[idx4+2] = b; data[idx4+3] = a;
        }
        ctx.putImageData(imgData, 0, 0);
        icons[BLOCKS.HOE] = canvas.toDataURL();
        materials[BLOCKS.HOE] = null; // Tool, not a placeable block
    })();

}
