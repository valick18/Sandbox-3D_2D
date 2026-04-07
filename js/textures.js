import { BLOCKS, BLOCK_DEF, CONST } from './constants.js';
import { random, noise2D } from './math.js';

const textures = {}; // { blockId: [canvas0 ... canvas15] }

// Convert hex to rgb
function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return [r, g, b];
}

export function generateTextures() {
    const size = CONST.TILE_SIZE;
    
    for (let key in BLOCKS) {
        const id = BLOCKS[key];
        if (id === BLOCKS.AIR) continue;
        
        textures[id] = [];
        const baseColor = hexToRgb(BLOCK_DEF[id].baseHex);
        
        // Generate 16 permutations for Auto-tiling (Bitmask: 1=Top, 2=Right, 4=Bottom, 8=Left)
        // 0 means no neighbors (singleton), 15 means surrounded
        for (let mask = 0; mask < 16; mask++) {
            const hasTop = (mask & 1) !== 0;
            const hasRight = (mask & 2) !== 0;
            const hasBottom = (mask & 4) !== 0;
            const hasLeft = (mask & 8) !== 0;

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(size, size);
            const data = imgData.data;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    let i = (y * size + x) * 4;
                    
                    let vary = (random() - 0.5) * 40; 
                    let r = baseColor[0] + vary;
                    let g = baseColor[1] + vary;
                    let b = baseColor[2] + vary;
                    let a = 255;

                    // Smooth corners and edge darkening for 2D terrain look
                    let isEdge = false;
                    let darken = 0;

                    if (!hasTop && y < 2) { r += 20; g += 20; b += 20; isEdge = true; } // Highlight top edge
                    if (!hasBottom && y > size - 3) { darken = 40; isEdge = true; }
                    if (!hasLeft && x < 2) { darken = 30; isEdge = true; }
                    if (!hasRight && x > size - 3) { darken = 30; isEdge = true; }

                    // Round corners if singleton or sticking out
                    if (!hasTop && !hasLeft && x === 0 && y === 0) a = 0;
                    if (!hasTop && !hasRight && x === size-1 && y === 0) a = 0;
                    if (!hasBottom && !hasLeft && x === 0 && y === size-1) a = 0;
                    if (!hasBottom && !hasRight && x === size-1 && y === size-1) a = 0;

                    // Apply specific pattern logic
                    if (id === BLOCKS.GRASS) {
                        if (y < 5 && !hasTop) {
                            r = 30 + vary; g = 180 + vary; b = 30 + vary; // Top grass
                        } else {
                            let dirt = hexToRgb(BLOCK_DEF[BLOCKS.DIRT].baseHex);
                            r = dirt[0] + vary; g = dirt[1] + vary; b = dirt[2] + vary;
                        }
                    } else if (id === BLOCKS.WOOD) {
                        let strip = Math.sin((x + y*0.2) * 1.5) * 15;
                        r += strip; g += strip; b += strip;
                    } else if (id === BLOCKS.LEAVES) {
                        if (noise2D(x, y, 0.4, 1) > 0.6) a = 0; // gaps in leaves
                    } else if (id === BLOCKS.WATER) {
                        a = 180; 
                        let wave = Math.sin(x*0.5 + y*0.5)*10;
                        r += wave; g += wave; b += wave;
                    } else if (id === BLOCKS.TORCH) {
                        if (x > 6 && x < 10 && y > 4) { r=139; g=69; b=19; } // Stick
                        else if (x > 5 && x < 11 && y >= 2 && y <= 4) { r=255; g=165+vary; b=0; } // Fire
                        else { a = 0; }
                    } else if (id === BLOCKS.WORKBENCH) {
                        if (y < 4 || x < 2 || x > size - 3) { r -= 20; g -= 20; b -= 20; }
                        else { a = 0; }
                    }

                    // Apply darkening
                    r -= darken; g -= darken; b -= darken;

                    data[i] = Math.max(0, Math.min(255, r));
                    data[i+1] = Math.max(0, Math.min(255, g));
                    data[i+2] = Math.max(0, Math.min(255, b));
                    data[i+3] = a;

                    // Ores specks
                    if (a > 0 && id === BLOCKS.COAL && random() < 0.1) { data[i]=0; data[i+1]=0; data[i+2]=0; }
                    if (a > 0 && id === BLOCKS.GOLD && random() < 0.08) { data[i]=255; data[i+1]=215; data[i+2]=0; }
                    if (a > 0 && id === BLOCKS.IRON && random() < 0.08) { data[i]=255; data[i+1]=200; data[i+2]=180; }
                }
            }
            ctx.putImageData(imgData, 0, 0);
            textures[id].push(canvas);
        }
    }
}

export function getTexture(id, mask = 15) {
    if (!textures[id] || !textures[id][mask]) return null;
    return textures[id][mask];
}
