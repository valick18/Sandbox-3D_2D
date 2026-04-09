import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { BLOCKS, materials, generateMaterials, icons } from './textures.js';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js';
import { Mob, mobsList } from './mobs.js';
import { setSeed } from './math.js';

let camera, scene, renderer, controls;
let chunks = {};

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

// ----------------- INVENTORY & CRAFTING -----------------
const BLOCK_NAMES = {1:'Grass', 2:'Dirt', 3:'Stone', 4:'Wood', 5:'Leaves', 6:'Sand', 7:'Planks', 8:'Meat', 9:'Workbench', 10:'Chest'};

class Inventory {
    constructor() {
        this.slots = Array(9).fill(null);
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

function updateCraftingUI() {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    
    // Helper to add recipes
    const addRecipe = (outId, outCount, reqId, reqCount) => {
        let btn = document.createElement('button');
        btn.innerHTML = `<span>Craft ${outCount}x <img src="${icons[outId]}" class="block-icon"></span> <span>Req: ${reqCount}x <img src="${icons[reqId]}" class="block-icon"></span>`;
        btn.disabled = inventory.countItem(reqId) < reqCount;
        btn.onclick = () => {
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

    // Advanced Recipes (Needs Workbench)
    if (craftingMode === 'workbench') {
        let hdr = document.createElement('div');
        hdr.innerHTML = '<br><b>Workbench Recipes:</b><hr>';
        hdr.style.color = '#fff';
        list.appendChild(hdr);
        
        addRecipe(BLOCKS.CHEST, 1, BLOCKS.PLANKS, 8);
    }
}

// ----------------- CHEST UI -----------------
window.chests = {};
let currentChestKey = null;

function saveChests() {
    localStorage.setItem('sandbox3d_chests', JSON.stringify(window.chests));
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
    for(let i=0; i<9; i++) {
        let div = document.createElement('div');
        div.className = 'player-slot';
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
let gameTime = Math.PI / 2; // start at noon
let dirLight, ambientLight;
let sunMesh, moonMesh, starsMesh;

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
    scene.fog = new THREE.Fog(0x87CEEB, 20, 60); // Depth fog
    
    // Lighting
    ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    scene.add(ambientLight);
    
    dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.y = 80; // Default high to avoid spawning underground immediately
    
    // Procedural Materials
    generateMaterials();
    
    // Sky Bodies
    const sunGeom = new THREE.SphereGeometry(8, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffdd, fog: false, transparent: true });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.userData = { ignoreRaycast: true };
    scene.add(sunMesh);
    
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false, transparent: true });
    moonMesh = new THREE.Mesh(sunGeom, moonMat);
    moonMesh.userData = { ignoreRaycast: true };
    scene.add(moonMesh);
    
    // Stars
    const starGeom = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<1500; i++) {
        starPos.push((Math.random()-0.5)*400, (Math.random()-0.5)*400, (Math.random()-0.5)*400);
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.8, transparent: true, opacity: 0});
    starsMesh = new THREE.Points(starGeom, starMat);
    starsMesh.userData = { ignoreRaycast: true };
    scene.add(starsMesh);
    
    // Build initial chunks (Expanded Map Size)
    for (let cx = -7; cx <= 7; cx++) {
        for (let cz = -7; cz <= 7; cz++) {
            chunks[`${cx},${cz}`] = new Chunk(cx, cz, scene, materials);
        }
    }

    // Spawn Mobs after chunks are built — find valid surface positions
    try {
        spawnMobsOnSurface(scene);
    } catch(e) {
        console.error('Mob spawn error:', e);
    }

    // Find a dry spawn point (not in water) within radius 40
    let spawnX = 0, spawnZ = 0;
    outer:
    for (let r = 0; r <= 40; r += 2) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / (r === 0 ? 1 : r + 1)) {
            let tx = r === 0 ? 0 : Math.round(Math.cos(angle) * r);
            let tz = r === 0 ? 0 : Math.round(Math.sin(angle) * r);
            let topBlock = BLOCKS.AIR;
            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                let b = getBlockGlobal(tx, y, tz);
                if (b !== BLOCKS.AIR) { topBlock = b; break; }
            }
            if (topBlock !== BLOCKS.WATER && topBlock !== BLOCKS.AIR) {
                spawnX = tx; spawnZ = tz; break outer;
            }
        }
    }
    // Snap player to that surface
    camera.position.x = spawnX + 0.5;
    camera.position.z = spawnZ + 0.5;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        if (getBlockGlobal(spawnX, y, spawnZ) !== BLOCKS.AIR) {
            camera.position.y = y + 3;
            break;
        }
    }

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    updateInventoryUI();
    
    controls = new PointerLockControls(camera, document.body);
    
    craftingMode = 'none'; 
    const craftingMenu = document.getElementById('crafting');

    const instructions = document.getElementById('instructions');
    
    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        if(audioCtx.state === 'suspended') audioCtx.resume();
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
        if (craftingMode === 'none') {
            instructions.style.display = 'flex';
        }
    });
    
    scene.add(controls.getObject());

    const onKeyDown = function (event) {
        if (event.repeat) {
            keys[event.code] = true;
            return;
        }
        keys[event.code] = true;
        
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'ShiftLeft':
                isSprinting = true;
                break;
            case 'Space':
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
                if (!controls.isLocked) return;
                // ... rest of E handler handled below ...
        }
    };

    const onKeyUp = function (event) {
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
                     } else if (targetBlockId === BLOCKS.WORKBENCH) {
                         craftingMode = 'workbench';
                     }
                }
                
                craftingMenu.style.display = 'block';
                document.getElementById('chest-ui').style.display = 'none';
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
        
        // Handle ESC to close UIs safely
        if (event.code === 'Escape' && craftingMode !== 'none') {
            craftingMode = 'none';
            craftingMenu.style.display = 'none';
            document.getElementById('chest-ui').style.display = 'none';
            document.getElementById('ui-backdrop').style.display = 'none';
            document.getElementById('ui').style.pointerEvents = 'none';
            instructions.style.display = 'flex'; // show pause menu
        }
    };

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
            if (intersect.object.userData.isMob) {
                if (e.button === 0) {
                     let mob = intersect.object.userData.mob;
                     let died = mob.takeDamage();
                     // Deer grunt (200), Rabbit squeak (600)
                     playSound(mob.isDeer ? 200 : 800, 0.1); 
                     
                     if (died) {
                          inventory.addItem(BLOCKS.MEAT, mob.isDeer ? 2 : 1);
                          updateInventoryUI();
                     }
                }
                return; 
            }
            
            let point = intersect.point;
            let normal = intersect.face.normal;
            
            // For right-click, first check what block we are aiming at.
            // Using 0.1 prevents floating point errors from putting us in the next block over
            let targetX = Math.floor(point.x - normal.x * 0.1);
            let targetY = Math.floor(point.y - normal.y * 0.1);
            let targetZ = Math.floor(point.z - normal.z * 0.1);
            
            if (e.button === 0) {
                // Break block
                let blockId = getBlockGlobal(targetX, targetY, targetZ);
                if (blockId !== BLOCKS.AIR && blockId !== BLOCKS.WATER) {
                    setBlockGlobal(targetX, targetY, targetZ, BLOCKS.AIR);
                    inventory.addItem(blockId, 1);
                    // Standardize drops
                    if (blockId === BLOCKS.CHEST) {
                         // drop contents (not implemented fully, will just break for now)
                         if(window.chests && window.chests[`${targetX},${targetY},${targetZ}`]) {
                             delete window.chests[`${targetX},${targetY},${targetZ}`];
                             saveChests();
                         }
                    }
                    updateInventoryUI();
                    if (blockId === BLOCKS.LEAVES || blockId === BLOCKS.GRASS) {
                        playLeafSound();
                    } else {
                        playSound(300, 0.05); // pop
                    }
                }
            } else if (e.button === 2) {
                // Interact with block
                let targetBlockId = getBlockGlobal(targetX, targetY, targetZ);
                
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
    const mobConfigs = [
        { count: 4, isDeer: false },
        { count: 2, isDeer: true },
    ];
    for (let cfg of mobConfigs) {
        for (let i = 0; i < cfg.count; i++) {
            // Pick a random spot within loaded world, away from origin
            let angle = Math.random() * Math.PI * 2;
            let dist  = 20 + Math.random() * 60;
            let wx = Math.floor(Math.cos(angle) * dist);
            let wz = Math.floor(Math.sin(angle) * dist);
            let wy = getSurfaceY(wx, wz);
            let mob = new Mob(scene, getBlockGlobal, cfg.isDeer);
            // Place slightly above surface so gravity settles them gently
            mob.group.position.set(wx + 0.5, wy + 0.5, wz + 0.5);
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
                if (blockId !== BLOCKS.AIR && blockId !== BLOCKS.WATER) return true;
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

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    // Debug View Check
    if (controls.isLocked === true) {
        raycaster.setFromCamera(center, camera);
        let collidable = scene.children.filter(obj => !obj.userData.ignoreRaycast);
        let intersects = raycaster.intersectObjects(collidable);
        let lookText = "";
        if (intersects.length > 0 && intersects[0].distance <= 8) {
            let point = intersects[0].point;
            let normal = intersects[0].face.normal;
            let targetX = Math.floor(point.x - normal.x * 0.1);
            let targetY = Math.floor(point.y - normal.y * 0.1);
            let targetZ = Math.floor(point.z - normal.z * 0.1);
            let id = getBlockGlobal(targetX, targetY, targetZ);
            lookText = id !== BLOCKS.AIR ? BLOCK_NAMES[id] : "";
        }
        document.getElementById('debug-text').innerText = lookText ? `Looking at: ${lookText}` : "";
    }

    // Only allow player movement and interactions if no UI is open
    if (controls.isLocked === true) {
        const delta = Math.min((time - prevTime) / 1000, 0.1); // clamp delta
        
        // Update Day/Night Cycle
        let isDay = Math.sin(gameTime) > 0;
        let speed = isDay ? (Math.PI / 900) : (Math.PI / 600); // Day: 15m, Night: 10m
        gameTime += delta * speed;
        let sunAngle = gameTime;
        let sunDist = 350;
        dirLight.position.set(Math.cos(sunAngle)*sunDist, Math.sin(sunAngle)*sunDist, Math.sin(sunAngle*0.2)*50);
        
        sunMesh.position.copy(dirLight.position).add(camera.position);
        moonMesh.position.set(-dirLight.position.x, -dirLight.position.y, -dirLight.position.z).add(camera.position);
        starsMesh.position.copy(camera.position);
        
        let dayNess = Math.sin(sunAngle); // 1 = noon, 0 = dusk, -1 = midnight

        // Fade celestial bodies near horizon to prevent seeing them through the maps bottom
        sunMesh.material.opacity = Math.max(0, Math.min(1, dayNess * 5));
        moonMesh.material.opacity = Math.max(0, Math.min(1, -dayNess * 5));

        // Detect Water
        let feetBlock = getBlockGlobal(
            Math.floor(camera.position.x),
            Math.floor(camera.position.y - 1.7),
            Math.floor(camera.position.z)
        );
        let headBlock = getBlockGlobal(
            Math.floor(camera.position.x),
            Math.floor(camera.position.y - 0.2),
            Math.floor(camera.position.z)
        );
        let cameraBlock = getBlockGlobal(
            Math.floor(camera.position.x),
            Math.floor(camera.position.y),
            Math.floor(camera.position.z)
        );
        
        let inWater = headBlock === BLOCKS.WATER || feetBlock === BLOCKS.WATER;
        let cameraInWater = cameraBlock === BLOCKS.WATER;
        
        // Background color blending
        if (cameraInWater) {
             // Underwater blue fog effect
             let waterFog = new THREE.Color().setHSL(0.6, 0.8, dayNess > 0 ? 0.3 : 0.1);
             scene.background.copy(waterFog);
             scene.fog.color.copy(waterFog);
             scene.fog.near = 0.1;
             scene.fog.far = 15; // very thick fog underwater
             dirLight.intensity = dayNess > 0 ? dayNess * 0.4 : 0;
             ambientLight.intensity = Math.max(0.1, dayNess * 0.4);
             starsMesh.material.opacity = 0;
        } else {
            scene.fog.near = 10;
            scene.fog.far = 80;
            
            if (dayNess > 0) {
                // Day
                let h = 0.55; // Blue
                let s = 0.6;
                let l = Math.max(0.05, dayNess * 0.6);
                scene.background.setHSL(h, s, l);
                scene.fog.color.setHSL(h, s, l);
                dirLight.intensity = dayNess * 0.8;
                ambientLight.intensity = Math.max(0.1, dayNess * 0.4);
                starsMesh.material.opacity = 0;
            } else {
                // Night
                scene.background.setHex(0x050515);
                scene.fog.color.setHex(0x050515);
                dirLight.intensity = 0;
                ambientLight.intensity = 0.1; // Moon approximation
                starsMesh.material.opacity = Math.min(1.0, -dayNess * 1.5);
            }
        }

        // Gravity / Buoyancy
        if (!flyMode) {
            if (inWater) {
                // Swimming physics
                velocity.y -= 8 * delta; // Much slower gravity / sinking
                if (velocity.y < -3) velocity.y = -3; // Terminal swim sink speed
                
                if (keys['Space']) {
                     velocity.y += 20 * delta; // Swim up
                     if (velocity.y > 6) velocity.y = 6;
                }
            } else {
                velocity.y -= 25 * delta;
                if (velocity.y < -30) velocity.y = -30;
            }
        } else {
            if (keys['Space']) velocity.y = 12.0;
            else if (keys['ShiftLeft']) velocity.y = -12.0;
            else velocity.y = 0;
        }

        // Get camera yaw direction (horizontal only — ignore pitch)
        const camQuat = camera.quaternion;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 1).applyQuaternion(camQuat); // wait, applying 1,0,0 earlier but I will set exactly right vector using cross of forward
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Build desired move vector this frame
        let speedMult = isSprinting ? 1.6 : 1.0;
        if (flyMode) speedMult = 2.5; // Fast fly
        if (inWater && !flyMode) speedMult *= 0.5; // Water heavily slows movement
        
        const WALK_SPEED = 4.5 * speedMult;
        let moveVec = new THREE.Vector3(0, 0, 0);
        if (moveForward)  moveVec.addScaledVector(forward,  WALK_SPEED);
        if (moveBackward) moveVec.addScaledVector(forward, -WALK_SPEED);
        if (moveRight)    moveVec.addScaledVector(right,    WALK_SPEED);
        if (moveLeft)     moveVec.addScaledVector(right,   -WALK_SPEED);

        let worldDx = moveVec.x * delta;
        let worldDz = moveVec.z * delta;
        let dy = velocity.y * delta;

        // Sweep collision on each axis independently
        const STEP = 0.04;
        let stepsY = Math.max(1, Math.ceil(Math.abs(dy) / STEP));
        let stepsX = Math.max(1, Math.ceil(Math.abs(worldDx) / STEP));
        let stepsZ = Math.max(1, Math.ceil(Math.abs(worldDz) / STEP));

        // --- Y ---
        let syStep = dy / stepsY;
        for (let i = 0; i < stepsY; i++) {
            if (!checkAABB(camera.position.x, camera.position.y + syStep, camera.position.z)) {
                camera.position.y += syStep;
            } else {
                if (syStep < 0) canJump = true;
                velocity.y = 0;
                break;
            }
        }
        let preX = camera.position.x;
        let preZ = camera.position.z;

        // --- X ---
        let sxStep = worldDx / stepsX;
        for (let i = 0; i < stepsX; i++) {
            if (!checkAABB(camera.position.x + sxStep, camera.position.y, camera.position.z)) {
                camera.position.x += sxStep;
            } else { break; }
        }
        // --- Z ---
        let szStep = worldDz / stepsZ;
        for (let i = 0; i < stepsZ; i++) {
            if (!checkAABB(camera.position.x, camera.position.y, camera.position.z + szStep)) {
                camera.position.z += szStep;
            } else { break; }
        }

        // Respawn if falling off the map
        if (camera.position.y < -50) {
            camera.position.set(0, 80, 0); 
            velocity.y = 0;
            velocity.x = 0;
            velocity.z = 0;
            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                if (getBlockGlobal(0, y, 0) !== BLOCKS.AIR) {
                    camera.position.y = y + 3;
                    break;
                }
            }
        }

        // Real displacement (zero if blocked by wall)
        let realDx = Math.abs(camera.position.x - preX);
        let realDz = Math.abs(camera.position.z - preZ);
        
        // Procedural Footstep Audio — only when truly moving, not just pressing against a wall
        const isMoving = moveForward || moveBackward || moveLeft || moveRight;
        if (canJump && isMoving && (realDx + realDz) > 0.001) {
            if (!window.footstepTimer) window.footstepTimer = 0.3;
            window.footstepTimer -= delta;
            if (window.footstepTimer <= 0) {
                let feetBlock = getBlockGlobal(
                    Math.floor(camera.position.x),
                    Math.floor(camera.position.y - 1.7),
                    Math.floor(camera.position.z)
                );
                let pitch = 150;
                if (feetBlock === BLOCKS.WOOD) pitch = 250;
                else if (feetBlock === BLOCKS.SAND) pitch = 100;
                playSound(pitch + Math.random()*20, 0.03);
                window.footstepTimer = 0.35;
            }
        } else if (!isMoving) {
            window.footstepTimer = 0.1;
        }
        
        // Mobs logic
        let dumpStr = "";
        for (let idx = 0; idx < mobsList.length; idx++) {
            let mob = mobsList[idx];
            try {
                mob.update(delta, camera.position);
                if (idx < 5) dumpStr += `(${mob.isDeer?'D':'R'}:${mob.group.position.y.toFixed(1)}) `;
            } catch(e) {
                console.error("Mob update error:", e);
                dumpStr += "[ERR] ";
            }
        }
        document.getElementById('debug-text').innerText = `${Math.round(1/delta)} | M: ${mobsList.length} ${dumpStr}`;

        // Ambient wind
        tickWind(delta);

        // Save player position every ~3 seconds
        _posSaveTimer -= delta;
        if (_posSaveTimer <= 0) {
            localStorage.setItem('sandbox3d_pos', JSON.stringify({
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            }));
            _posSaveTimer = 3.0;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

window.modifiedBlocks = {};
let currentSeed = 1337;
let _posSaveTimer = 3.0;

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
        
        window.chests = {};
        localStorage.setItem('sandbox3d_chests', JSON.stringify({}));
        
        localStorage.removeItem('sandbox3d_pos'); // reset spawn position
        
        inventory.slots = Array(9).fill(null);
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
        
        let savedInv = localStorage.getItem('sandbox3d_inventory');
        if(savedInv) {
             inventory.slots = JSON.parse(savedInv);
        }

        let savedPos = null;
        let posData = localStorage.getItem('sandbox3d_pos');
        if (posData) savedPos = JSON.parse(posData);

        startGame(savedPos);
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
