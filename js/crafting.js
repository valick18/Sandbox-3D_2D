import { BLOCKS, ITEMS, ITEM_DEF } from './constants.js';

export const RECIPES = [
    {
        result: BLOCKS.WORKBENCH,
        count: 1,
        req: [{ id: BLOCKS.WOOD, count: 5 }],
        station: BLOCKS.AIR // Can be crafted anywhere
    },
    {
        result: BLOCKS.TORCH,
        count: 4,
        req: [{ id: BLOCKS.WOOD, count: 1 }, { id: BLOCKS.COAL, count: 1 }],
        station: BLOCKS.AIR
    },
    {
        result: ITEMS.WOOD_PICKAXE,
        count: 1,
        req: [{ id: BLOCKS.WOOD, count: 10 }],
        station: BLOCKS.WORKBENCH
    },
    {
        result: ITEMS.STONE_PICKAXE,
        count: 1,
        req: [{ id: BLOCKS.WOOD, count: 5 }, { id: BLOCKS.STONE, count: 10 }],
        station: BLOCKS.WORKBENCH
    },
    {
        result: ITEMS.WOOD_AXE,
        count: 1,
        req: [{ id: BLOCKS.WOOD, count: 10 }],
        station: BLOCKS.WORKBENCH
    }
];

export function canCraft(recipe, inventoryItems, nearWorkbench) {
    if (recipe.station === BLOCKS.WORKBENCH && !nearWorkbench) return false;
    
    // Check if inventory has enough ingredients
    for (let req of recipe.req) {
        let countInInv = inventoryItems.find(s => s.id === req.id)?.count || 0;
        if (countInInv < req.count) return false;
    }
    return true;
}

export function craftItem(recipe, inventory) {
    // Deduct reqs
    for (let req of recipe.req) {
        let slot = inventory.slots.find(s => s.id === req.id);
        if(slot) slot.count -= req.count;
    }
    // Add result
    inventory.addItem(recipe.result, recipe.count);
}
