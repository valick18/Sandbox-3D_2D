export const BLOCKS = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    SAND: 6,
    WATER: 7,
    BEDROCK: 8,
    COAL: 9,
    GOLD: 10,
    IRON: 11,
    WORKBENCH: 12,
    TORCH: 13
};

// Items exist in inventory but may or may not be blocks. (Blocks can be items too, sharing the same ID namespace if we want, or separated).
// Let's share namespace for simplicity.
export const ITEMS = {
    WOOD_PICKAXE: 20,
    STONE_PICKAXE: 21,
    WOOD_AXE: 22
};

export const CONST = {
    TILE_SIZE: 16,
    CHUNK_W: 32, // Width in tiles
    CHUNK_H: 128, // Height in tiles (Total world height)
    GRAVITY: 0.015,
    MAX_FALL_SPEED: 0.8,
    PLAYER_SPEED: 0.2, // Increased from 0.15 for better control
    PLAYER_JUMP: 0.45, // Increased from 0.35 for higher jumps
    RENDER_CHUNKS: 2 // Render this many chunks left and right of player's chunk
};

// Map block ID to descriptive traits and colors (for procedural texture generation)
export const BLOCK_DEF = {
    [BLOCKS.AIR]: { solid: false, name: "Air" },
    [BLOCKS.DIRT]: { solid: true, baseHex: "#5E3A18", name: "Dirt", hardness: 100, tool: "none" },
    [BLOCKS.GRASS]: { solid: true, baseHex: "#458B00", name: "Grass", hardness: 100, tool: "none" },
    [BLOCKS.STONE]: { solid: true, baseHex: "#777777", name: "Stone", hardness: 500, tool: "pickaxe" },
    [BLOCKS.WOOD]: { solid: true, baseHex: "#4E2F13", name: "Wood", hardness: 200, tool: "axe" },
    [BLOCKS.LEAVES]: { solid: true, baseHex: "#228B22", name: "Leaves", hardness: 50, tool: "none" },
    [BLOCKS.SAND]: { solid: true, baseHex: "#D2B48C", name: "Sand", hardness: 80, tool: "none" },
    [BLOCKS.WATER]: { solid: false, baseHex: "#1E90FF", name: "Water", liquid: true },
    [BLOCKS.BEDROCK]: { solid: true, baseHex: "#111111", name: "Bedrock", hardness: Infinity },
    [BLOCKS.COAL]: { solid: true, baseHex: "#222222", name: "Coal Ore", hardness: 600, tool: "pickaxe" },
    [BLOCKS.GOLD]: { solid: true, baseHex: "#FFD700", name: "Gold Ore", hardness: 800, tool: "pickaxe" },
    [BLOCKS.IRON]: { solid: true, baseHex: "#A19D94", name: "Iron Ore", hardness: 700, tool: "pickaxe" },
    [BLOCKS.WORKBENCH]: { solid: false, baseHex: "#8B5A2B", name: "Workbench", hardness: 200, tool: "axe", isCraftingStation: true },
    [BLOCKS.TORCH]: { solid: false, baseHex: "#FFaa00", name: "Torch", hardness: 10, tool: "none", light: 10 }
};

export const ITEM_DEF = {
    ...BLOCK_DEF,
    [ITEMS.WOOD_PICKAXE]: { name: "Wooden Pick", toolType: "pickaxe", power: 2, baseHex: "#8B5A2B" },
    [ITEMS.STONE_PICKAXE]: { name: "Stone Pick", toolType: "pickaxe", power: 4, baseHex: "#777777" },
    [ITEMS.WOOD_AXE]: { name: "Wooden Axe", toolType: "axe", power: 2, baseHex: "#8B5A2B" }
};
