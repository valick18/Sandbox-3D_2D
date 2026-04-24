import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { BLOCKS, materials, generateMaterials, icons } from './textures.js';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, getWorldSurfaceY, getVillageSeed, VILLAGE_GRID, getVillagePartAtWorld, getHouseCentersInChunk } from './chunk.js';
import { Mob, mobsList } from './mobs.js';
import { setSeed, fbm2D } from './math.js';
import { dialogueService } from './services/dialogue.js';

let camera, scene, renderer, controls;
window.chunks = {};
window.mobsList = mobsList;
window.getSurfaceY = getWorldSurfaceY;
let chunks = window.chunks;

const VIEW_DISTANCE = 8;
let chunkQueue = [];
let lastPlayerChunkX = null;
let lastPlayerChunkZ = null;

let clouds = [];

let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false;
let isSprinting = false;
let flyMode = false;
let lastSpaceTime = 0;
const keys = {};
let prevTime = performance.now();
let raycaster, center;
let craftingMode = 'none'; // 'none', 'basic', 'workbench', 'chest'
let isChatOpen = false;

// ----------------- INVENTORY & CRAFTING -----------------
const BLOCK_NAMES = {
    1:'Grass', 2:'Dirt', 3:'Stone', 4:'Wood', 5:'Leaves', 6:'Sand', 7:'Planks', 8:'Meat',
    9:'Workbench', 10:'Chest', 11:'Water', 12:'Cactus', 13:'Red Flower', 14:'Yellow Flower',
    15:'Tall Grass', 16:'Brick', 17:'Stone Brick', 18:'Clay', 19:'Glass', 20:'Furnace',
    22:'Tilled Soil',
    23:'Wheat', 24:'Oats', 25:'Tomato', 26:'Carrot', 27:'Potato',
    28:'Wheat Seeds', 29:'Oat Seeds', 30:'Tomato Seeds',
    31:'Apple Leaves', 32:'Birch Wood', 33:'Birch Leaves', 34:'Pine Wood', 35:'Pine Leaves',
    36:'Jungle Wood', 37:'Jungle Leaves', 38:'Palm Wood', 39:'Palm Leaves',
    50:'Hoe'
};

class Inventory {
    constructor() {
        this.slots = Array(36).fill(null); // 9 hotbar + 27 backpack
        this.activeSlot = 0;
        // Starter items
        this.slots[0] = { id: BLOCKS.WOOD, count: 10 };
    }
    
    addItem(id, amount = 1) {
        if(id === BLOCKS.AIR) return; // ignore air
        
        let existing = this.slots.find(s => s && s.id === id);
        if (existing) {
            existing.count += amount;
            return;
        }
        let emptyIdx = this.slots.findIndex(s => s === null);
        if (emptyIdx !== -1) {
            this.slots[emptyIdx] = { id: id, count: amount };
        }
    }

    canAcceptItem(id) {
        // Returns true if there is a stackable slot or an empty slot
        let existing = this.slots.find(s => s && s.id === id && s.count < 64);
        if (existing) return true;
        let emptyIdx = this.slots.findIndex(s => s === null);
        return emptyIdx !== -1;
    }

    useActiveItem() {
        let slot = this.slots[this.activeSlot];
        if (slot) {
            let id = slot.id;
            slot.count--;
            if (slot.count <= 0) this.slots[this.activeSlot] = null;
            return id;
        }
        return BLOCKS.AIR;
    }
    
    countItem(id) {
        let slot = this.slots.find(s => s && s.id === id);
        return slot ? slot.count : 0;
    }
    
    removeItem(id, amount) {
        let slot = this.slots.find(s => s && s.id === id);
        if(slot && slot.count >= amount) {
            slot.count -= amount;
            if(slot.count === 0) {
                let idx = this.slots.indexOf(slot);
                this.slots[idx] = null;
            }
            return true;
        }
        return false;
    }
}
const inventory = new Inventory();

function updateInventoryUI() {
    const hotbar = document.getElementById('hotbar');
    hotbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        let div = document.createElement('div');
        div.className = 'hotbar-slot' + (i === inventory.activeSlot ? ' active' : '');
        let slot = inventory.slots[i];
        if (slot) {
            let n = BLOCK_NAMES[slot.id] || '?';
            div.title = n;
            let iconSrc = icons[slot.id];
            div.innerHTML = `<img src="${iconSrc}" class="block-icon"><span class="hotbar-count">${slot.count}</span>`;
        }
        div.onclick = () => { inventory.activeSlot = i; updateInventoryUI(); };
        hotbar.appendChild(div);
    }
    localStorage.setItem('sandbox3d_inventory', JSON.stringify(inventory.slots));
}

function updateFullInventoryUI() {
    const hotbarDiv = document.getElementById('full-inventory-hotbar');
    const backpackDiv = document.getElementById('full-inventory-backpack');
    const trashSlot = document.getElementById('inventory-trash-slot');
    if (!hotbarDiv || !backpackDiv) return;

    const makeSlot = (i) => {
        let div = document.createElement('div');
        div.className = 'chest-slot';
        let slot = inventory.slots[i];
        if (slot) {
            let img = document.createElement('img');
            img.src = icons[slot.id];
            img.className = 'block-icon';
            div.appendChild(img);
            if (slot.count > 1) {
                let cnt = document.createElement('span');
                cnt.className = 'hotbar-count';
                cnt.textContent = slot.count;
                div.appendChild(cnt);
            }
            div.title = BLOCK_NAMES[slot.id] || '?';
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'fullinv', index: i }));
            };
        }
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            let raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            let data = JSON.parse(raw);
            if (data.source === 'fullinv') {
                dragDropItem(inventory.slots, data.index, inventory.slots, i);
                updateInventoryUI();
                updateFullInventoryUI();
            }
        };
        return div;
    };

    hotbarDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) hotbarDiv.appendChild(makeSlot(i));
    backpackDiv.innerHTML = '';
    for (let i = 9; i < 36; i++) backpackDiv.appendChild(makeSlot(i));

    // Trash slot setup
    trashSlot.innerHTML = '🗑';
    trashSlot.ondragover = (e) => e.preventDefault();
    trashSlot.ondrop = (e) => {
        e.preventDefault();
        let raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;
        let data = JSON.parse(raw);
        if (data.source === 'fullinv' && inventory.slots[data.index]) {
            inventory.slots[data.index] = null;
            updateInventoryUI();
            updateFullInventoryUI();
            playSound(130, 0.08);
        }
    };
}

// --- WEATHER & SEASONS ---
const SEASONS = { SPRING: 0, SUMMER: 1, AUTUMN: 2, WINTER: 3 };
let totalGameDays = 0;
let currentSeason = SEASONS.SUMMER;
let seasonLerp = 0; // 0..1 progress within season

let isRaining = false;
let isStorming = false;
try {
    let wData = localStorage.getItem('sandbox3d_weather');
    if (wData) {
        let wx = JSON.parse(wData);
        isRaining = wx.isRaining || false;
        isStorming = wx.isStorming || false;
    }
} catch(e) {}
let rainIntensity = isRaining ? 1 : 0; // 0..1
let rainParticles = null;
let rainAudioGain = null;
let rainFilter = null;
let blizzardAudioGain = null; // for winter wind

let lastWeatherChange = performance.now();
let lightningLevel = 0;
let nextLightningTime = 0;
let thunderTimeout = null;

function initBlizzardAudio() {
    if (blizzardAudioGain || !audioCtx) return;
    try {
        const bufSize = 4 * audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (let i = 0; i < bufSize; i++) {
            let white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            data[i] *= 0.11;
            b6 = white * 0.115926;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        blizzardAudioGain = audioCtx.createGain();
        blizzardAudioGain.gain.value = 0;
        noise.connect(filter);
        filter.connect(blizzardAudioGain);
        blizzardAudioGain.connect(audioCtx.destination);
        noise.start();
    } catch (e) {}
}

function playThunder(dist = 1) {
    if (!audioCtx) return;
    try {
        const dur = 2 + Math.random() * 3;
        const bufSize = audioCtx.sampleRate * dur;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < bufSize; i++) {
            let white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }

        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 100 + Math.random() * 200;

        const gain = audioCtx.createGain();
        let vol = (0.3 + Math.random() * 0.4) / dist;
        
        // Dynamic check at time of sound
        let wx = Math.floor(camera.position.x), wz = Math.floor(camera.position.z);
        let surfaceY = getSurfaceY(wx, wz);
        let currentDepth = (surfaceY - 1) - camera.position.y;
        
        if (currentDepth > 0) {
            vol *= 0.2; // muffled
            if (currentDepth > 8) vol = 0; // silent
        } else {
            // Roof check
            for (let y = Math.floor(camera.position.y) + 1; y < Math.floor(camera.position.y) + 15; y++) {
                let b = getBlockGlobal(wx, y, wz);
                if (b !== BLOCKS.AIR && b !== BLOCKS.WATER && b !== BLOCKS.LEAVES) { vol *= 0.5; break; }
            }
        }

        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(vol, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start();
    } catch (e) {}
}

function initRainAudio() {
    if (rainAudioGain || !audioCtx) return;
    try {
        const bufSize = 2 * audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;

        rainFilter = audioCtx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.value = 1200;

        rainAudioGain = audioCtx.createGain();
        rainAudioGain.gain.value = 0;

        noise.connect(rainFilter);
        rainFilter.connect(rainAudioGain);
        rainAudioGain.connect(audioCtx.destination);
        noise.start();
    } catch (e) {
        console.error("Rain audio error", e);
    }
}

function initRain(scene) {
    const count = 6000; // Optimized for CPU occlusion checks
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = Math.random() * 60;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0x88ccff,
        size: 0.15,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });
    rainParticles = new THREE.Points(geometry, material);
    rainParticles.userData = { ignoreRaycast: true };
    scene.add(rainParticles);
}

function updateRain(delta, cameraPos, isSheltered) {
    if (!rainParticles) return;
    
    const fadeSpeed = 0.15;
    if (isRaining && rainIntensity < 1) rainIntensity = Math.min(1, rainIntensity + delta * fadeSpeed);
    else if (!isRaining && rainIntensity > 0) rainIntensity = Math.max(0, rainIntensity - delta * fadeSpeed);

    // Winter visuals: White particles for snow
    if (currentSeason === SEASONS.WINTER) {
        rainParticles.material.color.set(0xffffff);
        rainParticles.material.size = 0.25;
    } else {
        rainParticles.material.color.set(0x88ccff);
        rainParticles.material.size = 0.15;
    }

    let cameraBlock = getBlockGlobal(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
    let cameraInWater = cameraBlock === BLOCKS.WATER;

    if (cameraInWater) {
        rainParticles.material.opacity = 0;
    } else {
        rainParticles.material.opacity = rainIntensity * 0.45;
    }
    
    // Audio modulation
    if (rainAudioGain && rainFilter) {
        let targetFreq = isSheltered ? 400 : 1200;
        let targetVol = (isSheltered ? 0.04 : 0.12);
        if (cameraInWater) targetVol = 0; // Rain is silent underwater
        
        let wx = Math.floor(camera.position.x), wz = Math.floor(camera.position.z);
        let surfaceY = getSurfaceY(wx, wz);
        if (camera.position.y < surfaceY - 9) targetVol = 0; 
        
        let rainVol = (currentSeason === SEASONS.WINTER) ? 0 : targetVol;
        let snowVol = (currentSeason === SEASONS.WINTER) ? targetVol * 1.5 : 0;

        rainFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.2);
        rainAudioGain.gain.setTargetAtTime(rainVol * rainIntensity, audioCtx.currentTime, 0.2);
        
        if (blizzardAudioGain) {
            blizzardAudioGain.gain.setTargetAtTime(snowVol * rainIntensity, audioCtx.currentTime, 0.2);
        }
    }

    if (rainIntensity > 0) {
        const posAttr = rainParticles.geometry.attributes.position;
        const velY = (currentSeason === SEASONS.WINTER) ? 15 : 50; // snow falls slower
        for (let i = 0; i < posAttr.count; i++) {
            let px = posAttr.getX(i);
            let py = posAttr.getY(i);
            let pz = posAttr.getZ(i);

            py -= delta * velY;
            
            // Windy drift for snow
            if (currentSeason === SEASONS.WINTER) {
                px += Math.sin(performance.now()*0.001 + i) * 0.1;
                pz += Math.cos(performance.now()*0.0012 + i) * 0.1;
            }
            
            let wx = Math.floor(cameraPos.x + px), wz = Math.floor(cameraPos.z + pz), wy = cameraPos.y + py;
            let surfaceY = getSurfaceY(wx, wz);
            if (wy < surfaceY || py < -20) {
                py = 40 + Math.random() * 20; 
            }
            posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
        rainParticles.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
    }
}

function updateCraftingUI() {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    
    // Helper to add recipes
    const addRecipe = (outId, outCount, reqId, reqCount) => {
        let btn = document.createElement('button');
        let hasIngredients = inventory.countItem(reqId) >= reqCount;
        let hasSpace = inventory.canAcceptItem(outId);
        btn.innerHTML = `<span>${!hasSpace ? '<span style="color:#f55;font-size:11px;">[Inv Full] </span>' : ''}Craft ${outCount}x <img src="${icons[outId]}" class="block-icon"></span> <span>Req: ${reqCount}x <img src="${icons[reqId]}" class="block-icon"></span>`;
        btn.disabled = !hasIngredients || !hasSpace;
        btn.onclick = () => {
            if(!inventory.canAcceptItem(outId)) return;
            if(inventory.removeItem(reqId, reqCount)) {
                inventory.addItem(outId, outCount);
                updateInventoryUI();
                updateCraftingUI();
                playSound(400, 0.1);
            }
        };
        list.appendChild(btn);
    };

    // Basic Recipes (Available anywhere)
    addRecipe(BLOCKS.PLANKS, 4, BLOCKS.WOOD, 1);
    addRecipe(BLOCKS.WORKBENCH, 1, BLOCKS.PLANKS, 4);

    // Hoe Recipe (2 Planks + 2 Sticks — sticks come from wood/planks)
    // Simplified: requires 2 planks. Sticks are abstracted.
    (() => {
        const outId = BLOCKS.HOE;
        const reqId = BLOCKS.PLANKS;
        const reqCount = 2;
        let btn = document.createElement('button');
        let hasIngredients = inventory.countItem(reqId) >= reqCount;
        let hasSpace = inventory.canAcceptItem(outId);
        btn.innerHTML = `<span>${!hasSpace ? '<span style="color:#f55;font-size:11px;">[Inv Full] </span>' : ''}Craft 1x <img src="${icons[outId]}" class="block-icon"></span> <span>Req: ${reqCount}x <img src="${icons[reqId]}" class="block-icon"> (Planks)</span>`;
        btn.disabled = !hasIngredients || !hasSpace;
        btn.onclick = () => {
            if (!inventory.canAcceptItem(outId)) return;
            if (inventory.removeItem(reqId, reqCount)) {
                inventory.addItem(outId, 1);
                updateInventoryUI();
                updateCraftingUI();
                playSound(400, 0.1);
            }
        };
        list.appendChild(btn);
    })();

    // Advanced Recipes (Needs Workbench)
    if (craftingMode === 'workbench') {
        let hdr = document.createElement('div');
        hdr.innerHTML = '<br><b>Workbench Recipes:</b><hr>';
        hdr.style.color = '#fff';
        list.appendChild(hdr);
        
        addRecipe(BLOCKS.CHEST, 1, BLOCKS.PLANKS, 8);
        addRecipe(BLOCKS.FURNACE, 1, BLOCKS.STONE, 8); // Stone furnace
        addRecipe(BLOCKS.BRICK, 4, BLOCKS.CLAY, 4); // Baked clay -> bricks
        addRecipe(BLOCKS.STONE_BRICK, 4, BLOCKS.STONE, 4); // Carved stone
    }
}

// ----------------- CHEST UI -----------------
window.chests = {};
let currentChestKey = null;

function saveChests() {
    localStorage.setItem('sandbox3d_chests', JSON.stringify(window.chests));
}

function saveCropGrowth() {
    localStorage.setItem('sandbox3d_crops', JSON.stringify(window.cropGrowth));
}

// ----------------- FURNACE UI -----------------
window.furnaces = {};
let currentFurnaceKey = null;
let lastFurnaceTickTime = Date.now();

function saveFurnaces() {
    localStorage.setItem('sandbox3d_furnaces', JSON.stringify({
        data: window.furnaces,
        t: Date.now()
    }));
}

function updateFurnaceUI() {
    if (!currentFurnaceKey) return;
    let f = window.furnaces[currentFurnaceKey];
    if (!f) return;
    
    // helper to build slot div
    const buildSlot = (slotData, dragDataStr) => {
        let div = document.createElement('div');
        div.className = 'chest-slot';
        if (slotData) {
            let img = document.createElement('img');
            img.src = icons[slotData.id];
            img.className = 'block-icon';
            div.appendChild(img);
            if (slotData.count > 1) {
                let cnt = document.createElement('span');
                cnt.className = 'hotbar-count';
                cnt.textContent = slotData.count;
                div.appendChild(cnt);
            }
            div.title = BLOCK_NAMES[slotData.id] || '?';
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', dragDataStr);
            };
        }
        div.ondragover = (e) => e.preventDefault();
        return div;
    };

    // Update Input
    let inDiv = buildSlot(f.input, JSON.stringify({source:'furnace_input'}));
    inDiv.ondrop = (e) => { e.preventDefault(); handleFurnaceDrop(e.dataTransfer.getData('text/plain'), 'input'); };
    let cIn = document.getElementById('furnace-input'); cIn.innerHTML = ''; cIn.appendChild(inDiv);

    // Update Fuel
    let fuelDiv = buildSlot(f.fuel, JSON.stringify({source:'furnace_fuel'}));
    fuelDiv.ondrop = (e) => { e.preventDefault(); handleFurnaceDrop(e.dataTransfer.getData('text/plain'), 'fuel'); };
    let cFuel = document.getElementById('furnace-fuel'); cFuel.innerHTML = ''; cFuel.appendChild(fuelDiv);

    // Update Output (only withdrawable)
    let outDiv = buildSlot(f.output, JSON.stringify({source:'furnace_output'}));
    let cOut = document.getElementById('furnace-output'); cOut.innerHTML = ''; cOut.appendChild(outDiv);

    // Update Progress bar
    let pBar = document.getElementById('furnace-bar');
    pBar.style.width = (f.smeltProgress / 5.0 * 100) + '%';
    
    // Update player inventory inside furnace UI
    const pGrid = document.getElementById('player-furnace-grid');
    pGrid.innerHTML = '';
    for (let i = 0; i < inventory.slots.length; i++) {
        let div = document.createElement('div');
        div.className = 'player-slot';
        let slot = inventory.slots[i];
        if (slot) {
            let img = document.createElement('img');
            img.src = icons[slot.id];
            img.className = 'block-icon';
            div.appendChild(img);
            if (slot.count > 1) {
                let cnt = document.createElement('span');
                cnt.className = 'hotbar-count';
                cnt.textContent = slot.count;
                div.appendChild(cnt);
            }
            div.title = BLOCK_NAMES[slot.id];
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({source: 'inv_furnace', index: i}));
            };
        }
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            let dataRaw = e.dataTransfer.getData('text/plain');
            if(!dataRaw) return;
            let data = JSON.parse(dataRaw);
            
            if (data.source === 'furnace_output') {
                if (!slot || slot.id === f.output.id) sendFurnaceItemToInv('output', i);
            } else if (data.source === 'furnace_input') {
                if (!slot || slot.id === f.input.id) sendFurnaceItemToInv('input', i);
            } else if (data.source === 'furnace_fuel') {
                if (!slot || slot.id === f.fuel.id) sendFurnaceItemToInv('fuel', i);
            } else if (data.source === 'inv_furnace') {
                dragDropItem(inventory.slots, data.index, inventory.slots, i);
                updateFurnaceUI();
            }
        };
        // Right click to send to input/fuel automatically
        div.oncontextmenu = (e) => {
            e.preventDefault();
            if(!slot) return;
            if(slot.id === BLOCKS.WOOD || slot.id === BLOCKS.PLANKS) {
                sendInvItemToFurnace(i, 'fuel');
            } else {
                sendInvItemToFurnace(i, 'input');
            }
        };
        pGrid.appendChild(div);
    }
}

function handleFurnaceDrop(dataRaw, targetSlotName) {
    if(!dataRaw) return;
    let data = JSON.parse(dataRaw);
    let f = window.furnaces[currentFurnaceKey];
    if (data.source === 'inv_furnace') {
        let invItem = inventory.slots[data.index];
        if(!invItem) return;
        if(f[targetSlotName] && f[targetSlotName].id !== invItem.id) return;
        
        if(!f[targetSlotName]) f[targetSlotName] = {id: invItem.id, count: 1};
        else f[targetSlotName].count++;
        
        invItem.count--;
        if(invItem.count <= 0) inventory.slots[data.index] = null;
        updateFurnaceUI(); updateInventoryUI(); saveFurnaces();
    }
}

function sendFurnaceItemToInv(furnaceSlotName, invIndex) {
    let f = window.furnaces[currentFurnaceKey];
    let item = f[furnaceSlotName];
    if(!item) return;
    
    let target = inventory.slots[invIndex];
    if(!target) {
        inventory.slots[invIndex] = {id: item.id, count: item.count};
        f[furnaceSlotName] = null;
    } else if (target.id === item.id) {
        let space = 64 - target.count;
        let transfer = Math.min(space, item.count);
        target.count += transfer;
        item.count -= transfer;
        if(item.count <= 0) f[furnaceSlotName] = null;
    }
    updateFurnaceUI(); updateInventoryUI(); saveFurnaces();
}

function sendInvItemToFurnace(invIndex, furnaceSlotName) {
    let f = window.furnaces[currentFurnaceKey];
    let item = inventory.slots[invIndex];
    if(!item) return;
    let target = f[furnaceSlotName];
    if(!target) {
        f[furnaceSlotName] = {id: item.id, count: 1};
        item.count--;
    } else if(target.id === item.id && target.count < 64) {
        target.count++;
        item.count--;
    }
    if(item.count <= 0) inventory.slots[invIndex] = null;
    updateFurnaceUI(); updateInventoryUI(); saveFurnaces();
}

function openFurnace(x, y, z) {
    let key = `${x},${y},${z}`;
    if (!window.furnaces) window.furnaces = {};
    if (!window.furnaces[key]) {
        window.furnaces[key] = { input: null, fuel: null, output: null, fuelTicksLeft: 0, smeltProgress: 0 };
    }
    currentFurnaceKey = key;
    controls.unlock();
    document.getElementById('furnace-ui').style.display = 'block';
    document.getElementById('ui-backdrop').style.display = 'block';
    updateFurnaceUI();
}


function dragDropItem(fromArray, fromIdx, toArray, toIdx) {
    let fromItem = fromArray[fromIdx];
    let toItem = toArray[toIdx];
    if (!fromItem) return;
    if (fromArray === toArray && fromIdx === toIdx) return;
    
    if (toItem && toItem.id === fromItem.id) {
        toItem.count += fromItem.count;
        fromArray[fromIdx] = null;
    } else {
        toArray[toIdx] = fromItem;
        fromArray[fromIdx] = toItem;
    }
}

function transferItem(fromArray, fromIdx, toArray) {
    let item = fromArray[fromIdx];
    if (!item) return false;
    
    // try to stack
    let existing = toArray.find(s => s && s.id === item.id);
    if (existing) {
        existing.count += item.count;
        fromArray[fromIdx] = null;
        return true;
    }
    // find empty
    let emptyIdx = toArray.findIndex(s => s === null);
    if (emptyIdx !== -1) {
        toArray[emptyIdx] = { ...item };
        fromArray[fromIdx] = null;
        return true;
    }
    return false; // no space
}

function openChest(x, y, z) {
    let key = `${x},${y},${z}`;
    if (!window.chests) window.chests = {};
    if (!window.chests[key]) {
        window.chests[key] = Array(18).fill(null); // 18 slots in chest
    }
    currentChestKey = key;
    document.getElementById('ui-backdrop').style.display = 'block';
    document.getElementById('chest-ui').style.display = 'block';
    
    // Use the existing instructions overlay logic!
    document.getElementById('ui').style.pointerEvents = 'auto';

    ControlsUnlockWait();
    updateChestUI();
}

function ControlsUnlockWait() {
    controls.isLocked = false; // instantly disable mouse look to prevent jump
    controls.unlock();
    if (document.pointerLockElement) document.exitPointerLock();
}

function updateChestUI() {
    if (!currentChestKey) return;
    let chestSlots = window.chests[currentChestKey];
    
    const cGrid = document.getElementById('chest-grid');
    cGrid.innerHTML = '';
    for(let i=0; i<18; i++) {
        let div = document.createElement('div');
        div.className = 'chest-slot';
        let slot = chestSlots[i];
        if (slot) {
            div.title = BLOCK_NAMES[slot.id];
            div.innerHTML = `<img src="${icons[slot.id]}" class="block-icon" draggable="false"><span class="hotbar-count">${slot.count}</span>`;
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({source: 'chest', index: i}));
            };
        }
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            try {
                let data = JSON.parse(e.dataTransfer.getData('text/plain'));
                let srcArray = data.source === 'chest' ? chestSlots : inventory.slots;
                dragDropItem(srcArray, data.index, chestSlots, i);
                updateChestUI();
                updateInventoryUI();
                saveChests();
            } catch(err) {}
        };
        div.onclick = () => {
            if (transferItem(chestSlots, i, inventory.slots)) {
                updateChestUI();
                updateInventoryUI();
                saveChests();
            }
        };
        cGrid.appendChild(div);
    }
    
    const pGrid = document.getElementById('player-grid');
    pGrid.innerHTML = '';
    for(let i = 0; i < 36; i++) {
        // Visual separator between hotbar and backpack
        if (i === 9) {
            let sep = document.createElement('div');
            sep.style.cssText = 'width:100%; font-size:11px; color:#aaa; padding:4px 0 3px; border-top:1px solid #446;';
            sep.textContent = 'Backpack (10–36)';
            pGrid.appendChild(sep);
        }
        let div = document.createElement('div');
        div.className = 'player-slot' + (i < 9 ? ' hotbar-slot-inner' : '');
        let slot = inventory.slots[i];
        if (slot) {
            div.title = BLOCK_NAMES[slot.id];
            div.innerHTML = `<img src="${icons[slot.id]}" class="block-icon" draggable="false"><span class="hotbar-count">${slot.count}</span>`;
            div.draggable = true;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({source: 'inventory', index: i}));
            };
        }
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => {
            e.preventDefault();
            try {
                let data = JSON.parse(e.dataTransfer.getData('text/plain'));
                let srcArray = data.source === 'chest' ? chestSlots : inventory.slots;
                dragDropItem(srcArray, data.index, inventory.slots, i);
                updateChestUI();
                updateInventoryUI();
                saveChests();
            } catch(err) {}
        };
        div.onclick = () => {
            if (transferItem(inventory.slots, i, chestSlots)) {
                updateChestUI();
                updateInventoryUI();
                saveChests();
            }
        };
        pGrid.appendChild(div);
    }
}
// ---------------------------------------------------------

// Day / Night cycle
let gameTime = parseFloat(localStorage.getItem('sandbox3d_gameTime')) || (Math.PI / 2); // start at noon
let dirLight, ambientLight;
let sunMesh, moonMesh, starsMesh;

// Ambient Background Sounds
let ambientDayTracks = [
    new Audio('audio/ambient_day.mp3'),
    new Audio('audio/ambient_day_2.mp3')
];
ambientDayTracks.forEach(t => { t.loop = true; t.volume = 0; });
let currentDayTrackIndex = Math.floor(Math.random() * ambientDayTracks.length);
let wasDay = false;

let ambientNightAudio = new Audio('audio/ambient_night.mp3');
ambientNightAudio.loop = true;
ambientNightAudio.volume = 0;

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playLeafSound() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    // Noise burst filtered to sound like rustling leaves
    let bufLen = audioCtx.sampleRate * 0.18;
    let buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    let data = buf.getChannelData(0);
    for(let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    let src = audioCtx.createBufferSource();
    src.buffer = buf;
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    let gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
}

let _windTimer = 8 + Math.random() * 12;
function tickWind(delta) {
    _windTimer -= delta;
    if(_windTimer <= 0) {
        _windTimer = 14 + Math.random() * 20;
        if(audioCtx.state === 'suspended') return;
        // Gentle wind whoosh: filtered noise, slow fade in/out
        let dur = 2.5 + Math.random();
        let bufLen = Math.floor(audioCtx.sampleRate * dur);
        let buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
        let data = buf.getChannelData(0);
        for(let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
        let src = audioCtx.createBufferSource();
        src.buffer = buf;
        let filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400 + Math.random() * 300;
        let gain = audioCtx.createGain();
        let peak = 0.06 + Math.random() * 0.04;
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(peak, audioCtx.currentTime + dur * 0.4);
        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start();
        src.stop(audioCtx.currentTime + dur + 0.1);
    }
}

// Disable context menu
document.addEventListener('contextmenu', e => e.preventDefault());

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // 100 is ~6 chunks, chunks generate at 8+ hiding the popping
    
    // Lighting
    ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    scene.add(ambientLight);
    
    dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(100, 150, 100);
    dirLight.castShadow = true;
    
    // Configure shadow properties
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 120;
    dirLight.shadow.camera.bottom = -120;
    dirLight.shadow.bias = -0.001; // Increased bias to avoid floating shadows
    dirLight.shadow.normalBias = 0.05; // Fixes chunk border shadow acne
    
    scene.add(dirLight);
    
    // Add shadow target (dummy empty that sun follows)
    const shadowTarget = new THREE.Object3D();
    scene.add(shadowTarget);
    dirLight.target = shadowTarget;
    window.shadowTarget = shadowTarget;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.y = 80; // Default high to avoid spawning underground immediately
    
    // Procedural Materials
    generateMaterials();
    
    // Sky Bodies
    const sunGeom = new THREE.SphereGeometry(20, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b, fog: false, transparent: true, depthWrite: true });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.userData = { ignoreRaycast: true };
    
    // Sun Glow Aura
    const sunGlowGeom = new THREE.SphereGeometry(25, 16, 16);
    const sunGlowMat = new THREE.MeshBasicMaterial({ 
        color: 0xfff59d, 
        transparent: true, 
        opacity: 0.3, 
        fog: false 
    });
    const sunGlow = new THREE.Mesh(sunGlowGeom, sunGlowMat);
    sunMesh.add(sunGlow);
    
    scene.add(sunMesh);
    
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false, transparent: true, depthWrite: true });
    moonMesh = new THREE.Mesh(sunGeom, moonMat);
    moonMesh.userData = { ignoreRaycast: true };
    scene.add(moonMesh);
    
    // Stars
    const starGeom = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<1500; i++) {
        // Correct spherical distribution to ensure they are ALWAYS far away and behind terrain
        const r = 700 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xffffff, 
        size: 2.5, 
        sizeAttenuation: false, 
        transparent: true, 
        opacity: 0, 
        depthWrite: false,
        fog: false
    });
    starsMesh = new THREE.Points(starGeom, starMat);
    starsMesh.userData = { ignoreRaycast: true };
    scene.add(starsMesh);
    
    // Build initial central chunks synchronously so player doesn't fall through
    for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
            chunks[`${cx},${cz}`] = new Chunk(cx, cz, scene, materials);
            spawnOneMobInChunk(cx, cz);
        }
    }

    initRain(scene);

    // Spawn Mobs after chunks are built — find valid surface positions
    try {
        spawnMobsOnSurface(scene);
    } catch(e) {
        console.error('Mob spawn error:', e);
    }

    // Find a dry spawn point (not in water) using the raw noise function
    let spawnBaseX = Math.floor(((currentSeed * 73) % 10000) - 5000);
    let spawnBaseZ = Math.floor(((currentSeed * 137) % 10000) - 5000);
    let spawnX = spawnBaseX, spawnZ = spawnBaseZ;
    let spawnY = 80;
    
    outer:
    for (let r = 0; r <= 150; r += 5) {
        let steps = r === 0 ? 1 : Math.max(8, r);
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / steps) {
            let tx = r === 0 ? spawnBaseX : Math.round(spawnBaseX + Math.cos(angle) * r);
            let tz = r === 0 ? spawnBaseZ : Math.round(spawnBaseZ + Math.sin(angle) * r);
            
            // Replicate exactly chunk.js terrain height logic
            let baseElev = fbm2D(tx * 0.002, tz * 0.002, 4, 0.5); 
            let baseHeight = 40 + baseElev * 32; 
            let mountainBoost = 0;
            if (baseElev > 0.55) {
                mountainBoost = Math.pow((baseElev - 0.55) * 2.2, 2.5) * 90;
            }
            let detailNoise = fbm2D(tx*0.01, tz*0.01) * 5;
            if (baseElev > 0.55) detailNoise *= 1.0 + (baseElev - 0.55)*8;
            
            let distFromOrigin = Math.sqrt(tx*tx + tz*tz);
            if (distFromOrigin < 20) {
                baseElev = Math.min(baseElev, 0.50);
                mountainBoost = 0;
            }
            
            let surfaceY = Math.floor(baseHeight + mountainBoost + detailNoise);
            
            if (surfaceY > 58) { // 58 is water level
                spawnX = tx; 
                spawnZ = tz; 
                spawnY = surfaceY + 3;
                break outer;
            }
        }
    }
    
    // Snap player to that surface
    camera.position.x = spawnX + 0.5;
    camera.position.z = spawnZ + 0.5;
    camera.position.y = spawnY;

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    
    document.body.appendChild(renderer.domElement);
    
    updateInventoryUI();
    
    initClouds();

    controls = new PointerLockControls(camera, document.body);
    
    craftingMode = 'none'; 
    const craftingMenu = document.getElementById('crafting');

    const instructions = document.getElementById('instructions');
    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input');
    const chatLog = document.getElementById('chat-log');

    function addChatMessage(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        chatLog.appendChild(div);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function processCommand(cmd) {
        const c = cmd.toLowerCase().trim();
        if (c.startsWith('/time ')) {
            const arg = c.split(' ')[1];
            if (arg === 'sunset') { gameTime = Math.PI; addChatMessage("Time set to Sunset"); }
            else if (arg === 'day') { gameTime = Math.PI / 2; addChatMessage("Time set to Day"); }
            else if (arg === 'night') { gameTime = Math.PI * 1.5; addChatMessage("Time set to Night"); }
            return;
        }
        if (c === '/tp village') {
            addChatMessage("Searching for nearest village candidate...");
            let px = camera.position.x;
            let pz = camera.position.z;
            let found = false;
            // Scan village grid around player
            let cellX = Math.floor(px / VILLAGE_GRID);
            let cellZ = Math.floor(pz / VILLAGE_GRID);
            for (let r = 0; r < 20; r++) {
                for (let i = -r; i <= r; i++) {
                    for (let j = -r; j <= r; j++) {
                        if (Math.abs(i) !== r && Math.abs(j) !== r) continue;
                        let tcX = cellX + i;
                        let tcZ = cellZ + j;
                        let seed = getVillageSeed(tcX, tcZ);
                        if (seed <= 0.20) {
                            let vCX = tcX * VILLAGE_GRID + 30 + Math.floor(seed * (VILLAGE_GRID - 60));
                            let vCZ = tcZ * VILLAGE_GRID + 30 + Math.floor(((seed * 321.4) % 1) * (VILLAGE_GRID - 60));
                            let sY = getWorldSurfaceY(vCX, vCZ);
                            if (sY >= 60 && sY <= 90) {
                                // Double check flatness logic must match chunk.js
                                const SAMPLE_DIST = 18;
                                let h1 = getWorldSurfaceY(vCX + SAMPLE_DIST, vCZ + SAMPLE_DIST);
                                let h2 = getWorldSurfaceY(vCX - SAMPLE_DIST, vCZ - SAMPLE_DIST);
                                if (Math.abs(h1 - sY) <= 8 && Math.abs(h2 - sY) <= 8) {
                                    camera.position.set(vCX + 0.5, sY + 20.0, vCZ + 0.5);
                                    velocity.set(0, 0, 0);
                                    flyMode = true; // Safety flight mode
                                    
                                    // Failsafe: push player up if stuck in a block
                                    let failSafe = 50;
                                    while (checkAABB(camera.position.x, camera.position.y, camera.position.z) && failSafe > 0) {
                                        camera.position.y += 1.0;
                                        failSafe--;
                                    }
                                    
                                    addChatMessage(`Village found at ${Math.floor(vCX)}, ${Math.floor(vCZ)}. Flight mode enabled!`);
                                    found = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
            if (!found) addChatMessage("No village found within reach.");
            return;
        }
        if (c === '/day') {
            gameTime = Math.PI / 2;
            addChatMessage("Time set to Day");
        } else if (c === '/night') {
            gameTime = Math.PI * 1.5;
            addChatMessage("Time set to Night");
        } else if (c === '/sunrise') {
            gameTime = 0;
            addChatMessage("Time set to Sunrise");
        } else if (c === '/sunset') {
            gameTime = Math.PI;
            addChatMessage("Time set to Sunset");
        } else if (c === '/rain') {
            isRaining = !isRaining;
            isStorming = false;
            addChatMessage(isRaining ? "It starts to rain..." : "The rain stops.");
            initRainAudio();
        } else if (c === '/storm') {
            isRaining = true;
            isStorming = true;
            addChatMessage("A storm is coming!");
            initRainAudio();
            initBlizzardAudio();
        } else if (c === '/snow') {
            if (currentSeason !== SEASONS.WINTER) {
                addChatMessage("It's too warm for snow!");
            } else {
                isRaining = !isRaining;
                isStorming = false;
                addChatMessage(isRaining ? "Heavy snow begins..." : "The snowfall stops.");
                initBlizzardAudio();
            }
        } else if (c === '/spring') {
            gameTime = (0 * 10) * Math.PI * 2 + (Math.PI / 4);
            addChatMessage("Spring breeze fills the air...");
        } else if (c === '/summer') {
            gameTime = (1 * 10) * Math.PI * 2 + (Math.PI / 4);
            addChatMessage("The sun burns hot. Summer is here.");
        } else if (c === '/autumn') {
            gameTime = (2 * 10) * Math.PI * 2 + (Math.PI / 4);
            addChatMessage("Leaves begin to fall. Autumn arrives.");
        } else if (c === '/winter') {
            gameTime = (3 * 10) * Math.PI * 2 + (Math.PI / 4);
            addChatMessage("A cold wind blows. Winter has come.");
            if (!found) addChatMessage("No village found in nearby area.");
        } else if (c === '/help') {
            addChatMessage("Commands: /day, /night, /sunrise, /sunset, /rain, /storm, /spring, /summer, /autumn, /winter, /tpvillage, /help");
        } else if (c.startsWith('/')) {
            addChatMessage("Unknown command. Type /help for list.");
        }
    }

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        chatContainer.style.display = 'none';
        isChatOpen = false;
        if(audioCtx.state === 'suspended') audioCtx.resume();
        if(isRaining) initRainAudio();
        if(isStorming) initBlizzardAudio();
        ambientDayTracks.forEach(t => t.play().catch(e => console.log('Audio play error:', e)));
        ambientNightAudio.play().catch(e => console.log('Audio play error:', e));
    });
    
    // Instantly cut off mouse processing on ESC to prevent browser's exit-lock mousemove jump
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && controls) {
            controls.isLocked = false;
        }
    }, true);
    
    // Catch synthetic browser mouse moves on ESC that fire before keydown
    // Note: Removed the > 60 movement dropping because it ruins fast gamer flicks (causing "lags" or dropped inputs).

    controls.addEventListener('unlock', () => {
        // Don't show the pause overlay when any UI is open
        if (craftingMode === 'none' && (!dialogueService || !dialogueService.isUIOpen)) {
            instructions.style.display = 'flex';
            // ONLY pause ambient music if we are actually at the pause menu (no UI open)
            if (typeof ambientDayTracks !== 'undefined') ambientDayTracks.forEach(t => t.pause());
            if (typeof ambientNightAudio !== 'undefined') ambientNightAudio.pause();
            if (audioCtx && audioCtx.state === 'running') {
                audioCtx.suspend();
            }
        }
    });
    
    scene.add(controls.getObject());

    // Helper to find a Mob instance by climbing the parent tree
    function getMobFromObject(obj) {
        while (obj) {
            if (obj.userData && obj.userData.isMob && obj.userData.mob) {
                return obj.userData.mob;
            }
            obj = obj.parent;
        }
        return null;
    }

    // Spawn physical drop item
    function spawnDrop(blockId, count, x, y, z) {
        if (!icons[blockId]) return;
        
        let group = new THREE.Group();
        group.position.set(x + Math.random() * 0.5 + 0.25, y + 0.5, z + Math.random() * 0.5 + 0.25);
        
        if (!window.dropMaterials) window.dropMaterials = {};
        if (!dropMaterials[blockId]) {
            let img = new Image();
            img.src = icons[blockId];
            let tex = new THREE.Texture(img);
            img.onload = () => tex.needsUpdate = true;
            tex.magFilter = THREE.NearestFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            dropMaterials[blockId] = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
        }
        
        let sprite = new THREE.Sprite(dropMaterials[blockId]);
        sprite.scale.set(0.4, 0.4, 0.4);
        group.add(sprite);
        scene.add(group);
        
        if (!window.droppedItems) window.droppedItems = [];
        window.droppedItems.push({
            mesh: group,
            id: blockId,
            count: count,
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 2,
            vz: (Math.random() - 0.5) * 4,
            tick: 0
        });
    }

    // Handles block breaking logic recursively
    function handleBlockBreak(tx, ty, tz, blockId) {
        if (blockId === BLOCKS.AIR || blockId === BLOCKS.WATER) return;

        // Check if there's a plant above that needs to break first
        let aboveId = getBlockGlobal(tx, ty + 1, tz);
        if ((aboveId >= 13 && aboveId <= 15) || (aboveId >= 23 && aboveId <= 27)) {
            handleBlockBreak(tx, ty + 1, tz, aboveId); // recurse
        }

        let replacement = BLOCKS.AIR;
        if (ty <= 58) {
            // Check neighbors; if any is water, fill this hole with water
            let u = getBlockGlobal(tx, ty + 1, tz);
            let l = getBlockGlobal(tx - 1, ty, tz);
            let r = getBlockGlobal(tx + 1, ty, tz);
            let f = getBlockGlobal(tx, ty, tz + 1);
            let b = getBlockGlobal(tx, ty, tz - 1);
            if (u === BLOCKS.WATER || l === BLOCKS.WATER || r === BLOCKS.WATER || f === BLOCKS.WATER || b === BLOCKS.WATER) {
                replacement = BLOCKS.WATER;
            }
        }
        
        // --- CROP BREAKING DROPS ---
        const MATURE_CROPS = [BLOCKS.WHEAT, BLOCKS.OATS, BLOCKS.TOMATO, BLOCKS.CARROT, BLOCKS.POTATO];
        const CROP_SEED_MAP = {
            [BLOCKS.WHEAT]:   { fruit: BLOCKS.WHEAT,   seed: BLOCKS.WHEAT_SEED },
            [BLOCKS.OATS]:    { fruit: BLOCKS.OATS,    seed: BLOCKS.OATS_SEED },
            [BLOCKS.TOMATO]:  { fruit: BLOCKS.TOMATO,  seed: BLOCKS.TOMATO_SEED },
            [BLOCKS.CARROT]:  { fruit: BLOCKS.CARROT,  seed: BLOCKS.CARROT }, // carrot IS seed
            [BLOCKS.POTATO]:  { fruit: BLOCKS.POTATO,  seed: BLOCKS.POTATO }, // potato IS seed
        };

        if (MATURE_CROPS.includes(blockId)) {
            let cropKey = `${tx},${ty},${tz}`;
            let growthData = window.cropGrowth[cropKey];
            let isMature = !growthData || (growthData.stage !== undefined ? growthData.stage >= 2 : growthData.progress >= 100);
            setBlockGlobal(tx, ty, tz, replacement);
            if (window.cropGrowth[cropKey]) {
                delete window.cropGrowth[cropKey];
                saveCropGrowth();
            }
            if (isMature) {
                let cropInfo = CROP_SEED_MAP[blockId];
                spawnDrop(cropInfo.fruit, 2, tx, ty, tz);
                spawnDrop(cropInfo.seed, 3, tx, ty, tz);
            } else {
                let cropInfo = CROP_SEED_MAP[blockId];
                spawnDrop(cropInfo.seed, 1, tx, ty, tz);
            }
            playLeafSound();
            return;
        }
        
        // --- TILLED SOIL breaking returns dirt ---
        if (blockId === BLOCKS.TILLED_SOIL) {
            setBlockGlobal(tx, ty, tz, replacement);
            spawnDrop(BLOCKS.DIRT, 1, tx, ty, tz);
            playSound(300, 0.05);
            return;
        }

        // Default block break
        setBlockGlobal(tx, ty, tz, replacement);
        spawnDrop(blockId, 1, tx, ty, tz);
        
        if (blockId === BLOCKS.CHEST) {
             if(window.chests && window.chests[`${tx},${ty},${tz}`]) {
                 delete window.chests[`${tx},${ty},${tz}`];
                 saveChests();
             }
        }
        if (blockId === BLOCKS.FURNACE) {
            if (window.furnaces && window.furnaces[`${tx},${ty},${tz}`]) {
                delete window.furnaces[`${tx},${ty},${tz}`];
                saveFurnaces();
            }
            if (window.furnaceOrientations && window.furnaceOrientations[`${tx},${ty},${tz}`]) {
                delete window.furnaceOrientations[`${tx},${ty},${tz}`];
                localStorage.setItem('sandbox3d_furnace_orient', JSON.stringify(window.furnaceOrientations));
            }
        }
        
        if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.GRASS) {
            playLeafSound();
        } else {
            playSound(300, 0.05); // pop
        }
    }

    const onKeyDown = function (event) {
        if (event.repeat) {
            keys[event.code] = true;
            return;
        }
        keys[event.code] = true;
        
        if (dialogueService.isUIOpen && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
            if (event.code === 'Escape') {
                dialogueService.closeDialogue();
                setTimeout(() => {
                    if (!dialogueService.isUIOpen) controls.lock();
                }, 150);
            }
            // NO preventDefault() for other keys (like Space) when typing!
            return;
        }

        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'ShiftLeft':
                isSprinting = true;
                break;
            case 'Space':
                if (dialogueService.isUIOpen) {
                    event.preventDefault();
                    return;
                }
                const now = performance.now();
                if (now - lastSpaceTime < 200) {
                    flyMode = !flyMode;
                    velocity.y = 0;
                    lastSpaceTime = 0; // reset
                } else {
                    lastSpaceTime = now;
                }
                
                if (!flyMode && canJump === true) {
                    velocity.y = 11; // Jump exactly ~2 blocks high
                    canJump = false;
                }
                break;
            case 'KeyE':
                if (dialogueService.isUIOpen) {
                    event.preventDefault();
                    return;
                }
                if (!controls.isLocked) return;
                break;
            case 'AltLeft':
                if (dialogueService.isUIOpen) {
                    event.preventDefault();
                    dialogueService.startRecording();
                }
                break;
            case 'KeyV':
                // Removed to avoid conflict with typing
                break;
            case 'Enter':
            case 'Slash':
                if (!isChatOpen) {
                    isChatOpen = true;
                    controls.unlock();
                    chatContainer.style.display = 'block';
                    chatInput.value = (event.code === 'Slash' ? '/' : '');
                    setTimeout(() => chatInput.focus(), 10);
                }
                break;
        }
    };

    const onKeyUp = function (event) {
        if (dialogueService.isUIOpen && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
            return;
        }
        keys[event.code] = false;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward = false; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft = false; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward = false; break;
            case 'ArrowRight':
            case 'KeyD': moveRight = false; break;
            case 'AltLeft':
                dialogueService.stopRecording();
                break;
            case 'KeyV':
                // Removed stopRecording for V to support Alt
                break;
        }

        if (dialogueService.isUIOpen) {
            moveForward = false; moveBackward = false; moveLeft = false; moveRight = false;
        }
        
        // Inventory Slots
        if (event.key >= '1' && event.key <= '9') {
            inventory.activeSlot = parseInt(event.key) - 1;
            updateInventoryUI();
        }
        
        // Crafting Toggle
        if (event.code === 'KeyE') {
            // Prevent opening crafting if the game hasn't started yet
            if (!controls.isLocked && craftingMode === 'none' && instructions.style.display === 'flex') return;

            if (craftingMode !== 'none') {
                craftingMode = 'none';
                craftingMenu.style.display = 'none';
                document.getElementById('chest-ui').style.display = 'none';
                document.getElementById('furnace-ui').style.display = 'none';
                document.getElementById('full-inventory-ui').style.display = 'none';
                document.getElementById('ui-backdrop').style.display = 'none';
                instructions.style.display = 'none';
                document.getElementById('ui').style.pointerEvents = 'none';
                controls.lock();
            } else {
                craftingMode = 'basic';
                
                // Smart select chest if looking at it
                raycaster.setFromCamera(center, camera);
                let collidable = scene.children.filter(obj => !obj.userData.ignoreRaycast);
                let intersects = raycaster.intersectObjects(collidable);
                if (intersects.length > 0 && intersects[0].distance <= 8) {
                     // Check for villager interaction using the hierarchy helper
                     let hitMob = getMobFromObject(intersects[0].object);
                     if (hitMob && hitMob.isVillager) {
                         dialogueService.openDialogue(hitMob); // Open FIRST to set isUIOpen state
                         controls.unlock(); // Then unlock
                         return;
                     }

                     let point = intersects[0].point;
                     let normal = intersects[0].face.normal;
                     let targetX = Math.floor(point.x - normal.x * 0.1);
                     let targetY = Math.floor(point.y - normal.y * 0.1);
                     let targetZ = Math.floor(point.z - normal.z * 0.1);
                     let targetBlockId = getBlockGlobal(targetX, targetY, targetZ);
                     if (targetBlockId === BLOCKS.CHEST) {
                         craftingMode = 'chest';
                         openChest(targetX, targetY, targetZ);
                         return; // openChest handles unlocking
                     } else if (targetBlockId === BLOCKS.FURNACE) {
                         craftingMode = 'furnace';
                         openFurnace(targetX, targetY, targetZ);
                         return;
                     } else if (targetBlockId === BLOCKS.WORKBENCH) {
                         craftingMode = 'workbench';
                     }
                }
                
                craftingMenu.style.display = 'block';
                document.getElementById('chest-ui').style.display = 'none';
                document.getElementById('furnace-ui').style.display = 'none';
                instructions.style.display = 'none';
                document.getElementById('ui').style.pointerEvents = 'auto';
                
                try {
                    updateCraftingUI();
                } catch(err) {
                    document.getElementById('debug-text').innerText = "CRAFT_ERR: " + err.message;
                }
                
                ControlsUnlockWait();
            }
        }

        // Inventory (I key)
        if (event.code === 'KeyI') {
            if (!controls.isLocked && craftingMode === 'none' && instructions.style.display === 'flex') return;
            if (craftingMode === 'inventory') {
                craftingMode = 'none';
                document.getElementById('full-inventory-ui').style.display = 'none';
                document.getElementById('ui-backdrop').style.display = 'none';
                document.getElementById('ui').style.pointerEvents = 'none';
                controls.lock();
            } else if (craftingMode === 'none') {
                craftingMode = 'inventory';
                document.getElementById('full-inventory-ui').style.display = 'block';
                document.getElementById('ui-backdrop').style.display = 'block';
                document.getElementById('ui').style.pointerEvents = 'auto';
                updateFullInventoryUI();
                ControlsUnlockWait();
            }
        }
        
        // Handle ESC to close UIs safely
        if (event.code === 'Escape' && craftingMode !== 'none') {
            craftingMode = 'none';
            craftingMenu.style.display = 'none';
            document.getElementById('chest-ui').style.display = 'none';
            document.getElementById('furnace-ui').style.display = 'none';
            document.getElementById('full-inventory-ui').style.display = 'none';
            document.getElementById('ui-backdrop').style.display = 'none';
            document.getElementById('ui').style.pointerEvents = 'none';
            instructions.style.display = 'flex'; // show pause menu
        }
    };

    chatInput.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
            const val = chatInput.value;
            if (val) processCommand(val);
            chatInput.value = '';
            chatContainer.style.display = 'none';
            isChatOpen = false;
            controls.lock();
        }
        if (e.code === 'Escape' && isChatOpen) {
            chatContainer.style.display = 'none';
            isChatOpen = false;
            controls.lock();
        }
        if (e.code === 'Escape' && dialogueService.isUIOpen) {
            dialogueService.closeDialogue();
            controls.lock();
        }
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Mouse Scroll inventory
    window.addEventListener('wheel', (e) => {
        if(e.deltaY > 0) inventory.activeSlot = (inventory.activeSlot + 1) % 9;
        else inventory.activeSlot = (inventory.activeSlot - 1 + 9) % 9;
        updateInventoryUI();
    });
    
    // Raycaster for mining/placing
    raycaster = new THREE.Raycaster();
    center = new THREE.Vector2(0, 0);
    
    document.addEventListener('mousedown', (e) => {
        if(!controls.isLocked) return;
        raycaster.setFromCamera(center, camera);
        
        let collidable = scene.children.filter(obj => !obj.userData.ignoreRaycast);
        let intersects = raycaster.intersectObjects(collidable);
        if (intersects.length > 0) {
            let intersect = intersects[0];
            if (intersect.distance > 8) return; // Reach
            
            // Entity Hit
            let hitMob = getMobFromObject(intersect.object);
            if (hitMob) {
                if (e.button === 0) {
                     let died = hitMob.takeDamage();
                     // Deer grunt (200), Rabbit squeak (600)
                     playSound(hitMob.isDeer ? 200 : 800, 0.1); 
                     
                     if (died) {
                          inventory.addItem(BLOCKS.MEAT, hitMob.isDeer ? 2 : 1);
                          updateInventoryUI();
                     }
                }
                return; 
            }
            
            let point = intersect.point;
            if (!intersect.face) return;
            let normal = intersect.face.normal;
            
            // For right-click, first check what block we are aiming at.
            // Using 0.1 prevents floating point errors from putting us in the next block over
            let targetX = Math.floor(point.x - normal.x * 0.1);
            let targetY = Math.floor(point.y - normal.y * 0.1);
            let targetZ = Math.floor(point.z - normal.z * 0.1);
            
            if (e.button === 0) {
                // Break block
                let blockId = getBlockGlobal(targetX, targetY, targetZ);
                handleBlockBreak(targetX, targetY, targetZ, blockId);
            } else if (e.button === 2) {
            // The block break logic has been moved to handleBlockBreak

                // Interact with block
                let targetBlockId = getBlockGlobal(targetX, targetY, targetZ);
                
                // --- HOE: Till grass/dirt into tilled soil ---
                let heldItem = inventory.slots[inventory.activeSlot];
                if (heldItem && heldItem.id === BLOCKS.HOE) {
                    if (targetBlockId === BLOCKS.GRASS || targetBlockId === BLOCKS.DIRT) {
                        // Check block above is air (can't till under something)
                        let above = getBlockGlobal(targetX, targetY + 1, targetZ);
                        if (above === BLOCKS.AIR) {
                            setBlockGlobal(targetX, targetY, targetZ, BLOCKS.TILLED_SOIL);
                            playSound(350, 0.08);
                        }
                    }
                    return;
                }

                // --- SEEDS: Plant on tilled soil ---
                const SEED_TO_CROP = {
                    [BLOCKS.WHEAT_SEED]:  BLOCKS.WHEAT,
                    [BLOCKS.OATS_SEED]:   BLOCKS.OATS,
                    [BLOCKS.TOMATO_SEED]: BLOCKS.TOMATO,
                    [BLOCKS.CARROT]:      BLOCKS.CARROT,
                    [BLOCKS.POTATO]:      BLOCKS.POTATO,
                };
                if (heldItem && SEED_TO_CROP[heldItem.id] !== undefined) {
                    if (targetBlockId === BLOCKS.TILLED_SOIL) {
                        // Check block above tilled soil is air
                        let aboveTilled = getBlockGlobal(targetX, targetY + 1, targetZ);
                        if (aboveTilled === BLOCKS.AIR) {
                            let cropId = SEED_TO_CROP[heldItem.id];
                            // Place seedling block (starts as a tiny seedling)
                            setBlockGlobal(targetX, targetY + 1, targetZ, cropId);
                            // Track growth: progress 0-100, stage 0=seedling 1=young 2=mature
                            let cropKey = `${targetX},${targetY + 1},${targetZ}`;
                            window.cropGrowth[cropKey] = { progress: 0, stage: 0, cropId };
                            saveCropGrowth();
                            // Rebuild chunk so seedling renders at correct scale immediately
                            let cx = Math.floor(targetX / 16);
                            let cz = Math.floor((targetZ) / 16);
                            if (chunks[`${cx},${cz}`]) chunks[`${cx},${cz}`].buildMesh();
                            inventory.useActiveItem();
                            updateInventoryUI();
                            playLeafSound();
                        }
                    }
                    return;
                }

                if (targetBlockId === BLOCKS.WORKBENCH) {
                     craftingMode = 'workbench';
                     craftingMenu.style.display = 'block';
                     instructions.style.display = 'none';
                     document.getElementById('ui').style.pointerEvents = 'auto';
                     
                     try {
                         updateCraftingUI();
                     } catch(err) {
                         document.getElementById('debug-text').innerText = "CRAFT_ERR: " + err.message;
                     }
                     
                     ControlsUnlockWait();
                     return;
                }
                if (targetBlockId === BLOCKS.CHEST) {
                     craftingMode = 'chest';
                     openChest(targetX, targetY, targetZ);
                     return; // handled inside openChest
                }
                
                // Place block
                let slot = inventory.slots[inventory.activeSlot];
                if (!slot || slot.count <= 0) return;

                // Don't place non-placeable items (hoe, seeds, mature crops)
                // Mature crops (23-27) can't be placed directly — prevents harvest duplication exploit
                const NON_PLACEABLE = [BLOCKS.HOE, BLOCKS.WHEAT_SEED, BLOCKS.OATS_SEED, BLOCKS.TOMATO_SEED,
                    BLOCKS.WHEAT, BLOCKS.OATS, BLOCKS.TOMATO, BLOCKS.CARROT, BLOCKS.POTATO];
                if (NON_PLACEABLE.includes(slot.id)) return;
                
                let bx = Math.floor(point.x + normal.x * 0.5);
                let by = Math.floor(point.y + normal.y * 0.5);
                let bz = Math.floor(point.z + normal.z * 0.5);
                
                // If we're placing into a water block, replace it directly
                let destBlock = getBlockGlobal(bx, by, bz);
                if (destBlock !== BLOCKS.WATER) {
                    // Also check if targeted face belongs to a water block — place INTO it
                    let wx = Math.floor(point.x - normal.x * 0.5);
                    let wy = Math.floor(point.y - normal.y * 0.5);
                    let wz = Math.floor(point.z - normal.z * 0.5);
                    let facedBlock = getBlockGlobal(wx, wy, wz);
                    if (facedBlock === BLOCKS.WATER) {
                        bx = wx; by = wy; bz = wz; // place INTO the water block
                    }
                }
                
                // Prevent placing inside player
                let px = Math.floor(camera.position.x);
                let py = Math.floor(camera.position.y);
                let pz = Math.floor(camera.position.z);
                if (bx === px && bz === pz && (by === py || by === py-1)) return;
                
                let placedId = inventory.useActiveItem();
                if(placedId !== BLOCKS.AIR) {
                    // Store furnace orientation BEFORE setting block so mesh builder sees it
                    if (placedId === BLOCKS.FURNACE) {
                        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                        fwd.y = 0;
                        if (Math.abs(fwd.x) > Math.abs(fwd.z)) {
                            // Dominant X axis: player faces +X or -X
                            window.furnaceOrientations[`${bx},${by},${bz}`] = fwd.x > 0 ? 1 : 0; 
                        } else {
                            // Dominant Z axis: player faces +Z or -Z
                            window.furnaceOrientations[`${bx},${by},${bz}`] = fwd.z > 0 ? 5 : 4; 
                        }
                        localStorage.setItem('sandbox3d_furnace_orient', JSON.stringify(window.furnaceOrientations));
                    }
                    
                    setBlockGlobal(bx, by, bz, placedId);
                    updateInventoryUI();
                    playSound(200, 0.1); 
                }
            }
        }
    });

    window.addEventListener('resize', onWindowResize);
}

function setBlockGlobal(bx, by, bz, blockId) {
    // Correct chunk/local coordinate mapping for negative world coords
    let cx = Math.floor(bx / CHUNK_SIZE);
    let cz = Math.floor(bz / CHUNK_SIZE);
    // Use modulo to always get 0..CHUNK_SIZE-1 (JS % can be negative)
    let lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    if (!window.modifiedBlocks) window.modifiedBlocks = {};
    window.modifiedBlocks[`${bx},${by},${bz}`] = blockId;
    localStorage.setItem('sandbox3d_mods', JSON.stringify(window.modifiedBlocks));
    
    let chunk = chunks[`${cx},${cz}`];
    if (chunk) {
        chunk.data[chunk.getIndex(lx, by, lz)] = blockId;
        chunk.buildMesh();
        
        // Rebuild neighboring chunks if block is on a chunk edge
        // so water faces appear/disappear correctly across boundaries
        if (lx === 0)            { let nc = chunks[`${cx-1},${cz}`]; if (nc) nc.buildMesh(); }
        if (lx === CHUNK_SIZE-1) { let nc = chunks[`${cx+1},${cz}`]; if (nc) nc.buildMesh(); }
        if (lz === 0)            { let nc = chunks[`${cx},${cz-1}`]; if (nc) nc.buildMesh(); }
        if (lz === CHUNK_SIZE-1) { let nc = chunks[`${cx},${cz+1}`]; if (nc) nc.buildMesh(); }
    }
}

function getBlockGlobal(bx, by, bz) {
    // Correct chunk mapping for negative coords
    let cx = Math.floor(bx / CHUNK_SIZE);
    let cz = Math.floor(bz / CHUNK_SIZE);
    let lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let chunk = chunks[`${cx},${cz}`];
    if(chunk) return chunk.getBlock(lx, by, lz);
    return by <= 58 ? BLOCKS.WATER : BLOCKS.AIR;
}
window.getBlockGlobal = getBlockGlobal;

// Find surface Y at a world X/Z position (top solid non-water block)
function getSurfaceY(wx, wz) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        let b = getBlockGlobal(wx, y, wz);
        if (b !== BLOCKS.AIR && b !== BLOCKS.WATER) {
            return y + 1; // stand ON TOP of this block
        }
    }
    return 65; // fallback above water level
}

// Spawn mobs at valid surface positions (not floating in air, not underground)
function spawnMobsOnSurface(scene) {
    // This is now replaced by chunk-based spawning, but kept for init if needed
}

function spawnOneMobInChunk(cx, cz) {
    // --- RESIDENT PRIORITY SPAWNING (100% chance if houses exist) ---
    let houses = getHouseCentersInChunk(cx, cz);
    if (houses.length > 0) {
        for (let house of houses) {
            for (let i = 0; i < 2; i++) {
                // Fixed separation ensures coordinate hash variety, forcedGender ensures parity
                let sx = house.x + (i === 0 ? 1.2 : -1.2);
                let sz = house.z + (i === 0 ? 1.2 : -1.2);
                let floorY = house.y + 1;

                // Pass i%2 as forcedGender (6th arg)
                let mob = new Mob(scene, getBlockGlobal, 'villager', sx, sz, i % 2);
                mob.homePos.set(house.x + 0.5, floorY, house.z + 0.5);
                mob.group.position.set(sx, floorY + 0.7, sz);
            }
        }
    }

    // --- WILD ANIMAL SPAWNING (Subject to random chance and limits) ---
    if (Math.random() > 0.25) return;
    if (mobsList.length > 50) return;

    // Pick a random block within chunk for wild mob
    let x = Math.floor(Math.random() * 16);
    let z = Math.floor(Math.random() * 16);
    let wx = cx * 16 + x;
    let wz = cz * 16 + z;
    let wy = getSurfaceY(wx, wz);

    const pool = ['rabbit', 'deer', 'deer', 'deer', 'crow', 'crow', 'sparrow', 'sparrow', 'cormorant'];
    let type = pool[Math.floor(Math.random() * pool.length)];
    
    let mob = new Mob(scene, getBlockGlobal, type, wx, wz);
    
    if (mob.isBird) {
        mob.group.position.set(wx + 0.5, wy + 25 + Math.random() * 10, wz + 0.5);
    } else {
        let offset = type === 'deer' ? 0.8 : 0.5;
        mob.group.position.set(wx + 0.5, wy + offset, wz + 0.5);
    }
}

function updateDynamicSpawning() {
    // ONLY check for despawn of distant mobs
    for (let i = mobsList.length - 1; i >= 0; i--) {
        let mob = mobsList[i];
        let d = mob.group.position.distanceTo(camera.position);
        if (d > 140) {
            scene.remove(mob.group);
            mobsList.splice(i, 1);
        }
    }
}

// Complete AABB Box checking logic
function checkAABB(px, py, pz) {
    const W = 0.3; // half-width horizontal
    const HU = 0.2; // height up
    const HD = 1.6; // height down
    
    let minX = px - W, maxX = px + W;
    let minY = py - HD, maxY = py + HU;
    let minZ = pz - W, maxZ = pz + W;
    
    // Correct block-range: every block whose cube overlaps [min, max]
    let startX = Math.floor(minX), endX = Math.floor(maxX);
    let startY = Math.floor(minY), endY = Math.floor(maxY);
    let startZ = Math.floor(minZ), endZ = Math.floor(maxZ);
    
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            for (let z = startZ; z <= endZ; z++) {
                let blockId = getBlockGlobal(x, y, z);
                // Ignore AIR, WATER, FLORA (13-15), CROPS (23-27)
                // NOTE: TILLED_SOIL has full collision so player doesn't fall through
                if (blockId !== BLOCKS.AIR && blockId !== BLOCKS.WATER
                    && !(blockId >= 13 && blockId <= 15)
                    && !(blockId >= 23 && blockId <= 27)) return true;
            }
        }
    }
    return false;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function initClouds() {
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshLambertMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    
    for (let i = 0; i < 100; i++) {
        const mesh = new THREE.Mesh(cloudGeo, cloudMat);
        
        // Much smaller, flat shapes (reduced by 5x)
        const w = 12 + Math.random() * 16; 
        const h = 1.2;
        const d = 6 + Math.random() * 8;
        mesh.scale.set(w, h, d);
        
        mesh.position.set(
            (Math.random() - 0.5) * 1200, 
            110, // Fixed height for a single layer
            (Math.random() - 0.5) * 1200
        );
        
        mesh.userData = { ignoreRaycast: true };
        scene.add(mesh);
        clouds.push({
            mesh: mesh,
            vx: 1 + Math.random() * 1.5,
            vz: (Math.random() - 0.5) * 0.3
        });
    }
}

function updateClouds(delta, px, pz) {
    const range = 800;
    clouds.forEach(c => {
        c.mesh.position.x += c.vx * delta;
        c.mesh.position.z += c.vz * delta;
        
        // Wrap around player
        if (c.mesh.position.x - px > range) c.mesh.position.x -= range * 2;
        if (c.mesh.position.x - px < -range) c.mesh.position.x += range * 2;
        if (c.mesh.position.z - pz > range) c.mesh.position.z -= range * 2;
        if (c.mesh.position.z - pz < -range) c.mesh.position.z += range * 2;
    });
}

function updateDynamicChunks() {
    if (!camera) return;
    let px = Math.floor(camera.position.x / CHUNK_SIZE);
    let pz = Math.floor(camera.position.z / CHUNK_SIZE);

    // If player moved to a new chunk, recalculate render queue
    if (px !== lastPlayerChunkX || pz !== lastPlayerChunkZ) {
        lastPlayerChunkX = px;
        lastPlayerChunkZ = pz;
        
        chunkQueue = [];
        for (let cx = px - VIEW_DISTANCE; cx <= px + VIEW_DISTANCE; cx++) {
            for (let cz = pz - VIEW_DISTANCE; cz <= pz + VIEW_DISTANCE; cz++) {
                let dist = Math.hypot(cx - px, cz - pz);
                if (dist <= VIEW_DISTANCE) {
                    if (!chunks[`${cx},${cz}`]) {
                        chunkQueue.push({ cx, cz, dist });
                    }
                }
            }
        }
        // Sort closest first
        chunkQueue.sort((a, b) => a.dist - b.dist);

        // Unload chunks far away
        const unloadDist = VIEW_DISTANCE + 1.5;
        for (let key in chunks) {
            let chunk = chunks[key];
            if (Math.hypot(chunk.chunkX - px, chunk.chunkZ - pz) > unloadDist) {
                chunk.dispose();
                delete chunks[key];
            }
        }
    }

    // Process chunk queue (1 per frame to prevent lag)
    if (chunkQueue.length > 0) {
        let job = chunkQueue.shift();
        if (!chunks[`${job.cx},${job.cz}`]) {
            chunks[`${job.cx},${job.cz}`] = new Chunk(job.cx, job.cz, scene, materials);
            spawnOneMobInChunk(job.cx, job.cz);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    let delta = (time - prevTime) / 1000;
    if (delta > 0.1) delta = 0.1; // Safety clamp to prevent physics "explosions"
    
    // Process infinite world generation
    updateDynamicChunks();

    // Furnace ticking (Fast-forward if offline)
    let now = Date.now();
    if (now - lastFurnaceTickTime >= 1000) {
        let ticks = Math.floor((now - lastFurnaceTickTime) / 1000);
        if (ticks > 86400) ticks = 86400; // max 1 day sim
        lastFurnaceTickTime += ticks * 1000;
        
        let changed = false;
        for (let key in window.furnaces) {
             let f = window.furnaces[key];
             for(let i=0; i < ticks; i++) {
                 let outId = f.input?.id === BLOCKS.SAND ? BLOCKS.GLASS : (f.input?.id === BLOCKS.CLAY ? BLOCKS.BRICK : null);
                 let validSmelt = outId && (!f.output || (f.output.id === outId && f.output.count < 64));
                 
                 if (validSmelt && f.fuelTicksLeft <= 0 && f.fuel && (f.fuel.id === BLOCKS.WOOD || f.fuel.id === BLOCKS.PLANKS)) {
                     f.fuel.count--;
                     if (f.fuel.count <= 0) f.fuel = null;
                     f.fuelTicksLeft = 15; // 15 seconds per fuel
                     changed = true;
                 }
                 
                 if (validSmelt && f.fuelTicksLeft > 0) {
                     f.smeltProgress++;
                     changed = true;
                     if (f.smeltProgress >= 5) {
                         f.smeltProgress = 0;
                         f.input.count--;
                         if (f.input.count <= 0) f.input = null;
                         if (!f.output) f.output = {id: outId, count: 1};
                         else f.output.count++;
                     }
                 } else {
                     if (f.smeltProgress > 0) { f.smeltProgress = 0; changed = true; }
                 }
                 
                 if (f.fuelTicksLeft > 0) {
                     f.fuelTicksLeft--;
                     changed = true;
                     if (f.fuelTicksLeft === 0) f.smeltProgress = 0; 
                 }
                 
                 if (!validSmelt && f.fuelTicksLeft <= 0) break;
             }
        }
        if (changed) { 
            saveFurnaces(); 
            if (currentFurnaceKey && document.getElementById('furnace-ui').style.display === 'block') {
                updateFurnaceUI(); 
            }
        }
    }

    // --- WORLD SIMULATION (Continues even if UI is open) ---
    
    // Update Day/Night Cycle
    let isDay = Math.sin(gameTime) > 0;
    let speed = isDay ? (Math.PI / 900) : (Math.PI / 600); 
    gameTime += delta * speed;
    let sunAngle = gameTime;
    let dayNess = Math.sin(sunAngle); // 1 = noon, 0 = dusk, -1 = midnight

    // Season Logic (every 10 days)
    totalGameDays = (gameTime / (Math.PI * 2));
    currentSeason = Math.floor((totalGameDays / 10) % 4);
    seasonLerp = (totalGameDays % 10) / 10;

    // Seasonal Material Colors
    if (materials[BLOCKS.GRASS]) {
        const seasonColors = [
            { g: new THREE.Color(0x66cc66), l: new THREE.Color(0xffaac0) }, // Spring (Pink Blossom)
            { g: new THREE.Color(0x50b450), l: new THREE.Color(0x287828) }, // Summer (Lush)
            { g: new THREE.Color(0xb09040), l: new THREE.Color(0xe05010) }, // Autumn (Golden/Orange)
            { g: new THREE.Color(0xffffff), l: new THREE.Color(0xe05010) }  // Winter (Snow on ground, Gold leaves)
        ];
        let c1 = seasonColors[currentSeason];
        let c2 = seasonColors[(currentSeason + 1) % 4];
        
        // Transition only at last day of season
        let factor = Math.max(0, (seasonLerp - 0.9) * 10); 
        materials[BLOCKS.GRASS].color.copy(c1.g).lerp(c2.g, factor);
        materials[100].color.copy(c1.g).lerp(c2.g, factor); // side
        materials[BLOCKS.LEAVES].color.copy(c1.l).lerp(c2.l, factor);
        
        // Flora colors (flowers & tall grass)
        if (materials[BLOCKS.TALL_GRASS]) {
            materials[BLOCKS.TALL_GRASS].color.copy(c1.g).lerp(c2.g, factor);
        }
        if (materials[BLOCKS.FLOWER_RED]) {
             if (currentSeason === SEASONS.WINTER) materials[BLOCKS.FLOWER_RED].visible = false;
             else {
                 materials[BLOCKS.FLOWER_RED].visible = true;
                 // Slight tint for flowers too
                 materials[BLOCKS.FLOWER_RED].color.copy(new THREE.Color(0xffffff)).lerp(c2.g, factor * 0.3);
             }
        }
        if (materials[BLOCKS.FLOWER_YELLOW]) {
             materials[BLOCKS.FLOWER_YELLOW].visible = (currentSeason !== SEASONS.WINTER);
        }
        if (materials[BLOCKS.SNOW_LAYER]) {
             // Keep snow layer pure white
             materials[BLOCKS.SNOW_LAYER].color.set(0xffffff);
        }
    }

    // Update clouds
    updateClouds(delta, camera.position.x, camera.position.z);
    
    // Sky bodies
    let sunDist = 250;
    let tilt = 80; 
    let sunPos = new THREE.Vector3(
        Math.cos(sunAngle) * sunDist, 
        Math.sin(sunAngle) * sunDist, 
        tilt
    );
    
    // Update Directional Light (Sun/Shadow caster)
    dirLight.position.copy(sunPos).add(camera.position);
    if (window.shadowTarget) {
        window.shadowTarget.position.copy(camera.position);
    }
    
    // Dim sun as it sets
    dirLight.intensity = Math.max(0, dayNess) * 0.8 + 0.1;

    const baseSunColor = new THREE.Color(0xffeb3b);
    const sunsetSunColor = new THREE.Color(0xff8a65);
    let colorFac = Math.pow(1.0 - Math.abs(dayNess), 3); 
    sunMesh.material.color.copy(baseSunColor).lerp(sunsetSunColor, colorFac);
    
    sunMesh.position.copy(sunPos).add(camera.position);
    moonMesh.position.set(-sunPos.x, -sunPos.y, -sunPos.z).add(camera.position);
    starsMesh.position.copy(camera.position);

    sunMesh.material.opacity = Math.max(0, Math.min(1, dayNess * 5));
    moonMesh.material.opacity = Math.max(0, Math.min(1, -dayNess * 5));
    // Stars fade out as rain/storm intensity increases
    starsMesh.material.opacity = (dayNess > 0) ? 0 : (Math.min(1.0, -dayNess * 2.0) * (1.0 - rainIntensity));

    window.dayNess = dayNess;
    window.getVillagePartAtWorld = getVillagePartAtWorld;
    window.getSurfaceY = getSurfaceY;
    
    // --- SHELTER DETECTION (Shared) ---
    let wx = Math.floor(camera.position.x);
    let wz = Math.floor(camera.position.z);
    let surfaceY = getSurfaceY(wx, wz);
    let topBlock = getBlockGlobal(wx, surfaceY - 1, wz);
    let currentDepth = (surfaceY - 1) - camera.position.y;
    
    let isSheltered = false;
    let isDeep = (currentDepth > 8);
    
    if (currentDepth > 0 && topBlock !== BLOCKS.LEAVES) isSheltered = true;
    if (!isSheltered && !isDeep) {
        for (let y = Math.floor(camera.position.y) + 1; y < Math.floor(camera.position.y) + 20; y++) {
            let b = getBlockGlobal(wx, y, wz);
            if (b !== BLOCKS.AIR && b !== BLOCKS.WATER && b !== BLOCKS.LEAVES) { isSheltered = true; break; }
        }
    }

    // Weather (Rarely change weather)
    updateRain(delta, camera.position, isSheltered);
    // Lower probability: 2% in summer, 8% in winter
    let weatherChance = (currentSeason === SEASONS.WINTER) ? 0.08 : 0.02; 
    if (time - lastWeatherChange > 60000) { // Check every minute
        let rolled = Math.random();
        if (rolled < weatherChance) { 
            // If it's raining, 2-8% chance to STOP. 
            // If it's NOT raining, we only start if the roll is even lower (0.5% - 2% chance to START)
            let startChance = weatherChance * 0.25; 
            if (!isRaining) { 
                if (rolled < startChance) {
                    isRaining = true; 
                    isStorming = Math.random() < 0.3; 
                }
            } else { 
                // Always stop if we hit the toggle roll while raining
                isRaining = false; 
                isStorming = false; 
            }
            if (isRaining) initRainAudio();
        }
        lastWeatherChange = time;
    }

    // (Unified Lighting block removed to restore original logic below)

    // Storm Lightning Logic
    if (isStorming && isRaining) {
        if (time > nextLightningTime) {
            lightningLevel = 1.0;
            setTimeout(() => { lightningLevel = 0.8; }, 50);
            setTimeout(() => { lightningLevel = 1.0; }, 100);
            let delay = 500 + Math.random() * 2500;
            setTimeout(() => { playThunder(delay / 1000); }, delay);
            nextLightningTime = time + 5000 + Math.random() * 15000;
        }
    }
    if (lightningLevel > 0) lightningLevel -= delta * 5.0; 
    if (lightningLevel < 0.01) lightningLevel = 0;

    // Atmosphere
    let stormGloom = isStorming ? 0.3 : 1.0;
    let winterGloom = (currentSeason === SEASONS.WINTER) ? 0.8 : 1.0;
    let gloom = (1.0 - (rainIntensity * 0.70)) * stormGloom * winterGloom;
    
    // Modulate lightning for player view
    let viewLightning = lightningLevel;
    if (isDeep) viewLightning = 0;
    else if (isSheltered) viewLightning *= 0.15; // faint flash entering building

    ambientLight.intensity = (0.4 * gloom) + (viewLightning * 2.0);
    dirLight.intensity = (0.8 * gloom) + (viewLightning * 1.5);
    
    const dayColor = new THREE.Color(0x87CEEB);
    const nightColor = new THREE.Color(0x0a0a1a);
    // Smoothly transition between day and night colors around the horizon (lerp)
    // Widened window (0.3 instead of 0.1) for a much longer, more cinematic sunset
    let skyTransition = Math.max(0, Math.min(1, (dayNess + 0.3) / 0.6));
    const baseFogColor = nightColor.clone().lerp(dayColor, skyTransition);
    // Rainy fog now adjusts based on dayNess and Season
    let rainFogHex = isStorming ? 0x111122 : 0x222233;
    if (currentSeason === SEASONS.WINTER) rainFogHex = 0xeeeeff; // White-ish winter fog
    if (dayNess <= 0) {
        rainFogHex = isStorming ? 0x020205 : 0x080810; // Dark night rain
        if (currentSeason === SEASONS.WINTER) rainFogHex = 0x0a0a15;
    }
    
    const rainFogColor = new THREE.Color(rainFogHex);
    
    // --- INTEGRATED VISUALS (Weather + Underwater) ---
    let cameraBlock = getBlockGlobal(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
    let cameraInWater = cameraBlock === BLOCKS.WATER;

    if (cameraInWater) {
        scene.background = new THREE.Color(0x103090);
        if (scene.fog) {
            scene.fog.color.set(0x103090);
            scene.fog.near = 0.1;
            scene.fog.far = 15;
        }
    } else {
        // RESTORED ORIGINAL GITHUB LOGIC
        const lightningColor = new THREE.Color(0xffffff);
        let finalFogColor = baseFogColor.clone().lerp(rainFogColor, rainIntensity);
        if (viewLightning > 0) finalFogColor.lerp(lightningColor, viewLightning * 0.8);
        
        scene.fog.color.copy(finalFogColor);
        scene.background.copy(scene.fog.color);
        scene.fog.near = 10;
        // Adaptive distance from original code
        scene.fog.far = 100 - (rainIntensity * 40) - (isStorming ? 20 : 0) - (currentSeason === SEASONS.WINTER ? 10 : 0);
    }

    // Mobs
    for (let idx = 0; idx < mobsList.length; idx++) {
        try { 
            mobsList[idx].update(delta, camera.position); 
        } catch(e) {
            console.error("Mob update error:", e, mobsList[idx]);
        }
    }

    // Audio volume sync
    ambientDayTracks.forEach((track, idx) => {
        if (idx === currentDayTrackIndex) track.volume = Math.max(0, Math.min(1, dayNess * 0.15));
        else track.volume = 0;
    });
    ambientNightAudio.volume = Math.max(0, Math.min(1, -dayNess * 0.15));
    wasDay = (dayNess > 0);

    // Persistence
    if (Math.floor(time / 2000) !== Math.floor(prevTime / 2000)) {
        localStorage.setItem('sandbox3d_gameTime', gameTime);
        localStorage.setItem('sandbox3d_weather', JSON.stringify({isRaining: isRaining, isStorming: isStorming}));
        const isNight = gameTime > Math.PI || gameTime < 0;
    const nightFactor = Math.abs(Math.sin(gameTime));
    const timeOfDay = (gameTime > Math.PI / 4 && gameTime < 3 * Math.PI / 4) ? 'ранок' :
                     (gameTime >= 3 * Math.PI / 4 && gameTime < 5 * Math.PI / 4) ? 'день' :
                     (gameTime >= 5 * Math.PI / 4 && gameTime < 7 * Math.PI / 4) ? 'вечір' : 'ніч';

    window.worldState = {
        timeOfDay,
        weather: isStorming ? 'хуртовина' : (isRaining ? 'дощ' : 'ясно'),
        season: currentSeason === 0 ? 'весна' : (currentSeason === 1 ? 'літо' : (currentSeason === 2 ? 'осінь' : 'зима'))
    };

    updateDynamicSpawning();
    }

    // --- CROP GROWTH TICK (every 10 real seconds) ---
    // Stage 0 (seedling) → Stage 1 (young): progress 0→33 (10 ticks = ~1.7 min)
    // Stage 1 (young)    → Stage 2 (mature): progress 33→66 (10 more ticks)
    // Stage 2 (mature)   fully grown:         progress 66→100 (10 more ticks)
    // Total: 30 ticks = ~5 minutes real time
    _cropGrowthTimer += delta;
    if (_cropGrowthTimer >= 10.0) {
        _cropGrowthTimer -= 10.0;
        let cropChanged = false;
        for (let key in window.cropGrowth) {
            let entry = window.cropGrowth[key];
            if (entry.progress < 100) {
                let oldStage = entry.stage || 0;
                entry.progress = Math.min(100, entry.progress + 3.34);
                // Derive stage from progress: 0-33 seedling, 33-66 young, 66+ mature
                let newStage = entry.progress >= 66 ? 2 : (entry.progress >= 33 ? 1 : 0);
                entry.stage = newStage;
                cropChanged = true;
                // If stage changed, rebuild chunk so mesh updates immediately
                if (newStage !== oldStage) {
                    let parts = key.split(',');
                    let bx = parseInt(parts[0]), bz = parseInt(parts[2]);
                    let cx = Math.floor(bx / 16), cz = Math.floor(bz / 16);
                    if (chunks[`${cx},${cz}`]) chunks[`${cx},${cz}`].buildMesh();
                }
            }
        }
        if (cropChanged) saveCropGrowth();
    }

    // --- PLAYER INPUT & INTERACTION (Only if locked) ---
    if (controls.isLocked === true && !isChatOpen) {
        // Block looking feedback
        raycaster.setFromCamera(center, camera);
        let collidable = scene.children.filter(obj => !obj.userData.ignoreRaycast);
        let intersects = raycaster.intersectObjects(collidable);
        if (intersects.length > 0 && intersects[0].distance <= 8) {
            let p = intersects[0].point;
            if (intersects[0].face) {
                let n = intersects[0].face.normal;
                let tx = Math.floor(p.x - n.x * 0.1);
                let ty = Math.floor(p.y - n.y * 0.1);
                let tz = Math.floor(p.z - n.z * 0.1);
                let tid = getBlockGlobal(tx, ty, tz);
                // --- CROP GROWTH TOOLTIP ---
                const CROP_IDS = [BLOCKS.WHEAT, BLOCKS.OATS, BLOCKS.TOMATO, BLOCKS.CARROT, BLOCKS.POTATO];
                if (CROP_IDS.includes(tid)) {
                    let cropKey = `${tx},${ty},${tz}`;
                    let growData = window.cropGrowth[cropKey];
                    if (growData && growData.progress < 100) {
                        let stageNames = ['насінина 🌱', 'молоде 🌿', 'дозріває 🌾'];
                        let stageName = stageNames[growData.stage || 0];
                        // Seconds per 3.34 progress = 10s, so remaining = (100 - progress) / 3.34 * 10
                        let secRemaining = Math.ceil((100 - growData.progress) / 3.34) * 10;
                        let mins = Math.floor(secRemaining / 60);
                        let secs = secRemaining % 60;
                        let timeStr = mins > 0 ? `${mins}хв ${secs}с` : `${secs}с`;
                        document.getElementById('debug-text').innerText =
                            `${BLOCK_NAMES[tid]} [${stageName}] — залишилось: ${timeStr}`;
                    } else if (growData && growData.progress >= 100) {
                        document.getElementById('debug-text').innerText =
                            `${BLOCK_NAMES[tid]} [зріле ✅] — готово до збору!`;
                    } else {
                        document.getElementById('debug-text').innerText = `${BLOCK_NAMES[tid]} [зріле ✅]`;
                    }
                } else {
                    document.getElementById('debug-text').innerText = tid !== BLOCKS.AIR ? `Looking at: ${BLOCK_NAMES[tid]}` : "";
                }
            }
        }

        // --- DROPPED ITEMS PHYSICS & PICKUP ---
        if (window.droppedItems) {
            for (let i = droppedItems.length - 1; i >= 0; i--) {
                let drop = droppedItems[i];
                if (!drop.mesh) continue;
                
                // Physics processing
                drop.vy -= 10.0 * delta; // Gravity
                drop.mesh.position.x += drop.vx * delta;
                drop.mesh.position.y += drop.vy * delta;
                drop.mesh.position.z += drop.vz * delta;
                
                // Floor collision (simple center check)
                let dropBx = Math.floor(drop.mesh.position.x);
                let dropBy = Math.floor(drop.mesh.position.y - 0.2); // slight offset for sprite
                let dropBz = Math.floor(drop.mesh.position.z);
                let dropFloorId = getBlockGlobal(dropBx, dropBy, dropBz);
                
                // If it's hitting a solid block (not AIR, WATER, FLORA, CROPS)
                const isSolid = dropFloorId !== BLOCKS.AIR && dropFloorId !== BLOCKS.WATER 
                    && !(dropFloorId >= 13 && dropFloorId <= 15) && !(dropFloorId >= 23 && dropFloorId <= 27);
                
                if (isSolid) {
                    drop.mesh.position.y = dropBy + 1.2; // sit fully on top of block
                    drop.vy = 0;
                    drop.vx *= Math.max(0, 1.0 - 5.0 * delta); // friction
                    drop.vz *= Math.max(0, 1.0 - 5.0 * delta); // friction
                }
                
                drop.tick += delta;
                
                // Hover animation
                let hoverOffset = Math.sin(drop.tick * 3) * 0.1;
                // Since sprite always faces camera, we don't need to rotate it visually
                // Only bob it up and down slightly if it's resting
                if (isSolid) drop.mesh.position.y += hoverOffset * delta;
                
                // Pickup check
                let dx = camera.position.x - drop.mesh.position.x;
                let dy = camera.position.y - 0.5 - drop.mesh.position.y; // player body center
                let dz = camera.position.z - drop.mesh.position.z;
                let distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < 4.0) { // attract within 2 blocks
                    let dist = Math.sqrt(distSq);
                    if (dist < 1.0) {
                        // Picked up!
                        inventory.addItem(drop.id, drop.count);
                        updateInventoryUI();
                        playSound(300, 0.05); // pop sound
                        scene.remove(drop.mesh);
                        droppedItems.splice(i, 1);
                    } else {
                        // Attract to player
                        let attractSpeed = 5.0 * delta;
                        drop.vx = (dx / dist) * attractSpeed * 30; // override velocity
                        drop.vy = (dy / dist) * attractSpeed * 30;
                        drop.vz = (dz / dist) * attractSpeed * 30;
                    }
                }
            }
        }

        // Physics
        let headBlock = getBlockGlobal(Math.floor(camera.position.x), Math.floor(camera.position.y - 0.2), Math.floor(camera.position.z));
        let feetBlock = getBlockGlobal(Math.floor(camera.position.x), Math.floor(camera.position.y - 1.7), Math.floor(camera.position.z));
        let cameraBlock = getBlockGlobal(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
        
        let inWater = headBlock === BLOCKS.WATER || feetBlock === BLOCKS.WATER;


        // Gravity / Buoyancy
        if (!flyMode) {
            if (inWater) {
                velocity.y -= 8 * delta;
                if (velocity.y < -3) velocity.y = -3;
                if (keys['Space']) { velocity.y += 20 * delta; if (velocity.y > 6) velocity.y = 6; }
            } else {
                velocity.y -= 25 * delta;
                if (velocity.y < -30) velocity.y = -30;
            }
        } else {
            if (keys['Space']) velocity.y = 12.0;
            else if (keys['ShiftLeft']) velocity.y = -12.0;
            else velocity.y = 0;
        }

        // Movement
        const camQuat = camera.quaternion;
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(camQuat); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
        
        let speedMult = (isSprinting ? 1.6 : 1.0) * (flyMode ? 2.5 : 1.0) * (inWater && !flyMode ? 0.5 : 1.0);
        let moveVec = new THREE.Vector3(0,0,0);
        if (moveForward) moveVec.addScaledVector(forward, 4.5 * speedMult);
        if (moveBackward) moveVec.addScaledVector(forward, -4.5 * speedMult);
        if (moveRight) moveVec.addScaledVector(right, 4.5 * speedMult);
        if (moveLeft) moveVec.addScaledVector(right, -4.5 * speedMult);

        let preX = camera.position.x, preZ = camera.position.z;
        let dy = velocity.y * delta, dx = moveVec.x * delta, dz = moveVec.z * delta;

        // Simple sweep Y
        if (!checkAABB(camera.position.x, camera.position.y + dy, camera.position.z)) {
            camera.position.y += dy;
        } else { if (dy < 0) canJump = true; velocity.y = 0; }
        
        // Simple sweep X/Z
        if (!checkAABB(camera.position.x + dx, camera.position.y, camera.position.z)) camera.position.x += dx;
        if (!checkAABB(camera.position.x, camera.position.y, camera.position.z + dz)) camera.position.z += dz;

        // Footsteps
        const isMoving = moveForward || moveBackward || moveLeft || moveRight;
        if (!flyMode && canJump && isMoving && !inWater) {
            if (!window.footstepTimer) window.footstepTimer = 0.3;
            window.footstepTimer -= delta;
            if (window.footstepTimer <= 0) {
                let p = 150 + (feetBlock === BLOCKS.WOOD ? 100 : (feetBlock === BLOCKS.SAND ? -50 : 0));
                playSound(p + Math.random()*20, 0.03);
                window.footstepTimer = 0.35;
            }
        }
        
        tickWind(delta);

        _posSaveTimer -= delta;
        if (_posSaveTimer <= 0) {
            localStorage.setItem('sandbox3d_pos', JSON.stringify({x:camera.position.x, y:camera.position.y, z:camera.position.z}));
            _posSaveTimer = 3.0;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

window.modifiedBlocks = {};
window.furnaceOrientations = {};
// cropGrowth: key = "wx,wy,wz" -> { progress: 0..100, cropId } (planted seeds growing)
window.cropGrowth = {};
let currentSeed = 1337;
let _posSaveTimer = 3.0;
let _cropGrowthTimer = 0; // accumulates time, ticks every 10 seconds

document.addEventListener('DOMContentLoaded', () => {
    let savedSeed = localStorage.getItem('sandbox3d_seed');
    let btnLoad = document.getElementById('btn-load-world');
    if (savedSeed) {
        btnLoad.disabled = false;
    }
    
    document.getElementById('btn-new-world').onclick = (e) => {
        e.stopPropagation();
        currentSeed = Math.floor(Math.random() * 1000000);
        localStorage.setItem('sandbox3d_seed', currentSeed.toString());
        
        window.modifiedBlocks = {};
        localStorage.setItem('sandbox3d_mods', JSON.stringify({}));
        
        localStorage.removeItem('sandbox3d_gameTime'); // Reset time
        localStorage.removeItem('sandbox3d_weather'); // Reset weather
        gameTime = Math.PI / 4; // Start at morning
        isRaining = false;
        isStorming = false;
        rainIntensity = 0;
        
        window.chests = {};
        localStorage.setItem('sandbox3d_chests', JSON.stringify({}));
        
        window.furnaces = {};
        window.furnaceOrientations = {};
        lastFurnaceTickTime = Date.now();
        saveFurnaces();
        localStorage.setItem('sandbox3d_furnace_orient', JSON.stringify({}));
        
        window.cropGrowth = {};
        localStorage.setItem('sandbox3d_crops', JSON.stringify({}));
        
        localStorage.removeItem('sandbox3d_pos'); // reset spawn position
        
        inventory.slots = Array(36).fill(null);
        inventory.slots[0] = { id: BLOCKS.WOOD, count: 10 };
        inventory.activeSlot = 0;
        
        startGame(null);
    };
    
    document.getElementById('btn-load-world').onclick = (e) => {
        e.stopPropagation();
        currentSeed = parseInt(localStorage.getItem('sandbox3d_seed'));
        let modData = localStorage.getItem('sandbox3d_mods');
        if (modData) {
            window.modifiedBlocks = JSON.parse(modData);
        } else {
            window.modifiedBlocks = {};
        }
        
        let chestData = localStorage.getItem('sandbox3d_chests');
        if (chestData) {
            window.chests = JSON.parse(chestData);
        } else {
            window.chests = {};
        }

        let furnaceDataRaw = localStorage.getItem('sandbox3d_furnaces');
        if (furnaceDataRaw) {
            let fdata = JSON.parse(furnaceDataRaw);
            window.furnaces = fdata.data || {};
            lastFurnaceTickTime = fdata.t || Date.now();
        } else {
            window.furnaces = {};
            lastFurnaceTickTime = Date.now();
        }

        let orientData = localStorage.getItem('sandbox3d_furnace_orient');
        if (orientData) {
            window.furnaceOrientations = JSON.parse(orientData);
        } else {
            window.furnaceOrientations = {};
        }
        
        let savedInv = localStorage.getItem('sandbox3d_inventory');
        if(savedInv) {
             inventory.slots = JSON.parse(savedInv);
        }

        let cropData = localStorage.getItem('sandbox3d_crops');
        if (cropData) {
            window.cropGrowth = JSON.parse(cropData);
            // Fast-forward offline growth (10s per tick, max 30 days offline = 259200 ticks)
            let offlineSec = Math.min((Date.now() - (parseInt(localStorage.getItem('sandbox3d_lastSave')) || Date.now())) / 1000, 259200);
            let offlineTicks = Math.floor(offlineSec / 10);
            if (offlineTicks > 0) {
                for (let key in window.cropGrowth) {
                    let entry = window.cropGrowth[key];
                    entry.progress = Math.min(100, entry.progress + offlineTicks * 3.34);
                    // Recalculate stage from updated progress
                    entry.stage = entry.progress >= 66 ? 2 : (entry.progress >= 33 ? 1 : 0);
                }
                saveCropGrowth();
            }
        } else {
            window.cropGrowth = {};
        }

        let savedPos = null;
        let posData = localStorage.getItem('sandbox3d_pos');
        if (posData) savedPos = JSON.parse(posData);

        startGame(savedPos);
    };
    
    // Player Name Handling
    const nameInput = document.getElementById('player-name-input');
    const savedName = localStorage.getItem('sandbox3d_playername');
    if (savedName) {
        nameInput.value = savedName;
        dialogueService.playerName = savedName;
    }
    nameInput.onchange = () => {
        localStorage.setItem('sandbox3d_playername', nameInput.value);
        dialogueService.playerName = nameInput.value;
    };

    // Dialogue UI Listeners
    document.getElementById('btn-dialogue-close').onclick = () => {
        dialogueService.closeDialogue();
        setTimeout(() => {
            if (!dialogueService.isUIOpen) controls.lock();
        }, 150);
    };
    document.getElementById('dialogue-input').onkeydown = (e) => {
        if (e.key === 'Enter') {
            const text = e.target.value;
            e.target.value = '';
            dialogueService.handleUserMessage(text);
        }
    };
});

function startGame(savedPos) {
    document.getElementById('menu-buttons').style.display = 'none';
    const warning = document.getElementById('menu-warning');
    warning.style.display = 'block';
    warning.innerText = "Generating world, please wait...";
    
    // Defer initialization to allow the browser to render the loading text
    setTimeout(() => {
        setSeed(currentSeed);
        warning.style.display = 'none';
        
        init();
        animate();
        
        // Restore saved position
        if (savedPos) {
            camera.position.set(savedPos.x, savedPos.y, savedPos.z);
        }
        
        // Safety ejection
        let failSafe = 20;
        while (checkAABB(camera.position.x, camera.position.y, camera.position.z) && failSafe > 0) {
            camera.position.y += 1.0;
            failSafe--;
        }
        
        const instructions = document.getElementById('instructions');
        instructions.style.display = 'flex';
        instructions.innerHTML = '<div style="background:rgba(0,0,0,0.7); padding:40px; border-radius:10px; text-align:center;"><h1>World Ready!</h1><p style="font-size:24px; cursor:pointer;" id="click-to-play">➡️ Click here or on the screen to play ⬅️</p></div>';
        
        // Allow the user to explicitly trigger the lock, bypassing browser security timeouts
        instructions.onclick = () => {
             controls.lock();
        };
    }, 100);
}
