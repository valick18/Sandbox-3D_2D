import { CONST, BLOCKS, BLOCK_DEF } from './constants.js';

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 12; // slightly smaller than a tile
        this.height = 24; // 1.5 tiles high
        
        this.walkCycle = 0;
        this.dir = 1; // 1 = right, -1 = left
        
        // Input state
        this.keys = {};
        
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
    }

    update(dt, world) {
        // Horizontal Input
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            this.vx -= 0.05 * dt;
        } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            this.vx += 0.05 * dt;
        } else {
            this.vx *= 0.8; // friction
        }
        
        // Clamp horizontal speed
        this.vx = Math.max(-CONST.PLAYER_SPEED * dt, Math.min(CONST.PLAYER_SPEED * dt, this.vx));

        if (this.vx > 0.01) this.dir = 1;
        else if (this.vx < -0.01) this.dir = -1;

        if (Math.abs(this.vx) > 0.01 && this.onGround(world)) {
            this.walkCycle += Math.abs(this.vx) * 0.05; // Removed second dt multiplication
        } else if (!this.onGround(world)) {
            this.walkCycle = Math.PI / 4; // 'Jumping' pose
        } else {
            this.walkCycle = 0; // Standing
        }

        // Move X
        this.x += this.vx;
        if (this.checkCollision(world)) {
            this.x -= this.vx;
            this.vx = 0;
        }

        // Apply Gravity
        this.vy += CONST.GRAVITY * dt;
        this.vy = Math.min(this.vy, CONST.MAX_FALL_SPEED * dt); // Terminal velocity
        
        // Jump Input
        if ((this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['Space']) && this.onGround(world)) {
            this.vy = -CONST.PLAYER_JUMP * dt;
        }

        // Move Y
        this.y += this.vy;
        if (this.checkCollision(world)) {
            this.y -= this.vy;
            this.vy = 0;
        }
    }

    checkCollision(world) {
        // Find grid bounds
        let left = Math.floor(this.x / CONST.TILE_SIZE);
        let right = Math.floor((this.x + this.width) / CONST.TILE_SIZE);
        let top = Math.floor(this.y / CONST.TILE_SIZE);
        let bottom = Math.floor((this.y + this.height) / CONST.TILE_SIZE);

        for (let tx = left; tx <= right; tx++) {
            for (let ty = top; ty <= bottom; ty++) {
                let id = world.getBlock(tx, ty);
                if (BLOCK_DEF[id].solid) {
                    return true;
                }
            }
        }
        return false;
    }

    onGround(world) {
        // Check slightly below player
        let left = Math.floor(this.x / CONST.TILE_SIZE);
        let right = Math.floor((this.x + this.width) / CONST.TILE_SIZE);
        let bottom = Math.floor((this.y + this.height + 1) / CONST.TILE_SIZE);
        
        for (let tx = left; tx <= right; tx++) {
            let id = world.getBlock(tx, bottom);
            if (BLOCK_DEF[id].solid) {
                return true;
            }
        }
        return false;
    }
}
