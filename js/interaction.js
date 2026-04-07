import { CONST, BLOCKS, BLOCK_DEF, ITEM_DEF } from './constants.js';
import { sfxBreak, sfxPlace, sfxHit } from './audio.js';
import { RECIPES, canCraft, craftItem } from './crafting.js';

export class Inventory {
    constructor() {
        this.slots = [];
        this.activeSlot = 0;
        
        // Add bare hands
        this.slots.push({ id: BLOCKS.AIR, count: 1 });
    }
    
    addItem(id, amount = 1) {
        // Find existing stack
        let slot = this.slots.find(s => s.id === id);
        if (slot) {
            slot.count += amount;
        } else {
            this.slots.push({ id: id, count: amount });
        }
        return true;
    }
    
    useItem() {
        let slot = this.slots[this.activeSlot];
        // If it's not a tool and not air, consume 1
        if (slot && slot.id !== BLOCKS.AIR && !ITEM_DEF[slot.id].toolType) {
            if (slot.count > 0) {
                slot.count--;
                if(slot.count === 0) {
                   this.slots.splice(this.activeSlot, 1);
                   this.activeSlot = Math.max(0, this.activeSlot - 1);
                }
                return slot.id;
            }
        }
        return BLOCKS.AIR;
    }
    
    getCurrentPower(targetToolType) {
        let slot = this.slots[this.activeSlot];
        if (slot && slot.id !== BLOCKS.AIR && ITEM_DEF[slot.id].toolType === targetToolType) {
            return ITEM_DEF[slot.id].power;
        }
        return 1; // Base power for hands
    }
}

export class Interaction {
    constructor(canvas, camera, player, world, inventory) {
        this.canvas = canvas;
        this.camera = camera;
        this.player = player;
        this.world = world;
        this.inventory = inventory;
        
        // Mouse tracking
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;
        this.mouseButton = 0; // 0=left(break), 2=right(place)
        
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = Math.floor((e.clientX - rect.left) / (rect.width / canvas.width));
            this.mouseY = Math.floor((e.clientY - rect.top) / (rect.height / canvas.height));
        });
        
        canvas.addEventListener('mousedown', e => {
            this.isMouseDown = true;
            this.mouseButton = e.button;
        });
        
        canvas.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.miningProgress = 0;
            this.miningX = -1;
            this.miningY = -1;
        });
        
        // Disable context menu for right click
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Scroll to change inventory slot
        window.addEventListener('wheel', e => {
            if(this.inventory.slots.length === 0) return;
            if (e.deltaY > 0) {
                this.inventory.activeSlot = (this.inventory.activeSlot + 1) % this.inventory.slots.length;
            } else {
                this.inventory.activeSlot = (this.inventory.activeSlot - 1 + this.inventory.slots.length) % this.inventory.slots.length;
            }
            this.miningProgress = 0;
            this.updateInventoryUI();
        });
        
        // Crafting menu toggle
        window.addEventListener('keydown', e => {
            if(e.code === 'KeyE') {
                this.toggleCrafting();
            }
        });
        
        this.cooldown = 0;
        this.miningProgress = 0;
        this.miningX = -1;
        this.miningY = -1;
        this.isCraftingOpen = false;
    }
    
    toggleCrafting() {
        this.isCraftingOpen = !this.isCraftingOpen;
        const menu = document.getElementById('crafting-menu');
        if(this.isCraftingOpen) {
            menu.style.display = 'block';
            this.updateCraftingUI();
        } else {
            menu.style.display = 'none';
        }
    }
    
    updateCraftingUI() {
        const list = document.getElementById('recipe-list');
        list.innerHTML = '';
        
        // Check if near workbench
        let nearWorkbench = false;
        let px = Math.floor(this.player.x / CONST.TILE_SIZE);
        let py = Math.floor(this.player.y / CONST.TILE_SIZE);
        for(let tx = px - 2; tx <= px + 2; tx++) {
            for(let ty = py - 2; ty <= py + 2; ty++) {
                if(this.world.getBlock(tx, ty) === BLOCKS.WORKBENCH) nearWorkbench = true;
            }
        }
        
        RECIPES.forEach(r => {
            let div = document.createElement('div');
            div.className = 'recipe';
            
            let nameSpan = document.createElement('span');
            nameSpan.innerText = `${ITEM_DEF[r.result].name} x${r.count}`;
            
            let reqSpan = document.createElement('span');
            reqSpan.style.fontSize = '10px';
            reqSpan.innerText = r.req.map(req => `${ITEM_DEF[req.id].name}:${req.count}`).join(', ');
            
            let btn = document.createElement('button');
            btn.innerText = 'Craft';
            
            let craftable = canCraft(r, this.inventory.slots, nearWorkbench);
            if(!craftable) btn.disabled = true;
            
            btn.onclick = () => {
                craftItem(r, this.inventory);
                this.updateInventoryUI();
                this.updateCraftingUI();
            };
            
            div.appendChild(nameSpan);
            div.appendChild(reqSpan);
            div.appendChild(btn);
            list.appendChild(div);
        });
    }
    
    update(dt) {
        if (this.cooldown > 0) {
            this.cooldown -= dt;
            return;
        }
        
        if (this.isMouseDown) {
            // Get world coords
            const worldX = this.mouseX + this.camera.x;
            const worldY = this.mouseY + this.camera.y;
            
            // Player center
            const px = this.player.x + this.player.width / 2;
            const py = this.player.y + this.player.height / 2;
            
            // Distance check (Reach = ~5 tiles)
            const distSq = (worldX - px)*(worldX - px) + (worldY - py)*(worldY - py);
            if (distSq > (5 * CONST.TILE_SIZE) * (5 * CONST.TILE_SIZE)) return;
            
            const tx = Math.floor(worldX / CONST.TILE_SIZE);
            const ty = Math.floor(worldY / CONST.TILE_SIZE);
            
            const currentBlockId = this.world.getBlock(tx, ty);
            
            if (this.mouseButton === 0) { // Break limit
                if (currentBlockId !== BLOCKS.AIR && currentBlockId !== BLOCKS.BEDROCK) {
                    
                    // Reset progress if moved to new block
                    if (this.miningX !== tx || this.miningY !== ty) {
                        this.miningX = tx;
                        this.miningY = ty;
                        this.miningProgress = 0;
                    }
                    
                    let blockDef = ITEM_DEF[currentBlockId];
                    let hardness = blockDef.hardness || 100;
                    let requiredTool = blockDef.tool;
                    
                    let power = this.inventory.getCurrentPower(requiredTool);
                    
                    // If using bare hands on stone, drastically reduce power
                    if(requiredTool === "pickaxe" && power === 1) power = 0.1;
                    
                    this.miningProgress += dt * power;
                    sfxHit(); // tiny tapping sound? Actually too many sounds, limit it:
                    if(Math.random() < 0.1) sfxHit();
                    
                    if (this.miningProgress >= hardness) {
                        // Gather block (transform specific drops like grass to dirt here if needed)
                        let dropId = currentBlockId;
                        if(dropId === BLOCKS.GRASS) dropId = BLOCKS.DIRT;
                        else if(dropId === BLOCKS.LEAVES) dropId = BLOCKS.WOOD; // Simplifying leaves dropping wood/nothing
                        else if(dropId === BLOCKS.IRON || dropId === BLOCKS.GOLD) dropId = BLOCKS.STONE; // Simplify
                        
                        this.inventory.addItem(dropId, 1);
                        this.world.setBlock(tx, ty, BLOCKS.AIR);
                        sfxBreak();
                        this.cooldown = 150; // ms
                        this.miningProgress = 0;
                        this.updateInventoryUI();
                    }
                }
            } else if (this.mouseButton === 2) { // Place
                if (currentBlockId === BLOCKS.AIR) {
                    // Check intersection with player
                    let pLeft = Math.floor(this.player.x / CONST.TILE_SIZE);
                    let pRight = Math.floor((this.player.x + this.player.width) / CONST.TILE_SIZE);
                    let pTop = Math.floor(this.player.y / CONST.TILE_SIZE);
                    let pBottom = Math.floor((this.player.y + this.player.height) / CONST.TILE_SIZE);
                    
                    if (!(tx >= pLeft && tx <= pRight && ty >= pTop && ty <= pBottom)) {
                        let toPlace = this.inventory.useItem();
                        if (toPlace !== BLOCKS.AIR) {
                            this.world.setBlock(tx, ty, toPlace);
                            sfxPlace();
                            this.cooldown = 150;
                            this.updateInventoryUI();
                        }
                    }
                }
            }
        }
    }
    
    updateInventoryUI() {
        const container = document.getElementById('inventory-bar');
        container.innerHTML = '';
        this.inventory.slots.forEach((slot, index) => {
            const div = document.createElement('div');
            div.className = 'inv-slot' + (index === this.inventory.activeSlot ? ' active' : '');
            
            if(slot.id === BLOCKS.AIR) {
                div.innerHTML = "<span style='font-size:8px'>Hand</span>";
            } else {
                let def = ITEM_DEF[slot.id];
                div.style.borderBottom = `4px solid ${def.baseHex}`;
                
                // Short name based on ID
                div.innerText = def.name.substring(0, 3);
                
                if(!def.toolType) {
                    const count = document.createElement('span');
                    count.className = 'inv-count';
                    count.innerText = slot.count;
                    div.appendChild(count);
                }
            }
            
            div.onclick = () => {
                this.inventory.activeSlot = index;
                this.miningProgress = 0;
                this.updateInventoryUI();
            };
            
            container.appendChild(div);
        });
    }
}
