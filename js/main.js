import { CONST, BLOCKS, BLOCK_DEF } from './constants.js';
import { setSeed, initHashOffset, random } from './math.js';
import { generateTextures, getTexture } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Inventory, Interaction } from './interaction.js';
import { resumeAudio, updateAmbient } from './audio.js';
import { Enemy } from './enemies.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no alpha bg
let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false; // Need to set it again after resize
});

ctx.imageSmoothingEnabled = false;

// Game State
let world;
let player;
let inventory;
let interaction;
let enemies = [];
let particles = [];
let camera = { x: 0, y: 0 };
let lastTime = 0;
let frames = 0;
let fpsTimer = 0;

// Day/Night Cycle (0 to 1, 0 = noon, 0.5 = midnight)
// 4 minutes total = 240,000 ms. 1/240000 = ~0.000004
let timeOfDay = 0;
const DAY_SPEED = 0.5 / 900000; // 15 mins for half cycle
const NIGHT_SPEED = 0.5 / 600000; // 10 mins for half cycle

function initLightMap() {
    // Very simple localized lighting could be done here,
    // but for <100kb we might just do distance-to-surface or a crude shadow mask in renderer
}

function start() {
    resumeAudio();
    document.getElementById('start-screen').style.display = 'none';
    
    // Procedural Seed Initializer
    const seed = Math.floor(Math.random() * 1000000);
    setSeed(seed);
    initHashOffset(seed);
    console.log("World Seed: ", seed);
    
    generateTextures();
    
    world = new World();
    
    // Spawn player at chunk 0, find surface
    world.ensureChunkLoaded(0);
    let spawnX = CONST.CHUNK_W / 2;
    let spawnY = 0;
    for(let y=0; y<CONST.CHUNK_H; y++) {
        if(world.getBlock(spawnX, y) !== BLOCKS.AIR) {
            spawnY = y - 2; // Spawn slightly above surface
            break;
        }
    }
    
    player = new Player(spawnX * CONST.TILE_SIZE, spawnY * CONST.TILE_SIZE);
    inventory = new Inventory();
    interaction = new Interaction(canvas, camera, player, world, inventory);
    interaction.updateInventoryUI();
    
    // Spawn some initial enemies nearby
    enemies = [];
    for(let i=0; i<3; i++) {
        let ex = spawnX + (Math.random() - 0.5) * 40;
        if(ex < 0) ex = 0;
        let ey = 0;
        for(let ty=0; ty<CONST.CHUNK_H; ty++) {
            if(world.getBlock(Math.floor(ex), ty) !== BLOCKS.AIR) {
                ey = ty - 2;
                break;
            }
        }
        enemies.push(new Enemy(ex * CONST.TILE_SIZE, ey * CONST.TILE_SIZE));
    }
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

document.getElementById('btn-start').addEventListener('click', start);

function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    
    // Limit max dt to avoid tunneling on lag spikes
    if (dt > 50) dt = 50; 

    // Update
    player.update(dt, world);
    interaction.update(dt);
    
    enemies.forEach(e => e.update(dt, world, player.x, player.y));
    
    // Check damage to player (crude)
    enemies.forEach(e => {
        let dx = (player.x + player.width/2) - (e.x + e.width/2);
        let dy = (player.y + player.height/2) - (e.y + e.height/2);
        if(dx*dx + dy*dy < 200) {
            // Player hit
            let healthSpan = document.getElementById('health-val');
            healthSpan.innerText = Math.max(0, parseInt(healthSpan.innerText) - 1);
            // Basic knockback
            player.vx = dx > 0 ? 0.3 * dt : -0.3 * dt;
            player.vy = -0.2 * dt;
        }
    });
    
    // Update camera to follow player smoothly
    let targetCamX = player.x + player.width/2 - width/2;
    let targetCamY = player.y + player.height/2 - height/2;
    camera.x += (targetCamX - camera.x) * 0.1;
    camera.y += (targetCamY - camera.y) * 0.1;
    
    // Clamp camera Y so we don't see out of bounds vertically
    camera.y = Math.max(0, Math.min(camera.y, (CONST.CHUNK_H * CONST.TILE_SIZE) - height));

    // Update Day/Night Cycle
    let currentIsNight = (timeOfDay > 0.25 && timeOfDay < 0.75);
    timeOfDay += dt * (currentIsNight ? NIGHT_SPEED : DAY_SPEED);
    if (timeOfDay >= 1) timeOfDay = 0;
    
    let isNight = (timeOfDay > 0.25 && timeOfDay < 0.75);
    updateAmbient(isNight, dt);
    
    // Update Particles (Fireflies)
    if (isNight && Math.random() < 0.05 && particles.length < 50) {
        // Spawn firefly near player
        let px = player.x + (Math.random() - 0.5) * width;
        let py = player.y + (Math.random() - 0.5) * height;
        if(py < player.y + 200 && world.getBlock(Math.floor(px/CONST.TILE_SIZE), Math.floor(py/CONST.TILE_SIZE)) === BLOCKS.AIR) {
            particles.push({x: px, y: py, life: 1.0, vx: (Math.random()-0.5)*0.02, vy: -0.01 - Math.random()*0.02});
        }
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.0005;
        p.vx += (Math.random() - 0.5) * 0.01; // erratically fly
        if (p.life <= 0) particles.splice(i, 1);
    }

    render();
    
    // FPS Calc
    frames++;
    fpsTimer += dt;
    if(fpsTimer >= 1000) {
        document.getElementById('fps-val').innerText = frames;
        frames = 0;
        fpsTimer -= 1000;
    }
    
    // Periodic Spawning (approx every 20 seconds off-screen)
    if(frames % 1200 === 0 && enemies.length < 5) {
        let isNight = (timeOfDay > 0.25 && timeOfDay < 0.75);
        let ezType = isNight && Math.random() > 0.3 ? "zombie" : "slime";
        
        let ex = player.x + (Math.random() > 0.5 ? 1 : -1) * (width/2 + 200);
        let ey = 0;
        for(let ty=0; ty<CONST.CHUNK_H; ty++) {
            if(world.getBlock(Math.floor(ex/CONST.TILE_SIZE), ty) !== BLOCKS.AIR) {
                ey = ty - 2;
                break;
            }
        }
        if(ey > 0) enemies.push(new Enemy(ex, ey * CONST.TILE_SIZE, ezType));
    }

    requestAnimationFrame(gameLoop);
}

function render() {
    // Background sky color based on depth and time
    let depthPercent = camera.y / (CONST.CHUNK_H * CONST.TILE_SIZE);
    
    // Day/Night sky colors
    // timeOfDay: 0 = noon, 0.5 = midnight
    let nightFactor = -Math.cos(timeOfDay * Math.PI * 2) * 0.5 + 0.5; // 0 at noon, 1 at midnight
    
    let skyR = Math.floor(135 * (1 - nightFactor)); // 135 to 0
    let skyG = Math.floor(206 * (1 - nightFactor)); // 206 to 0
    let skyB = Math.floor(235 * (1 - nightFactor) + 20 * nightFactor); // 235 to 20
    
    if(depthPercent < 0.3) {
        ctx.fillStyle = `rgb(${skyR}, ${skyG}, ${skyB})`;
    } else if (depthPercent < 0.6) {
        ctx.fillStyle = '#222'; // Cave darkness
    } else {
         ctx.fillStyle = '#0a0a0a'; // Deep underground
    }
    ctx.fillRect(0, 0, width, height);
    
    // Parallax Mountains (Distant & Mid)
    if (depthPercent < 0.5) {
        // Distant Mountains
        ctx.fillStyle = nightFactor > 0.5 ? '#1a2b3c' : '#8899aa';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for(let px = 0; px <= width; px += 10) {
            let worldX = px + camera.x * 0.05;
            let py = height*0.6 + Math.sin(worldX * 0.002) * 100 + Math.sin(worldX * 0.01) * 30;
            ctx.lineTo(px, py);
        }
        ctx.lineTo(width, height);
        ctx.fill();
        
        // Mid-layer Hills
        ctx.fillStyle = nightFactor > 0.5 ? '#112211' : '#446644';
        ctx.beginPath();
        ctx.moveTo(0, height);
        for(let px = 0; px <= width; px += 20) {
            let worldX = px + camera.x * 0.2;
            let py = height*0.75 + Math.sin(worldX * 0.005) * 50 + Math.cos(worldX * 0.02) * 20;
            ctx.lineTo(px, py);
        }
        ctx.lineTo(width, height);
        ctx.fill();
    }
    
    // Parallax Clouds
    if (depthPercent < 0.3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - nightFactor)})`;
        let span = Math.max(width * 2, 3000); // Massive wrap space prevents overlaps
        
        for (let i = 0; i < 6; i++) {
            let cloudSpeed = 0.5 + (i * 0.1);
            let startBase = i * (span / 6);
            let cloudX = (startBase + (timeOfDay * 15000 * cloudSpeed) - (camera.x * 0.1 * cloudSpeed)) % span;
            cloudX -= 300; // Let them spawn smoothly off camera
            
            let cloudY = 40 + (i * 25) - (camera.y * 0.1);
            
            // Prettier, fluffier multi-circle cloud shape
            ctx.beginPath();
            ctx.arc(cloudX, cloudY, 30, 0, Math.PI * 2);
            ctx.arc(cloudX + 35, cloudY - 20, 45, 0, Math.PI * 2);
            ctx.arc(cloudX + 75, cloudY - 10, 35, 0, Math.PI * 2);
            ctx.arc(cloudX + 100, cloudY + 10, 25, 0, Math.PI * 2);
            ctx.arc(cloudX + 20, cloudY + 15, 30, 0, Math.PI * 2);
            ctx.arc(cloudX + 60, cloudY + 15, 30, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw stars at night
    if(depthPercent < 0.3 && nightFactor > 0.5) {
        ctx.fillStyle = `rgba(255,255,255,${(nightFactor-0.5)*2})`; // Fade in
        for(let i=0; i<50; i++) {
            // Pseudo-random based on index so they don't jitter
            let sx = (i * 137) % width;
            let sy = (i * 251) % (height * 0.4);
            ctx.fillRect(sx, sy, 2, 2); // Make stars slightly bigger
        }
    }
    
    // Draw Sun and Moon
    if (depthPercent < 0.3) {
        // timeOfDay goes 0 to 1. Noon is 0, midnight is 0.5.
        // Arc path for celestial bodies
        let sunAngle = (timeOfDay + 0.25) * Math.PI * 2;
        let moonAngle = (timeOfDay + 0.75) * Math.PI * 2;
        
        let cx = width / 2;
        let cy = height; // Orbit around bottom center of screen
        let radius = width * 0.4;
        
        // Sun
        let sunX = cx - Math.cos(sunAngle) * radius;
        let sunY = cy - Math.sin(sunAngle) * radius;
        if (sunY < height) {
            ctx.fillStyle = '#FFD700'; // Gold
            ctx.beginPath();
            ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Moon (Draw as crescent)
        let moonX = cx - Math.cos(moonAngle) * radius;
        let moonY = cy - Math.sin(moonAngle) * radius;
        if (moonY < height) {
            ctx.fillStyle = '#DDDDDD';
            ctx.beginPath();
            ctx.arc(moonX, moonY, 25, 0, Math.PI * 2);
            ctx.fill();
            
            // Cut out the crescent
            ctx.fillStyle = `rgb(${skyR}, ${skyG}, ${skyB})`; // Matches sky background
            ctx.beginPath();
            ctx.arc(moonX - 8, moonY - 8, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Visible bounds in tiles
    let startCol = Math.floor(camera.x / CONST.TILE_SIZE);
    let endCol = startCol + Math.floor(width / CONST.TILE_SIZE) + 1;
    let startRow = Math.floor(camera.y / CONST.TILE_SIZE);
    let endRow = startRow + Math.floor(height / CONST.TILE_SIZE) + 1;
    
    // To minimize chunk loading hitches, pre-load +/- Render Distance
    let centerChunk = world.getChunkX(startCol);
    for(let i = -CONST.RENDER_CHUNKS; i <= CONST.RENDER_CHUNKS; i++) {
        world.ensureChunkLoaded(centerChunk + i);
    }
    
    // -- REAL-TIME SMOOTH LIGHTING (Screen Space) --
    let lCols = endCol - startCol + 2;
    let lRows = endRow - startRow + 2;
    let lightMap = new Uint8Array(lCols * lRows);
    
    let toProcess = [];
    
    // Build light map
    let flicker = Math.random() < 0.2 ? Math.floor(Math.random() * 2) : 0;
    
    for (let cx = 0; cx < lCols; cx++) {
        for (let cy = 0; cy < lRows; cy++) {
            let tx = startCol + cx;
            let ty = startRow + cy;
            let id = world.getBlock(tx, ty);
            let idx = cy * lCols + cx;
            
            if (id === BLOCKS.AIR && ty < 60) {
                // Sky exposure 
                let skyLight = Math.floor(15 * (1 - nightFactor));
                if(skyLight < 3) skyLight = 3; 
                if(skyLight > 0) {
                    lightMap[idx] = skyLight;
                    toProcess.push(idx);
                }
            } else if (BLOCK_DEF[id] && BLOCK_DEF[id].light) {
                // Emitting blocks (Torches with flicker)
                lightMap[idx] = Math.max(0, BLOCK_DEF[id].light - flicker);
                toProcess.push(idx);
            }
        }
    }
    
    // Propagate light (Flood Fill)
    let iter = 0;
    while(toProcess.length > 0 && iter < 5000) {
        let idx = toProcess.shift();
        let cy = Math.floor(idx / lCols);
        let cx = idx % lCols;
        let l = lightMap[idx];
        
        // Neighbors
        let neighbors = [
            {nx: cx-1, ny: cy}, {nx: cx+1, ny: cy},
            {nx: cx, ny: cy-1}, {nx: cx, ny: cy+1}
        ];
        
        for(let n of neighbors) {
            if(n.nx >= 0 && n.nx < lCols && n.ny >= 0 && n.ny < lRows) {
                let nidx = n.ny * lCols + n.nx;
                let tx = startCol + n.nx;
                let ty = startRow + n.ny;
                
                let id = world.getBlock(tx, ty);
                let attenuation = (BLOCK_DEF[id] && BLOCK_DEF[id].solid) ? 3 : 1; 
                let nextL = Math.max(0, l - attenuation);
                
                if(nextL > lightMap[nidx]) {
                    lightMap[nidx] = nextL;
                    toProcess.push(nidx);
                }
            }
        }
        iter++;
    }

    // Render Blocks
    const isSolid = (tx, ty) => {
        let nid = world.getBlock(tx, ty);
        return nid !== BLOCKS.AIR && nid !== BLOCKS.WATER; // && BLOCK_DEF[nid]?.solid 
    };

    // Precalculate surface level for each column to know where dirt background starts
    let surfaceLevels = {};
    for (let tx = startCol; tx <= endCol; tx++) {
        for (let ty = 0; ty < CONST.CHUNK_H; ty++) {
            if (world.getBlock(tx, ty) !== BLOCKS.AIR) {
                surfaceLevels[tx] = ty;
                break;
            }
        }
        if (surfaceLevels[tx] === undefined) surfaceLevels[tx] = 0;
    }

    for (let tx = startCol; tx <= endCol; tx++) {
        for (let ty = startRow; ty <= endRow; ty++) {
            let id = world.getBlock(tx, ty);
            let px = Math.floor(tx * CONST.TILE_SIZE - camera.x);
            let py = Math.floor(ty * CONST.TILE_SIZE - camera.y);
            
            // Draw dirt background wall if we are at least 4 blocks below the surface height of this column
            if (id === BLOCKS.AIR && ty > surfaceLevels[tx] + 3) {
                ctx.fillStyle = '#2b1b0b'; // Dirt dark bg
                ctx.fillRect(px, py, CONST.TILE_SIZE, CONST.TILE_SIZE);
            }

            // Water Animation (bobbing top pixels)
            if (id === BLOCKS.WATER) {
                let wave = Math.sin(frames * 0.05 + tx * 0.5) * 2;
                if (world.getBlock(tx, ty - 1) === BLOCKS.AIR) {
                    ctx.fillStyle = BLOCK_DEF[id].baseHex;
                    ctx.fillRect(px, py + 2 + wave, CONST.TILE_SIZE, CONST.TILE_SIZE - 2 - wave);
                } else {
                    ctx.fillStyle = BLOCK_DEF[id].baseHex;
                    ctx.fillRect(px, py, CONST.TILE_SIZE, CONST.TILE_SIZE);
                }
            } else if (id !== BLOCKS.AIR) {
                // Auto-tiling Mask Calculation
                let mask = 0;
                if (isSolid(tx, ty - 1)) mask |= 1; // Top
                if (isSolid(tx + 1, ty)) mask |= 2; // Right
                if (isSolid(tx, ty + 1)) mask |= 4; // Bottom
                if (isSolid(tx - 1, ty)) mask |= 8; // Left

                let tex = getTexture(id, mask);
                if(tex) {
                    ctx.drawImage(tex, px, py);
                } else {
                    ctx.fillStyle = BLOCK_DEF[id].baseHex;
                    ctx.fillRect(px, py, CONST.TILE_SIZE, CONST.TILE_SIZE);
                }
            }
            
            // Apply lighting visually
            let cx = tx - startCol;
            let cy = ty - startRow;
            let lMapVal = lightMap[cy * lCols + cx];
            let darkness = Math.min(1.0, 1.0 - (lMapVal / 15.0));
            
            // Smooth shading trick: if neighbors have lower light, simulate AO gradient
            let drawAO = false;
            if (id !== BLOCKS.AIR && lMapVal > 1) {
                let ln1 = lightMap[(cy-1)*lCols + cx] || 0;
                let ln2 = lightMap[cy*lCols + (cx-1)] || 0;
                if (ln1 < lMapVal - 1 || ln2 < lMapVal - 1) {
                    drawAO = true;
                }
            }

            if (darkness > 0.85) darkness = 0.85;
            
            if(darkness > 0) {
                ctx.fillStyle = `rgba(0,0,0,${darkness})`;
                ctx.fillRect(px, py, CONST.TILE_SIZE, CONST.TILE_SIZE);
            }
            
            if(drawAO && id !== BLOCKS.AIR && darkness < 0.8) {
                 ctx.fillStyle = `rgba(0,0,0,0.3)`;
                 // Simple diagonal AO
                 ctx.beginPath();
                 ctx.moveTo(px, py);
                 ctx.lineTo(px + CONST.TILE_SIZE, py);
                 ctx.lineTo(px, py + CONST.TILE_SIZE);
                 ctx.fill();
            }
        }
    }
    
    // Render Player
    let ppx = Math.floor(player.x - camera.x);
    let ppy = Math.floor(player.y - camera.y);
    let dir = player.dir || 1;
    
    // Legs (animated)
    let bop = Math.abs(Math.sin(player.walkCycle || 0)) * 2; // body bops down slightly while walking
    let offsetL = Math.sin(player.walkCycle || 0) * 4;
    let offsetR = -Math.sin(player.walkCycle || 0) * 4;
    
    // Draw back arm
    ctx.fillStyle = '#3366cc'; // Shirt color
    ctx.fillRect(ppx + 4 + (dir * 2), ppy + 9 + bop + offsetR, 3, 6); 
    
    ctx.fillStyle = '#333333'; // Pants
    ctx.fillRect(ppx + 3, ppy + 18 + offsetL, 3, 6); // Back Leg
    
    ctx.fillStyle = '#333333'; // Pants
    ctx.fillRect(ppx + 6, ppy + 18 + offsetR, 3, 6); // Front Leg
    
    // Body
    ctx.fillStyle = '#3366cc'; // Shirt
    ctx.fillRect(ppx + 1, ppy + 8 + bop, 10, 10); 
    
    // Front arm
    ctx.fillStyle = '#ffcc99'; // Hand
    ctx.fillRect(ppx + 4 - (dir * 2), ppy + 13 + bop + offsetL, 2, 2); 
    
    // Head -> Offset slightly by direction
    ctx.fillStyle = '#ffcc99'; // Skin
    ctx.fillRect(ppx + 2 + (dir === 1 ? 1 : 0), ppy + bop, 8, 8); 
    
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(ppx + 4 + (dir === 1 ? 4 : 0), ppy + 2 + bop, 2, 2);
    
    // Render Enemies
    enemies.forEach(e => e.render(ctx, camera.x, camera.y));
    
    // Render Particles (Fireflies)
    particles.forEach(p => {
        let px = Math.floor(p.x - camera.x);
        let py = Math.floor(p.y - camera.y);
        ctx.fillStyle = `rgba(255, 255, 100, ${p.life})`;
        ctx.fillRect(px, py, 2, 2);
    });
    
    // Draw highlight on tile currently aimed at
    let aimTx = Math.floor((interaction.mouseX + camera.x) / CONST.TILE_SIZE);
    let aimTy = Math.floor((interaction.mouseY + camera.y) / CONST.TILE_SIZE);
    let hpx = Math.floor(aimTx * CONST.TILE_SIZE - camera.x);
    let hpy = Math.floor(aimTy * CONST.TILE_SIZE - camera.y);
    
    // Distance check for UI highlight
    let distSq = ((aimTx * CONST.TILE_SIZE) - player.x) ** 2 + ((aimTy * CONST.TILE_SIZE) - player.y) ** 2;
    if(distSq < (5 * CONST.TILE_SIZE) ** 2) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpx, hpy, CONST.TILE_SIZE, CONST.TILE_SIZE);
        
        // Draw mining progress bar
        if (interaction.miningProgress > 0 && interaction.miningX === aimTx && interaction.miningY === aimTy) {
            let blockId = world.getBlock(aimTx, aimTy);
            if(blockId !== BLOCKS.AIR && BLOCK_DEF[blockId]) {
                let hardness = BLOCK_DEF[blockId].hardness || 100;
                let pct = Math.min(1, interaction.miningProgress / hardness);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(hpx + 2, hpy + CONST.TILE_SIZE - 4, CONST.TILE_SIZE - 4, 3);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(hpx + 2, hpy + CONST.TILE_SIZE - 4, (CONST.TILE_SIZE - 4) * pct, 3);
            }
        }
    }
}
