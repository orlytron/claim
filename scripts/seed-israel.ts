import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local before anything else
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClaimItem {
  room: string;
  description: string;
  brand: string;
  model: string;
  qty: number;
  age_years: number;
  age_months: number;
  condition: string;
  unit_cost: number;
  category: string;
}

interface RoomSummary {
  room: string;
  item_count: number;
  subtotal: number;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const CLAIM_ITEMS: ClaimItem[] = [
  // Living Room
  { room: "Living Room", description: "Bowl with food", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Decorative" },
  { room: "Living Room", description: "Matcha tea container", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Decorative" },
  { room: "Living Room", description: "Ceramic tea pot", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 175.00, category: "Decorative" },
  { room: "Living Room", description: "Tea bowls", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Decorative" },
  { room: "Living Room", description: "Black Vase", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 101.00, category: "Decorative" },
  { room: "Living Room", description: "Heath Ceramics Vase", brand: "Heath Ceramics", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Decorative" },
  { room: "Living Room", description: "Beige Vase", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 201.00, category: "Decorative" },
  { room: "Living Room", description: "Rose Quartz", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Decorative" },
  { room: "Living Room", description: "Pinecone Candle", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Decorative" },
  { room: "Living Room", description: "George Smith Scroll Armchair", brand: "George Smith", model: "Scroll Armchair", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 6500.00, category: "Furniture" },
  { room: "Living Room", description: "ABC Carpet & Home Area Rug", brand: "ABC Carpet & Home", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 3200.00, category: "Furniture" },
  { room: "Living Room", description: "Artwork (Heart)", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1500.00, category: "Art" },
  { room: "Living Room", description: "Elephant Presenting Flower print Sues framed", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 16000.00, category: "Art" },
  { room: "Living Room", description: "Artwork (Zebra Print)", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1800.00, category: "Art" },
  { room: "Living Room", description: "Wooden Dining Table", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 5000.00, category: "Furniture" },
  { room: "Living Room", description: "Dining Chairs", brand: "", model: "", qty: 8, age_years: 0, age_months: 0, condition: "Average", unit_cost: 800.00, category: "Furniture" },
  { room: "Living Room", description: "Pearl inlaid wood side table", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1300.00, category: "Furniture" },
  { room: "Living Room", description: "Decorative Bowl with spheres", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1200.00, category: "Decorative" },
  { room: "Living Room", description: "Vase", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 125.00, category: "Decorative" },
  { room: "Living Room", description: "Glas Italia Coffee Table", brand: "Glas Italia", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 4700.00, category: "Furniture" },
  { room: "Living Room", description: "Kai Schaeffer Album photo in Plexiglas", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 7500.00, category: "Art" },
  { room: "Living Room", description: "8ft RH Maxwell Sofa", brand: "RH", model: "Maxwell", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 6600.00, category: "Furniture" },
  { room: "Living Room", description: "5 yards Osborne & Little striped fabric", brand: "Osborne & Little", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 750.00, category: "Textiles" },
  { room: "Living Room", description: "20 yards velvet fabric for couch recover", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1000.00, category: "Textiles" },
  { room: "Living Room", description: "Standup piano", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 3000.00, category: "Electronics" },
  { room: "Living Room", description: "Art books", brand: "", model: "", qty: 60, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Books" },

  // Kitchen
  { room: "Kitchen", description: "Silver Candlesticks", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 502.00, category: "Decorative" },
  { room: "Kitchen", description: "Orange Vase", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 152.00, category: "Decorative" },
  { room: "Kitchen", description: "Dog Bed", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Pet" },
  { room: "Kitchen", description: "Woven Basket", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 77.00, category: "Decorative" },
  { room: "Kitchen", description: "Ceramic Teapot", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 300.00, category: "Kitchen" },
  { room: "Kitchen", description: "Ceramic Bowl", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 129.00, category: "Kitchen" },
  { room: "Kitchen", description: "Wooden Bowl with Tea", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 178.00, category: "Kitchen" },
  { room: "Kitchen", description: "Glass Vase with Flowers", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 153.00, category: "Decorative" },
  { room: "Kitchen", description: "Air Fryer", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Appliances" },
  { room: "Kitchen", description: "Framed Photo", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Art" },
  { room: "Kitchen", description: "East Fork salad bowls", brand: "East Fork", model: "", qty: 10, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Kitchen" },
  { room: "Kitchen", description: "Textile", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Textiles" },
  { room: "Kitchen", description: "Glass Teapot", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Kitchen" },
  { room: "Kitchen", description: "Wooden Block", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 73.00, category: "Kitchen" },
  { room: "Kitchen", description: "Refrigerator", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 10000.00, category: "Appliances" },
  { room: "Kitchen", description: "Pendant Lights", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 800.00, category: "Lighting" },
  { room: "Kitchen", description: "Handbag", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 300.00, category: "Clothing" },
  { room: "Kitchen", description: "Kitchen Island", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 10000.00, category: "Furniture" },
  { room: "Kitchen", description: "Chilewich placemats", brand: "Chilewich", model: "", qty: 30, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Kitchen" },
  { room: "Kitchen", description: "Matcha whisk", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Kitchen" },
  { room: "Kitchen", description: "Ceramic teapot", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 175.00, category: "Kitchen" },
  { room: "Kitchen", description: "Nugget Ice Machine", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Appliances" },

  // Bedroom Rafe
  { room: "Bedroom Rafe", description: "T-Shirts", brand: "", model: "", qty: 30, age_years: 0, age_months: 0, condition: "Average", unit_cost: 18.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "T-Shirts premium", brand: "", model: "", qty: 15, age_years: 0, age_months: 0, condition: "Average", unit_cost: 45.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Hoodies", brand: "", model: "", qty: 8, age_years: 0, age_months: 0, condition: "Average", unit_cost: 90.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Crewneck Sweatshirts", brand: "", model: "", qty: 8, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Casper Twin Mattress", brand: "Casper", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 700.00, category: "Furniture" },
  { room: "Bedroom Rafe", description: "Carmelo Anthony Signed Game-Worn Nuggets Jersey", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 6500.00, category: "Collectibles" },
  { room: "Bedroom Rafe", description: "Heavy Jackets", brand: "", model: "", qty: 7, age_years: 0, age_months: 0, condition: "Average", unit_cost: 140.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Button-Up Shirts", brand: "", model: "", qty: 7, age_years: 0, age_months: 0, condition: "Average", unit_cost: 55.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Button-Up Shirts casual", brand: "", model: "", qty: 10, age_years: 0, age_months: 0, condition: "Average", unit_cost: 20.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Vintage T-Shirts", brand: "", model: "", qty: 14, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Pillows", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 80.00, category: "Furniture" },
  { room: "Bedroom Rafe", description: "Autographed Sports Memorabilia", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 120.00, category: "Collectibles" },
  { room: "Bedroom Rafe", description: "Jerseys", brand: "", model: "", qty: 9, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Cameupinthedrought Coaster Pack #1", brand: "Cameupinthedrought", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Collectibles" },
  { room: "Bedroom Rafe", description: "Cameupinthedrought BeyBelt", brand: "Cameupinthedrought", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Collectibles" },
  { room: "Bedroom Rafe", description: "Athletic Shoes", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 80.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Casual Shoes", brand: "", model: "", qty: 5, age_years: 0, age_months: 0, condition: "Average", unit_cost: 50.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Brad Bird Signed Iron Giant Poster 24x36", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 750.00, category: "Art" },
  { room: "Bedroom Rafe", description: "Posters", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 55.00, category: "Art" },
  { room: "Bedroom Rafe", description: "Sweatpants", brand: "", model: "", qty: 15, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Jeans", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Pants", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Light Jackets", brand: "", model: "", qty: 5, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Clothing" },
  { room: "Bedroom Rafe", description: "Hats", brand: "", model: "", qty: 12, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Clothing" },

  // Patio
  { room: "Patio", description: "Wooden Storage Trunk", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 2000.00, category: "Furniture" },
  { room: "Patio", description: "Sofa with cushions", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 2100.00, category: "Furniture" },
  { room: "Patio", description: "Pillows", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 95.00, category: "Furniture" },

  // Garage
  { room: "Garage", description: "Electric bicycle", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 3500.00, category: "Sports" },
  { room: "Garage", description: "Bike helmet", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 65.00, category: "Sports" },
  { room: "Garage", description: "Sunglasses", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Clothing" },
  { room: "Garage", description: "Leather handbag", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Garage", description: "Bicycle bag", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Sports" },
  { room: "Garage", description: "Athletic shoes", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 85.00, category: "Clothing" },
  { room: "Garage", description: "Toolbox", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 140.00, category: "Tools" },
  { room: "Garage", description: "Weights", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 450.00, category: "Sports" },
  { room: "Garage", description: "Boogie boards", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Sports" },
  { room: "Garage", description: "Boogie board holders", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Sports" },
  { room: "Garage", description: "Golf clubs", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Sports" },
  { room: "Garage", description: "Tennis racquets", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 140.00, category: "Sports" },
  { room: "Garage", description: "Tennis racquet strings", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Sports" },
  { room: "Garage", description: "Baseball bats", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 55.00, category: "Sports" },
  { room: "Garage", description: "Baseball mitt", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 65.00, category: "Sports" },
  { room: "Garage", description: "Tennis balls", brand: "", model: "", qty: 12, age_years: 0, age_months: 0, condition: "Average", unit_cost: 5.00, category: "Sports" },
  { room: "Garage", description: "Pickle ball racket", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 80.00, category: "Sports" },
  { room: "Garage", description: "Paddle tennis racket", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Sports" },
  { room: "Garage", description: "Basketball", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 43.00, category: "Sports" },
  { room: "Garage", description: "Wet suits", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 200.00, category: "Sports" },
  { room: "Garage", description: "Flippers", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Sports" },
  { room: "Garage", description: "Snorkel", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 20.00, category: "Sports" },
  { room: "Garage", description: "Hockey stick", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 80.00, category: "Sports" },
  { room: "Garage", description: "Football", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Sports" },
  { room: "Garage", description: "Soccer ball", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Sports" },
  { room: "Garage", description: "Flat screen TV", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Electronics" },
  { room: "Garage", description: "Gameboy", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Electronics" },
  { room: "Garage", description: "Xbox", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 120.00, category: "Electronics" },
  { room: "Garage", description: "Speakers", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 200.00, category: "Electronics" },
  { room: "Garage", description: "Art", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 300.00, category: "Art" },
  { room: "Garage", description: "Refrigerator/freezer", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 800.00, category: "Appliances" },
  { room: "Garage", description: "Work gloves", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Tools" },
  { room: "Garage", description: "Extension cords", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Tools" },
  { room: "Garage", description: "Car cleaning supplies", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Tools" },
  { room: "Garage", description: "Holiday decorations", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Decorative" },
  { room: "Garage", description: "Quince carry on luggage", brand: "Quince", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 275.00, category: "Clothing" },
  { room: "Garage", description: "Duffel bag", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Clothing" },
  { room: "Garage", description: "Golf balls", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Sports" },
  { room: "Garage", description: "Wilson tennis racquet bag", brand: "Wilson", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Sports" },
  { room: "Garage", description: "Gardening tools", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 175.00, category: "Tools" },
  { room: "Garage", description: "Couch", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 450.00, category: "Furniture" },
  { room: "Garage", description: "Satellite TV box", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Electronics" },
  { room: "Garage", description: "Universal remote control", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 45.00, category: "Electronics" },
  { room: "Garage", description: "Litelok bike lock", brand: "Litelok", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 180.00, category: "Sports" },
  { room: "Garage", description: "Hoto portable tire pump", brand: "Hoto", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Tools" },
  { room: "Garage", description: "Surf boards", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Sports" },
  { room: "Garage", description: "Surf board wax", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 14.00, category: "Sports" },
  { room: "Garage", description: "Rollerblades", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Sports" },
  { room: "Garage", description: "Rollerblade helmet", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Sports" },
  { room: "Garage", description: "Rollerblade pads", brand: "", model: "", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Sports" },
  { room: "Garage", description: "Paint", brand: "", model: "", qty: 12, age_years: 0, age_months: 0, condition: "Average", unit_cost: 45.00, category: "Tools" },
  { room: "Garage", description: "Paintbrush", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 12.00, category: "Tools" },
  { room: "Garage", description: "Leather suit bag", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Clothing" },
  { room: "Garage", description: "Leather travel bag", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Garage", description: "Camping equipment", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Sports" },
  { room: "Garage", description: "REI Co-op Siesta 20 hooded sleeping bag", brand: "REI", model: "Siesta 20", qty: 3, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Sports" },
  { room: "Garage", description: "Camping lantern", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 45.00, category: "Sports" },
  { room: "Garage", description: "Simpsons memorabilia", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Collectibles" },

  // Bedroom Orly
  { room: "Bedroom Orly", description: "Epson 1080 projector", brand: "Epson", model: "1080", qty: 1, age_years: 2, age_months: 0, condition: "Average", unit_cost: 600.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Hue Light Bulbs", brand: "Philips Hue", model: "", qty: 12, age_years: 0, age_months: 0, condition: "Average", unit_cost: 50.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Hue Light Bridge", brand: "Philips Hue", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Sony a6100 camera", brand: "Sony", model: "a6100", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 550.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Sony a6600 camera", brand: "Sony", model: "a6600", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 900.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Sony a6000 camera", brand: "Sony", model: "a6000", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 350.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Nectar mattress", brand: "Nectar", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 900.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Sony A7sii batteries", brand: "Sony", model: "A7sii", qty: 14, age_years: 0, age_months: 0, condition: "Average", unit_cost: 60.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "4K Monitor", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 400.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Ronin M gimbal", brand: "DJI", model: "Ronin M", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 700.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Comforter", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Mayfair bedframe", brand: "", model: "Mayfair", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Pillows", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 50.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Lightform LFC", brand: "Lightform", model: "LFC", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 699.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Sennheiser shotgun mic", brand: "Sennheiser", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 900.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Sennheiser directional mic", brand: "Sennheiser", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 500.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Extension cord", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Manfrotto Tripod", brand: "Manfrotto", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Mattress protector", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 65.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Filing Cabinets", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Wooden desk", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 450.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Audio-Technica headphones", brand: "Audio-Technica", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Beyerdynamic headphones", brand: "Beyerdynamic", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Technical cables", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Battery charger", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Rechargeable batteries", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Shirts", brand: "", model: "", qty: 27, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Pants", brand: "", model: "", qty: 11, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Hats", brand: "", model: "", qty: 5, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Sweaters", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 93.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Jean jacket", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 245.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Window shades", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 85.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Nike shoes", brand: "Nike", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 90.00, category: "Clothing" },
  { room: "Bedroom Orly", description: "Kobe sneakers", brand: "Nike", model: "Kobe", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Collectibles" },
  { room: "Bedroom Orly", description: "Hitmonchan Pokemon card", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 3.00, category: "Collectibles" },
  { room: "Bedroom Orly", description: "Bulletin board", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 65.00, category: "Office" },
  { room: "Bedroom Orly", description: "Thumbtacks", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 3.00, category: "Office" },
  { room: "Bedroom Orly", description: "Box of Sharpies", brand: "Sharpie", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Office" },
  { room: "Bedroom Orly", description: "Milk crates", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Furniture" },
  { room: "Bedroom Orly", description: "Seagull guitar", brand: "Seagull", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 450.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Craft supplies", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 80.00, category: "Office" },
  { room: "Bedroom Orly", description: "2012 Macbook", brand: "Apple", model: "Macbook 2012", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Razer BlackWidow V3 keyboard", brand: "Razer", model: "BlackWidow V3", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 100.00, category: "Electronics" },
  { room: "Bedroom Orly", description: "Harry Potter hardcover collection", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Books" },

  // Bathroom White
  { room: "Bathroom White", description: "Electric Toothbrush", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Castile soap gallon", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Toothpaste", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 7.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Bath mat", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Shower curtain", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Dental floss", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 4.00, category: "Personal Care" },
  { room: "Bathroom White", description: "Bidet", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 200.00, category: "Personal Care" },

  // Bathroom Master
  { room: "Bathroom Master", description: "Built-in desk", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1800.00, category: "Furniture" },

  // David Office / Guest Room
  { room: "David Office / Guest Room", description: "Books", brand: "", model: "", qty: 25, age_years: 0, age_months: 0, condition: "Average", unit_cost: 30.00, category: "Books" },
  { room: "David Office / Guest Room", description: "Artwork", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 4000.00, category: "Art" },
  { room: "David Office / Guest Room", description: "Chair", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 300.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Prints", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1000.00, category: "Art" },
  { room: "David Office / Guest Room", description: "Womb Chair and Ottoman", brand: "Knoll", model: "Womb Chair", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 5500.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Extension Cord", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 15.00, category: "Electronics" },
  { room: "David Office / Guest Room", description: "Surge protector", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 25.00, category: "Electronics" },
  { room: "David Office / Guest Room", description: "Desk Lamp", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 125.00, category: "Lighting" },
  { room: "David Office / Guest Room", description: "West Elm Wood platform bed", brand: "West Elm", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1200.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Saatva queen mattress", brand: "Saatva", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 1700.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "West Elm queen sheets", brand: "West Elm", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 150.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Pillows", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 50.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Computer monitor", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Electronics" },
  { room: "David Office / Guest Room", description: "Built-in desk", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 2500.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Filing cabinets", brand: "", model: "", qty: 2, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Sweaters", brand: "", model: "", qty: 8, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Clothing" },
  { room: "David Office / Guest Room", description: "Crystals", brand: "", model: "", qty: 20, age_years: 0, age_months: 0, condition: "Average", unit_cost: 40.00, category: "Decorative" },
  { room: "David Office / Guest Room", description: "Emmy Award", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 750.00, category: "Collectibles" },
  { room: "David Office / Guest Room", description: "Golden Globe Award", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 2500.00, category: "Collectibles" },
  { room: "David Office / Guest Room", description: "Office supplies", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Office" },
  { room: "David Office / Guest Room", description: "Candles", brand: "", model: "", qty: 7, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Decorative" },
  { room: "David Office / Guest Room", description: "Diffuser", brand: "", model: "", qty: 1, age_years: 0, age_months: 0, condition: "Average", unit_cost: 35.00, category: "Decorative" },
  { room: "David Office / Guest Room", description: "Window shades", brand: "", model: "", qty: 4, age_years: 0, age_months: 0, condition: "Average", unit_cost: 250.00, category: "Furniture" },
  { room: "David Office / Guest Room", description: "Ceramics", brand: "", model: "", qty: 6, age_years: 0, age_months: 0, condition: "Average", unit_cost: 75.00, category: "Decorative" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRoomSummary(items: ClaimItem[]): RoomSummary[] {
  const map: Record<string, { item_count: number; subtotal: number }> = {};

  for (const item of items) {
    if (!map[item.room]) map[item.room] = { item_count: 0, subtotal: 0 };
    map[item.room].item_count += 1;
    map[item.room].subtotal += item.qty * item.unit_cost;
  }

  return Object.entries(map).map(([room, data]) => ({
    room,
    item_count: data.item_count,
    subtotal: Math.round(data.subtotal * 100) / 100,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("   Make sure .env.local exists at the project root.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const roomSummary = computeRoomSummary(CLAIM_ITEMS);
  const computedTotal = CLAIM_ITEMS.reduce((s, i) => s + i.qty * i.unit_cost, 0);

  console.log(`\nSeeding ${CLAIM_ITEMS.length} items across ${roomSummary.length} rooms…`);
  console.log(`Computed total: $${computedTotal.toFixed(2)}`);

  for (const r of roomSummary) {
    console.log(`  ${r.room}: ${r.item_count} items · $${r.subtotal.toFixed(2)}`);
  }

  const { error } = await supabase
    .from("claim_session")
    .upsert(
      {
        id: "trial",
        status: "complete",
        current_total: 214708.93,
        claim_items: CLAIM_ITEMS,
        room_summary: roomSummary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("\n❌  Supabase upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`\n✅  Done. Seeded claim_session id='trial'`);
  console.log(`   ${CLAIM_ITEMS.length} items · $214,708.93 · status=complete`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
