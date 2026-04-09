import * as THREE from 'three';
import { BLOCKS } from './textures.js';

export const mobsList = [];

// ---- Helper: build a box part ----
function makePart(w, h, d, color, ox=0, oy=0, oz=0) {
    let geo = new THREE.BoxGeometry(w, h, d);
    let mat = new THREE.MeshLambertMaterial({ color });
    let mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox, oy, oz);
    return mesh;
}

// ---- RABBIT ----
function buildRabbit() {
    let root = new THREE.Group();
    root.userData = { isMob: true };

    const bodyColor  = 0xe8e0d0; // light cream
    const earColor   = 0xf0c0c0; // pink ear inside
    const noseColor  = 0xff9999;

    // Body (slightly oval)
    let body = makePart(0.38, 0.28, 0.52, bodyColor, 0, 0, 0);
    root.add(body);

    // Head
    let head = makePart(0.30, 0.26, 0.30, bodyColor, 0, 0.22, 0.16);
    root.add(head);

    // Tall ears
    let earL = makePart(0.07, 0.38, 0.07, bodyColor, -0.10, 0.50, 0.16);
    let earR = makePart(0.07, 0.38, 0.07, bodyColor,  0.10, 0.50, 0.16);
    // Pink inner ears
    let innerL = makePart(0.04, 0.28, 0.03, earColor, -0.10, 0.54, 0.20);
    let innerR = makePart(0.04, 0.28, 0.03, earColor,  0.10, 0.54, 0.20);
    root.add(earL, earR, innerL, innerR);

    // Nose
    let nose = makePart(0.06, 0.05, 0.04, noseColor, 0, 0.20, 0.33);
    root.add(nose);
    
    // Eyes
    const eyeB = 0x111111;
    let eyeL = makePart(0.03, 0.03, 0.03, eyeB, -0.12, 0.25, 0.30);
    let eyeR = makePart(0.03, 0.03, 0.03, eyeB,  0.12, 0.25, 0.30);
    root.add(eyeL, eyeR);

    // Legs (4 short stumps)
    let fl = makePart(0.09, 0.14, 0.12, bodyColor, -0.13, -0.18, 0.14);
    let fr = makePart(0.09, 0.14, 0.12, bodyColor,  0.13, -0.18, 0.14);
    let bl = makePart(0.10, 0.16, 0.13, bodyColor, -0.13, -0.18, -0.14);
    let br = makePart(0.10, 0.16, 0.13, bodyColor,  0.13, -0.18, -0.14);
    root.add(fl, fr, bl, br);

    // Fluffy tail
    let tail = makePart(0.12, 0.12, 0.10, 0xffffff, 0, 0.02, -0.27);
    root.add(tail);

    // Mark legs for hop animation
    root.userData.legs = { fl, fr, bl, br };
    root.userData.ears = { earL, earR, innerL, innerR };

    return root;
}

// ---- DEER ----
function buildDeer() {
    let root = new THREE.Group();
    root.userData = { isMob: true };

    const bodyColor = 0x9c5c1e; // warm brown
    const bellyColor = 0xd0a060;
    const darkBrown  = 0x5a3010;

    // Main body (elongated)
    let body = makePart(0.70, 0.55, 1.20, bodyColor, 0, 0, 0);
    root.add(body);

    // Belly highlight
    let belly = makePart(0.48, 0.20, 0.90, bellyColor, 0, -0.18, 0);
    root.add(belly);

    // Neck (tilted forward)
    let neck = makePart(0.22, 0.55, 0.22, bodyColor, 0, 0.40, 0.40);
    neck.rotation.x = -0.35;
    root.add(neck);

    // Head
    let head = makePart(0.30, 0.28, 0.44, bodyColor, 0, 0.72, 0.56);
    root.add(head);

    // Snout
    let snout = makePart(0.16, 0.18, 0.22, bellyColor, 0, 0.66, 0.78);
    root.add(snout);

    // Dark nose tip
    let nose = makePart(0.10, 0.10, 0.06, darkBrown, 0, 0.68, 0.92);
    root.add(nose);
    
    // Eyes (black)
    const eyeBlack = 0x111111;
    let eyeL = makePart(0.04, 0.04, 0.04, eyeBlack, -0.16, 0.78, 0.65);
    let eyeR = makePart(0.04, 0.04, 0.04, eyeBlack,  0.16, 0.78, 0.65);
    root.add(eyeL, eyeR);

    // Ears (large and perky, angled outward)
    let earL = makePart(0.08, 0.24, 0.16, bodyColor, -0.22, 0.92, 0.55);
    let earR = makePart(0.08, 0.24, 0.16, bodyColor,  0.22, 0.92, 0.55);
    earL.rotation.z =  0.3;
    earR.rotation.z = -0.3;
    root.add(earL, earR);

    // Antlers (male look - simple T shape)
    let antlerBaseL = makePart(0.05, 0.30, 0.05, darkBrown, -0.15, 1.12, 0.52);
    let antlerBaseR = makePart(0.05, 0.30, 0.05, darkBrown,  0.15, 1.12, 0.52);
    let antlerBranchL = makePart(0.20, 0.05, 0.05, darkBrown, -0.22, 1.28, 0.52);
    let antlerBranchR = makePart(0.20, 0.05, 0.05, darkBrown,  0.22, 1.28, 0.52);
    root.add(antlerBaseL, antlerBaseR, antlerBranchL, antlerBranchR);

    // Legs - long and slender
    let fl = makePart(0.12, 0.60, 0.12, bodyColor, -0.24, -0.55, 0.38);
    let fr = makePart(0.12, 0.60, 0.12, bodyColor,  0.24, -0.55, 0.38);
    let bl = makePart(0.12, 0.60, 0.12, bodyColor, -0.24, -0.55, -0.38);
    let br = makePart(0.12, 0.60, 0.12, bodyColor,  0.24, -0.55, -0.38);
    // Dark hooves
    let hfl = makePart(0.13, 0.12, 0.13, darkBrown, -0.24, -0.90, 0.38);
    let hfr = makePart(0.13, 0.12, 0.13, darkBrown,  0.24, -0.90, 0.38);
    let hbl = makePart(0.13, 0.12, 0.13, darkBrown, -0.24, -0.90, -0.38);
    let hbr = makePart(0.13, 0.12, 0.13, darkBrown,  0.24, -0.90, -0.38);
    root.add(fl, fr, bl, br, hfl, hfr, hbl, hbr);

    // Short tail
    let tail = makePart(0.12, 0.10, 0.08, 0xfff0e0, 0, 0.12, -0.62);
    root.add(tail);

    root.userData.legs = { fl, fr, bl, br };
    root.userData.headParts = { head, neck, snout, nose, earL, earR };

    return root;
}

export class Mob {
    constructor(scene, getBlockFn, isDeer=false) {
        this.scene = scene;
        this.getBlock = getBlockFn;
        this.isDeer = isDeer;

        this.group = isDeer ? buildDeer() : buildRabbit();
        this.group.position.set(Math.random()*30-15, 80, Math.random()*30-15);
        this.group.userData.isMob = true;
        this.group.userData.mob = this;

        // Mark every child mesh so raycasts work
        this.group.traverse(obj => {
            if(obj.isMesh) {
                obj.userData.isMob = true;
                obj.userData.mob = this;
            }
        });

        this.scene.add(this.group);

        this.velocity = new THREE.Vector3();
        this.health = isDeer ? 3 : 1;

        // Wander AI state — start moving immediately so mob finds ground fast
        this.wanderTimer = Math.random() * 0.5; // short initial delay
        this.targetDir = new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
        this.isMoving = true; // start moving right away
        this.restTimer = 0;

        // Leg animation
        this.legPhase = 0;

        // Rabbit hop cooldown timer (prevents 12 hops/sec at 60fps)
        this.hopTimer = 0;

        mobsList.push(this);
    }

    get mesh() { return this.group; } // compatibility shim

    isBlocked(nx, ny, nz) {
        let r = this.isDeer ? 0.35 : 0.18; // Mob radius
        let minX = Math.floor(nx - r);
        let maxX = Math.floor(nx + r);
        let minZ = Math.floor(nz - r);
        let maxZ = Math.floor(nz + r);
        
        // Height range (add small epsilon to avoid floor scrapes counting as walls)
        let minY = Math.floor(ny - (this.isDeer ? 0.96 : 0.20) + 0.1); 
        let maxY = Math.floor(ny + (this.isDeer ? 0.40 : 0.15));

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
        // Check if chunk is loaded. If not, freeze physics to prevent falling out.
        let cx = Math.floor(this.group.position.x / 16);
        let cz = Math.floor(this.group.position.z / 16);
        if (window.chunks && !window.chunks[`${cx},${cz}`]) return; 

        // Respawn on surface if fell off the world
        if(this.group.position.y < -30) {
            // Find a surface position near where the mob was
            let rx = Math.floor(this.group.position.x);
            let rz = Math.floor(this.group.position.z);
            // Search for solid ground
            let ry = 90;
            if(window.getBlockGlobal) {
                for(let y = 100; y >= 0; y--) {
                    let b = window.getBlockGlobal(rx, y, rz);
                    if(b !== 0 && b !== 11) { ry = y + 1; break; } // not AIR(0) or WATER(11)
                }
            }
            this.group.position.set(rx + 0.5, ry + 1, rz + 0.5);
            this.velocity.set(0, 0, 0);
        }

        let pos = this.group.position;
        let blockAtCenter = this.getBlock(Math.floor(pos.x), Math.floor(pos.y + 0.1), Math.floor(pos.z));
        let inWater = blockAtCenter === BLOCKS.WATER;

        // Gravity & Buoyancy
        if (inWater) {
             this.velocity.y += 12 * delta; // float up
             if(this.velocity.y > 3) this.velocity.y = 3;
        } else {
             this.velocity.y -= (this.isDeer ? 30 : 25) * delta;
        }

        let halfH = this.isDeer ? 0.96 : 0.20;
        let speed = this.isDeer ? 4.5 : 2.5;
        if (inWater) speed *= 0.6; // swim slower

        let dist = this.group.position.distanceTo(playerPos);

        // ---- Wander / flee AI ----
        this.wanderTimer -= delta;
        if(this.wanderTimer <= 0) {
            let fleeing = (this.isDeer && dist < 10) || (!this.isDeer && dist < 5);
            if(fleeing) {
                // Run away from player, but more smoothly
                let awayDir = new THREE.Vector3().subVectors(this.group.position, playerPos).normalize();
                
                // Add a bit of noise to fleeing so they don't get stuck parallel to walls
                awayDir.x += (Math.random()-0.5)*0.5;
                if(this.onGround && Math.random() < 0.2) this.velocity.y = this.isDeer ? 8.5 : 6.5; // Random jump while fleeing
                
                this.targetDir.copy(awayDir).normalize();
                this.wanderTimer = 0.8;
                this.isMoving = true;
                this.restTimer = 0;
            } else {
                // Alternate between moving and resting
                if(this.isMoving) {
                    // Switch to rest
                    this.isMoving = false;
                    this.restTimer = 3.0 + Math.random() * 5.0; // Stand still longer
                    this.wanderTimer = this.restTimer;
                } else {
                    // Start moving in new direction
                    this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                    this.isMoving = true;
                    this.wanderTimer = 1.0 + Math.random() * 2.5; // Walk shorter durations
                }
            }

            // Deer occasionally jumps fences / obstacles
            if(this.isDeer && this.isMoving && this.velocity.y === 0) {
                if(Math.random() < 0.15) this.velocity.y = 8;
            }
        }

        // Rabbits hop — use hopTimer to limit jump rate (once per ~0.5s)
        if(!this.isDeer && this.isMoving) {
            this.hopTimer -= delta;
            if(this.onGround && this.hopTimer <= 0) {
                this.velocity.y = 6.5;
                this.hopTimer = 0.4 + Math.random() * 0.4; // 0.4–0.8s between hops
            }
        }

        // Apply horizontal movement
        if(this.isMoving) {
            this.velocity.x = this.targetDir.x * speed;
            this.velocity.z = this.targetDir.z * speed;
        } else {
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
        }

        // Applies gravity and calculates new position
        pos = this.group.position;
        let ny = pos.y + this.velocity.y * delta;
        let nx = pos.x;
        let nz = pos.z;

        // Ensure no NaNs can ever break the mob coordinates
        if (isNaN(ny)) ny = pos.y;
        if (isNaN(this.velocity.x)) this.velocity.x = 0;
        if (isNaN(this.velocity.y)) this.velocity.y = 0;
        if (isNaN(this.velocity.z)) this.velocity.z = 0;

        // ---- Wall Collision with Sliding (X/Z independent) ----
        let hitWall = false;
        if (this.isMoving) {
            let nextX = pos.x + this.velocity.x * delta;
            // Only apply X if not blocked
            if (this.isBlocked(nextX, pos.y, pos.z)) {
                this.velocity.x *= -0.2;
                hitWall = true;
            } else nx = nextX;
            
            let nextZ = pos.z + this.velocity.z * delta;
            // Only apply Z if not blocked
            if (this.isBlocked(nx, pos.y, nextZ)) {
                this.velocity.z *= -0.2;
                hitWall = true;
            } else nz = nextZ;
        }

        // ---- Ceiling Collision ----
        if (this.velocity.y > 0) {
            let topY = Math.floor(ny + (this.isDeer ? 0.40 : 0.15));
            let r = this.isDeer ? 0.35 : 0.18;
            let hitCeiling = false;
            for (let xx = Math.floor(nx - r); xx <= Math.floor(nx + r); xx++) {
                for (let zz = Math.floor(nz - r); zz <= Math.floor(nz + r); zz++) {
                    let cb = this.getBlock(xx, topY, zz);
                    if (cb !== BLOCKS.AIR && cb !== BLOCKS.WATER) hitCeiling = true;
                }
            }
            if (hitCeiling) {
                this.velocity.y = 0;
                ny = pos.y; // Abort upward movement
            }
        }

        // ---- Swept Ground collision (fall-through prevention) ----
        // Scan every block between old feet and new feet position
        let yFeetOld = Math.floor(pos.y - halfH);
        let yFeetNew = Math.floor(ny  - halfH);
        let blockBelow = BLOCKS.AIR;
        let groundYHit = yFeetNew;
        let r = this.isDeer ? 0.35 : 0.18;

        // Always scan at least the new position (handles yFeetOld == yFeetNew case)
        let yStart = Math.max(yFeetOld, yFeetNew); // highest y to start scan
        let yEnd   = Math.min(yFeetOld, yFeetNew); // lowest  y to stop

        for (let yy = yStart; yy >= yEnd; yy--) {
            let isSolid = false;
            for (let xx = Math.floor(nx - r); xx <= Math.floor(nx + r) && !isSolid; xx++) {
                for (let zz = Math.floor(nz - r); zz <= Math.floor(nz + r) && !isSolid; zz++) {
                    let gb = this.getBlock(xx, yy, zz);
                    if (gb !== BLOCKS.AIR && gb !== BLOCKS.WATER) isSolid = true;
                }
            }
            if (isSolid) {
                // Land on top of solid block only when falling (velocity.y <= 0)
                if(this.velocity.y <= 0) {
                    blockBelow = 1;
                    groundYHit = yy;
                }
                break;
            }
        }

        this.onGround = false;
        if(blockBelow !== BLOCKS.AIR) {
            this.velocity.y = 0;
            ny = groundYHit + 1 + halfH;
            this.onGround = true;
        }

        if(hitWall && this.onGround) {
            // If blocked on the ground, either jump over it or pick a completely new direction to avoid getting stuck
            if (this.velocity.y === 0 && Math.random() < 0.3) {
                 this.velocity.y = this.isDeer ? 8.5 : 6; // moderate jump to clear 1 block
            } else {
                 this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
            }
        }

        this.group.position.set(nx, ny, nz);

        // ---- Face movement direction ----
        if(this.isMoving && (Math.abs(this.velocity.x) + Math.abs(this.velocity.z)) > 0.2) {
            let angle = Math.atan2(this.velocity.x, this.velocity.z);
            this.group.rotation.y = angle;
        }

        // ---- Smooth animations ----
        let legs = this.group.userData.legs;
        
        if (this.isDeer) {
            if(this.isMoving) this.legPhase += delta * 8;
            if(legs) {
                // Deer stride
                let swing = Math.sin(this.legPhase) * 0.45;
                legs.fl.rotation.x =  swing;
                legs.br.rotation.x =  swing;
                legs.fr.rotation.x = -swing;
                legs.bl.rotation.x = -swing;
                
                // Head bob
                let headParts = this.group.userData.headParts;
                if(headParts) {
                    let bob = Math.abs(Math.cos(this.legPhase)) * 0.15;
                    headParts.neck.rotation.x = -0.35 + bob;
                }
            }
        } else {
            // Rabbit hop animation (driven by vertical velocity)
            if(legs) {
                let yVel = this.velocity.y;
                let pose = 0;
                
                if (yVel > 2) pose = 0.6; // jumping up, legs back
                else if (yVel < -2) pose = -0.4; // falling down, legs forward
                else pose = 0; // standing
                
                // Lerp towards target pose
                legs.fl.rotation.x += (pose - legs.fl.rotation.x) * delta * 15;
                legs.fr.rotation.x += (pose - legs.fr.rotation.x) * delta * 15;
                legs.bl.rotation.x += (pose - legs.bl.rotation.x) * delta * 15;
                legs.br.rotation.x += (pose - legs.br.rotation.x) * delta * 15;
                
                // Ear twitch occasionally
                let ears = this.group.userData.ears;
                if(ears && !this.isMoving && Math.random() < 0.02) {
                    ears.earL.rotation.z = -0.2 - Math.random() * 0.3;
                    ears.earR.rotation.z =  0.2 + Math.random() * 0.3;
                } else if(ears) {
                    ears.earL.rotation.z += (0 - ears.earL.rotation.z) * delta * 5;
                    ears.earR.rotation.z += (0 - ears.earR.rotation.z) * delta * 5;
                }
            }
        }
    }

    takeDamage() {
        this.health -= 1;
        if(this.health <= 0) {
            this.scene.remove(this.group);
            let idx = mobsList.indexOf(this);
            if(idx > -1) mobsList.splice(idx, 1);
            return true;
        }
        return false;
    }
}
