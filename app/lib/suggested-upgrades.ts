/**
 * First-visit suggested upgrades (applied to claim via scripts/apply-suggested-upgrades.ts).
 */

import type { ClaimItem } from "./types";

export type SuggestedAddItem = {
  description: string;
  brand: string;
  unit_cost: number;
  qty: number;
  room: string;
  category: string;
  age_years: number;
  condition: string;
};

export type SuggestedSplitPart = {
  description: string;
  unit_cost: number;
  qty: number;
  brand?: string;
};

export type SuggestedUpgrade =
  | { type: "RENAME"; match_description: string; new_description: string; reason: string }
  | { type: "MOVE"; match_description: string; new_room: string; reason: string }
  | {
      type: "PRICE";
      match_description: string;
      new_unit_cost: number;
      reason: string;
      new_description?: string;
      new_qty?: number;
    }
  | {
      type: "QTY";
      match_description: string;
      new_qty: number;
      reason: string;
      new_unit_cost?: number;
    }
  | { type: "ADD"; item: SuggestedAddItem; reason: string }
  | {
      type: "SPLIT";
      match_description: string;
      item_a: SuggestedSplitPart;
      item_b: SuggestedSplitPart;
      reason: string;
    }
  | { type: "REMOVE"; match_description: string; reason: string };

export const SUGGESTED_UPGRADES: Record<string, SuggestedUpgrade[]> = {
  "Living Room": [
    {
      type: "RENAME",
      match_description: "Bowl with food",
      new_description: "Decorative Ceramic Bowl",
      reason: "Clarified description",
    },
    {
      type: "MOVE",
      match_description: "Artwork (Zebra Print)",
      new_room: "Art Collection",
      reason: "Art items tracked separately",
    },
    {
      type: "MOVE",
      match_description: "Artwork (Heart)",
      new_room: "Art Collection",
      reason: "Art items tracked separately",
    },
  ],

  Kitchen: [
    {
      type: "RENAME",
      match_description: "Ceramic teapot",
      new_description: "Japanese Cast Iron Teapot",
      reason: "Descriptive rename",
    },
    {
      type: "RENAME",
      match_description: "Wooden Bowl with Tea",
      new_description: "Hand-Turned Wooden Serving Bowl",
      reason: "Descriptive rename",
    },
    {
      type: "RENAME",
      match_description: "Textile",
      new_description: "Linen Kitchen Runner",
      reason: "Clarified description",
    },
    {
      type: "ADD",
      item: {
        description: "Bar stools",
        brand: "Restoration Hardware",
        unit_cost: 580,
        qty: 6,
        room: "Kitchen",
        category: "Furniture",
        age_years: 0,
        condition: "New",
      },
      reason: "Island seating",
    },
    {
      type: "ADD",
      item: {
        description: "All-Clad D5 10-piece cookware set",
        brand: "All-Clad",
        unit_cost: 895,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Standard kitchen cookware",
    },
    {
      type: "ADD",
      item: {
        description: "Le Creuset Dutch oven 5.5qt",
        brand: "Le Creuset",
        unit_cost: 420,
        qty: 2,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Dutch ovens",
    },
    {
      type: "ADD",
      item: {
        description: "Lodge cast iron skillet 12in",
        brand: "Lodge",
        unit_cost: 45,
        qty: 2,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 3,
        condition: "Average",
      },
      reason: "Cast iron skillets",
    },
    {
      type: "ADD",
      item: {
        description: "Shun Premier knife set 6-piece",
        brand: "Shun",
        unit_cost: 680,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Knife set",
    },
    {
      type: "ADD",
      item: {
        description: "KitchenAid Artisan stand mixer",
        brand: "KitchenAid",
        unit_cost: 500,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Stand mixer",
    },
    {
      type: "ADD",
      item: {
        description: "Vitamix Professional blender",
        brand: "Vitamix",
        unit_cost: 650,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Blender",
    },
    {
      type: "ADD",
      item: {
        description: "Breville food processor 16-cup",
        brand: "Breville",
        unit_cost: 380,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Food processor",
    },
    {
      type: "ADD",
      item: {
        description: "Baratza Encore coffee grinder",
        brand: "Baratza",
        unit_cost: 170,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Coffee grinder",
    },
    {
      type: "ADD",
      item: {
        description: "East Fork dinner plates service for 8",
        brand: "East Fork",
        unit_cost: 48,
        qty: 8,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Dinner plates",
    },
    {
      type: "ADD",
      item: {
        description: "East Fork pasta bowls service for 8",
        brand: "East Fork",
        unit_cost: 42,
        qty: 8,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Pasta bowls",
    },
    {
      type: "ADD",
      item: {
        description: "Riedel Veritas wine glasses set of 8",
        brand: "Riedel",
        unit_cost: 320,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Wine glasses",
    },
    {
      type: "ADD",
      item: {
        description: "Riedel champagne flutes set of 6",
        brand: "Riedel",
        unit_cost: 180,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Champagne flutes",
    },
    {
      type: "ADD",
      item: {
        description: "Duralex Picardie glasses set of 6",
        brand: "Duralex",
        unit_cost: 35,
        qty: 3,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Everyday glasses",
    },
    {
      type: "ADD",
      item: {
        description: "Staub cast iron roasting pan",
        brand: "Staub",
        unit_cost: 280,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Roasting pan",
    },
    {
      type: "ADD",
      item: {
        description: "Boos block maple cutting board 18x12",
        brand: "John Boos",
        unit_cost: 180,
        qty: 2,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Cutting boards",
    },
    {
      type: "ADD",
      item: {
        description: "OXO sheet pans set of 3",
        brand: "OXO",
        unit_cost: 85,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Sheet pans",
    },
    {
      type: "ADD",
      item: {
        description: "Oxo salad spinner large",
        brand: "OXO",
        unit_cost: 45,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Salad spinner",
    },
    {
      type: "ADD",
      item: {
        description: "Zwilling stainless mixing bowls set of 5",
        brand: "Zwilling",
        unit_cost: 120,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Mixing bowls",
    },
    {
      type: "ADD",
      item: {
        description: "Oxo glass food storage containers set of 10",
        brand: "OXO",
        unit_cost: 85,
        qty: 2,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Food storage",
    },
    {
      type: "ADD",
      item: {
        description: "Staub serving platter large oval",
        brand: "Staub",
        unit_cost: 120,
        qty: 2,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Serving platters",
    },
    {
      type: "ADD",
      item: {
        description: "OXO kitchen utensil set 5-piece",
        brand: "OXO",
        unit_cost: 65,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Kitchen utensils",
    },
    {
      type: "ADD",
      item: {
        description: "Breville kettle electric gooseneck",
        brand: "Breville",
        unit_cost: 180,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Electric kettle",
    },
    {
      type: "ADD",
      item: {
        description: "Chemex pour-over coffee maker 8-cup",
        brand: "Chemex",
        unit_cost: 55,
        qty: 1,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 2,
        condition: "Average",
      },
      reason: "Pour-over coffee maker",
    },
    {
      type: "ADD",
      item: {
        description: "La Marzocco Linea Mini espresso machine",
        brand: "La Marzocco",
        unit_cost: 5500,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Espresso machine",
    },
    {
      type: "ADD",
      item: {
        description: "Sub-Zero 147-bottle wine refrigerator",
        brand: "Sub-Zero",
        unit_cost: 6800,
        qty: 1,
        room: "Kitchen",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Wine refrigerator",
    },
    {
      type: "ADD",
      item: {
        description: "Linen aprons",
        brand: "Hedley & Bennett",
        unit_cost: 95,
        qty: 4,
        room: "Kitchen",
        category: "Kitchen",
        age_years: 1,
        condition: "Average",
      },
      reason: "Kitchen aprons",
    },
  ],

  "Bedroom Orly": [
    {
      type: "PRICE",
      match_description: "Mayfair bedframe",
      new_unit_cost: 800,
      reason: "Mayfair frames retail $800-1,200",
    },
    {
      type: "PRICE",
      match_description: "Window shades",
      new_unit_cost: 250,
      reason: "Custom shades $250-400 each",
    },
    {
      type: "QTY",
      match_description: "Sweaters",
      new_qty: 12,
      new_unit_cost: 150,
      reason: "Updated quantity and price",
    },
    {
      type: "QTY",
      match_description: "Nike shoes",
      new_qty: 3,
      new_unit_cost: 150,
      reason: "Multiple pairs, updated price",
    },
    {
      type: "QTY",
      match_description: "Pillows",
      new_qty: 4,
      new_unit_cost: 120,
      reason: "More pillows, updated price",
    },
    {
      type: "PRICE",
      match_description: "Razer BlackWidow V3 keyboard",
      new_unit_cost: 200,
      reason: "Updated to current model price",
    },
    {
      type: "RENAME",
      match_description: "Hitmonchan Pokemon card",
      new_description: "Hitmonchan 1st Edition Pokémon Card Graded PSA",
      reason: "Specific collectible description",
    },
    {
      type: "PRICE",
      match_description: "Hitmonchan 1st Edition Pokémon Card Graded PSA",
      new_unit_cost: 280,
      reason: "Graded 1st edition value",
    },
    {
      type: "ADD",
      item: {
        description: "Apple MacBook Pro 14in M3",
        brand: "Apple",
        unit_cost: 1999,
        qty: 1,
        room: "Bedroom Orly",
        category: "Electronics",
        age_years: 1,
        condition: "Average",
      },
      reason: "Second laptop for filmmaker",
    },
    {
      type: "ADD",
      item: {
        description: "Pokémon Base Set complete collection",
        brand: "",
        unit_cost: 650,
        qty: 1,
        room: "Bedroom Orly",
        category: "Collectibles",
        age_years: 0,
        condition: "Average",
      },
      reason: "Pokémon card collection",
    },
  ],

  "Bedroom Rafe": [
    {
      type: "QTY",
      match_description: "T-Shirts",
      new_qty: 30,
      new_unit_cost: 35,
      reason: "Updated price for brand tier",
    },
    {
      type: "QTY",
      match_description: "Jerseys",
      new_qty: 15,
      new_unit_cost: 95,
      reason: "More jerseys, updated price",
    },
    {
      type: "SPLIT",
      match_description: "Jeans",
      item_a: { description: "Casual jeans", unit_cost: 120, qty: 6 },
      item_b: { description: "Premium jeans", unit_cost: 280, qty: 4 },
      reason: "Casual and premium denim split",
    },
    {
      type: "SPLIT",
      match_description: "Crewneck Sweatshirts",
      item_a: { description: "Casual crewneck sweatshirts", unit_cost: 90, qty: 8 },
      item_b: { description: "Premium crewneck sweatshirts", unit_cost: 220, qty: 5 },
      reason: "Casual and premium split",
    },
    {
      type: "SPLIT",
      match_description: "Sweatpants",
      item_a: { description: "Casual sweatpants", unit_cost: 45, qty: 8 },
      item_b: { description: "Premium sweatpants", unit_cost: 180, qty: 7 },
      reason: "Casual and premium split",
    },
    {
      type: "QTY",
      match_description: "Casual Shoes",
      new_qty: 8,
      new_unit_cost: 150,
      reason: "More shoes, updated price",
    },
    {
      type: "PRICE",
      match_description: "Button-Up Shirts casual",
      new_unit_cost: 75,
      reason: "Updated price for brand tier",
    },
    {
      type: "PRICE",
      match_description: "Light Jackets",
      new_unit_cost: 180,
      reason: "Updated price for brand tier",
    },
    {
      type: "PRICE",
      match_description: "Pants",
      new_unit_cost: 150,
      reason: "Updated price for brand tier",
    },
    {
      type: "PRICE",
      match_description: "Heavy Jackets",
      new_unit_cost: 250,
      reason: "Updated for luxury streetwear tier",
    },
    {
      type: "PRICE",
      match_description: "Vintage T-Shirts",
      new_unit_cost: 150,
      reason: "Underground brand vintage tees",
    },
    {
      type: "PRICE",
      match_description: "Button-Up Shirts",
      new_unit_cost: 120,
      reason: "Updated for brand tier",
    },
    {
      type: "PRICE",
      match_description: "Hoodies",
      new_unit_cost: 180,
      reason: "Updated for luxury streetwear",
    },
    {
      type: "PRICE",
      match_description: "T-Shirts premium",
      new_unit_cost: 85,
      reason: "Updated for brand tier",
    },
    {
      type: "PRICE",
      match_description: "Cameupinthedrought BeyBelt",
      new_unit_cost: 650,
      reason: "Underground luxury belt price",
    },
    {
      type: "PRICE",
      match_description: "Athletic Shoes",
      new_unit_cost: 180,
      reason: "Updated for brand tier",
    },
  ],

  "David Office / Guest Room": [
    {
      type: "PRICE",
      match_description: "Chair",
      new_unit_cost: 1795,
      new_description: "Herman Miller Aeron Chair",
      reason: "Emmy winner office chair upgrade",
    },
    {
      type: "PRICE",
      match_description: "Computer monitor",
      new_unit_cost: 800,
      reason: "Updated monitor price",
    },
    {
      type: "PRICE",
      match_description: "Office supplies",
      new_unit_cost: 450,
      reason: "Updated value",
    },
    {
      type: "PRICE",
      match_description: "Desk Lamp",
      new_unit_cost: 380,
      reason: "Quality desk lamp",
    },
    {
      type: "QTY",
      match_description: "Pillows",
      new_qty: 4,
      new_unit_cost: 120,
      reason: "More pillows, updated price",
    },
    {
      type: "PRICE",
      match_description: "Books",
      new_unit_cost: 45,
      reason: "Updated book values",
    },
    {
      type: "SPLIT",
      match_description: "Sweaters",
      item_a: { description: "Casual sweaters", unit_cost: 120, qty: 5 },
      item_b: { description: "Premium cashmere sweaters", unit_cost: 380, qty: 3 },
      reason: "Casual and premium split",
    },
    {
      type: "SPLIT",
      match_description: "Candles",
      item_a: {
        description: "Diptyque Baies candles",
        brand: "Diptyque",
        unit_cost: 95,
        qty: 3,
      },
      item_b: {
        description: "Cire Trudon candles",
        brand: "Cire Trudon",
        unit_cost: 130,
        qty: 2,
      },
      reason: "Specified luxury candle brands",
    },
    {
      type: "MOVE",
      match_description: "Artwork",
      new_room: "Art Collection",
      reason: "Art tracked separately",
    },
    {
      type: "MOVE",
      match_description: "Prints",
      new_room: "Art Collection",
      reason: "Art tracked separately",
    },
  ],

  Garage: [
    {
      type: "REMOVE",
      match_description: "Golf clubs",
      reason: "Replacing with itemized set",
    },
    {
      type: "ADD",
      item: {
        description: "Titleist T200 iron set 4-PW",
        brand: "Titleist",
        unit_cost: 1400,
        qty: 2,
        room: "Garage",
        category: "Sports",
        age_years: 2,
        condition: "Average",
      },
      reason: "Proper iron sets",
    },
    {
      type: "ADD",
      item: {
        description: "TaylorMade Stealth driver",
        brand: "TaylorMade",
        unit_cost: 580,
        qty: 2,
        room: "Garage",
        category: "Sports",
        age_years: 2,
        condition: "Average",
      },
      reason: "Golf drivers",
    },
    {
      type: "ADD",
      item: {
        description: "Callaway Jaws MD5 wedge set",
        brand: "Callaway",
        unit_cost: 480,
        qty: 2,
        room: "Garage",
        category: "Sports",
        age_years: 2,
        condition: "Average",
      },
      reason: "Golf wedge sets",
    },
    {
      type: "QTY",
      match_description: "Surf boards",
      new_qty: 7,
      reason: "More realistic board quiver",
    },
    {
      type: "PRICE",
      match_description: "Surf boards",
      new_unit_cost: 600,
      reason: "Updated surfboard price",
    },
    {
      type: "PRICE",
      match_description: "Tennis racquets",
      new_unit_cost: 280,
      reason: "David plays seriously",
    },
    {
      type: "PRICE",
      match_description: "Flat screen TV",
      new_unit_cost: 1200,
      reason: "Updated TV price",
    },
    {
      type: "PRICE",
      match_description: "Golf balls",
      new_unit_cost: 55,
      new_qty: 6,
      reason: "Titleist Pro V1 pricing",
    },
    {
      type: "PRICE",
      match_description: "Speakers",
      new_unit_cost: 450,
      reason: "Updated speaker price",
    },
    {
      type: "SPLIT",
      match_description: "Wet suits",
      item_a: { description: "Standard wetsuits 3/2mm", unit_cost: 380, qty: 2 },
      item_b: { description: "Premium wetsuit Patagonia Yulex", unit_cost: 680, qty: 1 },
      reason: "Standard and premium split",
    },
    {
      type: "PRICE",
      match_description: "Quince carry on luggage",
      new_description: "Away carry-on hardside luggage",
      new_unit_cost: 395,
      reason: "Upgraded brand",
    },
    {
      type: "RENAME",
      match_description: "Boogie board holders",
      new_description: "Surfboard wall rack",
      reason: "Accurate description",
    },
    {
      type: "PRICE",
      match_description: "Surfboard wall rack",
      new_unit_cost: 180,
      reason: "Updated price",
    },
  ],

  Patio: [
    {
      type: "ADD",
      item: {
        description: "Teak outdoor dining table",
        brand: "Brown Jordan",
        unit_cost: 3200,
        qty: 1,
        room: "Patio",
        category: "Furniture",
        age_years: 2,
        condition: "Average",
      },
      reason: "Patio dining table",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor dining chairs",
        brand: "Brown Jordan",
        unit_cost: 850,
        qty: 6,
        room: "Patio",
        category: "Furniture",
        age_years: 2,
        condition: "Average",
      },
      reason: "Patio dining chairs",
    },
    {
      type: "ADD",
      item: {
        description: "Cantilever outdoor umbrella 11ft",
        brand: "Tuuci",
        unit_cost: 1800,
        qty: 1,
        room: "Patio",
        category: "Furniture",
        age_years: 2,
        condition: "Average",
      },
      reason: "Patio umbrella",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor rug 8x10",
        brand: "Gandia Blasco",
        unit_cost: 2400,
        qty: 1,
        room: "Patio",
        category: "Decorative",
        age_years: 2,
        condition: "Average",
      },
      reason: "Outdoor rug",
    },
    {
      type: "ADD",
      item: {
        description: "Terracotta planters large",
        brand: "",
        unit_cost: 380,
        qty: 4,
        room: "Patio",
        category: "Decorative",
        age_years: 2,
        condition: "Average",
      },
      reason: "Decorative planters",
    },
    {
      type: "ADD",
      item: {
        description: "Potted olive tree",
        brand: "",
        unit_cost: 450,
        qty: 2,
        room: "Patio",
        category: "Decorative",
        age_years: 3,
        condition: "Average",
      },
      reason: "Decorative trees",
    },
    {
      type: "ADD",
      item: {
        description: "Potted citrus tree",
        brand: "",
        unit_cost: 220,
        qty: 3,
        room: "Patio",
        category: "Decorative",
        age_years: 2,
        condition: "Average",
      },
      reason: "Decorative trees",
    },
    {
      type: "ADD",
      item: {
        description: "Ceramic garden pots medium",
        brand: "",
        unit_cost: 120,
        qty: 8,
        room: "Patio",
        category: "Decorative",
        age_years: 2,
        condition: "Average",
      },
      reason: "Decorative pots",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor string lights 48ft",
        brand: "Brightech",
        unit_cost: 280,
        qty: 2,
        room: "Patio",
        category: "Lighting",
        age_years: 1,
        condition: "Average",
      },
      reason: "Patio lighting",
    },
    {
      type: "ADD",
      item: {
        description: "Solo Stove Yukon fire pit",
        brand: "Solo Stove",
        unit_cost: 800,
        qty: 1,
        room: "Patio",
        category: "Furniture",
        age_years: 1,
        condition: "Average",
      },
      reason: "Fire pit",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor side tables teak",
        brand: "Gloster",
        unit_cost: 480,
        qty: 2,
        room: "Patio",
        category: "Furniture",
        age_years: 2,
        condition: "Average",
      },
      reason: "Side tables",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor throw pillows weather-resistant",
        brand: "Sunbrella",
        unit_cost: 95,
        qty: 8,
        room: "Patio",
        category: "Textiles",
        age_years: 1,
        condition: "Average",
      },
      reason: "Outdoor throw pillows",
    },
    {
      type: "ADD",
      item: {
        description: "Hanging plants in ceramic pots",
        brand: "",
        unit_cost: 85,
        qty: 6,
        room: "Patio",
        category: "Decorative",
        age_years: 1,
        condition: "Average",
      },
      reason: "Hanging plants",
    },
    {
      type: "ADD",
      item: {
        description: "Weber Genesis gas grill",
        brand: "Weber",
        unit_cost: 1200,
        qty: 1,
        room: "Patio",
        category: "Appliances",
        age_years: 2,
        condition: "Average",
      },
      reason: "Outdoor grill",
    },
    {
      type: "ADD",
      item: {
        description: "Outdoor lounge chairs",
        brand: "Dedon",
        unit_cost: 1800,
        qty: 2,
        room: "Patio",
        category: "Furniture",
        age_years: 2,
        condition: "Average",
      },
      reason: "Lounge chairs",
    },
  ],

  "Bathroom Master": [
    {
      type: "REMOVE",
      match_description: "Built-in desk",
      reason: "Wrong room — moved to David Office",
    },
    {
      type: "ADD",
      item: {
        description: "Built-in vanity cabinet with mirror",
        brand: "",
        unit_cost: 1800,
        qty: 2,
        room: "Bathroom Master",
        category: "Furniture",
        age_years: 3,
        condition: "Average",
      },
      reason: "Bathroom vanity cabinets",
    },
    {
      type: "ADD",
      item: {
        description: "Kohler medicine cabinet recessed",
        brand: "Kohler",
        unit_cost: 650,
        qty: 1,
        room: "Bathroom Master",
        category: "Furniture",
        age_years: 3,
        condition: "Average",
      },
      reason: "Medicine cabinet",
    },
  ],

  "Bathroom White": [
    {
      type: "PRICE",
      match_description: "Bidet",
      new_unit_cost: 650,
      reason: "Quality bidet seat upgrade",
    },
    {
      type: "ADD",
      item: {
        description: "Bathroom vanity cabinet",
        brand: "",
        unit_cost: 1200,
        qty: 1,
        room: "Bathroom White",
        category: "Furniture",
        age_years: 3,
        condition: "Average",
      },
      reason: "Vanity cabinet",
    },
  ],
};

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function normLine(s: string): string {
  return s.trim().toLowerCase();
}

function findClaimLine(claim: ClaimItem[], room: string, matchDescription: string): ClaimItem | undefined {
  const m = normLine(matchDescription);
  const r = normLine(room);
  return claim.find((i) => normLine(i.room) === r && normLine(i.description) === m);
}

/** Rich one-liner for modal/banner (uses current claim for before → after). */
export function formatSuggestedUpgradeLineWithClaim(claim: ClaimItem[], room: string, s: SuggestedUpgrade): string {
  switch (s.type) {
    case "RENAME":
      return `☑ ${s.match_description} → ${s.new_description}`;
    case "MOVE":
      return `☑ ${s.match_description} → ${s.new_room}`;
    case "PRICE": {
      const orig = findClaimLine(claim, room, s.match_description);
      const from = orig != null ? fmtMoney(orig.unit_cost) : "—";
      const to = fmtMoney(s.new_unit_cost);
      const qtyNote =
        orig != null && orig.qty > 1 ? ` ×${orig.qty}` : s.new_qty != null ? ` ×${s.new_qty}` : "";
      return `☑ ${s.match_description}${qtyNote} ${from} → ${to}`;
    }
    case "QTY": {
      const orig = findClaimLine(claim, room, s.match_description);
      const uOld = orig != null ? fmtMoney(orig.unit_cost) : "—";
      const uNew = s.new_unit_cost != null ? fmtMoney(s.new_unit_cost) : uOld;
      const qOld = orig?.qty ?? "—";
      return `☑ ${s.match_description} ${qOld}×${uOld} → ${s.new_qty}×${uNew}`;
    }
    case "ADD": {
      const it = s.item;
      const x = it.qty > 1 ? ` ×${it.qty}` : "";
      return `☑ Added: ${it.description}${x}`;
    }
    case "SPLIT":
      return `☑ Split: ${s.match_description} → ${s.item_a.description} + ${s.item_b.description}`;
    case "REMOVE":
      return `☑ Removed: ${s.match_description}`;
  }
}

/** One-line summary for first-visit banner bullets. */
export function formatSuggestedUpgradePreview(s: SuggestedUpgrade): string {
  switch (s.type) {
    case "RENAME":
      return `✓ ${s.match_description} → ${s.new_description}`;
    case "MOVE":
      return `✓ Moved: ${s.match_description} → ${s.new_room}`;
    case "PRICE": {
      const extra =
        s.new_description != null ? ` (${s.new_description})` : s.new_qty != null ? ` ×${s.new_qty}` : "";
      return `✓ ${s.match_description}: updated to ${fmtMoney(s.new_unit_cost)} each${extra}`;
    }
    case "QTY": {
      const p = s.new_unit_cost != null ? ` × ${fmtMoney(s.new_unit_cost)}` : "";
      return `✓ ${s.match_description}: qty → ${s.new_qty}${p}`;
    }
    case "ADD":
      return `✓ Added: ${s.item.description} ${fmtMoney(s.item.unit_cost)}${s.item.qty > 1 ? ` ×${s.item.qty}` : ""}`;
    case "SPLIT":
      return `✓ Split: ${s.match_description} → ${s.item_a.description} + ${s.item_b.description}`;
    case "REMOVE":
      return `✓ Removed: ${s.match_description}`;
  }
}
