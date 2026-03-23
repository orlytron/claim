/**
 * Generates consumable addition packages per room.
 * Upserts to Supabase `bundles` and rewrites the consumables section in app/lib/bundles-data.ts
 *
 * Run: npm run gen-consumables
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Context for future LLM prompts (not used — packages are hard-coded). */
const FAMILY_PROFILE = `
Pacific Palisades luxury home, 
total loss fire January 2025.

Family members:
- David (50s): Emmy Award and Golden Globe 
  winning filmmaker. VERY serious tennis player,
  plays multiple times per week. Also golfs, 
  cycles occasionally. Runs the film office.
  
- Jacquie (50s): Professional art curator.
  Expensive, refined European taste. 
  Runs the household aesthetic and kitchen.
  Candles: Diptyque, Cire Trudon, Flamel,
  Regime des Fleurs.
  Skincare: La Mer, Augustinus Bader, 
  Sisley, Valmont.

- Orly (30, son): Photographer and filmmaker
  (NOT the Emmy winner, David is).
  Sony camera collector. Manga and anime 
  collectible collector. Surfer. Sports.
  Has 1994 baseball card complete sets 
  (one per brand: Topps, Upper Deck, 
  Fleer, Donruss, Score, Bowman).
  Men's candles: Le Labo, Malin+Goetz,
  DS & Durga, Apotheke, Byredo men's.

- Rafe (24, son): Collects luxury underground
  streetwear brands (Fear of God, Amiri, 
  Rick Owens, Rhude, Palm Angels, 
  Enfants Riches Déprimés, John Elliott).
  Sports fan, various collectibles.
  Basketball fan, Carmelo Anthony collector.

Family dog. Active lifestyle throughout.
`.trim();

/** Reference caps for future validation (not enforced in this generator). */
const QTY_CAPS: Record<string, { max: number; unit: string }> = {
  tennis_ball_can: { max: 12, unit: "cans of 4" },
  basketball: { max: 4, unit: "balls" },
  golf_ball_dozen: { max: 6, unit: "dozens" },
  golf_tee_pack: { max: 4, unit: "packs" },
  surf_wax: { max: 24, unit: "bars" },
  candle: { max: 24, unit: "candles" },
  soap_bottle: { max: 12, unit: "bottles" },
  toothpaste: { max: 12, unit: "tubes" },
  battery_pack: { max: 6, unit: "packs" },
  paper_towel_pack: { max: 6, unit: "packs" },
  cleaning_spray: { max: 8, unit: "bottles" },
  sd_card: { max: 8, unit: "cards" },
  card_sleeve_pack: { max: 10, unit: "packs" },
  default: { max: 6, unit: "units" },
};

void FAMILY_PROFILE;
void QTY_CAPS;

type ItemIn = {
  description: string;
  brand: string;
  unit_cost: number;
  qty: number;
  category: string;
};

type PackIn = {
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  items: ItemIn[];
};

type BundleItemRow = ItemIn & { total: number };

type BundleRow = {
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  tier: string;
  total_value: number;
  sweet_spot: boolean;
  plausibility: string;
  items: BundleItemRow[];
};

/** Compact line builder — normalizes whitespace in descriptions. */
function I(description: string, brand: string, unit_cost: number, qty: number, category: string): ItemIn {
  return {
    description: description.replace(/\s+/g, " ").trim(),
    brand,
    unit_cost,
    qty,
    category,
  };
}

const CONSUMABLE_PACKAGES: PackIn[] = [
  {
    room: "Living Room",
    bundle_code: "CONS-LIV-1",
    name: "Fine Candles & Home Fragrance",
    description: "Jacquie's luxury candle selection for living spaces",
    items: [
      I("Cire Trudon Abd el Kader Large Candle", "Cire Trudon", 130, 3, "consumables"),
      I("Diptyque Baies Large Candle 300g", "Diptyque", 95, 3, "consumables"),
      I("Flamel Paris Signature Candle", "Flamel", 85, 3, "consumables"),
      I("Regime des Fleurs Candle", "Regime des Fleurs", 110, 2, "consumables"),
    ],
  },
  {
    room: "Living Room",
    bundle_code: "CONS-LIV-2",
    name: "Bar & Entertaining Supplies",
    description: "Hosting essentials for a Pacific Palisades home",
    items: [
      I("Fever Tree Premium Tonic Water 24-pack", "Fever Tree", 22, 3, "consumables"),
      I("San Pellegrino Sparkling Water 24-pack", "San Pellegrino", 28, 3, "consumables"),
      I("Linen Cocktail Napkins Set of 12", "", 35, 4, "consumables"),
      I("Woodford Reserve Cocktail Cherries", "Woodford Reserve", 18, 4, "consumables"),
      I("Cocktail Picks Stainless Set", "", 12, 3, "consumables"),
    ],
  },
  {
    room: "Living Room",
    bundle_code: "CONS-LIV-3",
    name: "Art Books & Coffee Table Collection",
    description: "Curated books for an art curator's living room",
    items: [
      I("Assouline Luxury Coffee Table Book", "Assouline", 85, 3, "consumables"),
      I("Taschen Art Monograph", "Taschen", 65, 2, "consumables"),
      I("Phaidon Design Classics Volume", "Phaidon", 55, 2, "consumables"),
      I("Disposable Camera 3-pack", "Kodak", 38, 4, "consumables"),
    ],
  },
  {
    room: "Kitchen",
    bundle_code: "CONS-KIT-1",
    name: "Premium Pantry Staples",
    description: "Quality cooking essentials for a serious kitchen",
    items: [
      I("Brightland Alive Olive Oil 375ml", "Brightland", 37, 4, "consumables"),
      I("Katz Pinot Grigio Wine Vinegar", "Katz", 22, 4, "consumables"),
      I("Diaspora Single Origin Spice Set", "Diaspora", 45, 3, "consumables"),
      I("Maldon Sea Salt Flakes 8.5oz", "Maldon", 8, 6, "consumables"),
      I("Rancho Gordo Heirloom Beans", "Rancho Gordo", 8, 6, "consumables"),
    ],
  },
  {
    room: "Kitchen",
    bundle_code: "CONS-KIT-2",
    name: "Kitchen Cleaning & Paper Goods",
    description: "Eco-friendly cleaning supplies and paper goods",
    items: [
      I("Method All-Purpose Spray Cleaner", "Method", 5, 8, "consumables"),
      I("Seventh Generation Dish Soap", "Seventh Generation", 6, 12, "consumables"),
      I("Bounty Select-A-Size 8-Roll Pack", "Bounty", 22, 4, "consumables"),
      I("If You Care Parchment Paper Roll", "If You Care", 8, 6, "consumables"),
      I("Ecover Dishwasher Tablets 25-pack", "Ecover", 12, 4, "consumables"),
    ],
  },
  {
    room: "Kitchen",
    bundle_code: "CONS-KIT-3",
    name: "Coffee & Tea Supplies",
    description: "Premium coffee and tea for a California household",
    items: [
      I("Stumptown Hair Bender Whole Bean Coffee 12oz", "Stumptown", 18, 6, "consumables"),
      I("Blue Bottle Coffee Whole Bean 12oz", "Blue Bottle", 22, 4, "consumables"),
      I("Harney & Sons Fine Tea Sampler Set", "Harney & Sons", 28, 4, "consumables"),
      I("Chemex Bonded Filters Square 100-pack", "Chemex", 12, 3, "consumables"),
    ],
  },
  {
    room: "Kitchen",
    bundle_code: "CONS-KIT-4",
    name: "Kitchen Candles & Fragrance",
    description: "Jacquie's kitchen fragrance selection",
    items: [
      I("Diptyque Figuier Medium Candle 190g", "Diptyque", 68, 4, "consumables"),
      I("Cire Trudon Ernesto Classic Candle", "Cire Trudon", 95, 2, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-1",
    name: "Camera Maintenance Kit",
    description: "Professional camera cleaning and maintenance supplies",
    items: [
      I("Sony 128GB SDXC UHS-II Card", "Sony", 45, 4, "consumables"),
      I("Zeiss Lens Cleaning Solution 2oz", "Zeiss", 12, 6, "consumables"),
      I("Microfiber Lens Cleaning Cloths", "Zeiss", 8, 12, "consumables"),
      I("Photographic Solutions Sensor Swab Kit", "Photographic Solutions", 28, 3, "consumables"),
      I("Giottos Rocket Air Blower Large", "Giottos", 18, 2, "consumables"),
      I("ProTapes Pro Gaffer Tape 2in Black", "ProTapes", 18, 6, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-2",
    name: "Film Production Supplies",
    description: "On-set production essentials for a working filmmaker",
    items: [
      I("Rosco Color Correction Gel Pack", "Rosco", 28, 3, "consumables"),
      I("Duracell AA Optimum 20-pack", "Duracell", 15, 6, "consumables"),
      I("Anker USB-C Braided Cable 6ft", "Anker", 20, 6, "consumables"),
      I("Pelican SD Card Case Wallet", "Pelican", 18, 3, "consumables"),
      I("Dry Erase Markers Assorted 8-pack", "Expo", 12, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-3",
    name: "1994 Baseball Card Collection",
    description: "Complete 1994 season sets — one per brand",
    items: [
      I("1994 Topps Complete Set 792 Cards", "Topps", 45, 1, "collectibles"),
      I("1994 Upper Deck Complete Set", "Upper Deck", 55, 1, "collectibles"),
      I("1994 Fleer Complete Set", "Fleer", 35, 1, "collectibles"),
      I("1994 Donruss Complete Set", "Donruss", 30, 1, "collectibles"),
      I("1994 Score Complete Set", "Score", 25, 1, "collectibles"),
      I("1994 Bowman Complete Set", "Bowman", 40, 1, "collectibles"),
      I("Ultra Pro Card Sleeves 100-pack", "Ultra Pro", 8, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-4",
    name: "Men's Candles & Fragrance",
    description: "Orly's curated men's candle collection",
    items: [
      I("Le Labo Santal 26 Classic Candle", "Le Labo", 98, 3, "consumables"),
      I("Malin+Goetz Cannabis Candle 9oz", "Malin+Goetz", 58, 3, "consumables"),
      I("DS & Durga Portable Fireplace Candle", "DS & Durga", 85, 2, "consumables"),
      I("Apotheke Charcoal Candle 11oz", "Apotheke", 48, 3, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-5",
    name: "Surf Supplies",
    description: "Surf wax and maintenance for regular surfer",
    items: [
      I("Sex Wax Original Cool Water Surf Wax", "Sex Wax", 3, 12, "consumables"),
      I("Sticky Bumps Original Basecoat Wax", "Sticky Bumps", 5, 6, "consumables"),
      I("FCS Fin Screw & Key Pack", "FCS", 8, 4, "consumables"),
      I("Creatures of Leisure Regular Comp Leash 6ft", "Creatures of Leisure", 38, 2, "consumables"),
      I("Dakine Wax Comb", "Dakine", 6, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Orly",
    bundle_code: "CONS-ORL-6",
    name: "Manga & Anime Collection Supplies",
    description: "Storage and display for manga and anime collectibles",
    items: [
      I("Viz Media Manga Volume Premium Edition", "Viz Media", 22, 8, "collectibles"),
      I("Funko Pop Protector Case Hard Stack", "Funko", 8, 12, "consumables"),
      I("Acid-Free Comic Bags Current Size 100-pack", "BCW", 15, 2, "consumables"),
      I("Backing Boards Current Size 100-pack", "BCW", 12, 2, "consumables"),
      I("Display Shelf Risers Set of 4", "", 18, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Rafe",
    bundle_code: "CONS-RAF-1",
    name: "Luxury Clothing Care",
    description: "Premium garment care for luxury streetwear collection",
    items: [
      I("The Laundress Wool & Cashmere Wash 16oz", "The Laundress", 22, 6, "consumables"),
      I("The Laundress Delicate Wash 16oz", "The Laundress", 22, 4, "consumables"),
      I("Steamery Cirrus No2 Fabric Spray", "Steamery", 28, 4, "consumables"),
      I("Dryel Home Dry Cleaning Kit", "Dryel", 18, 4, "consumables"),
      I("Cedar Blocks Closet Protector 8-pack", "Household Essentials", 15, 3, "consumables"),
    ],
  },
  {
    room: "Bedroom Rafe",
    bundle_code: "CONS-RAF-2",
    name: "Streetwear Storage & Display",
    description: "Organization for a serious clothing collector",
    items: [
      I("Magnetic Floating Hat Display Wall Mount", "", 18, 6, "consumables"),
      I("Clear Stackable Shoe Box Display", "IRIS USA", 8, 12, "consumables"),
      I("Velvet Slim Hangers 50-pack", "Zober", 22, 2, "consumables"),
      I("Cedar Wood Shoe Trees Pair", "Stratton", 18, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Rafe",
    bundle_code: "CONS-RAF-3",
    name: "Sports Collectibles Supplies",
    description: "Card storage and display for serious collector",
    items: [
      I("Ultra Pro 9-Pocket Binder Pages 100-pack", "Ultra Pro", 12, 4, "consumables"),
      I("BCW Card Storage Box 800-count", "BCW", 15, 4, "consumables"),
      I("Grading Submission Sleeves Pro-Mold", "Pro-Mold", 18, 3, "consumables"),
      I("Beckett Basketball Card Price Guide Annual", "Beckett", 28, 2, "consumables"),
      I("UV Card Display Case Wall Mount", "Ultra Pro", 35, 4, "consumables"),
    ],
  },
  {
    room: "Bedroom Rafe",
    bundle_code: "CONS-RAF-4",
    name: "Sports & Active Supplies",
    description: "Basketball and athletic supplies",
    items: [
      I("Spalding NBA Official Game Basketball", "Spalding", 85, 2, "consumables"),
      I("Ball Pump with Needle 10-pack", "Nike", 15, 2, "consumables"),
      I("Nike Dri-FIT Athletic Socks 6-pack", "Nike", 22, 4, "consumables"),
      I("Under Armour Performance Socks 6-pack", "Under Armour", 18, 4, "consumables"),
    ],
  },
  {
    room: "David Office / Guest Room",
    bundle_code: "CONS-DAV-1",
    name: "Professional Stationery",
    description: "Emmy-winning filmmaker's office supplies",
    items: [
      I("Leuchtturm1917 Hardcover Notebook A5 Black", "Leuchtturm1917", 28, 6, "consumables"),
      I("Moleskine Professional Large Notebook", "Moleskine", 28, 4, "consumables"),
      I("Muji Gel Pen 0.5mm 10-pack", "Muji", 12, 4, "consumables"),
      I("Sharpie Markers Variety 24-pack", "Sharpie", 18, 3, "consumables"),
      I("Post-it Super Sticky Notes 12-pack", "Post-it", 18, 4, "consumables"),
    ],
  },
  {
    room: "David Office / Guest Room",
    bundle_code: "CONS-DAV-2",
    name: "Tech & Office Supplies",
    description: "Technology consumables for a filmmaker's office",
    items: [
      I("Anker USB-C Braided Cable 6ft", "Anker", 22, 6, "consumables"),
      I("Duracell AA Optimum 20-pack", "Duracell", 15, 4, "consumables"),
      I("Duracell AAA Optimum 20-pack", "Duracell", 12, 4, "consumables"),
      I("iKlear Laptop Cleaning Kit", "iKlear", 18, 3, "consumables"),
      I("Cable Management Box Organizer", "JOTO", 25, 2, "consumables"),
    ],
  },
  {
    room: "David Office / Guest Room",
    bundle_code: "CONS-DAV-3",
    name: "Film Reference Library",
    description: "Professional cinema and screenplay reference books",
    items: [
      I("Taschen Cinema Monograph Book", "Taschen", 65, 3, "consumables"),
      I("American Cinematographer Manual 11th Ed", "ASC Press", 85, 1, "consumables"),
      I("Save the Cat Screenplay Writing Book", "Michael Wiese", 28, 2, "consumables"),
      I("Directors Guild of America Yearbook", "DGA", 45, 2, "consumables"),
      I("Final Draft Screenplay Paper Ream", "Final Draft", 18, 4, "consumables"),
    ],
  },
  {
    room: "David Office / Guest Room",
    bundle_code: "CONS-DAV-4",
    name: "David's Tennis Supplies",
    description: "Serious tennis player consumables — regular player",
    items: [
      I("Penn Pro Extra Duty Tennis Balls 4-pack", "Penn", 9, 12, "consumables"),
      I("Wilson Ultra Wrap Overgrip 30-pack", "Wilson", 18, 3, "consumables"),
      I("Babolat VS Touch Overgrip 3-pack", "Babolat", 12, 4, "consumables"),
      I("Tourna Grip Original XL Overgrip", "Tourna", 12, 4, "consumables"),
      I("Wilson String Set Synthetic Gut", "Wilson", 18, 4, "consumables"),
      I("Gamma Tennis Ball Hopper 72-ball", "Gamma", 45, 1, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-1",
    name: "Surf Maintenance Pack",
    description: "Full surf wax and gear maintenance for family surfers",
    items: [
      I("Sex Wax Cool Water Surf Wax", "Sex Wax", 3, 12, "consumables"),
      I("Sticky Bumps Original Basecoat", "Sticky Bumps", 5, 8, "consumables"),
      I("Dakine Wax Comb & Scraper", "Dakine", 6, 4, "consumables"),
      I("O'Neill Wetsuit Cleaner Spray 8oz", "O'Neill", 15, 4, "consumables"),
      I("Curve Wetsuit Hanger", "Curve", 18, 3, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-2",
    name: "Tennis Court Supplies",
    description: "David's garage tennis supply backup stock",
    items: [
      I("Penn Championship Extra Duty Balls 4-pack", "Penn", 9, 12, "consumables"),
      I("Wilson Pro Overgrip 30-pack", "Wilson", 18, 3, "consumables"),
      I("Babolat VS Touch Overgrip 3-pack", "Babolat", 12, 4, "consumables"),
      I("Head Vibration Dampener 2-pack", "Head", 8, 6, "consumables"),
      I("Luxilon ALU Power Rough String Set", "Luxilon", 18, 4, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-3",
    name: "Golf Supplies",
    description: "Golf ball and accessory stock for regular golfer",
    items: [
      I("Titleist Pro V1 Golf Balls Dozen", "Titleist", 55, 4, "consumables"),
      I("TaylorMade TP5 Golf Balls Dozen", "TaylorMade", 48, 2, "consumables"),
      I("Pride Professional Tees 250-pack", "Pride", 8, 4, "consumables"),
      I("Callaway Golf Glove Mens Medium", "Callaway", 18, 4, "consumables"),
      I("Titleist Club Glove Cart Bag Towel", "Titleist", 18, 3, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-4",
    name: "Cycling Maintenance Kit",
    description: "Bike maintenance supplies for regular cyclists",
    items: [
      I("Continental Race 28 700x25 Inner Tube", "Continental", 12, 6, "consumables"),
      I("Muc-Off Bio Bike Cleaner 1L", "Muc-Off", 15, 4, "consumables"),
      I("Park Tool IB-3 I-Beam Multi-Tool", "Park Tool", 35, 2, "consumables"),
      I("Finish Line Dry Teflon Lube 4oz", "Finish Line", 12, 3, "consumables"),
      I("Topeak Micro Rocket AL Mini Pump", "Topeak", 28, 2, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-5",
    name: "Basketball & Multi-Sport",
    description: "Basketball and general athletic supplies",
    items: [
      I("Spalding NBA Street Outdoor Basketball", "Spalding", 45, 2, "consumables"),
      I("Nike Ball Pump with Needle", "Nike", 15, 2, "consumables"),
      I("Rogue Fitness Resistance Bands Set", "Rogue", 28, 2, "consumables"),
      I("Buddy Lee Speed Jump Rope", "Buddy Lee", 22, 2, "consumables"),
      I("TriggerPoint Grid Foam Roller", "TriggerPoint", 35, 2, "consumables"),
    ],
  },
  {
    room: "Garage",
    bundle_code: "CONS-GAR-6",
    name: "Garage Maintenance",
    description: "Hardware and maintenance essentials",
    items: [
      I("WD-40 Multi-Use Product 14.4oz", "WD-40", 12, 4, "consumables"),
      I("3M Command Strips Variety Pack", "3M", 12, 4, "consumables"),
      I("Duracell AA Optimum 20-pack", "Duracell", 15, 4, "consumables"),
      I("Streamlight Protac HL LED Flashlight", "Streamlight", 22, 2, "consumables"),
    ],
  },
  {
    room: "Master Bathroom",
    bundle_code: "CONS-BTM-1",
    name: "Jacquie Luxury Skincare",
    description: "High-end skincare for art curator's bathroom",
    items: [
      I("La Mer Moisturizing Cream 1oz", "La Mer", 95, 2, "consumables"),
      I("Augustinus Bader The Rich Cream 50ml", "Augustinus Bader", 185, 1, "consumables"),
      I("Sisley Black Rose Cream Mask 60ml", "Sisley", 165, 1, "consumables"),
      I("Valmont Prime Renewing Pack 75ml", "Valmont", 95, 2, "consumables"),
      I("Dr. Barbara Sturm Hyaluronic Serum 30ml", "Dr. Barbara Sturm", 145, 1, "consumables"),
    ],
  },
  {
    room: "Master Bathroom",
    bundle_code: "CONS-BTM-2",
    name: "Luxury Hair & Body",
    description: "Premium hair and body care for master bath",
    items: [
      I("Oribe Gold Lust Shampoo 8.5oz", "Oribe", 46, 4, "consumables"),
      I("Oribe Gold Lust Conditioner 8.5oz", "Oribe", 46, 4, "consumables"),
      I("Leonor Greyl Huile de Leonor Greyl 3.5oz", "Leonor Greyl", 68, 3, "consumables"),
    ],
  },
  {
    room: "Master Bathroom",
    bundle_code: "CONS-BTM-3",
    name: "Dental & Daily Personal Care",
    description: "Premium personal care essentials",
    items: [
      I("Cocofloss Coconut Oil Floss 3-pack", "Cocofloss", 36, 4, "consumables"),
      I("Aesop Reverence Hand Wash Pump 500ml", "Aesop", 38, 4, "consumables"),
      I("Aesop Resurrection Aromatique Hand Balm", "Aesop", 42, 3, "consumables"),
      I("Frette Luxury Guest Hand Towel", "Frette", 85, 2, "consumables"),
    ],
  },
  {
    room: "Bathroom White",
    bundle_code: "CONS-BTW-1",
    name: "Daily Personal Care",
    description: "Quality daily personal care essentials",
    items: [
      I("Method Body Wash Ylang Ylang 18oz", "Method", 8, 8, "consumables"),
      I("Nécessaire The Body Lotion 8.4oz", "Nécessaire", 25, 4, "consumables"),
      I("Tom's of Maine Toothpaste 4oz", "Tom's of Maine", 6, 12, "consumables"),
      I("Cocofloss Variety 3-pack", "Cocofloss", 12, 4, "consumables"),
    ],
  },
  {
    room: "Bathroom White",
    bundle_code: "CONS-BTW-2",
    name: "Hair Care Supplies",
    description: "Quality hair care for shared family bathroom",
    items: [
      I("Briogeo Don't Despair Repair Shampoo 8oz", "Briogeo", 38, 4, "consumables"),
      I("Briogeo Don't Despair Repair Conditioner 8oz", "Briogeo", 38, 4, "consumables"),
      I("Olaplex No.3 Hair Perfector 3.3oz", "Olaplex", 28, 3, "consumables"),
    ],
  },
  {
    room: "Bathroom White",
    bundle_code: "CONS-BTW-3",
    name: "Towels & Bath Linens",
    description: "Quality bath linens for secondary bathroom",
    items: [
      I("Brooklinen Super Plush Bath Towel", "Brooklinen", 28, 6, "consumables"),
      I("Parachute Classic Hand Towel", "Parachute", 18, 6, "consumables"),
      I("Parachute Classic Bath Mat", "Parachute", 39, 2, "consumables"),
    ],
  },
];

function finalizePackage(pack: PackIn): BundleRow {
  const items: BundleItemRow[] = pack.items.map((it) => ({
    ...it,
    total: it.unit_cost * it.qty,
  }));
  const calculatedTotal = items.reduce((sum, it) => sum + it.total, 0);
  return {
    room: pack.room,
    bundle_code: pack.bundle_code,
    name: pack.name,
    description: pack.description.replace(/\s+/g, " ").trim(),
    tier: "consumables",
    total_value: calculatedTotal,
    sweet_spot: false,
    plausibility: "easy",
    items,
  };
}

function formatBundleForTs(b: BundleRow): string {
  const itemLines = b.items.map(
    (it) =>
      `      { description: ${JSON.stringify(it.description)}, brand: ${JSON.stringify(it.brand)}, qty: ${it.qty}, unit_cost: ${it.unit_cost}, total: ${it.total}, category: ${JSON.stringify(it.category)} },`
  );
  return `  {
    room: ${JSON.stringify(b.room)},
    bundle_code: ${JSON.stringify(b.bundle_code)},
    name: ${JSON.stringify(b.name)},
    tier: "consumables",
    sweet_spot: false,
    plausibility: "easy",
    total_value: ${b.total_value},
    description: ${JSON.stringify(b.description)},
    items: [
${itemLines.join("\n")}
    ],
  },`;
}

const MARKER_START = "  // ── CONSUMABLE PACKAGES (auto-generated — npm run gen-consumables) ──";
const MARKER_END = "  // ── END CONSUMABLE PACKAGES ──";
const ART_ANCHOR = "  // ── ART PLACEHOLDER ──────────────────────────────────────────────────────────";

function updateBundlesDataFile(block: string): void {
  const rel = path.resolve(process.cwd(), "app/lib/bundles-data.ts");
  let content = fs.readFileSync(rel, "utf8");

  const startIdx = content.indexOf(MARKER_START);
  if (startIdx !== -1) {
    const endIdx = content.indexOf(MARKER_END);
    if (endIdx === -1) {
      throw new Error("bundles-data.ts: found CONSUMABLE start marker but missing END marker");
    }
    const endLine = content.indexOf("\n", endIdx);
    content = content.slice(0, startIdx) + content.slice(endLine + 1);
  }

  const artIdx = content.indexOf(ART_ANCHOR);
  if (artIdx === -1) {
    throw new Error("bundles-data.ts: could not find ART PLACEHOLDER anchor for insertion");
  }

  const insertion = `${MARKER_START}\n${block}\n${MARKER_END}\n\n`;
  content = content.slice(0, artIdx) + insertion + content.slice(artIdx);

  fs.writeFileSync(rel, content, "utf8");
  console.log(`\n✓ Updated ${path.relative(process.cwd(), rel)}`);
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const finalized = CONSUMABLE_PACKAGES.map(finalizePackage);

  const payload = finalized.map((b) => ({
    room: b.room,
    bundle_code: b.bundle_code,
    name: b.name,
    description: b.description,
    tier: b.tier,
    total_value: b.total_value,
    sweet_spot: b.sweet_spot,
    plausibility: b.plausibility,
    items: b.items,
  }));

  const { error: batchErr } = await supabaseAdmin.from("bundles").upsert(payload, {
    onConflict: "bundle_code",
  });
  if (batchErr) {
    console.error("Batch upsert failed:", batchErr.message);
    process.exit(1);
  }

  for (const b of finalized) {
    console.log(`✓ [${b.room}] ${b.name} $${b.total_value.toLocaleString()} — ${b.items.length} items`);
  }

  const tsBlock = finalized.map(formatBundleForTs).join("\n\n");
  updateBundlesDataFile(tsBlock);

  const rooms = new Set(finalized.map((b) => b.room));
  const grandTotal = finalized.reduce((s, b) => s + b.total_value, 0);

  console.log("\n── Summary ──");
  console.log(`Total packages: ${finalized.length}`);
  console.log(`Total rooms covered: ${rooms.size}`);
  console.log(`Total consumable value: $${grandTotal.toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
