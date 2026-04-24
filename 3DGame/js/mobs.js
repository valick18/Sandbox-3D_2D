import * as THREE from 'three';
import { BLOCKS } from './textures.js';

export const mobsList = [];

const MaleNames = ["Маркус", "Адріан", "Данило", "Орландо", "Артем", "Віктор", "Леон", "Макс", "Бруно", "Фелікс", "Лукас", "Степан", "Ігор", "Микита", "Павло"];
const FemaleNames = ["Еліза", "Сільвія", "Оксана", "Джулія", "Анна", "Діана", "Кая", "Міра", "Олена", "Марія", "Софія", "Вікторія", "Кіра", "Ліза", "Ніна"];

function createNameTag(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 40px Arial'; ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 0.375, 1);
    return sprite;
}

function makePart(w, h, d, color, ox=0, oy=0, oz=0) {
    let geo = new THREE.BoxGeometry(w, h, d);
    let mat = new THREE.MeshLambertMaterial({ color });
    let mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox, oy, oz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function buildRabbit() {
    let root = new THREE.Group();
    root.userData = { isMob: true };
    const bodyColor = 0xe8e0d0;
    root.add(makePart(0.38, 0.28, 0.52, bodyColor, 0, 0, 0));
    root.add(makePart(0.30, 0.26, 0.30, bodyColor, 0, 0.22, 0.16));
    let earL = makePart(0.07, 0.38, 0.07, bodyColor, -0.10, 0.50, 0.16);
    let earR = makePart(0.07, 0.38, 0.07, bodyColor,  0.10, 0.50, 0.16);
    root.add(earL, earR);
    root.add(makePart(0.04, 0.28, 0.03, 0xf0c0c0, -0.10, 0.54, 0.20));
    root.add(makePart(0.04, 0.28, 0.03, 0xf0c0c0,  0.10, 0.54, 0.20));
    root.add(makePart(0.06, 0.05, 0.04, 0xff9999, 0, 0.20, 0.33));
    root.add(makePart(0.03, 0.03, 0.03, 0x111111, -0.12, 0.25, 0.30));
    root.add(makePart(0.03, 0.03, 0.03, 0x111111,  0.12, 0.25, 0.30));
    let fl = makePart(0.09, 0.14, 0.12, bodyColor, -0.13, -0.18, 0.14);
    let fr = makePart(0.09, 0.14, 0.12, bodyColor,  0.13, -0.18, 0.14);
    let bl = makePart(0.10, 0.16, 0.13, bodyColor, -0.13, -0.18, -0.14);
    let br = makePart(0.10, 0.16, 0.13, bodyColor,  0.13, -0.18, -0.14);
    root.add(fl, fr, bl, br);
    root.add(makePart(0.12, 0.12, 0.10, 0xffffff, 0, 0.02, -0.27));
    root.userData.legs = { fl, fr, bl, br };
    return root;
}

function buildSnake() {
    let root = new THREE.Group();
    root.userData = { isMob: true };
    const bodyColor = 0x556b2f; // dark olive green
    
    // Head
    root.add(makePart(0.15, 0.12, 0.20, bodyColor, 0, 0.06, 0.45));
    // Body segments (so it looks long)
    root.add(makePart(0.12, 0.10, 0.80, bodyColor, 0, 0.05, 0));
    // Eyes
    root.add(makePart(0.04, 0.04, 0.04, 0x111111, -0.06, 0.10, 0.52));
    root.add(makePart(0.04, 0.04, 0.04, 0x111111,  0.06, 0.10, 0.52));
    
    // Optional: a tongue
    root.add(makePart(0.02, 0.02, 0.06, 0xff0000, 0, 0.05, 0.58));
    
    return root;
}

function buildFish() {
    let root = new THREE.Group();
    root.userData = { isMob: true };
    const bodyColor = Math.random() > 0.5 ? 0x1e90ff : 0xff8c00; // Blue or Orange
    const finColor = 0x888888;
    
    // Body
    root.add(makePart(0.10, 0.25, 0.40, bodyColor, 0, 0, 0));
    // Tail
    let tail = makePart(0.02, 0.20, 0.15, finColor, 0, 0, -0.25);
    root.add(tail);
    // Dorsal fin
    root.add(makePart(0.02, 0.10, 0.20, finColor, 0, 0.16, 0));
    // Eyes
    root.add(makePart(0.03, 0.03, 0.03, 0x111111, -0.05, 0.05, 0.15));
    root.add(makePart(0.03, 0.03, 0.03, 0x111111,  0.05, 0.05, 0.15));
    
    root.userData.tail = tail;
    return root;
}

function buildVillager(shirtColor = 0x40e0d0, isFemale = false) {
    let root = new THREE.Group();
    root.userData = { isMob: true };
    const skinColor = 0xffdbac;
    const hairColor = (isFemale && Math.random() < 0.3) ? 0x8b4513 : 0x5d3a1a;
    const trouserColor = 0x3d2b1f;

    let torso = makePart(isFemale ? 0.36 : 0.40, 0.55, 0.25, shirtColor, 0, 0.35, 0); root.add(torso);
    if (!isFemale) {
        root.add(makePart(0.42, 0.08, 0.27, 0x2d1a0a, 0, 0.20, 0));
        let cross = makePart(0.08, 0.60, 0.27, 0x2d1a0a, 0, 0.35, 0); cross.rotation.z = 0.5; root.add(cross);
    }
    root.add(makePart(0.42, 0.42, 0.42, skinColor, 0, 0.85, 0));
    
    if (isFemale) {
        root.add(makePart(0.46, 0.15, 0.46, hairColor, 0, 1.05, 0));
        root.add(makePart(0.44, 0.60, 0.15, hairColor, 0, 0.65, -0.18));
        root.add(makePart(0.08, 0.40, 0.40, hairColor, -0.21, 0.80, 0));
        root.add(makePart(0.08, 0.40, 0.40, hairColor,  0.21, 0.80, 0));
    } else {
        root.add(makePart(0.46, 0.15, 0.46, hairColor, 0, 1.05, 0)); 
        root.add(makePart(0.48, 0.20, 0.30, hairColor, 0, 1.00, -0.10));
    }

    root.add(makePart(0.12, 0.14, 0.05, 0xffffff, -0.12, 0.90, 0.20));
    root.add(makePart(0.12, 0.14, 0.05, 0xffffff,  0.12, 0.90, 0.20));
    root.add(makePart(0.06, 0.08, 0.02, 0x111111, -0.12, 0.88, 0.23));
    root.add(makePart(0.06, 0.08, 0.02, 0x111111,  0.12, 0.88, 0.23));

    let armL = makePart(0.12, 0.50, 0.12, skinColor, -0.26, 0.35, 0);
    let armR = makePart(0.12, 0.50, 0.12, skinColor,  0.26, 0.35, 0);
    root.add(armL, armR);
    root.add(makePart(0.14, 0.25, 0.14, shirtColor, -0.26, 0.50, 0));
    root.add(makePart(0.14, 0.25, 0.14, shirtColor,  0.26, 0.50, 0));

    let legL, legR;
    if (isFemale) {
        legL = makePart(0.42, 0.55, 0.35, shirtColor, 0, -0.15, 0);
        legR = makePart(0.12, 0.55, 0.12, trouserColor, 0.12, -0.15, 0);
    } else {
        legL = makePart(0.16, 0.55, 0.18, trouserColor, -0.12, -0.15, 0);
        legR = makePart(0.16, 0.55, 0.18, trouserColor,  0.12, -0.15, 0);
    }
    root.add(legL, legR);
    root.userData.humanoidParts = { armL, armR, legL, legR, isFemale };
    return root;
}

function buildDeer() {
    let root = new THREE.Group();
    root.userData = { isMob: true };
    const bodyColor = 0x9c5c1e; const bellyColor = 0xd0a060; const darkBrown = 0x5a3010;
    root.add(makePart(0.70, 0.55, 1.20, bodyColor, 0, 0, 0));
    root.add(makePart(0.48, 0.20, 0.90, bellyColor, 0, -0.18, 0));
    let neck = makePart(0.22, 0.55, 0.22, bodyColor, 0, 0.40, 0.40); neck.rotation.x = -0.35; root.add(neck);
    root.add(makePart(0.30, 0.28, 0.44, bodyColor, 0, 0.72, 0.56));
    root.add(makePart(0.16, 0.18, 0.22, bellyColor, 0, 0.66, 0.78)); 
    root.add(makePart(0.10, 0.10, 0.06, darkBrown, 0, 0.68, 0.92)); 
    root.add(makePart(0.04, 0.04, 0.04, 0x111111, -0.16, 0.78, 0.65));
    root.add(makePart(0.04, 0.04, 0.04, 0x111111,  0.16, 0.78, 0.65));
    
    root.add(makePart(0.05, 0.30, 0.05, darkBrown, -0.15, 1.12, 0.52));
    root.add(makePart(0.05, 0.30, 0.05, darkBrown,  0.15, 1.12, 0.52));
    root.add(makePart(0.20, 0.05, 0.05, darkBrown, -0.22, 1.28, 0.52));
    root.add(makePart(0.20, 0.05, 0.05, darkBrown,  0.22, 1.28, 0.52));

    let fl = makePart(0.12, 0.60, 0.12, bodyColor, -0.24, -0.55, 0.38);
    let fr = makePart(0.12, 0.60, 0.12, bodyColor,  0.24, -0.55, 0.38);
    let bl = makePart(0.12, 0.60, 0.12, bodyColor, -0.24, -0.55, -0.38);
    let br = makePart(0.12, 0.60, 0.12, bodyColor,  0.24, -0.55, -0.38);
    root.add(fl, fr, bl, br);
    root.userData.legs = { fl, fr, bl, br };
    return root;
}

function buildBird(type = 'sparrow') {
    let root = new THREE.Group();
    root.userData = { isMob: true, isBird: true, birdType: type };
    let bodyColor, wingColor, beakColor, scale;
    if (type === 'crow') { bodyColor = 0x222222; wingColor = 0x111111; beakColor = 0x111111; scale = 1.0; }
    else if (type === 'cormorant') { bodyColor = 0xeeeeee; wingColor = 0x999999; beakColor = 0xffa500; scale = 1.4; }
    else { bodyColor = 0x8b4513; wingColor = 0x5d2e0c; beakColor = 0xcd853f; scale = 0.6; }
    
    root.add(makePart(0.18 * scale, 0.15 * scale, 0.25 * scale, bodyColor, 0, 0, 0));
    root.add(makePart(0.12 * scale, 0.12 * scale, 0.12 * scale, bodyColor, 0, 0.10 * scale, 0.12 * scale));
    root.add(makePart(0.04 * scale, 0.04 * scale, 0.12 * scale, beakColor, 0, 0.08 * scale, 0.22 * scale));

    const eyeColor = 0x111111;
    root.add(makePart(0.02 * scale, 0.02 * scale, 0.02 * scale, eyeColor, -0.05 * scale, 0.13 * scale, 0.17 * scale));
    root.add(makePart(0.02 * scale, 0.02 * scale, 0.02 * scale, eyeColor,  0.05 * scale, 0.13 * scale, 0.17 * scale));
    
    let wingLGroup = new THREE.Group(); wingLGroup.position.set(-0.09 * scale, 0.02 * scale, 0);
    wingLGroup.add(makePart(0.25 * scale, 0.02 * scale, 0.18 * scale, wingColor, -0.12 * scale, 0, 0));
    let wingRGroup = new THREE.Group(); wingRGroup.position.set(0.09 * scale, 0.02 * scale, 0);
    wingRGroup.add(makePart(0.25 * scale, 0.02 * scale, 0.18 * scale, wingColor, 0.12 * scale, 0, 0));
    root.add(wingLGroup, wingRGroup);
    
    let legL = makePart(0.02 * scale, 0.12 * scale, 0.02 * scale, 0x333333, -0.05 * scale, -0.12 * scale, 0);
    let legR = makePart(0.02 * scale, 0.12 * scale, 0.02 * scale, 0x333333,  0.05 * scale, -0.12 * scale, 0);
    root.add(legL, legR);
    
    root.userData.wings = { l: wingLGroup, r: wingRGroup };
    return root;
}

export class Mob {
    constructor(scene, getBlockFn, type = 'rabbit', spawnX = 0, spawnZ = 0, forcedGender = undefined) {
        this.scene = scene;
        this.getBlock = getBlockFn;
        this.type = type;
        this.isDeer = type === 'deer';
        this.isBird = ['crow', 'cormorant', 'sparrow'].includes(type);
        this.isVillager = type === 'villager';
        this.isSnake = type === 'snake';
        this.isFish = type === 'fish';
        this.health = 5;

        if (this.isBird) { this.group = buildBird(this.type); }
        else if (this.isDeer) { this.group = buildDeer(); }
        else if (this.isSnake) { this.group = buildSnake(); }
        else if (this.isFish) { this.group = buildFish(); }
        else if (this.isVillager) {
            const h = Math.abs(Math.sin(spawnX * 0.77 + spawnZ * 1.31) * 1000) % 1;
            this.isFemale = forcedGender !== undefined ? (forcedGender === 1) : (h < 0.5);
            const namePool = this.isFemale ? FemaleNames : MaleNames;
            this.name = namePool[Math.floor(h * namePool.length)];
            this.nameTag = createNameTag(this.name); this.nameTag.position.set(0, 1.45, 0);
            const shirtColors = this.isFemale ? [0xff69b4, 0xdda0dd, 0xf0e68c] : [0x40e0d0, 0x4682b4, 0x20b2aa];
            this.group = buildVillager(shirtColors[Math.floor(h * shirtColors.length)], this.isFemale);
            this.group.add(this.nameTag);
            this.homePos = new THREE.Vector3(spawnX, 0, spawnZ);
            if (window.getVillagePartAtWorld) {
                let vPart = window.getVillagePartAtWorld(spawnX, spawnZ);
                if (vPart && vPart.type === 'house') {
                    this.homePos.set(vPart.originX + 0.5, vPart.surfaceY + 1, vPart.originZ + 0.5);
                    this.doorNode = new THREE.Vector3(vPart.originX + 0.5, vPart.surfaceY + 1, vPart.originZ + 3.5);
                }
            }
        } else { this.group = buildRabbit(); }

        this.group.position.set(spawnX, 80, spawnZ);
        this.group.userData.isMob = true;
        this.group.userData.mob = this;
        this.group.traverse(obj => { if(obj.isMesh) { obj.userData.isMob = true; obj.userData.mob = this; } });
        this.scene.add(this.group);

        this.velocity = new THREE.Vector3();
        this.birdState = 'flying'; 
        this.wanderTimer = Math.random() * 0.5;
        this.targetDir = new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
        this.isMoving = true;
        this.onGround = false;
        this.legPhase = 0;
        this.hopTimer = 0;
        this.isTalking = false;
        mobsList.push(this);
    }

    isBlocked(nx, ny, nz) {
        let r = this.isVillager ? 0.3 : (this.isDeer ? 0.35 : 0.18);
        let h = this.isVillager ? 0.43 : (this.isDeer ? 0.85 : 0.25);
        let minX = Math.floor(nx - r), maxX = Math.floor(nx + r);
        let minZ = Math.floor(nz - r), maxZ = Math.floor(nz + r);
        let minY = Math.floor(ny - h + 0.1); 
        let maxY = Math.floor(ny + h - 0.1);
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    let b = this.getBlock(x, y, z);
                    if (b !== BLOCKS.AIR && b !== BLOCKS.WATER) return true;
                }
            }
        }
        return false;
    }

    update(delta, playerPos) {
        let cx = Math.floor(this.group.position.x / 16);
        let cz = Math.floor(this.group.position.z / 16);
        if (window.chunks && !window.chunks[`${cx},${cz}`]) return; 

        if(this.group.position.y < -30) {
            let ry = 90;
            if(window.getSurfaceY) ry = window.getSurfaceY(this.group.position.x, this.group.position.z);
            this.group.position.y = ry + 2;
            this.velocity.set(0, 0, 0);
        }

        // Zero out movement if talking
        if (this.isTalking) {
            this.isMoving = false;
            this.targetDir.set(0, 0, 0);
            this.velocity.x = 0;
            this.velocity.z = 0;
            this.wanderTimer = 1.0; 
        }

        let pos = this.group.position;
        let blockAtCenter = this.getBlock(Math.floor(pos.x), Math.floor(pos.y + 0.1), Math.floor(pos.z));
        let inWater = blockAtCenter === BLOCKS.WATER;

        if (this.isBird && this.birdState !== 'sitting') {
            if (this.birdState === 'flying') {
                let surface = (window.getSurfaceY ? window.getSurfaceY(pos.x, pos.z) : 80);
                surface = Math.max(surface, 58); // Stay above water level
                let targetAlt = (this.type === 'cormorant') ? surface + 30 : surface + 18;
                let diff = targetAlt - pos.y;
                this.velocity.y += (Math.sin(performance.now() * 0.005) * 2 + (diff * 0.7) - this.velocity.y) * delta * 2;
            } else if (this.birdState === 'landing') {
                // Planing: glide down smoothly instead of falling
                let targetDescent = -1.2;
                this.velocity.y += (targetDescent - this.velocity.y) * delta * 1.5;
            }
        } else if (this.isFish) {
            if (inWater) {
                let surface = window.getSurfaceY ? window.getSurfaceY(pos.x, pos.z) : 0;
                let targetY = surface + 2 + Math.sin(performance.now() * 0.002 + pos.x) * 1.5;
                if (targetY > 57) targetY = 57;
                this.velocity.y += (targetY - pos.y) * delta * 2;
                
                if (this.isMoving) {
                    this.velocity.x += this.targetDir.x * 5 * delta;
                    this.velocity.z += this.targetDir.z * 5 * delta;
                }
                this.velocity.x *= 0.92; this.velocity.z *= 0.92;
            } else {
                this.velocity.y -= 25 * delta;
                if (this.onGround && this.hopTimer <= 0) { 
                    this.velocity.y = 5; 
                    this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                    this.isMoving = true;
                    this.hopTimer = 0.5; 
                }
            }
        } else {
            if (inWater) {
                // Smoother buoyancy and diagonal movement
                this.velocity.y += 8 * delta; 
                if (this.velocity.y > 3) this.velocity.y = 3;
                
                if (this.isMoving) {
                    this.velocity.x += this.targetDir.x * 5 * delta;
                    this.velocity.z += this.targetDir.z * 5 * delta;
                }
                this.velocity.x *= 0.92; this.velocity.z *= 0.92;
            } else {
                 this.velocity.y -= (this.isDeer || this.isVillager ? 30 : 25) * delta;
            }
        }

        let halfH = this.isVillager ? 0.43 : (this.isDeer ? 0.85 : 0.25);
        let dist = this.group.position.distanceTo(playerPos);

        if (this.isBird && this.birdState === 'sitting') {
            let threatPos = null;
            if (dist < 7) threatPos = playerPos;
            else if (window.mobsList) {
                for (let m of window.mobsList) {
                    if (m !== this && m.isVillager && m.group.position.distanceTo(pos) < 6) { threatPos = m.group.position; break; }
                }
            }
            if (threatPos) {
                this.birdState = 'flying'; this.velocity.y = 8; this.isMoving = true;
                this.targetDir.subVectors(pos, threatPos).setY(0).normalize();
                this.velocity.x = this.targetDir.x * 6; this.velocity.z = this.targetDir.z * 6;
                this.wanderTimer = 2 + Math.random() * 2;
            }
        }

        this.wanderTimer -= delta;
        if(this.wanderTimer <= 0) {
            let nearbyVillager = null;
            if (window.mobsList) {
                for(let m of window.mobsList) {
                    if (m != this && m.isVillager && m.group.position.distanceTo(pos) < 8) { nearbyVillager = m; break; }
                }
            }
            const isNight = window.dayNess && window.dayNess < -0.1;
            
            if (this.isVillager) {
                const distToHome = pos.distanceTo(this.homePos);
                const isInside = distToHome < 3.8;
                if (isNight) {
                    if (isInside) {
                        this.isMoving = false; this.wanderTimer = 10.0; this.velocity.x = 0; this.velocity.z = 0;
                    } else {
                        let distToDoor = this.doorNode ? pos.distanceTo(this.doorNode) : 999;
                        let target = (distToDoor > 1 && distToHome > 2) ? this.doorNode : this.homePos;
                        this.targetDir.subVectors(target, pos).normalize();
                        this.isMoving = true; this.wanderTimer = 1.0;
                    }
                } else {
                    if (isInside) {
                        if (this.doorNode && Math.random() < 0.8) {
                            this.targetDir.subVectors(this.doorNode, pos).normalize();
                            this.isMoving = true; this.wanderTimer = 3.0;
                        } else {
                             this.isMoving = false; this.wanderTimer = 4.0 + Math.random() * 4; this.velocity.x = 0; this.velocity.z = 0;
                        }
                    } else {
                        let bestDir = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                        if (window.getVillagePartAtWorld) {
                            for (let attempt = 0; attempt < 8; attempt++) {
                                let testDir = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                                let testPos = pos.clone().addScaledVector(testDir, 4);
                                let part = window.getVillagePartAtWorld(testPos.x, testPos.z);
                                if (part && part.type === 'path') { bestDir.copy(testDir).normalize(); break; }
                            }
                        }
                        this.targetDir.copy(bestDir);
                        this.isMoving = true; this.wanderTimer = 2.0 + Math.random() * 4;
                    }
                }
            } else if (this.isBird) {
                if (this.birdState === 'sitting') {
                    if(Math.random()<0.05) this.birdState = 'flying'; 
                    this.wanderTimer = 2 + Math.random() * 5; 
                } else {
                    if (Math.random() < 0.2) { 
                        this.birdState = 'landing'; this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize(); 
                    } else { 
                        this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize(); 
                        this.wanderTimer = 3 + Math.random() * 5; 
                    }
                }
            } else {
                let fleeing = (dist < 8) || nearbyVillager;
                if(fleeing) {
                    this.targetDir.subVectors(pos, nearbyVillager ? nearbyVillager.group.position : playerPos).normalize();
                    this.isMoving = true; this.wanderTimer = 1.0;
                } else {
                    if(this.isMoving) { this.isMoving = false; this.wanderTimer = 3.0 + Math.random() * 4; }
                    else { this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize(); this.isMoving = true; this.wanderTimer = 1.5 + Math.random() * 2; }
                }
            }
        }

        if(!this.isDeer && !this.isBird && !this.isVillager && !this.isSnake && !this.isFish && this.isMoving) {
            this.hopTimer -= delta;
            if(this.onGround && this.hopTimer <= 0) { this.velocity.y = 6.5; this.hopTimer = 0.5; }
        }

        let speed = this.isVillager ? 3.0 : (this.isDeer ? 4.5 : 2.5);
        if (this.isSnake) speed = 1.8;
        if (this.isFish) speed = 2.0;
        if (this.isBird) {
            if (this.birdState === 'sitting') speed = this.isMoving ? 1.5 : 0;
            else speed = (this.group.userData.birdType === 'sparrow' ? 4.5 : 3.0);
        }
        if (inWater) speed *= 0.6;
        if (this.isMoving) { 
            this.velocity.x = this.targetDir.x * speed; this.velocity.z = this.targetDir.z * speed; 
        } else { 
            this.velocity.x *= 0.85; this.velocity.z *= 0.85; 
        }

        let ny = pos.y + this.velocity.y * delta;
        let nx = pos.x + this.velocity.x * delta;
        let nz = pos.z + this.velocity.z * delta;

        if (this.isBlocked(nx, pos.y, pos.z)) { this.velocity.x *= -0.2; nx = pos.x; }
        if (this.isBlocked(nx, pos.y, nz)) { this.velocity.z *= -0.2; nz = pos.z; }

        let yFeetOld = Math.floor(pos.y - halfH);
        let yFeetNew = Math.floor(ny  - halfH);
        let blockBelow = 0; let groundYHit = yFeetNew;
        let r = this.isVillager ? 0.3 : (this.isDeer ? 0.35 : 0.18);
        for (let yy = Math.max(yFeetOld, yFeetNew); yy >= Math.min(yFeetOld, yFeetNew); yy--) {
            let isSolid = false;
            for (let xx = Math.floor(nx - r); xx <= Math.floor(nx + r) && !isSolid; xx++) {
                for (let zz = Math.floor(nz - r); zz <= Math.floor(nz + r) && !isSolid; zz++) {
                    let gb = this.getBlock(xx, yy, zz);
                    if (gb !== 0 && gb !== 11) isSolid = true;
                }
            }
            if (isSolid && this.velocity.y <= 0) { blockBelow = 1; groundYHit = yy; break; }
        }

        this.onGround = false;
        if(blockBelow !== 0) {
            this.velocity.y = 0; ny = groundYHit + 1 + halfH; this.onGround = true;
            if (this.isBird && this.birdState === 'landing') { 
                this.birdState = 'sitting'; this.wanderTimer = 5; 
                this.isMoving = false; this.velocity.x = 0; this.velocity.z = 0;
            }
        } else if (this.isBird && this.birdState === 'sitting') { this.birdState = 'flying'; }

        this.group.position.set(nx, ny, nz);
        if(this.isMoving && (Math.abs(this.velocity.x)+Math.abs(this.velocity.z))>0.1) { 
            this.group.rotation.y = Math.atan2(this.velocity.x, this.velocity.z); 
        }

        if (this.isBird) {
            let wings = this.group.userData.wings;
            if (wings && this.birdState !== 'sitting') {
                let flap = Math.sin(performance.now() * 0.015) * 1.2;
                wings.l.rotation.z = flap; wings.r.rotation.z = -flap;
            } else if (wings) { wings.l.rotation.z = 0.2; wings.r.rotation.z = -0.2; }
        } else if (this.isVillager) {
            if (this.isTalking) {
                this.legPhase = 0;
            } else if (this.isMoving) {
                this.legPhase += delta * 7;
            }
            
            let parts = this.group.userData.humanoidParts;
            if (parts) {
                if (this.isTalking) {
                    parts.legL.rotation.x = 0; parts.legR.rotation.x = 0;
                    parts.armL.rotation.x = 0; parts.armR.rotation.x = 0;
                } else {
                    let swing = Math.sin(this.legPhase) * 0.5;
                    parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
                    parts.armL.rotation.x = -swing; parts.armR.rotation.x = swing;
                }
            }
        } else if (this.isDeer) {
             if (this.isMoving) this.legPhase += delta * 8;
             let legs = this.group.userData.legs;
             if (legs) {
                 let swing = Math.sin(this.legPhase) * 0.45;
                 legs.fl.rotation.x = swing; legs.br.rotation.x = swing;
                 legs.fr.rotation.x = -swing; legs.bl.rotation.x = -swing;
             }
        } else if (this.isSnake) {
             if (this.isMoving) {
                 let wiggle = Math.sin(performance.now() * 0.015) * 0.3;
                 this.group.children[1].rotation.y = wiggle; // wag body
             }
        } else if (this.isFish) {
             if (this.isMoving) {
                 let swim = Math.sin(performance.now() * 0.02) * 0.5;
                 if (this.group.userData.tail) this.group.userData.tail.rotation.y = swim;
             }
        }
    }

    takeDamage() {
        this.health = (this.health || 5) - 1;
        if(this.health <= 0) {
            this.scene.remove(this.group);
            let idx = mobsList.indexOf(this);
            if(idx > -1) mobsList.splice(idx, 1);
            return true;
        }
        return false;
    }

    getSurroundingContext() {
        const pos = this.group.position;
        const wx = Math.floor(pos.x);
        const wy = Math.floor(pos.y);
        const wz = Math.floor(pos.z);
        
        // Time & weather from window (attached in main.js)
        const timeOfDay = window.worldState ? window.worldState.timeOfDay : 'зараз день';
        const weather = window.worldState ? window.worldState.weather : 'ясно';
        const season = window.worldState ? window.worldState.season : 'літо';

        // Biome detection
        let biome = "рівнина";
        if (wy > 95) biome = "високі гори";
        else if (wy > 80) biome = "пагорби";
        
        // Block scanning (7x7x7 box for better vision)
        let foundBlocks = new Set();
        let counts = {};
        if (window.getBlockGlobal) {
            for (let x = -3; x <= 3; x++) {
                for (let y = -2; y <= 4; y++) {
                    for (let z = -3; z <= 3; z++) {
                        let id = window.getBlockGlobal(wx + x, wy + y, wz + z);
                        if (id === 0) continue;
                        let name = window.BLOCK_NAMES ? window.BLOCK_NAMES[id] : null;
                        if (name) {
                            counts[name] = (counts[name] || 0) + 1;
                            foundBlocks.add(name);
                        }
                    }
                }
            }
        }
        
        let blockHighlights = [];
        if (counts['Workbench']) blockHighlights.push("верстак");
        if (counts['Chest']) blockHighlights.push("скриня");
        if (counts['Furnace']) blockHighlights.push("піч");
        if (counts['Water'] > 5) blockHighlights.push("багато води");
        else if (counts['Water']) blockHighlights.push("трішки води");
        if (counts['Wood'] > 3 || counts['Leaves'] > 5) blockHighlights.push("дерева");
        if (counts['Stone'] > 5 || counts['Stone Brick'] > 5) blockHighlights.push("каміння");
        if (counts['Glass']) blockHighlights.push("скло");
        if (counts['Brick'] > 5) blockHighlights.push("цегляна кладка");
        if (counts['Sand'] > 10) blockHighlights.push("пісок");
        if (counts['Red Flower'] || counts['Yellow Flower']) blockHighlights.push("квіти");
        
        // Structure detection
        let structure = "дика природа";
        if (window.getVillagePartAtWorld) {
            let res = window.getVillagePartAtWorld(wx, wz);
            if (res) {
                if (res.type === 'road') structure = "дорога в селі";
                else if (res.type === 'house') structure = "біля будинку";
                else structure = "територія села";
            }
        }

        // Find nearby mobs (creatures)
        let nearbyMobs = [];
        if (window.mobsList) {
            for (let m of window.mobsList) {
                if (m === this) continue;
                let d = m.group.position.distanceTo(pos);
                if (d < 18) {
                    let desc = "";
                    if (m.isVillager) desc = `житель ${m.name}`;
                    else if (m.isBird) desc = `в небі летить ${m.type || 'пташка'}`;
                    else if (m.isDeer) desc = `олень`;
                    else desc = m.type || 'істота';
                    
                    let dirStr = "";
                    if (Math.abs(m.group.position.x - pos.x) > Math.abs(m.group.position.z - pos.z)) {
                        dirStr = (m.group.position.x > pos.x) ? "на сході" : "на заході";
                    } else {
                        dirStr = (m.group.position.z > pos.z) ? "на півночі" : "на півдні";
                    }
                    nearbyMobs.push(`${desc} (${dirStr}, за ${Math.round(d)}м)`);
                }
            }
        }

        let surrStr = `Місцевість: ${biome}. Об'єкти поруч: ${structure}. `;
        if (blockHighlights.length > 0) surrStr += `Я бачу: ${blockHighlights.join(', ')}. `;
        if (nearbyMobs.length > 0) surrStr += `Живі істоти поруч: ${nearbyMobs.join('; ')}.`;
        else surrStr += `Поруч немає інших істот.`;

        return {
            timeOfDay,
            weather,
            season,
            surroundings: surrStr
        };
    }
}
