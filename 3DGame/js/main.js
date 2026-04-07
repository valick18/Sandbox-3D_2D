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
let prevTime = performance.now();

// ----------------- INVENTORY & CRAFTING -----------------
const BLOCK_NAMES = {1:'Grass', 2:'Dirt', 3:'Stone', 4:'Wood', 5:'Leaves', 6:'Sand', 7:'Planks', 8:'Meat'};

class Inventory {
    constructor() {
        this.slots = Array(9).fill(null);
        this.activeSlot = 0;
        // Starter items
        this.slots[0] = { id: BLOCKS.WOOD, count: 10 };
    }
    
    addItem(id, amount = 1) {
        if(id === BLOCKS.AIR || id === BLOCKS.LEAVES) return; // avoid junk
        if(id === BLOCKS.GRASS) id = BLOCKS.DIRT; // grass drops dirt
        
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
}

function updateCraftingUI() {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    
    // Recipe: 1 Wood -> 4 Planks
    let btn = document.createElement('button');
    btn.innerHTML = `<span>Craft 4x <img src="${icons[BLOCKS.PLANKS]}" class="block-icon"></span> <span>Req: 1x <img src="${icons[BLOCKS.WOOD]}" class="block-icon"></span>`;
    btn.disabled = inventory.countItem(BLOCKS.WOOD) < 1;
    btn.onclick = () => {
        if(inventory.removeItem(BLOCKS.WOOD, 1)) {
            inventory.addItem(BLOCKS.PLANKS, 4);
            updateInventoryUI();
            updateCraftingUI();
            playSound(400, 0.1);
        }
    };
    list.appendChild(btn);
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
    const sunGeom = new THREE.SphereGeometry(15, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });
    sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.userData = { ignoreRaycast: true };
    scene.add(sunMesh);
    
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff });
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
    
    // Build initial chunks
    for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
            chunks[`${cx},${cz}`] = new Chunk(cx, cz, scene, materials);
        }
    }

    // Spawn Mobs
    for(let i=0; i<4; i++) new Mob(scene, getBlockGlobal, false); // Rabbit
    for(let i=0; i<2; i++) new Mob(scene, getBlockGlobal, true); // Deer

    // Snap player to surface to prevent spawning underground
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        if (getBlockGlobal(0, y, 0) !== BLOCKS.AIR && getBlockGlobal(0, y, 0) !== BLOCKS.LEAVES) {
            camera.position.y = y + 3;
            break;
        }
    }

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    updateInventoryUI();
    
    controls = new PointerLockControls(camera, renderer.domElement);
    
    let isCraftingOpen = false;
    const craftingMenu = document.getElementById('crafting');

    const instructions = document.getElementById('instructions');
    
    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        if(audioCtx.state === 'suspended') audioCtx.resume();
    });
    
    controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex';
    });
    
    scene.add(controls.getObject());

    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward = true; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft = true; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward = true; break;
            case 'ArrowRight':
            case 'KeyD': moveRight = true; break;
            case 'Space':
                if (canJump === true) velocity.y += 20;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
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
            isCraftingOpen = !isCraftingOpen;
            if(isCraftingOpen) {
                controls.unlock();
                craftingMenu.style.display = 'block';
                updateCraftingUI();
            } else {
                controls.lock();
                craftingMenu.style.display = 'none';
            }
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
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    
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
            
            if (e.button === 0) {
                // Break block
                let bx = Math.floor(point.x - normal.x * 0.5);
                let by = Math.floor(point.y - normal.y * 0.5);
                let bz = Math.floor(point.z - normal.z * 0.5);
                let blockId = getBlockGlobal(bx, by, bz);
                if (blockId !== BLOCKS.AIR) {
                    setBlockGlobal(bx, by, bz, BLOCKS.AIR);
                    inventory.addItem(blockId, 1);
                    updateInventoryUI();
                    playSound(300, 0.05); // pop
                }
            } else if (e.button === 2) {
                // Place block
                let slot = inventory.slots[inventory.activeSlot];
                if (!slot || slot.count <= 0) return;
                
                let bx = Math.floor(point.x + normal.x * 0.5);
                let by = Math.floor(point.y + normal.y * 0.5);
                let bz = Math.floor(point.z + normal.z * 0.5);
                
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
    let cx = Math.floor(bx / CHUNK_SIZE);
    let cz = Math.floor(bz / CHUNK_SIZE);
    let lx = bx - cx * CHUNK_SIZE;
    let lz = bz - cz * CHUNK_SIZE;
    
    if (!window.modifiedBlocks) window.modifiedBlocks = {};
    window.modifiedBlocks[`${bx},${by},${bz}`] = blockId;
    localStorage.setItem('sandbox3d_mods', JSON.stringify(window.modifiedBlocks));
    
    let chunk = chunks[`${cx},${cz}`];
    if (chunk) {
        chunk.data[chunk.getIndex(lx, by, lz)] = blockId;
        chunk.buildMesh(); 
        
        // Update neighbors if on the edge, so faces cull properly!
        // Simplified for now.
    }
}

function getBlockGlobal(bx, by, bz) {
    let cx = Math.floor(bx / CHUNK_SIZE);
    let cz = Math.floor(bz / CHUNK_SIZE);
    let lx = bx - cx * CHUNK_SIZE;
    let lz = bz - cz * CHUNK_SIZE;
    let chunk = chunks[`${cx},${cz}`];
    if(chunk) return chunk.getBlock(lx, by, lz);
    return BLOCKS.AIR;
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
                if (blockId !== BLOCKS.AIR && blockId !== BLOCKS.LEAVES) return true;
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

    if (controls.isLocked === true) {
        const delta = Math.min((time - prevTime) / 1000, 0.1); // clamp delta
        
        // Update Day/Night Cycle
        let isDay = Math.sin(gameTime) > 0;
        let speed = isDay ? (Math.PI / 900) : (Math.PI / 600); // Day: 15m, Night: 10m
        gameTime += delta * speed;
        let sunAngle = gameTime;
        let sunDist = 200;
        dirLight.position.set(Math.cos(sunAngle)*sunDist, Math.sin(sunAngle)*sunDist, Math.sin(sunAngle*0.2)*50);
        
        sunMesh.position.copy(dirLight.position).add(camera.position);
        moonMesh.position.set(-dirLight.position.x, -dirLight.position.y, -dirLight.position.z).add(camera.position);
        starsMesh.position.copy(camera.position);
        
        let dayNess = Math.sin(sunAngle); // 1 = noon, 0 = dusk, -1 = midnight
        
        // Background color blending
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

        // Gravity
        velocity.y -= 20 * delta;
        if (velocity.y < -25) velocity.y = -25;

        // Get camera yaw direction (horizontal only — ignore pitch)
        const camQuat = camera.quaternion;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
        right.y = 0; right.normalize();

        // Build desired move vector this frame
        const WALK_SPEED = 4.0; // units per second
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
        for (let mob of mobsList) {
            mob.update(delta, camera.position);
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

window.modifiedBlocks = {};
let currentSeed = 1337;

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
        
        startGame();
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
        startGame();
    };
});

function startGame() {
    document.getElementById('menu-warning').style.display = 'block';
    
    setTimeout(() => {
        setSeed(currentSeed);
        document.getElementById('menu-buttons').style.display = 'none';
        document.getElementById('menu-warning').style.display = 'none';
        
        init();
        animate();
        
        const instructions = document.getElementById('instructions');
        instructions.style.display = 'none';
        instructions.onclick = () => {
             controls.lock();
        };
        
        controls.lock();
    }, 50);
}
