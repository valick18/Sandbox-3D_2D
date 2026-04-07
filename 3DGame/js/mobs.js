import * as THREE from 'three';
import { BLOCKS } from './textures.js';

export const mobsList = [];

export class Mob {
    constructor(scene, getBlockFn, isDeer=false) {
        this.scene = scene;
        this.getBlock = getBlockFn;
        this.isDeer = isDeer;
        
        let color = isDeer ? 0x8b5a2b : 0xffffff;
        let size = isDeer ? 1.5 : 0.4;
        
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            new THREE.MeshLambertMaterial({ color: color })
        );
        this.mesh.position.set(Math.random()*20-10, 80, Math.random()*20-10);
        this.mesh.userData = { isMob: true, mob: this };
        this.scene.add(this.mesh);
        
        this.velocity = new THREE.Vector3();
        this.health = isDeer ? 3 : 1; // clicks to kill
        
        this.hopTimer = 0;
        this.targetDir = new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
        
        mobsList.push(this);
    }
    
    update(delta, playerPos) {
        if(this.mesh.position.y < -50) {
            this.mesh.position.y = 80; // Reset if fell through world before chunks loaded
        }
        
        this.velocity.y -= 40 * delta; // gravity
        
        let halfHeight = this.isDeer ? 0.75 : 0.2;
        
        // simple hop AI
        this.hopTimer -= delta;
        if(this.hopTimer <= 0) {
            this.hopTimer = this.isDeer ? 1.0 + Math.random() : 0.5 + Math.random()*0.5;
            this.targetDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
            
            // if player nearby
            let dist = this.mesh.position.distanceTo(playerPos);
            if(this.isDeer && dist < 12) {
                // RUN AWAY
                this.targetDir.subVectors(this.mesh.position, playerPos).normalize();
                this.hopTimer = 0.5;
            } else if (!this.isDeer && dist < 5) {
                this.targetDir.subVectors(this.mesh.position, playerPos).normalize();
            }
            // jump
            if (this.velocity.y === 0) {
               this.velocity.y = this.isDeer ? 10 : 8;
            }
        }
        
        let speed = this.isDeer ? 6 : 3;
        if (this.velocity.y > 0) {
            this.velocity.x = this.targetDir.x * speed;
            this.velocity.z = this.targetDir.z * speed;
        } else {
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }
        
        let nx = this.mesh.position.x + this.velocity.x * delta;
        let ny = this.mesh.position.y + this.velocity.y * delta;
        let nz = this.mesh.position.z + this.velocity.z * delta;
        
        let floorY = Math.floor(ny - halfHeight);
        let blockBelow = this.getBlock(Math.floor(nx), floorY, Math.floor(nz));
        
        if (blockBelow !== BLOCKS.AIR && blockBelow !== BLOCKS.LEAVES) {
            // Hit ground
            this.velocity.y = 0;
            // Snap to ground top + halfHeight
            ny = floorY + 1 + halfHeight;
        } else {
            // Check wall loosely
            let wallBlock = this.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
            if (wallBlock !== BLOCKS.AIR && wallBlock !== BLOCKS.LEAVES) {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
                nx = this.mesh.position.x;
                nz = this.mesh.position.z;
            }
        }
        
        this.mesh.position.set(nx, ny, nz);
    }
    
    takeDamage() {
        this.health -= 1;
        if(this.health <= 0) {
             this.scene.remove(this.mesh);
             let idx = mobsList.indexOf(this);
             if(idx > -1) mobsList.splice(idx, 1);
             return true; // died
        }
        return false;
    }
}
