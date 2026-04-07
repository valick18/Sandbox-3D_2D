import { CONST, BLOCK_DEF } from './constants.js';

export class Enemy {
    constructor(x, y, type = "slime") {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === "zombie") {
            this.width = 12;
            this.height = 20;
            this.vx = (Math.random() > 0.5 ? 1 : -1) * 0.03; // Slower
            this.vy = 0;
            this.color = '#2E8B57'; // SeaGreen
            this.bounce = 0;
            this.hp = 8;
        } else {
            this.width = 10;
            this.height = 10;
            this.vx = (Math.random() > 0.5 ? 1 : -1) * 0.05;
            this.vy = 0;
            // Biome based coloring approximation based on spawn position
            let h = Math.random() * 60 + 100; // default green-ish
            this.color = `hsl(${h}, 80%, 50%)`;
            this.bounce = 0.5 + Math.random() * 0.3;
            this.hp = 3;
        }
    }
    
    update(dt, world, playerX, playerY) {
        // Apply Gravity
        this.vy += CONST.GRAVITY * dt;
        this.vy = Math.min(this.vy, CONST.MAX_FALL_SPEED * dt);
        
        // Chase player if near
        let dx = (playerX || this.x) - this.x;
        let dy = (playerY || this.y) - this.y;
        let distSq = dx*dx + dy*dy;
        
        if (distSq < 150*150 && playerX !== undefined) {
            // Chase
            let speed = this.type === "zombie" ? 0.035 : 0.055;
            this.vx = (dx > 0 ? 1 : -1) * speed;
        }

        // Move X
        this.x += this.vx * dt;
        if (this.checkCollision(world, this.x, this.y)) {
            this.x -= this.vx * dt;
            this.vx *= -1; // Turn around
        }
        
        // Move Y
        this.y += this.vy;
        if (this.checkCollision(world, this.x, this.y)) {
            this.y -= this.vy;
            if (this.vy > 0) {
                // Hit ground, bounce
                this.vy = -this.vy * this.bounce;
                // If bounce is too small, jump randomly
                if(Math.abs(this.vy) < 0.1) {
                    this.vy = -0.3 * dt;
                    // Randomly switch direction sometimes
                    if(distSq >= 150*150 && Math.random() < 0.2) this.vx *= -1;
                }
            } else {
                this.vy = 0; // Hit ceiling
            }
        }
    }
    
    checkCollision(world, x, y) {
        let left = Math.floor(x / CONST.TILE_SIZE);
        let right = Math.floor((x + this.width) / CONST.TILE_SIZE);
        let top = Math.floor(y / CONST.TILE_SIZE);
        let bottom = Math.floor((y + this.height) / CONST.TILE_SIZE);

        for (let tx = left; tx <= right; tx++) {
            for (let ty = top; ty <= bottom; ty++) {
                let id = world.getBlock(tx, ty);
                if (BLOCK_DEF[id] && BLOCK_DEF[id].solid) {
                    return true;
                }
            }
        }
        return false;
    }
    
    render(ctx, cameraX, cameraY) {
        let px = Math.floor(this.x - cameraX);
        let py = Math.floor(this.y - cameraY);
        
        ctx.fillStyle = this.color;
        
        if (this.type === "zombie") {
            ctx.fillRect(px, py, this.width, this.height);
            ctx.fillStyle = '#006400';
            let armOffset = this.vx > 0 ? this.width : -4;
            ctx.fillRect(px + armOffset, py + 8, 4, 4);
        } else {
            // Circle/Rectangle shapes
            ctx.beginPath();
            ctx.arc(px + this.width/2, py + this.height/2 + 2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            let eyeSide = this.vx > 0 ? 2 : -2;
            ctx.fillRect(px + 2 + eyeSide, py + 2, 2, 2);
            ctx.fillRect(px + 6 + eyeSide, py + 2, 2, 2);
            
            ctx.fillStyle = '#000';
            ctx.fillRect(px + 3 + eyeSide, py + 3, 1, 1);
            ctx.fillRect(px + 7 + eyeSide, py + 3, 1, 1);
        }
    }
}
