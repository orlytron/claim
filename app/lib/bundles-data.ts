export interface BundleItem {
  description: string;
  brand: string;
  qty: number;
  unit_cost: number;
  total: number;
  category: string;
}

export interface Bundle {
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  tier: string;
  total_value: number;
  sweet_spot: boolean;
  plausibility: "green" | "yellow" | "red";
  items: BundleItem[];
}

export const BUNDLES_DATA: Bundle[] = [
  // ── LIVING ROOM ──────────────────────────────────────────────────────────────
  {
    room: "Living Room", bundle_code: "LR-A", name: "Warm Refresh",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 17495,
    description: "Modest quality lift. Same aesthetic, better materials.",
    items: [
      { description: "Table lamp pair", brand: "Arteriors Home", qty: 2, unit_cost: 680, total: 1360, category: "Lighting" },
      { description: "Wool accent pillows", brand: "Society Limonta", qty: 6, unit_cost: 180, total: 1080, category: "Textiles" },
      { description: "Jute area rug 8x10", brand: "Dash & Albert", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
      { description: "Linen window panels", brand: "Pottery Barn custom", qty: 4, unit_cost: 320, total: 1280, category: "Furniture" },
      { description: "Ceramic vase set", brand: "East Fork Asheville", qty: 3, unit_cost: 220, total: 660, category: "Decorative" },
      { description: "Coffee table books", brand: "Taschen", qty: 8, unit_cost: 85, total: 680, category: "Books" },
      { description: "Scented candles large", brand: "Diptyque", qty: 4, unit_cost: 95, total: 380, category: "Decorative" },
      { description: "Brass picture lights", brand: "Circa Lighting", qty: 2, unit_cost: 480, total: 960, category: "Lighting" },
      { description: "Yamaha U1 upright piano polished ebony", brand: "Yamaha", qty: 1, unit_cost: 8500, total: 8500, category: "Electronics" },
      { description: "Wool throw blankets", brand: "Faribault Mill", qty: 3, unit_cost: 195, total: 585, category: "Textiles" },
      { description: "Decorative tray set", brand: "Hawkins NY", qty: 2, unit_cost: 185, total: 370, category: "Decorative" },
      { description: "Large fiddle leaf fig floor plant", brand: "", qty: 2, unit_cost: 220, total: 440, category: "Decorative" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-B", name: "California Modern",
    tier: "B", sweet_spot: false, plausibility: "green", total_value: 42740,
    description: "Clean lines, natural materials, LA sensibility.",
    items: [
      { description: "Arc floor lamp pair", brand: "Allied Maker", qty: 2, unit_cost: 3200, total: 6400, category: "Lighting" },
      { description: "Hand-knotted wool rug 9x12", brand: "Patterson Flynn Martin", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Linen Roman shades custom", brand: "The Shade Store", qty: 4, unit_cost: 1200, total: 4800, category: "Furniture" },
      { description: "Ceramic table lamps", brand: "Christopher Spitzmiller", qty: 2, unit_cost: 1850, total: 3700, category: "Lighting" },
      { description: "Acacia solid wood console table", brand: "CB2", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Kawai K-300 upright piano ebony", brand: "Kawai", qty: 1, unit_cost: 6800, total: 6800, category: "Electronics" },
      { description: "Abstract print framed edition 3/10", brand: "", qty: 1, unit_cost: 4500, total: 4500, category: "Art" },
      { description: "Large glazed ceramic vessels", brand: "Heath Ceramics", qty: 2, unit_cost: 1200, total: 2400, category: "Decorative" },
      { description: "Cashmere throw blankets", brand: "Johnstons of Elgin", qty: 2, unit_cost: 480, total: 960, category: "Textiles" },
      { description: "Linen accent pillows", brand: "Matteo LA", qty: 8, unit_cost: 220, total: 1760, category: "Textiles" },
      { description: "Brass candle holders", brand: "Skultuna Sweden", qty: 4, unit_cost: 280, total: 1120, category: "Decorative" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-C", name: "Curated Warm Modern",
    tier: "C", sweet_spot: true, plausibility: "yellow", total_value: 78000,
    description: "The right answer for this household. Designer pieces, gallery art, Italian sensibility.",
    items: [
      { description: "Signal X floor lamp aged brass", brand: "Apparatus Studio", qty: 2, unit_cost: 8000, total: 16000, category: "Lighting" },
      { description: "Hand-knotted wool/silk rug 10x14", brand: "Stark Carpet", qty: 1, unit_cost: 14500, total: 14500, category: "Furniture" },
      { description: "Custom linen drapes 4 panels", brand: "Rogers & Goffigon", qty: 4, unit_cost: 2800, total: 11200, category: "Textiles" },
      { description: "Median table lamp alabaster + brass", brand: "Apparatus Studio", qty: 2, unit_cost: 5500, total: 11000, category: "Lighting" },
      { description: "Yamaha U3 upright piano polished ebony", brand: "Yamaha", qty: 1, unit_cost: 9500, total: 9500, category: "Electronics" },
      { description: "Archival photo print framed edition 2/5 40x60in", brand: "", qty: 1, unit_cost: 8500, total: 8500, category: "Art" },
      { description: "Cashmere throw", brand: "Loro Piana", qty: 2, unit_cost: 1850, total: 3700, category: "Textiles" },
      { description: "Accent pillows Christopher Farr fabric", brand: "Christopher Farr", qty: 8, unit_cost: 450, total: 3600, category: "Textiles" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-D", name: "Designer Living",
    tier: "D", sweet_spot: false, plausibility: "yellow", total_value: 112100,
    description: "Full designer specification. Every piece intentional.",
    items: [
      { description: "Modo pendant light hand-blown glass", brand: "Roll & Hill", qty: 1, unit_cost: 14500, total: 14500, category: "Lighting" },
      { description: "Metronome floor lamp hand-wrapped leather", brand: "Apparatus Studio", qty: 2, unit_cost: 10900, total: 21800, category: "Lighting" },
      { description: "Custom hand-knotted rug 10x14", brand: "Doris Leslie Blau", qty: 1, unit_cost: 22000, total: 22000, category: "Furniture" },
      { description: "Dedar Milano velvet motorized custom drapes", brand: "Dedar Milano", qty: 4, unit_cost: 4200, total: 16800, category: "Textiles" },
      { description: "Yamaha C1X baby grand piano ebony", brand: "Yamaha", qty: 1, unit_cost: 28000, total: 28000, category: "Electronics" },
      { description: "C-print edition 1/5 48x60in framed", brand: "", qty: 1, unit_cost: 12500, total: 12500, category: "Art" },
      { description: "Novecento credenza lacquered wood + brass", brand: "B&B Italia", qty: 1, unit_cost: 16500, total: 16500, category: "Furniture" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-E", name: "Gallery Home",
    tier: "E", sweet_spot: false, plausibility: "red", total_value: 189300,
    description: "Art-forward. Gallery-quality pieces throughout.",
    items: [
      { description: "Custom blown glass chandelier", brand: "Lindsey Adelman Studio", qty: 1, unit_cost: 22000, total: 22000, category: "Lighting" },
      { description: "Metronome floor lamp leather", brand: "Apparatus Studio", qty: 2, unit_cost: 10900, total: 21800, category: "Lighting" },
      { description: "Vintage Persian rug", brand: "Nazmiyal", qty: 1, unit_cost: 32000, total: 32000, category: "Furniture" },
      { description: "Steinway Model S ebonized baby grand", brand: "Steinway", qty: 1, unit_cost: 48000, total: 48000, category: "Electronics" },
      { description: "Gallery oil painting abstract 48x60in", brand: "", qty: 1, unit_cost: 35000, total: 35000, category: "Art" },
      { description: "Limited edition bronze sculpture 3/6", brand: "", qty: 1, unit_cost: 18500, total: 18500, category: "Art" },
      { description: "Lutron Palladiom motorized shade system", brand: "Lutron", qty: 1, unit_cost: 12000, total: 12000, category: "Furniture" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-F", name: "Entertainment Standard",
    tier: "F", sweet_spot: false, plausibility: "red", total_value: 210500,
    description: "Reflects Emmy/Golden Globe household.",
    items: [
      { description: "Custom lighting installation studio commission", brand: "Workstead", qty: 1, unit_cost: 28000, total: 28000, category: "Lighting" },
      { description: "Antique Oushak rug 1920s", brand: "Nazmiyal", qty: 1, unit_cost: 42000, total: 42000, category: "Furniture" },
      { description: "Steinway Model M custom finish grand piano", brand: "Steinway", qty: 1, unit_cost: 52000, total: 52000, category: "Electronics" },
      { description: "Large format artwork blue chip secondary market", brand: "", qty: 2, unit_cost: 28000, total: 56000, category: "Art" },
      { description: "Custom neon sculpture artist commission", brand: "", qty: 1, unit_cost: 14500, total: 14500, category: "Art" },
      { description: "Lutron motorized window treatment system", brand: "Lutron", qty: 1, unit_cost: 18000, total: 18000, category: "Furniture" },
    ],
  },
  {
    room: "Living Room", bundle_code: "LR-G", name: "Collector's Home",
    tier: "G", sweet_spot: false, plausibility: "red", total_value: 275000,
    description: "Maximum defensible for this profile.",
    items: [
      { description: "Custom chandelier studio commission", brand: "Studio Lapatsch/Unger", qty: 1, unit_cost: 38000, total: 38000, category: "Lighting" },
      { description: "Fine antique Persian rug 1920s", brand: "Nazmiyal", qty: 1, unit_cost: 65000, total: 65000, category: "Furniture" },
      { description: "Steinway Model B concert grand piano", brand: "Steinway", qty: 1, unit_cost: 88000, total: 88000, category: "Electronics" },
      { description: "Museum quality artwork secondary market", brand: "", qty: 2, unit_cost: 42000, total: 84000, category: "Art" },
    ],
  },

  // ── KITCHEN ──────────────────────────────────────────────────────────────────
  {
    room: "Kitchen", bundle_code: "KIT-A", name: "Functional Upgrade",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 14555,
    description: "Quality essentials, all defensible.",
    items: [
      { description: "All-Clad d5 cookware set 10pc", brand: "All-Clad", qty: 1, unit_cost: 895, total: 895, category: "Kitchen" },
      { description: "Shun Classic knife set 7pc", brand: "Shun", qty: 1, unit_cost: 680, total: 680, category: "Kitchen" },
      { description: "Breville Barista Express espresso machine", brand: "Breville", qty: 1, unit_cost: 750, total: 750, category: "Appliances" },
      { description: "Vitamix 5200 blender", brand: "Vitamix", qty: 1, unit_cost: 550, total: 550, category: "Appliances" },
      { description: "East Fork complete dinnerware set 4 place", brand: "East Fork", qty: 1, unit_cost: 420, total: 420, category: "Kitchen" },
      { description: "Riedel Veritas crystal wine glasses", brand: "Riedel", qty: 12, unit_cost: 65, total: 780, category: "Kitchen" },
      { description: "Fellow Stagg EKG Pro electric kettle", brand: "Fellow", qty: 1, unit_cost: 195, total: 195, category: "Kitchen" },
      { description: "Boos Block maple cutting board", brand: "John Boos", qty: 2, unit_cost: 280, total: 560, category: "Kitchen" },
      { description: "Libeco Belgian linen kitchen towels", brand: "Libeco", qty: 8, unit_cost: 45, total: 360, category: "Textiles" },
      { description: "Apparatus Studio small pendant lights", brand: "Apparatus Studio", qty: 2, unit_cost: 4200, total: 8400, category: "Lighting" },
      { description: "Molly Mutt large dog bed", brand: "Molly Mutt", qty: 1, unit_cost: 185, total: 185, category: "Pet" },
      { description: "Large indoor herb garden planter set", brand: "", qty: 1, unit_cost: 380, total: 380, category: "Decorative" },
      { description: "Burlap & Barrel spice full collection", brand: "Burlap & Barrel", qty: 1, unit_cost: 280, total: 280, category: "Kitchen" },
      { description: "Yamazaki Tower dish rack", brand: "Yamazaki", qty: 1, unit_cost: 85, total: 85, category: "Kitchen" },
    ],
  },
  {
    room: "Kitchen", bundle_code: "KIT-B", name: "Serious Cook",
    tier: "B", sweet_spot: false, plausibility: "green", total_value: 39400,
    description: "For someone who takes food seriously.",
    items: [
      { description: "Linea Mini espresso machine", brand: "La Marzocco", qty: 1, unit_cost: 5500, total: 5500, category: "Appliances" },
      { description: "Cast iron complete cookware set", brand: "Staub", qty: 1, unit_cost: 1800, total: 1800, category: "Kitchen" },
      { description: "5000MCD knife set 7pc Japan", brand: "Miyabi", qty: 1, unit_cost: 1200, total: 1200, category: "Kitchen" },
      { description: "A3500 Ascent blender", brand: "Vitamix", qty: 1, unit_cost: 650, total: 650, category: "Appliances" },
      { description: "Custom pendant light pair", brand: "Roll & Hill", qty: 2, unit_cost: 6200, total: 12400, category: "Lighting" },
      { description: "Complete porcelain dinnerware set", brand: "Mud Australia", qty: 1, unit_cost: 1800, total: 1800, category: "Kitchen" },
      { description: "Universal wine glasses", brand: "Zalto", qty: 12, unit_cost: 85, total: 1020, category: "Kitchen" },
      { description: "Butcher block cutting board 24x18", brand: "John Boos", qty: 1, unit_cost: 580, total: 580, category: "Kitchen" },
      { description: "About A Stool kitchen island stools", brand: "Hay", qty: 4, unit_cost: 380, total: 1520, category: "Furniture" },
      { description: "Sub-Zero 30in column refrigerator", brand: "Sub-Zero", qty: 1, unit_cost: 8500, total: 8500, category: "Appliances" },
      { description: "Jicon ceramic matcha full set", brand: "Jicon", qty: 1, unit_cost: 680, total: 680, category: "Kitchen" },
      { description: "Framed botanical prints", brand: "", qty: 3, unit_cost: 850, total: 2550, category: "Art" },
    ],
  },
  {
    room: "Kitchen", bundle_code: "KIT-C", name: "Chef's Kitchen",
    tier: "C", sweet_spot: true, plausibility: "yellow", total_value: 78020,
    description: "Full professional kitchen specification.",
    items: [
      { description: "GS3 espresso machine", brand: "La Marzocco", qty: 1, unit_cost: 9000, total: 9000, category: "Appliances" },
      { description: "Sub-Zero 36in French door refrigerator", brand: "Sub-Zero", qty: 1, unit_cost: 14500, total: 14500, category: "Appliances" },
      { description: "Circuit pendant light pair", brand: "Apparatus Studio", qty: 2, unit_cost: 8400, total: 16800, category: "Lighting" },
      { description: "M'Cook complete copper cookware", brand: "Mauviel", qty: 1, unit_cost: 2800, total: 2800, category: "Kitchen" },
      { description: "Custom chef knives", brand: "Bob Kramer", qty: 4, unit_cost: 800, total: 3200, category: "Kitchen" },
      { description: "Naxos 12-place dinnerware", brand: "Bernardaud", qty: 1, unit_cost: 4200, total: 4200, category: "Kitchen" },
      { description: "Sub-Zero 147-bottle wine refrigerator", brand: "Sub-Zero", qty: 1, unit_cost: 6800, total: 6800, category: "Appliances" },
      { description: "Crystal glasses set 12pc", brand: "Baccarat", qty: 12, unit_cost: 185, total: 2220, category: "Kitchen" },
      { description: "Outdoor kitchen stools", brand: "Minotti", qty: 4, unit_cost: 1800, total: 7200, category: "Furniture" },
      { description: "Original kitchen oil painting", brand: "", qty: 1, unit_cost: 6500, total: 6500, category: "Art" },
      { description: "Custom Turkish kilim kitchen rug", brand: "", qty: 1, unit_cost: 4800, total: 4800, category: "Furniture" },
    ],
  },
  {
    room: "Kitchen", bundle_code: "KIT-D", name: "Entertaining Kitchen",
    tier: "D", sweet_spot: false, plausibility: "red", total_value: 114000,
    description: "Full service hosting at highest tier.",
    items: [
      { description: "48in dual fuel professional range", brand: "Wolf", qty: 1, unit_cost: 18000, total: 18000, category: "Appliances" },
      { description: "48in side by side refrigerator", brand: "Sub-Zero", qty: 1, unit_cost: 22000, total: 22000, category: "Appliances" },
      { description: "Strada EP espresso machine", brand: "La Marzocco", qty: 1, unit_cost: 18000, total: 18000, category: "Appliances" },
      { description: "Custom pendant lights commission", brand: "Apparatus Studio", qty: 2, unit_cost: 12000, total: 24000, category: "Lighting" },
      { description: "Cheval d'Or dinnerware set", brand: "Hermes", qty: 1, unit_cost: 12500, total: 12500, category: "Kitchen" },
      { description: "Complete crystal service", brand: "Baccarat", qty: 1, unit_cost: 8500, total: 8500, category: "Kitchen" },
      { description: "EuroCave full column wine storage", brand: "EuroCave", qty: 1, unit_cost: 6800, total: 6800, category: "Kitchen" },
      { description: "Perles silver flatware set", brand: "Christofle", qty: 1, unit_cost: 4200, total: 4200, category: "Kitchen" },
    ],
  },
  {
    room: "Kitchen", bundle_code: "KIT-E", name: "Collector's Kitchen",
    tier: "E", sweet_spot: false, plausibility: "red", total_value: 170900,
    description: "Maximum for this lifestyle profile.",
    items: [
      { description: "Château 110cm range custom color", brand: "La Cornue", qty: 1, unit_cost: 38000, total: 38000, category: "Appliances" },
      { description: "48in column refrigerator/freezer set", brand: "Sub-Zero", qty: 1, unit_cost: 28000, total: 28000, category: "Appliances" },
      { description: "Integrated panel dishwasher", brand: "Miele", qty: 2, unit_cost: 3200, total: 6400, category: "Appliances" },
      { description: "Leva X espresso machine", brand: "La Marzocco", qty: 1, unit_cost: 22000, total: 22000, category: "Appliances" },
      { description: "Bespoke pendant lights commission", brand: "", qty: 2, unit_cost: 18000, total: 36000, category: "Lighting" },
      { description: "24pc crystal service", brand: "Baccarat", qty: 1, unit_cost: 18500, total: 18500, category: "Kitchen" },
      { description: "Full tableware service 8-place", brand: "Hermes", qty: 1, unit_cost: 22000, total: 22000, category: "Kitchen" },
    ],
  },

  // ── DAVID OFFICE ─────────────────────────────────────────────────────────────
  {
    room: "David Office / Guest Room", bundle_code: "OFF-A", name: "Functional Office",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 20970,
    description: "",
    items: [
      { description: "Aeron office chair", brand: "Herman Miller", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Median desk lamp alabaster", brand: "Apparatus Studio", qty: 1, unit_cost: 5500, total: 5500, category: "Lighting" },
      { description: "Canon imagePROGRAF Pro printer", brand: "Canon", qty: 1, unit_cost: 850, total: 850, category: "Electronics" },
      { description: "LG 32in 4K monitor", brand: "LG", qty: 1, unit_cost: 900, total: 900, category: "Electronics" },
      { description: "Bookcase tower", brand: "West Elm", qty: 2, unit_cost: 680, total: 1360, category: "Furniture" },
      { description: "Custom acrylic award display cases", brand: "", qty: 2, unit_cost: 850, total: 1700, category: "Furniture" },
      { description: "SentrySafe fireproof safe", brand: "SentrySafe", qty: 1, unit_cost: 480, total: 480, category: "Furniture" },
      { description: "Desk accessories set", brand: "Areaware", qty: 1, unit_cost: 380, total: 380, category: "Office" },
      { description: "Hand-tufted area rug 6x9", brand: "Loloi", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Custom window shades", brand: "The Shade Store", qty: 4, unit_cost: 850, total: 3400, category: "Furniture" },
      { description: "Arc floor lamp", brand: "Allied Maker", qty: 1, unit_cost: 2800, total: 2800, category: "Lighting" },
    ],
  },
  {
    room: "David Office / Guest Room", bundle_code: "OFF-B", name: "Creative Director's Office",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 59000,
    description: "Reflects Emmy/Golden Globe professional status.",
    items: [
      { description: "Generation office chair", brand: "Knoll", qty: 1, unit_cost: 2800, total: 2800, category: "Furniture" },
      { description: "Signal X floor lamp brass", brand: "Apparatus Studio", qty: 1, unit_cost: 8000, total: 8000, category: "Lighting" },
      { description: "Built-in style bookcase", brand: "De Padova", qty: 1, unit_cost: 9500, total: 9500, category: "Furniture" },
      { description: "Museum quality award display cases", brand: "", qty: 2, unit_cost: 2800, total: 5600, category: "Furniture" },
      { description: "Hand-knotted area rug 8x10", brand: "Patterson Flynn Martin", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Womb Chair reupholstered in Knoll wool", brand: "Knoll", qty: 1, unit_cost: 7500, total: 7500, category: "Furniture" },
      { description: "Apple Pro Display XDR 6K monitor", brand: "Apple", qty: 1, unit_cost: 5000, total: 5000, category: "Electronics" },
      { description: "Custom walnut desk", brand: "", qty: 1, unit_cost: 6500, total: 6500, category: "Furniture" },
      { description: "Signed industry artwork prints", brand: "", qty: 2, unit_cost: 2800, total: 5600, category: "Art" },
    ],
  },
  {
    room: "David Office / Guest Room", bundle_code: "OFF-C", name: "Executive Office",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 116200,
    description: "",
    items: [
      { description: "Solid walnut executive desk", brand: "Holly Hunt", qty: 1, unit_cost: 18500, total: 18500, category: "Furniture" },
      { description: "Eames EA219 office chair", brand: "Vitra", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
      { description: "Metronome floor lamp", brand: "Apparatus Studio", qty: 1, unit_cost: 10900, total: 10900, category: "Lighting" },
      { description: "Custom millwork built-in bookcase", brand: "", qty: 1, unit_cost: 22000, total: 22000, category: "Furniture" },
      { description: "Hand-knotted rug 9x12", brand: "Stark Carpet", qty: 1, unit_cost: 14500, total: 14500, category: "Furniture" },
      { description: "Museum-quality award wall installation", brand: "", qty: 1, unit_cost: 8500, total: 8500, category: "Art" },
      { description: "Signed prints collection", brand: "", qty: 4, unit_cost: 4500, total: 18000, category: "Art" },
      { description: "Apple Pro Display XDR monitor", brand: "Apple", qty: 2, unit_cost: 5000, total: 10000, category: "Electronics" },
      { description: "George Smith guest chairs", brand: "George Smith", qty: 2, unit_cost: 4800, total: 9600, category: "Furniture" },
    ],
  },
  {
    room: "David Office / Guest Room", bundle_code: "OFF-D", name: "Industry Standard",
    tier: "D", sweet_spot: false, plausibility: "red", total_value: 174000,
    description: "",
    items: [
      { description: "Custom studio desk", brand: "Thomas Hayes Studio", qty: 1, unit_cost: 32000, total: 32000, category: "Furniture" },
      { description: "Lounge seating set", brand: "Minotti", qty: 1, unit_cost: 28000, total: 28000, category: "Furniture" },
      { description: "Custom built-in millwork full room", brand: "", qty: 1, unit_cost: 45000, total: 45000, category: "Furniture" },
      { description: "Signed industry artwork collection", brand: "", qty: 6, unit_cost: 8500, total: 51000, category: "Art" },
      { description: "Lutron and Apparatus lighting system", brand: "Lutron", qty: 1, unit_cost: 18000, total: 18000, category: "Lighting" },
    ],
  },

  // ── BEDROOM ORLY ─────────────────────────────────────────────────────────────
  {
    room: "Bedroom Orly", bundle_code: "ORLY-A", name: "Complete Sony Kit",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 19810,
    description: "Missing lenses and accessories for existing bodies.",
    items: [
      { description: "24-70mm f/2.8 GM II lens", brand: "Sony", qty: 1, unit_cost: 2300, total: 2300, category: "Electronics" },
      { description: "85mm f/1.4 GM lens", brand: "Sony", qty: 1, unit_cost: 1800, total: 1800, category: "Electronics" },
      { description: "16-35mm f/2.8 GM lens", brand: "Sony", qty: 1, unit_cost: 2200, total: 2200, category: "Electronics" },
      { description: "NP-FZ100 genuine batteries", brand: "Sony", qty: 6, unit_cost: 80, total: 480, category: "Electronics" },
      { description: "CFexpress Type A 160GB cards", brand: "Sony", qty: 4, unit_cost: 180, total: 720, category: "Electronics" },
      { description: "ND filter set Peter McKinnon edition", brand: "PolarPro", qty: 1, unit_cost: 380, total: 380, category: "Electronics" },
      { description: "Everyday Backpack 20L camera bag", brand: "Peak Design", qty: 1, unit_cost: 310, total: 310, category: "Electronics" },
      { description: "1510 carry-on case", brand: "Pelican", qty: 1, unit_cost: 280, total: 280, category: "Electronics" },
      { description: "Rugged 4TB drives", brand: "LaCie", qty: 4, unit_cost: 185, total: 740, category: "Electronics" },
      { description: "TS4 Thunderbolt 4 dock", brand: "CalDigit", qty: 1, unit_cost: 380, total: 380, category: "Electronics" },
      { description: "NTG5 shotgun microphone", brand: "Rode", qty: 1, unit_cost: 500, total: 500, category: "Electronics" },
      { description: "DJI Mic 2 wireless kit 2-person", brand: "DJI", qty: 1, unit_cost: 350, total: 350, category: "Electronics" },
      { description: "300X LED key light", brand: "Aputure", qty: 1, unit_cost: 1100, total: 1100, category: "Electronics" },
      { description: "C-stand light stands", brand: "Avenger", qty: 2, unit_cost: 180, total: 360, category: "Electronics" },
      { description: "SW270C color accurate monitor", brand: "BenQ", qty: 1, unit_cost: 1100, total: 1100, category: "Electronics" },
      { description: "Wave Hybrid mattress", brand: "Casper", qty: 1, unit_cost: 2400, total: 2400, category: "Furniture" },
      { description: "Bedside table", brand: "West Elm", qty: 2, unit_cost: 380, total: 760, category: "Furniture" },
      { description: "Petal bed frame", brand: "West Elm", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
      { description: "Blackout roller shades", brand: "", qty: 4, unit_cost: 320, total: 1280, category: "Furniture" },
    ],
  },
  {
    room: "Bedroom Orly", bundle_code: "ORLY-B", name: "Professional Filmmaker",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 42200,
    description: "Full professional video/photo setup.",
    items: [
      { description: "FX3 Cinema Line camera", brand: "Sony", qty: 1, unit_cost: 3800, total: 3800, category: "Electronics" },
      { description: "24-70mm f/2.8 GM II lens", brand: "Sony", qty: 1, unit_cost: 2300, total: 2300, category: "Electronics" },
      { description: "16-35mm f/2.8 GM lens", brand: "Sony", qty: 1, unit_cost: 2200, total: 2200, category: "Electronics" },
      { description: "70-200mm f/2.8 GM II lens", brand: "Sony", qty: 1, unit_cost: 2800, total: 2800, category: "Electronics" },
      { description: "85mm f/1.4 GM lens", brand: "Sony", qty: 1, unit_cost: 1800, total: 1800, category: "Electronics" },
      { description: "RS3 Pro 3-axis gimbal", brand: "DJI", qty: 1, unit_cost: 1200, total: 1200, category: "Electronics" },
      { description: "600X Pro LED light", brand: "Aputure", qty: 1, unit_cost: 2200, total: 2200, category: "Electronics" },
      { description: "MixPre-3 audio recorder", brand: "Sound Devices", qty: 1, unit_cost: 1200, total: 1200, category: "Electronics" },
      { description: "Shogun external recorder", brand: "Atomos", qty: 1, unit_cost: 1400, total: 1400, category: "Electronics" },
      { description: "Mac Studio M2 Ultra", brand: "Apple", qty: 1, unit_cost: 4000, total: 4000, category: "Electronics" },
      { description: "Pro Display XDR 6K monitor", brand: "Apple", qty: 1, unit_cost: 5000, total: 5000, category: "Electronics" },
      { description: "Rugged Raid 20TB storage", brand: "LaCie", qty: 1, unit_cost: 1200, total: 1200, category: "Electronics" },
      { description: "Full bedroom furniture refresh", brand: "", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Motorized blackout shades Lutron", brand: "Lutron", qty: 4, unit_cost: 850, total: 3400, category: "Furniture" },
      { description: "Custom camera display wall shelf", brand: "", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
    ],
  },
  {
    room: "Bedroom Orly", bundle_code: "ORLY-C", name: "Director's Suite",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 61287,
    description: "",
    items: [
      { description: "FX6 Cinema Line full frame camera", brand: "Sony", qty: 1, unit_cost: 6000, total: 6000, category: "Electronics" },
      { description: "24-70mm f/2.8 GM II lens", brand: "Sony", qty: 1, unit_cost: 2300, total: 2300, category: "Electronics" },
      { description: "16-35mm f/2.8 GM lens", brand: "Sony", qty: 1, unit_cost: 2200, total: 2200, category: "Electronics" },
      { description: "70-200mm f/2.8 GM II lens", brand: "Sony", qty: 1, unit_cost: 2800, total: 2800, category: "Electronics" },
      { description: "35mm f/1.4 GM lens", brand: "Sony", qty: 1, unit_cost: 1400, total: 1400, category: "Electronics" },
      { description: "50mm f/1.2 GM lens", brand: "Sony", qty: 1, unit_cost: 2500, total: 2500, category: "Electronics" },
      { description: "Complete Aputure lighting system", brand: "Aputure", qty: 1, unit_cost: 6500, total: 6500, category: "Electronics" },
      { description: "Sound Devices and Rode complete audio kit", brand: "", qty: 1, unit_cost: 4200, total: 4200, category: "Electronics" },
      { description: "Mac Studio M2 Ultra + Pro Display XDR x2", brand: "Apple", qty: 1, unit_cost: 14000, total: 14000, category: "Electronics" },
      { description: "QNAP NAS 40TB storage system", brand: "QNAP", qty: 1, unit_cost: 2800, total: 2800, category: "Electronics" },
      { description: "Sony FX3 Cinema Line Camera", brand: "Sony", qty: 1, unit_cost: 3799, total: 3799, category: "Electronics" },
      { description: "DJI RS3 Pro Gimbal Stabilizer", brand: "DJI", qty: 1, unit_cost: 1200, total: 1200, category: "Electronics" },
      { description: "Rode NTG5 Shotgun Microphone", brand: "Rode", qty: 1, unit_cost: 500, total: 500, category: "Electronics" },
      { description: "Aputure 300d II LED Light", brand: "Aputure", qty: 1, unit_cost: 1099, total: 1099, category: "Electronics" },
      { description: "Apple MacBook Pro 14in M3", brand: "Apple", qty: 1, unit_cost: 1999, total: 1999, category: "Electronics" },
      { description: "LG 32in 4K USB-C Monitor", brand: "LG", qty: 1, unit_cost: 700, total: 700, category: "Electronics" },
      { description: "Elgato Stream Deck MK2", brand: "Elgato", qty: 1, unit_cost: 150, total: 150, category: "Electronics" },
      { description: "SanDisk 4TB Extreme SSD", brand: "SanDisk", qty: 2, unit_cost: 320, total: 640, category: "Electronics" },
      { description: "Lutron full room motorized blackout system", brand: "Lutron", qty: 1, unit_cost: 6500, total: 6500, category: "Furniture" },
    ],
  },

  // ── BEDROOM RAFE ─────────────────────────────────────────────────────────────
  {
    room: "Bedroom Rafe", bundle_code: "RAFE-A", name: "Collector's Room",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 27990,
    description: "Filling obvious gaps in existing collection.",
    items: [
      { description: "1994 MLB complete print run — all major sets", brand: "DeBasel", qty: 1, unit_cost: 14000, total: 14000, category: "Collectibles" },
      { description: "UV-protected jersey wall display cases", brand: "", qty: 6, unit_cost: 380, total: 2280, category: "Furniture" },
      { description: "Classic queen mattress", brand: "Saatva", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Toulouse bed frame", brand: "Pottery Barn", qty: 1, unit_cost: 1400, total: 1400, category: "Furniture" },
      { description: "Bedside tables", brand: "West Elm", qty: 2, unit_cost: 380, total: 760, category: "Furniture" },
      { description: "Standing desk", brand: "Uplift", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
      { description: "Signed sports photography prints framed", brand: "", qty: 3, unit_cost: 850, total: 2550, category: "Art" },
      { description: "CB2 floor lamp", brand: "CB2", qty: 1, unit_cost: 680, total: 680, category: "Lighting" },
      { description: "Blackout window shades", brand: "", qty: 3, unit_cost: 280, total: 840, category: "Furniture" },
      { description: "Custom poster framing", brand: "", qty: 6, unit_cost: 220, total: 1320, category: "Art" },
    ],
  },
  {
    room: "Bedroom Rafe", bundle_code: "RAFE-B", name: "Sports Collector's Den",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 58600,
    description: "Full serious collector setup.",
    items: [
      { description: "1994 MLB complete print run all major sets", brand: "DeBasel", qty: 1, unit_cost: 14000, total: 14000, category: "Collectibles" },
      { description: "Game-used NBA hardwood floor panel signed", brand: "", qty: 1, unit_cost: 4500, total: 4500, category: "Collectibles" },
      { description: "Authenticated signed MLB baseballs", brand: "", qty: 12, unit_cost: 850, total: 10200, category: "Collectibles" },
      { description: "Museum-grade framed jersey display", brand: "", qty: 8, unit_cost: 1200, total: 9600, category: "Furniture" },
      { description: "Large format signed NBA photography", brand: "", qty: 4, unit_cost: 2200, total: 8800, category: "Art" },
      { description: "Complete vintage sports magazine runs", brand: "", qty: 1, unit_cost: 3500, total: 3500, category: "Collectibles" },
      { description: "Full bedroom furniture set", brand: "West Elm", qty: 1, unit_cost: 3800, total: 3800, category: "Furniture" },
      { description: "Room accessories bedside desk bookcase", brand: "", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
    ],
  },
  {
    room: "Bedroom Rafe", bundle_code: "RAFE-C", name: "Serious Collector",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 88100,
    description: "",
    items: [
      { description: "1994 MLB PSA-graded card collection top rookies PSA 8-10", brand: "DeBasel", qty: 1, unit_cost: 28000, total: 28000, category: "Collectibles" },
      { description: "Multi-player game-worn NBA authenticated collection", brand: "", qty: 1, unit_cost: 18000, total: 18000, category: "Collectibles" },
      { description: "Hall of fame signed photograph collection", brand: "", qty: 12, unit_cost: 1800, total: 21600, category: "Collectibles" },
      { description: "Custom museum display system full room", brand: "", qty: 1, unit_cost: 12000, total: 12000, category: "Furniture" },
      { description: "Premium bedroom furniture complete set", brand: "", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
    ],
  },

  // ── PATIO ─────────────────────────────────────────────────────────────────────
  {
    room: "Patio", bundle_code: "PAT-A", name: "Upgraded Outdoor",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 18560,
    description: "",
    items: [
      { description: "Teak outdoor dining table 84in + 8 chairs", brand: "", qty: 1, unit_cost: 4800, total: 4800, category: "Furniture" },
      { description: "9ft aluminum patio umbrella", brand: "Tuuci", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
      { description: "Outdoor area rugs 8x10", brand: "Dash & Albert", qty: 2, unit_cost: 480, total: 960, category: "Furniture" },
      { description: "LED string light patio system", brand: "", qty: 1, unit_cost: 380, total: 380, category: "Lighting" },
      { description: "Large terra cotta planters", brand: "", qty: 6, unit_cost: 220, total: 1320, category: "Decorative" },
      { description: "Sunbrella fabric outdoor throw pillows", brand: "", qty: 8, unit_cost: 180, total: 1440, category: "Textiles" },
      { description: "Genesis E-435 gas grill", brand: "Weber", qty: 1, unit_cost: 1200, total: 1200, category: "Appliances" },
      { description: "Teak outdoor side tables", brand: "", qty: 2, unit_cost: 480, total: 960, category: "Furniture" },
      { description: "Outdoor floor lamp", brand: "Gandia Blasco", qty: 1, unit_cost: 2800, total: 2800, category: "Lighting" },
      { description: "Weather-resistant garden sculpture", brand: "", qty: 1, unit_cost: 3500, total: 3500, category: "Art" },
    ],
  },
  {
    room: "Patio", bundle_code: "PAT-B", name: "California Outdoor Living",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 50020,
    description: "",
    items: [
      { description: "Mbrace outdoor sofa", brand: "Dedon", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "8-piece teak outdoor dining set", brand: "Brown Jordan", qty: 1, unit_cost: 6800, total: 6800, category: "Furniture" },
      { description: "Teak outdoor coffee table", brand: "Kettal", qty: 1, unit_cost: 3200, total: 3200, category: "Furniture" },
      { description: "Ocean Master XL umbrella", brand: "Tuuci", qty: 1, unit_cost: 3800, total: 3800, category: "Furniture" },
      { description: "Custom outdoor area rug", brand: "Gandia Blasco", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
      { description: "700 series outdoor kitchen", brand: "Napoleon", qty: 1, unit_cost: 8500, total: 8500, category: "Appliances" },
      { description: "Large glazed ceramic planters", brand: "", qty: 4, unit_cost: 880, total: 3520, category: "Decorative" },
      { description: "Yukon fire pit", brand: "Solo Stove", qty: 1, unit_cost: 800, total: 800, category: "Furniture" },
      { description: "Kichler landscape lighting system", brand: "Kichler", qty: 1, unit_cost: 4200, total: 4200, category: "Lighting" },
      { description: "Bronze garden sculpture", brand: "", qty: 1, unit_cost: 6500, total: 6500, category: "Art" },
    ],
  },
  {
    room: "Patio", bundle_code: "PAT-C", name: "Resort Outdoor",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 83500,
    description: "",
    items: [
      { description: "Quadrado outdoor sectional", brand: "Minotti", qty: 1, unit_cost: 18500, total: 18500, category: "Furniture" },
      { description: "Basket 10-piece outdoor dining", brand: "Kettal", qty: 1, unit_cost: 12000, total: 12000, category: "Furniture" },
      { description: "Viking full outdoor kitchen system", brand: "Viking", qty: 1, unit_cost: 18000, total: 18000, category: "Appliances" },
      { description: "Custom outdoor water feature fountain", brand: "", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Lutron full landscape lighting system", brand: "Lutron", qty: 1, unit_cost: 12000, total: 12000, category: "Lighting" },
      { description: "Artist commission outdoor sculpture", brand: "", qty: 1, unit_cost: 14500, total: 14500, category: "Art" },
    ],
  },

  // ── GARAGE ───────────────────────────────────────────────────────────────────
  {
    room: "Garage", bundle_code: "GAR-A", name: "Active Lifestyle Upgrade",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 21875,
    description: "",
    items: [
      { description: "Turbo Vado SL electric bike", brand: "Specialized", qty: 2, unit_cost: 4800, total: 9600, category: "Sports" },
      { description: "Custom surfboards", brand: "Channel Islands", qty: 2, unit_cost: 900, total: 1800, category: "Sports" },
      { description: "Wall mount surf storage rack", brand: "StoreYourBoard", qty: 1, unit_cost: 480, total: 480, category: "Sports" },
      { description: "Pro Staff tennis racquets", brand: "Wilson", qty: 4, unit_cost: 280, total: 1120, category: "Sports" },
      { description: "T200 iron set golf clubs", brand: "Titleist", qty: 1, unit_cost: 1800, total: 1800, category: "Sports" },
      { description: "Psycho Tech wetsuit", brand: "O'Neill", qty: 3, unit_cost: 680, total: 2040, category: "Sports" },
      { description: "Velo bike storage stand", brand: "Feedback Sports", qty: 1, unit_cost: 480, total: 480, category: "Sports" },
      { description: "Adjustable dumbbell set", brand: "Rogue", qty: 1, unit_cost: 1200, total: 1200, category: "Sports" },
      { description: "Tundra 65 cooler", brand: "YETI", qty: 1, unit_cost: 450, total: 450, category: "Sports" },
      { description: "Away large hardside luggage", brand: "Away", qty: 2, unit_cost: 695, total: 1390, category: "Clothing" },
      { description: "Black Hole sports duffel", brand: "Patagonia", qty: 3, unit_cost: 185, total: 555, category: "Sports" },
      { description: "Kingdom tent camping setup", brand: "REI", qty: 1, unit_cost: 580, total: 580, category: "Sports" },
      { description: "Premium car care kit", brand: "Chemical Guys", qty: 1, unit_cost: 380, total: 380, category: "Tools" },
    ],
  },
  {
    room: "Garage", bundle_code: "GAR-B", name: "Serious Active",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 53740,
    description: "",
    items: [
      { description: "Supercharger3 electric bike", brand: "Riese & Müller", qty: 2, unit_cost: 7500, total: 15000, category: "Sports" },
      { description: "Custom performance surfboards", brand: "Firewire", qty: 2, unit_cost: 1800, total: 3600, category: "Sports" },
      { description: "TSR complete iron set", brand: "Titleist", qty: 1, unit_cost: 4500, total: 4500, category: "Sports" },
      { description: "C-130 cart bag", brand: "Sun Mountain", qty: 1, unit_cost: 480, total: 480, category: "Sports" },
      { description: "Blade 98 tennis racquets", brand: "Wilson", qty: 4, unit_cost: 380, total: 1520, category: "Sports" },
      { description: "Monster Rack + weight system", brand: "Rogue", qty: 1, unit_cost: 8500, total: 8500, category: "Sports" },
      { description: "R2 wetsuit", brand: "Patagonia", qty: 3, unit_cost: 580, total: 1740, category: "Sports" },
      { description: "Allstar paddleboard", brand: "Starboard", qty: 2, unit_cost: 2800, total: 5600, category: "Sports" },
      { description: "Essential hardside luggage", brand: "Rimowa", qty: 4, unit_cost: 1050, total: 4200, category: "Clothing" },
      { description: "Big Agnes full camping kit", brand: "Big Agnes", qty: 1, unit_cost: 2800, total: 2800, category: "Sports" },
      { description: "Ceiling mount bike storage system", brand: "Saris", qty: 1, unit_cost: 1200, total: 1200, category: "Sports" },
      { description: "Custom garage surf wall storage system", brand: "", qty: 1, unit_cost: 3800, total: 3800, category: "Sports" },
    ],
  },
  {
    room: "Garage", bundle_code: "GAR-C", name: "Elite Active",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 89500,
    description: "",
    items: [
      { description: "S-Works Turbo electric bike", brand: "Specialized", qty: 2, unit_cost: 12500, total: 25000, category: "Sports" },
      { description: "Custom hand-shaped surfboards", brand: "Christenson", qty: 3, unit_cost: 2800, total: 8400, category: "Sports" },
      { description: "Stealth complete golf set", brand: "TaylorMade", qty: 1, unit_cost: 6500, total: 6500, category: "Sports" },
      { description: "Tonal home gym system + Peloton Bike+", brand: "", qty: 1, unit_cost: 9500, total: 9500, category: "Sports" },
      { description: "Sport paddleboard", brand: "Red Paddle Co", qty: 2, unit_cost: 3200, total: 6400, category: "Sports" },
      { description: "Original hardside luggage", brand: "Rimowa", qty: 6, unit_cost: 1200, total: 7200, category: "Clothing" },
      { description: "Full garage storage system", brand: "California Closets", qty: 1, unit_cost: 18000, total: 18000, category: "Furniture" },
      { description: "Sub-Zero outdoor refrigerator", brand: "Sub-Zero", qty: 1, unit_cost: 8500, total: 8500, category: "Appliances" },
    ],
  },

  // ── BATHROOM MASTER ──────────────────────────────────────────────────────────
  {
    room: "Bathroom Master", bundle_code: "BATH-M-A", name: "Luxury Essentials",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 15480,
    description: "",
    items: [
      { description: "Hotel collection bath towels", brand: "Frette", qty: 8, unit_cost: 185, total: 1480, category: "Textiles" },
      { description: "Premium bath mats", brand: "Abyss & Habidecor", qty: 3, unit_cost: 280, total: 840, category: "Textiles" },
      { description: "Cashmere bath robe", brand: "Frette", qty: 2, unit_cost: 680, total: 1360, category: "Textiles" },
      { description: "Robern full length medicine cabinet", brand: "Robern", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Arch mirror", brand: "Restoration Hardware", qty: 1, unit_cost: 1200, total: 1200, category: "Furniture" },
      { description: "La Mer complete skincare set", brand: "La Mer", qty: 1, unit_cost: 2800, total: 2800, category: "Personal Care" },
      { description: "Creed Aventus fragrance + diffuser", brand: "Creed", qty: 1, unit_cost: 580, total: 580, category: "Personal Care" },
      { description: "DiamondClean electric toothbrush", brand: "Philips", qty: 1, unit_cost: 280, total: 280, category: "Personal Care" },
      { description: "Body+ smart scale", brand: "Withings", qty: 1, unit_cost: 180, total: 180, category: "Personal Care" },
      { description: "Large scented candles", brand: "Diptyque", qty: 4, unit_cost: 95, total: 380, category: "Decorative" },
      { description: "Bathroom storage organizer set", brand: "Yamazaki", qty: 1, unit_cost: 380, total: 380, category: "Furniture" },
      { description: "Kohler DTV+ digital shower system", brand: "Kohler", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
    ],
  },
  {
    room: "Bathroom Master", bundle_code: "BATH-M-B", name: "Spa Standard",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 41480,
    description: "",
    items: [
      { description: "Egyptian cotton bath towels", brand: "Pratesi", qty: 12, unit_cost: 280, total: 3360, category: "Textiles" },
      { description: "Cashmere bath robe", brand: "Pratesi", qty: 2, unit_cost: 1200, total: 2400, category: "Textiles" },
      { description: "Premium bath mat collection", brand: "Abyss & Habidecor", qty: 4, unit_cost: 580, total: 2320, category: "Textiles" },
      { description: "Custom backlit mirror system", brand: "", qty: 2, unit_cost: 2800, total: 5600, category: "Furniture" },
      { description: "La Mer and Sisley skincare complete", brand: "", qty: 1, unit_cost: 6500, total: 6500, category: "Personal Care" },
      { description: "Raindance shower system", brand: "Hansgrohe", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Nuheat floor heating system", brand: "Nuheat", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
      { description: "Apparatus Studio vanity lighting", brand: "Apparatus Studio", qty: 1, unit_cost: 6800, total: 6800, category: "Lighting" },
      { description: "Creed and Byredo fragrance collection", brand: "", qty: 1, unit_cost: 1800, total: 1800, category: "Personal Care" },
    ],
  },
  {
    room: "Bathroom Master", bundle_code: "BATH-M-C", name: "Luxury Suite",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 57400,
    description: "",
    items: [
      { description: "Custom shower system", brand: "Dornbracht", qty: 1, unit_cost: 18000, total: 18000, category: "Furniture" },
      { description: "Freestanding soaking tub", brand: "Waterworks", qty: 1, unit_cost: 12500, total: 12500, category: "Furniture" },
      { description: "Omnipanel towel warmer", brand: "Runtal", qty: 1, unit_cost: 2800, total: 2800, category: "Furniture" },
      { description: "Bespoke bath linen complete set", brand: "Frette", qty: 1, unit_cost: 8500, total: 8500, category: "Textiles" },
      { description: "Robern full vanity suite", brand: "Robern", qty: 1, unit_cost: 6800, total: 6800, category: "Furniture" },
      { description: "Custom sconce lighting", brand: "", qty: 4, unit_cost: 2200, total: 8800, category: "Lighting" },
    ],
  },

  // ── BATHROOM WHITE ───────────────────────────────────────────────────────────
  {
    room: "Bathroom White", bundle_code: "BATH-W-A", name: "Quality Refresh",
    tier: "A", sweet_spot: false, plausibility: "green", total_value: 4520,
    description: "",
    items: [
      { description: "Super-Plush bath towels", brand: "Brooklinen", qty: 6, unit_cost: 85, total: 510, category: "Textiles" },
      { description: "Premium bath mat", brand: "Abyss & Habidecor", qty: 2, unit_cost: 180, total: 360, category: "Textiles" },
      { description: "Arch wall mirror", brand: "West Elm", qty: 1, unit_cost: 480, total: 480, category: "Furniture" },
      { description: "Verdera medicine cabinet", brand: "Kohler", qty: 1, unit_cost: 680, total: 680, category: "Furniture" },
      { description: "Linen shower curtain", brand: "Matouk", qty: 1, unit_cost: 280, total: 280, category: "Textiles" },
      { description: "Kiehl's skincare basics set", brand: "Kiehl's", qty: 1, unit_cost: 380, total: 380, category: "Personal Care" },
      { description: "Scented candles", brand: "Diptyque", qty: 2, unit_cost: 95, total: 190, category: "Decorative" },
      { description: "Bathroom storage organizers", brand: "Yamazaki", qty: 1, unit_cost: 220, total: 220, category: "Furniture" },
      { description: "iO Series 9 electric toothbrush", brand: "Oral-B", qty: 2, unit_cost: 280, total: 560, category: "Personal Care" },
      { description: "Classic bath robe", brand: "Parachute", qty: 2, unit_cost: 180, total: 360, category: "Textiles" },
      { description: "Shower accessories kit", brand: "Aesop", qty: 1, unit_cost: 380, total: 380, category: "Personal Care" },
      { description: "Smart scale", brand: "Withings", qty: 1, unit_cost: 120, total: 120, category: "Personal Care" },
    ],
  },
  {
    room: "Bathroom White", bundle_code: "BATH-W-B", name: "Upgraded Bath",
    tier: "B", sweet_spot: true, plausibility: "yellow", total_value: 18480,
    description: "",
    items: [
      { description: "Hotel collection bath towels", brand: "Frette", qty: 8, unit_cost: 185, total: 1480, category: "Textiles" },
      { description: "Premium bath mats", brand: "Abyss & Habidecor", qty: 3, unit_cost: 280, total: 840, category: "Textiles" },
      { description: "Custom backlit wall mirror", brand: "", qty: 1, unit_cost: 1800, total: 1800, category: "Furniture" },
      { description: "Digital shower upgrade system", brand: "Kohler", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
      { description: "Visual Comfort wall sconces", brand: "Visual Comfort", qty: 2, unit_cost: 1200, total: 2400, category: "Lighting" },
      { description: "Aesop complete skincare set", brand: "Aesop", qty: 1, unit_cost: 1200, total: 1200, category: "Personal Care" },
      { description: "Bath robes", brand: "Frette", qty: 2, unit_cost: 480, total: 960, category: "Textiles" },
      { description: "Custom bathroom storage system", brand: "", qty: 1, unit_cost: 2800, total: 2800, category: "Furniture" },
      { description: "Nuheat floor heating mat", brand: "Nuheat", qty: 1, unit_cost: 2800, total: 2800, category: "Furniture" },
    ],
  },
  {
    room: "Bathroom White", bundle_code: "BATH-W-C", name: "Luxury Bath",
    tier: "C", sweet_spot: false, plausibility: "red", total_value: 39200,
    description: "",
    items: [
      { description: "Raindance full shower system", brand: "Hansgrohe", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Complete luxury bath linen set", brand: "Pratesi", qty: 1, unit_cost: 6800, total: 6800, category: "Textiles" },
      { description: "Custom Robern vanity suite", brand: "Robern", qty: 1, unit_cost: 8500, total: 8500, category: "Furniture" },
      { description: "Full room Nuheat heated floor", brand: "Nuheat", qty: 1, unit_cost: 4200, total: 4200, category: "Furniture" },
      { description: "Apparatus Studio sconce lighting", brand: "Apparatus Studio", qty: 4, unit_cost: 2800, total: 11200, category: "Lighting" },
    ],
  },

  // ── ART PLACEHOLDER ──────────────────────────────────────────────────────────
  {
    room: "Art", bundle_code: "ART-HOLD", name: "Art Collection",
    tier: "A", sweet_spot: true, plausibility: "yellow", total_value: 300000,
    description: "Multi-room art collection — inventory pending advisor PDF. Conservative placeholder.",
    items: [
      { description: "Multi-room art collection — pending advisor inventory PDF", brand: "Various", qty: 1, unit_cost: 300000, total: 300000, category: "Art" },
    ],
  },
];

/** Dev aid: flag vague bundle lines for manual cleanup (see room review bundle UX). */
if (process.env.NODE_ENV === "development") {
  (function scanVagueBundleItems() {
    for (const bundle of BUNDLES_DATA) {
      for (const it of bundle.items) {
        const d = it.description.toLowerCase();
        const br = (it.brand || "").trim();
        const vagueRefresh = d.includes("refresh");
        const vagueCollection = d.includes("collection");
        const vagueSet = /\bset\b/.test(d) && !/\d{2,}/.test(d);
        const expensiveNoBrand = it.unit_cost > 5000 && !br;
        if (vagueRefresh || vagueCollection || vagueSet || expensiveNoBrand) {
          console.log("WARNING: Vague bundle item found:", it.description);
        }
      }
    }
  })();
}
