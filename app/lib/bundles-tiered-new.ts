import type { Bundle, BundleItem, BundleTiers3, BundleTiers5 } from "./bundles-data";

function bi(description: string, brand: string, unit_cost: number, qty: number, category: string): BundleItem {
  const total = Math.round(unit_cost * qty * 100) / 100;
  return { description, brand, qty, unit_cost, total, category };
}

function tiered(
  room: string,
  bundle_code: string,
  name: string,
  description: string,
  essential: BundleItem[],
  complete: BundleItem[],
  full: BundleItem[],
  o?: { sweet_spot?: boolean; plausibility?: Bundle["plausibility"] }
): Bundle {
  const eSum = essential.reduce((s, x) => s + x.total, 0);
  const cSum = complete.reduce((s, x) => s + x.total, 0);
  const fSum = full.reduce((s, x) => s + x.total, 0);
  const tiers: BundleTiers3 = {
    essential: { total: eSum, items: essential },
    complete: { total: eSum + cSum, items: complete },
    full: { total: eSum + cSum + fSum, items: full },
  };
  return {
    room,
    bundle_code,
    name,
    description,
    tier: "focused",
    sweet_spot: o?.sweet_spot ?? true,
    plausibility: o?.plausibility ?? "green",
    total_value: tiers.complete.total,
    items: [...essential, ...complete, ...full],
    tiers,
  };
}

function tiered5(
  room: string,
  bundle_code: string,
  name: string,
  description: string,
  essential: BundleItem[],
  enhanced: BundleItem[],
  complete: BundleItem[],
  full: BundleItem[],
  ultimate: BundleItem[],
  o?: { sweet_spot?: boolean; plausibility?: Bundle["plausibility"] }
): Bundle {
  const tiers: BundleTiers5 = {
    essential: { total: essential.reduce((s, x) => s + x.total, 0), items: essential },
    enhanced: { total: enhanced.reduce((s, x) => s + x.total, 0), items: enhanced },
    complete: { total: complete.reduce((s, x) => s + x.total, 0), items: complete },
    full: { total: full.reduce((s, x) => s + x.total, 0), items: full },
    ultimate: { total: ultimate.reduce((s, x) => s + x.total, 0), items: ultimate },
  };
  const allItems = [...essential, ...enhanced, ...complete, ...full, ...ultimate];
  const tv = allItems.reduce((s, x) => s + x.total, 0);
  return {
    room,
    bundle_code,
    name,
    description,
    tier: "focused",
    sweet_spot: o?.sweet_spot ?? true,
    plausibility: o?.plausibility ?? "green",
    total_value: tv,
    items: allItems,
    tiers,
  };
}

/** Client-facing tiered focused additions (see product spec). */
export const TIERED_FOCUS_BUNDLES: Bundle[] = [
  tiered(
    "Living Room",
    "LR-AUDIO-A",
    "Home Audio System",
    "Whole-room TV and Sonos listening",
    [
      bi("Sonos Era 300 speaker", "Sonos", 450, 2, "Electronics"),
      bi("Apple TV 4K", "Apple", 130, 2, "Electronics"),
      bi("Sonos Sub Mini", "Sonos", 430, 1, "Electronics"),
      bi("TV wall mount articulating full-motion", "Sanus", 180, 1, "Electronics"),
      bi("HDMI 2.1 cable certified 6ft", "AudioQuest", 45, 4, "Electronics"),
      bi("Speaker stand pair height-adjustable", "Sanus", 125, 2, "Electronics"),
    ],
    [
      bi("Sony Bravia XR 65in OLED 4K", "Sony", 2799, 1, "Electronics"),
      bi("Sonos Arc soundbar", "Sonos", 899, 1, "Electronics"),
      bi("Sonos Sub Gen 3", "Sonos", 749, 1, "Electronics"),
    ],
    [
      bi("Sony Bravia XR 83in OLED 4K", "Sony", 4999, 1, "Electronics"),
      bi("Bowers & Wilkins 703 S3 floorstanding speaker", "B&W", 2000, 2, "Electronics"),
    ]
  ),
  tiered(
    "Living Room",
    "LR-LIGHT-A",
    "Lighting Refresh",
    "Layered decorative and architectural lighting",
    [bi("Apparatus Studio Signal X floor lamp aged brass", "Apparatus", 8000, 1, "Lighting")],
    [
      bi("Visual Comfort table lamp", "Visual Comfort", 1200, 2, "Lighting"),
      bi("Lutron Caseta smart dimmer switch", "Lutron", 85, 6, "Lighting"),
      bi("The Shade Store roman shade custom", "The Shade Store", 850, 4, "Furniture"),
    ],
    [
      bi("Roll & Hill pendant custom commission", "Roll & Hill", 8500, 1, "Lighting"),
      bi("Lutron whole-room lighting system design", "Lutron", 3800, 1, "Lighting"),
    ],
    { sweet_spot: true }
  ),
  tiered(
    "Living Room",
    "LR-TEXTILE-A",
    "Textiles & Soft Goods",
    "Drapes, throws, and layered soft finishes",
    [
      bi("Rogers & Goffigon custom drapes pair", "Rogers & Goffigon", 3800, 1, "Textiles"),
      bi("Parachute linen throw pillow", "Parachute", 120, 8, "Textiles"),
      bi("Sferra cashmere throw blanket", "Sferra", 680, 1, "Textiles"),
    ],
    [
      bi("Decorative lumbar pillow designer fabric", "", 85, 6, "Textiles"),
      bi("The Shade Store roman shade", "The Shade Store", 850, 2, "Textiles"),
      bi("Loro Piana cashmere throw", "Loro Piana", 680, 1, "Textiles"),
    ],
    [
      bi("Custom window treatments labor & install", "", 4800, 1, "Textiles"),
      bi("Beni Ourain wool area rug 8x10", "Moroccan", 3200, 1, "Furniture"),
    ]
  ),
  tiered(
    "Living Room",
    "LR-BAR-A",
    "Bar & Entertaining",
    "Glassware, bar tools, and service pieces",
    [
      bi("Brass bar cart", "CB2", 1200, 1, "Kitchen"),
      bi("Riedel wine glass Vinum", "Riedel", 40, 8, "Kitchen"),
      bi("Cocktail shaker set professional", "", 280, 1, "Kitchen"),
      bi("Waterford crystal decanter", "Waterford", 180, 2, "Kitchen"),
      bi("Stainless ice bucket insulated", "", 85, 1, "Kitchen"),
      bi("Serving tray lacquer", "", 180, 2, "Kitchen"),
    ],
    [
      bi("Cocktail glass crystal", "Baccarat", 240, 8, "Kitchen"),
      bi("Bar tool set professional weighted", "", 380, 1, "Kitchen"),
      bi("Marble cocktail station top", "", 480, 1, "Kitchen"),
      bi("Champagne bucket stainless", "", 120, 2, "Kitchen"),
    ],
    [
      bi("Wine cellar 50-bottle dual zone", "Vinotemp", 2800, 1, "Appliances"),
      bi("Custom bar cabinet millwork", "", 4800, 1, "Furniture"),
    ]
  ),
  tiered(
    "Kitchen",
    "KIT-COOKWARE-A",
    "Premium Cookware",
    "Pro-grade pots, knives, and prep",
    [
      bi("All-Clad D5 stainless 10-piece set", "All-Clad", 895, 1, "Kitchen"),
      bi("Shun Premier knife block set", "Shun", 680, 1, "Kitchen"),
      bi("John Boos maple cutting board", "John Boos", 180, 2, "Kitchen"),
      bi("OXO kitchen utensil set", "OXO", 65, 1, "Kitchen"),
      bi("OXO sheet pans set of 3", "OXO", 85, 1, "Kitchen"),
      bi("OXO salad spinner", "OXO", 45, 1, "Kitchen"),
    ],
    [
      bi("Mauviel M'Cook 5-piece copper core", "Mauviel", 1400, 1, "Kitchen"),
      bi("Miyabi Birchwood chef knife", "Miyabi", 280, 3, "Kitchen"),
      bi("Staub Dutch oven 7qt", "Staub", 380, 1, "Kitchen"),
      bi("Staub braiser 3.75qt", "Staub", 280, 1, "Kitchen"),
      bi("Zwilling stainless mixing bowl set", "Zwilling", 120, 1, "Kitchen"),
    ],
    [
      bi("La Cornue custom range hood", "La Cornue", 4800, 1, "Appliances"),
      bi("Mauviel complete copper upgrade set", "Mauviel", 2800, 1, "Kitchen"),
      bi("Knife storage custom walnut block", "", 880, 1, "Kitchen"),
    ]
  ),
  tiered(
    "Kitchen",
    "KIT-TABLE-A",
    "Table Setting for 12",
    "Dinnerware, glass, and serveware",
    [
      bi("East Fork dinner plate", "East Fork", 48, 12, "Kitchen"),
      bi("East Fork salad plate", "East Fork", 42, 12, "Kitchen"),
      bi("East Fork cereal bowl", "East Fork", 42, 12, "Kitchen"),
      bi("Linen napkin hemstitch", "", 18, 12, "Textiles"),
      bi("Duralex Picardie tumbler", "Duralex", 8, 12, "Kitchen"),
    ],
    [
      bi("Christofle silverware 12-place setting", "Christofle", 1800, 1, "Kitchen"),
      bi("Riedel Ouverture red wine glass", "Riedel", 28, 12, "Kitchen"),
      bi("Riedel champagne flute", "Riedel", 22, 8, "Kitchen"),
      bi("Staub ceramic serving platter", "Staub", 120, 2, "Kitchen"),
      bi("Marble serving board 20in", "", 180, 1, "Kitchen"),
    ],
    [
      bi("Hermès or Ginori dinner service upgrade", "", 3800, 1, "Kitchen"),
      bi("Crystal water goblet", "Baccarat", 45, 12, "Kitchen"),
      bi("Silver serving pieces set", "Christofle", 1200, 1, "Kitchen"),
    ]
  ),
  tiered(
    "Kitchen",
    "KIT-BAR-A",
    "Wine & Bar Collection",
    "Cellar, glassware, and spirits",
    [
      bi("Red wine bottle reserve tier", "", 45, 24, "Kitchen"),
      bi("White wine bottle", "", 35, 12, "Kitchen"),
      bi("Champagne bottle", "", 65, 6, "Kitchen"),
      bi("Premium spirits bottle", "", 85, 6, "Kitchen"),
    ],
    [
      bi("Vinotemp wine rack 30-bottle", "Vinotemp", 380, 1, "Appliances"),
      bi("Riedel Vinum Burgundy glass", "Riedel", 48, 8, "Kitchen"),
      bi("Crystal decanter lead-free", "Riedel", 220, 2, "Kitchen"),
      bi("Bar tools premium weighted set", "", 280, 1, "Kitchen"),
      bi("Cocktail bitters collection", "", 180, 1, "Kitchen"),
    ],
    [
      bi("Sub-Zero wine column 24in", "Sub-Zero", 6800, 1, "Appliances"),
      bi("Reserve wine bottle allocation", "", 120, 24, "Kitchen"),
    ]
  ),
  tiered(
    "Bedroom Orly",
    "ORL-CAMERA-A",
    "Camera & Lenses",
    "Sony cinema kit expansion",
    [
      bi("Sony FE 24-70mm F2.8 GM II lens", "Sony", 2299, 1, "Electronics"),
      bi("Sony FE 85mm F1.4 GM II lens", "Sony", 1799, 1, "Electronics"),
      bi("Peak Design Slide camera strap", "Peak Design", 79, 1, "Electronics"),
    ],
    [
      bi("Sony FX30 Cinema Line camera", "Sony", 1999, 1, "Electronics"),
      bi("Sony FE 16-35mm F2.8 GM II lens", "Sony", 2299, 1, "Electronics"),
      bi("Peak Design Everyday Backpack 20L", "Peak Design", 310, 1, "Electronics"),
      bi("Syrp Genie II motion control", "Syrp", 480, 1, "Electronics"),
    ],
    [
      bi("Sony FX3 full-frame cinema camera", "Sony", 3799, 1, "Electronics"),
      bi("Zeiss Milvus 50mm F1.4 lens", "Zeiss", 2099, 1, "Electronics"),
      bi("DJI Ronin 4D gimbal cinema package", "DJI", 2999, 1, "Electronics"),
    ]
  ),
  tiered(
    "Bedroom Orly",
    "ORL-GRIP-A",
    "Lighting & Grip",
    "LED, modifiers, and support",
    [
      bi("Aputure 300d II LED light", "Aputure", 1099, 1, "Electronics"),
      bi("Aputure Light Dome II", "Aputure", 180, 1, "Electronics"),
      bi("C-stand heavy duty with grip", "Matthews", 180, 2, "Electronics"),
      bi("V-mount battery 99Wh", "IDX", 180, 2, "Electronics"),
    ],
    [
      bi("Aputure 600d Pro LED", "Aputure", 1899, 1, "Electronics"),
      bi("DoPchoice softbox for 600d", "DoPchoice", 380, 1, "Electronics"),
      bi("Tilta follow focus Nucleus-M", "Tilta", 480, 1, "Electronics"),
      bi("Wooden Camera unified cage", "Wooden Camera", 280, 1, "Electronics"),
    ],
    [
      bi("ARRI SkyPanel S60-C LED", "ARRI", 3800, 1, "Electronics"),
      bi("Kino Flo Diva-Lite LED 20in", "Kino Flo", 1200, 2, "Electronics"),
    ]
  ),
  tiered(
    "Bedroom Orly",
    "ORL-AUDIO-A",
    "Audio Production",
    "Field recording and monitoring",
    [
      bi("Rode NTG5 shotgun microphone", "Rode", 500, 1, "Electronics"),
      bi("K-Tek KE-110CC boom pole", "K-Tek", 380, 1, "Electronics"),
      bi("Sound Devices MixPre-3 II recorder", "Sound Devices", 699, 1, "Electronics"),
      bi("Rycote Softie windshield kit", "Rycote", 180, 1, "Electronics"),
    ],
    [
      bi("Sennheiser EW 112P G4 wireless lav", "Sennheiser", 850, 1, "Electronics"),
      bi("Schiit Magni/Modi headphone amp stack", "Schiit", 200, 1, "Electronics"),
      bi("Yamaha HS5 studio monitor", "Yamaha", 380, 2, "Electronics"),
      bi("Acoustic foam panel 24x48", "Auralex", 45, 12, "Electronics"),
    ],
    [
      bi("Sound Devices 702T timecode recorder", "Sound Devices", 2800, 1, "Electronics"),
      bi("Neumann KU 100 binaural head", "Neumann", 1600, 1, "Electronics"),
    ]
  ),
  tiered(
    "Bedroom Rafe",
    "RAF-DISPLAY-A",
    "Memorabilia Display",
    "UV frames, shelves, and cases",
    [
      bi("UV-protect jersey display frame", "", 380, 4, "Decorative"),
      bi("Floating wall shelf 36in", "", 180, 4, "Furniture"),
    ],
    [
      bi("UV jersey display frame additional", "", 380, 4, "Decorative"),
      bi("LED display puck light", "", 45, 4, "Lighting"),
      bi("Acrylic display case", "", 85, 6, "Decorative"),
      bi("Gallery wall mounting rail system", "", 280, 1, "Decorative"),
    ],
    [
      bi("Custom built-in display wall", "", 3200, 1, "Furniture"),
      bi("Museum track lighting kit", "", 1200, 1, "Lighting"),
    ]
  ),
  tiered(
    "Bedroom Rafe",
    "RAF-CLOSET-A",
    "Luxury Closet System",
    "Closet organization upgrade path",
    [
      bi("California Closets basic reach-in design", "California Closets", 1400, 1, "Furniture"),
      bi("Velvet slim hanger 100-pack", "", 28, 2, "Household"),
      bi("Shoe rack 20-pair expandable", "", 180, 1, "Furniture"),
    ],
    [
      bi("California Closets upgrade shelving", "California Closets", 1400, 1, "Furniture"),
      bi("Hat display rack wall", "", 180, 3, "Furniture"),
      bi("Cedar shoe tree pair", "", 18, 8, "Household"),
      bi("Accessory drawer insert set", "", 280, 1, "Furniture"),
    ],
    [bi("Custom millwork walk-in closet", "", 4800, 1, "Furniture")]
  ),
  tiered(
    "David Office / Guest Room",
    "DAV-AV-A",
    "Professional AV Setup",
    "Edit bay and presentation",
    [
      bi("Apple Mac Studio M2 Max", "Apple", 1999, 1, "Electronics"),
      bi("LG UltraFine 5K 27in display", "LG", 1299, 1, "Electronics"),
      bi("Sonos Era 100 speaker", "Sonos", 249, 2, "Electronics"),
      bi("Apple TV 4K", "Apple", 130, 1, "Electronics"),
      bi("iPad Pro 12.9in M2", "Apple", 1099, 1, "Electronics"),
    ],
    [
      bi("Sony Bravia XR 65in OLED", "Sony", 2799, 1, "Electronics"),
      bi("Sonos Arc soundbar", "Sonos", 899, 1, "Electronics"),
      bi("Elgato Stream Deck XL", "Elgato", 250, 1, "Electronics"),
      bi("CalDigit TS4 Thunderbolt dock", "CalDigit", 349, 1, "Electronics"),
      bi("LG UltraWide 38in monitor", "LG", 699, 1, "Electronics"),
    ],
    [
      bi("Apple Pro Display XDR 32in", "Apple", 4999, 1, "Electronics"),
      bi("Mac Pro M2 Ultra tower", "Apple", 6999, 1, "Electronics"),
    ]
  ),
  tiered(
    "David Office / Guest Room",
    "DAV-LIBRARY-A",
    "Filmmaker Reference Library",
    "Books, media, and storage",
    [
      bi("Taschen cinema art book", "Taschen", 65, 3, "Books"),
      bi("American Cinematographer Manual", "ASC", 85, 1, "Books"),
      bi("Final Draft screenplay paper ream", "Final Draft", 18, 4, "Office"),
      bi("Moleskine large notebook", "Moleskine", 28, 4, "Office"),
      bi("Muji gel pen 0.5mm", "Muji", 12, 4, "Office"),
    ],
    [
      bi("Directors Guild annual yearbook", "DGA", 45, 3, "Books"),
      bi("Criterion Collection Blu-ray", "Criterion", 45, 20, "Electronics"),
      bi("Industry production directory", "", 85, 4, "Books"),
      bi("Custom bookcase walnut 6ft", "", 1200, 1, "Furniture"),
    ],
    [
      bi("Rare cinema monograph collection", "", 2800, 1, "Books"),
      bi("Custom display shelving lit", "", 1800, 1, "Furniture"),
    ]
  ),
  tiered(
    "Bathroom Master",
    "MSTR-FURN-A",
    "Master Bedroom Furniture",
    "King suite furniture path",
    [
      bi("RH king platform bed frame", "RH", 3200, 1, "Furniture"),
      bi("RH nightstand", "RH", 1400, 2, "Furniture"),
      bi("West Elm 6-drawer dresser", "West Elm", 1500, 1, "Furniture"),
    ],
    [
      bi("RH double-door armoire", "RH", 3800, 1, "Furniture"),
      bi("George Smith bedroom bench upholstered", "George Smith", 2800, 1, "Furniture"),
      bi("Floor-length leaning mirror", "", 680, 1, "Furniture"),
      bi("Visual Comfort bedside sconce", "Visual Comfort", 480, 2, "Lighting"),
    ],
    [
      bi("Custom millwork wardrobe wall", "", 8500, 1, "Furniture"),
      bi("Holly Hunt chaise lounge", "Holly Hunt", 4800, 1, "Furniture"),
      bi("Visual Comfort bedroom chandelier", "Visual Comfort", 2800, 1, "Lighting"),
    ]
  ),
  tiered(
    "Bathroom Master",
    "MSTR-BED-A",
    "King Bedding & Linens",
    "Layered luxury bedding",
    [
      bi("Sferra Fiona king sheet set", "Sferra", 480, 2, "Textiles"),
      bi("Hungarian goose down duvet king", "Sferra", 680, 1, "Textiles"),
      bi("European down pillow king", "Sferra", 280, 4, "Textiles"),
    ],
    [
      bi("Slip silk duvet cover king", "Slip", 380, 1, "Textiles"),
      bi("Sferra euro sham set", "Sferra", 220, 4, "Textiles"),
      bi("Loro Piana cashmere throw", "Loro Piana", 680, 2, "Textiles"),
      bi("Decorative bed pillow designer", "", 180, 6, "Textiles"),
    ],
    [
      bi("Frette hotel collection king sheet set", "Frette", 680, 3, "Textiles"),
      bi("Slip silk pillowcase king", "Slip", 185, 4, "Textiles"),
      bi("Goose down mattress topper king", "Sferra", 880, 1, "Textiles"),
    ]
  ),
  tiered(
    "Bathroom Master",
    "MSTR-JAC-A",
    "Jacquie's Wardrobe",
    "Professional and evening wardrobe",
    [
      bi("Designer blazer", "", 850, 4, "Clothing"),
      bi("Silk blouse", "", 380, 8, "Clothing"),
      bi("Tailored trouser", "", 420, 6, "Clothing"),
      bi("Cashmere sweater", "", 380, 6, "Clothing"),
      bi("Designer flat shoe", "", 480, 6, "Clothing"),
    ],
    [
      bi("Designer cocktail dress", "", 680, 4, "Clothing"),
      bi("Designer evening gown", "", 1800, 3, "Clothing"),
      bi("Designer wool coat", "", 1200, 3, "Clothing"),
      bi("Designer handbag", "", 1800, 3, "Clothing"),
      bi("Designer heel", "", 650, 8, "Clothing"),
    ],
    [
      bi("Fur or luxury overcoat", "", 4800, 1, "Clothing"),
      bi("Premium designer handbag", "", 3800, 2, "Clothing"),
      bi("Designer knee-high boot", "", 1200, 3, "Clothing"),
    ],
    { sweet_spot: false }
  ),
  tiered(
    "Bathroom Master",
    "MSTR-DAV-A",
    "David's Wardrobe",
    "On-camera and casual wardrobe",
    [
      bi("Tailored suit", "", 1800, 3, "Clothing"),
      bi("Dress shirt", "", 280, 8, "Clothing"),
      bi("Dress shoe", "", 480, 4, "Clothing"),
      bi("Casual blazer", "", 650, 3, "Clothing"),
      bi("Leather dress belt", "", 180, 4, "Clothing"),
    ],
    [
      bi("Men's cashmere sweater", "", 480, 6, "Clothing"),
      bi("Premium selvedge jean", "", 280, 6, "Clothing"),
      bi("Tennis outfit set", "Nike", 180, 8, "Clothing"),
      bi("Swim trunk premium", "", 120, 6, "Clothing"),
      bi("Casual dress watch", "", 380, 3, "Clothing"),
    ],
    [
      bi("Bespoke suit made-to-measure", "", 4800, 2, "Clothing"),
      bi("Luxury cashmere overcoat", "", 2800, 1, "Clothing"),
      bi("Italian luxury loafer", "", 850, 3, "Clothing"),
    ],
    { sweet_spot: false }
  ),
  tiered(
    "Bathroom Master",
    "MSTR-JEW-A",
    "Jacquie's Jewelry",
    "Fine and inherited pieces",
    [
      bi("Gold chain necklace 14k", "", 1800, 2, "Jewelry"),
      bi("Diamond stud earrings 1ctw", "", 2800, 1, "Jewelry"),
      bi("Pearl strand necklace", "", 1400, 1, "Jewelry"),
      bi("Gold bracelet 14k", "", 1200, 2, "Jewelry"),
      bi("Inherited estate ring", "", 1800, 2, "Jewelry"),
    ],
    [
      bi("Inherited diamond ring", "", 3800, 1, "Jewelry"),
      bi("Sapphire pendant necklace", "", 2400, 1, "Jewelry"),
      bi("Gold drop earring 18k", "", 1200, 3, "Jewelry"),
      bi("Vintage brooch", "", 850, 4, "Jewelry"),
      bi("Costume jewelry suite", "", 280, 8, "Jewelry"),
    ],
    [
      bi("Estate necklace colored stones", "", 4800, 1, "Jewelry"),
      bi("Gold charm bracelet 18k", "", 2200, 1, "Jewelry"),
      bi("South Sea pearl drop earring", "", 1800, 1, "Jewelry"),
    ],
    { sweet_spot: false, plausibility: "medium" }
  ),
  tiered(
    "Bathroom Master",
    "MSTR-WATCH-A",
    "Watch Collection",
    "His and hers timepieces",
    [
      bi("Rolex Datejust 36mm", "Rolex", 8500, 1, "Watches"),
      bi("Omega Seamaster", "Omega", 4800, 1, "Watches"),
      bi("Women's dress watch gold", "", 1800, 1, "Watches"),
    ],
    [
      bi("TAG Heuer Carrera chronograph", "TAG Heuer", 3200, 1, "Watches"),
      bi("Women's diamond bezel watch", "", 2800, 1, "Watches"),
      bi("Garmin Fenix sport watch", "Garmin", 650, 1, "Watches"),
    ],
    [
      bi("IWC Portugieser automatic", "IWC", 8500, 1, "Watches"),
      bi("Vintage dress watch inherited", "", 3800, 1, "Watches"),
    ],
    { sweet_spot: false, plausibility: "medium" }
  ),
  tiered5(
    "David Office / Guest Room",
    "DAV-TEA-A",
    "Japanese Tea Room Setup",
    "Wabi-sabi inspired tea ceremony collection (5-tier — add more lines in bundles-tiered-new as needed)",
    [
      bi("Tetsubin cast iron teapot Japanese", "Iwachu", 180, 1, "Kitchen"),
      bi("Matcha whisk set bamboo", "Ippodo", 45, 2, "Kitchen"),
    ],
    [
      bi("Low Japanese tea table chabudai", "", 380, 1, "Furniture"),
      bi("Floor sitting cushions zabuton", "", 95, 4, "Furniture"),
    ],
    [
      bi("Kyusu teapot clay side handle", "", 120, 2, "Kitchen"),
      bi("Premium matcha powder ceremonial", "Ippodo", 38, 6, "Kitchen"),
    ],
    [
      bi("Tokonoma alcove scroll painting", "", 280, 1, "Decorative"),
      bi("Japanese incense set kodo", "Baieido", 45, 4, "Decorative"),
    ],
    [
      bi("Shoji screen room divider", "", 380, 2, "Furniture"),
      bi("Tatami floor mat", "", 220, 2, "Furniture"),
    ],
    { sweet_spot: true, plausibility: "easy" }
  ),
];
