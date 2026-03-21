/** Hard-coded “missing from PDF” suggestions — top 5 per room (mid / premium options). */

import type { ClaimItem } from "../../lib/types";

export type SuggestedAdditionOption = {
  title: string;
  price: number;
  url: string;
  brand?: string;
};

export type SuggestedAdditionRow = {
  id: string;
  label: string;
  category: string;
  mid: SuggestedAdditionOption;
  premium: SuggestedAdditionOption;
};

export const SUGGESTED_ADDITIONS: Record<string, SuggestedAdditionRow[]> = {
  "Living Room": [
    {
      id: "lr-floor-lamp",
      label: "Floor lamp",
      category: "Lighting",
      mid: { title: "Apparatus Studio Signal X", price: 8000, url: "https://www.google.com/search?q=Apparatus+Signal+X+floor+lamp", brand: "Apparatus" },
      premium: { title: "Apparatus Metronome", price: 10900, url: "https://www.google.com/search?q=Apparatus+Metronome+lamp", brand: "Apparatus" },
    },
    {
      id: "lr-rug",
      label: "Area rug",
      category: "Textiles",
      mid: { title: "Patterson Flynn area rug", price: 8500, url: "https://www.google.com/search?q=Patterson+Flynn+rug", brand: "Patterson Flynn" },
      premium: { title: "Stark area rug", price: 14500, url: "https://www.google.com/search?q=Stark+carpet+rug", brand: "Stark" },
    },
    {
      id: "lr-windows",
      label: "Window treatments",
      category: "Textiles",
      mid: { title: "Shade Store custom shades", price: 4800, url: "https://www.google.com/search?q=Shade+Store", brand: "Shade Store" },
      premium: { title: "Rogers & Goffigon drapery", price: 11200, url: "https://www.google.com/search?q=Rogers+Goffigon", brand: "Rogers & Goffigon" },
    },
    {
      id: "lr-pendant",
      label: "Pendant / chandelier",
      category: "Lighting",
      mid: { title: "Roll & Hill pendant", price: 14500, url: "https://www.google.com/search?q=Roll+and+Hill+pendant", brand: "Roll & Hill" },
      premium: { title: "Roll & Hill chandelier (premium)", price: 22000, url: "https://www.google.com/search?q=Roll+and+Hill+chandelier", brand: "Roll & Hill" },
    },
    {
      id: "lr-console",
      label: "Console table",
      category: "Furniture",
      mid: { title: "CB2 console table", price: 1800, url: "https://www.google.com/search?q=CB2+console+table", brand: "CB2" },
      premium: { title: "Holly Hunt console", price: 8500, url: "https://www.google.com/search?q=Holly+Hunt+console", brand: "Holly Hunt" },
    },
  ],
  Kitchen: [
    {
      id: "kit-espresso",
      label: "Espresso machine",
      category: "Appliances",
      mid: { title: "La Marzocco Linea Mini", price: 5500, url: "https://www.google.com/search?q=La+Marzocco+Linea+Mini", brand: "La Marzocco" },
      premium: { title: "La Marzocco GS3", price: 9000, url: "https://www.google.com/search?q=La+Marzocco+GS3", brand: "La Marzocco" },
    },
    {
      id: "kit-cookware",
      label: "Cookware set",
      category: "Kitchen",
      mid: { title: "All-Clad d5 set", price: 895, url: "https://www.google.com/search?q=All-Clad+d5", brand: "All-Clad" },
      premium: { title: "Mauviel M'Cook set", price: 2800, url: "https://www.google.com/search?q=Mauviel+cookware", brand: "Mauviel" },
    },
    {
      id: "kit-wine",
      label: "Wine refrigerator",
      category: "Appliances",
      mid: { title: "Sub-Zero 147-bottle wine storage", price: 6800, url: "https://www.google.com/search?q=Sub-Zero+wine+147", brand: "Sub-Zero" },
      premium: { title: "Sub-Zero wine column (premium)", price: 9500, url: "https://www.google.com/search?q=Sub-Zero+wine+column", brand: "Sub-Zero" },
    },
    {
      id: "kit-knives",
      label: "Knife set",
      category: "Kitchen",
      mid: { title: "Shun Classic block set", price: 680, url: "https://www.google.com/search?q=Shun+Classic+knife+set", brand: "Shun" },
      premium: { title: "Miyabi Artisan set", price: 1200, url: "https://www.google.com/search?q=Miyabi+knife+set", brand: "Miyabi" },
    },
    {
      id: "kit-stools",
      label: "Kitchen stools (×4)",
      category: "Furniture",
      mid: { title: "Hay About A Stool ×4", price: 1520, url: "https://www.google.com/search?q=Hay+About+A+Stool", brand: "Hay" },
      premium: { title: "Knoll Bertoia counter stool ×4", price: 4800, url: "https://www.google.com/search?q=Bertoia+counter+stool", brand: "Knoll" },
    },
  ],
  "David Office / Guest Room": [
    {
      id: "do-chair",
      label: "Office chair",
      category: "Furniture",
      mid: { title: "Herman Miller Aeron", price: 1800, url: "https://www.google.com/search?q=Herman+Miller+Aeron", brand: "Herman Miller" },
      premium: { title: "Knoll Generation", price: 2800, url: "https://www.google.com/search?q=Knoll+Generation+chair", brand: "Knoll" },
    },
    {
      id: "do-lamp",
      label: "Floor lamp",
      category: "Lighting",
      mid: { title: "Allied Maker floor lamp", price: 2800, url: "https://www.google.com/search?q=Allied+Maker+floor+lamp", brand: "Allied Maker" },
      premium: { title: "Apparatus Signal floor lamp", price: 8000, url: "https://www.google.com/search?q=Apparatus+Signal", brand: "Apparatus" },
    },
    {
      id: "do-awards",
      label: "Award display cases",
      category: "Decorative",
      mid: { title: "Custom acrylic display cases ×2", price: 1700, url: "https://www.google.com/search?q=acrylic+trophy+case", brand: "Custom" },
      premium: { title: "Museum-quality cases ×2", price: 3200, url: "https://www.google.com/search?q=museum+display+case", brand: "Custom" },
    },
    {
      id: "do-rug",
      label: "Area rug",
      category: "Textiles",
      mid: { title: "Loloi area rug", price: 1800, url: "https://www.google.com/search?q=Loloi+rug", brand: "Loloi" },
      premium: { title: "Patterson Flynn rug", price: 8500, url: "https://www.google.com/search?q=Patterson+Flynn+rug", brand: "Patterson Flynn" },
    },
    {
      id: "do-printer",
      label: "Large-format printer",
      category: "Electronics",
      mid: { title: "Canon imagePROGRAF", price: 850, url: "https://www.google.com/search?q=Canon+imagePROGRAF", brand: "Canon" },
      premium: { title: "Canon imagePROGRAF PRO", price: 2400, url: "https://www.google.com/search?q=Canon+imagePROGRAF+PRO", brand: "Canon" },
    },
  ],
  "Bedroom Orly": [
    {
      id: "bo-lenses",
      label: "Sony lenses",
      category: "Electronics",
      mid: { title: "Sony 24-70mm GM", price: 2300, url: "https://www.google.com/search?q=Sony+24-70+GM", brand: "Sony" },
      premium: { title: "Sony 85mm GM", price: 1800, url: "https://www.google.com/search?q=Sony+85mm+GM", brand: "Sony" },
    },
    {
      id: "bo-bag",
      label: "Camera bag",
      category: "Electronics",
      mid: { title: "Peak Design Everyday", price: 310, url: "https://www.google.com/search?q=Peak+Design+camera+bag", brand: "Peak Design" },
      premium: { title: "Peak Design Travel Backpack", price: 380, url: "https://www.google.com/search?q=Peak+Design+travel", brand: "Peak Design" },
    },
    {
      id: "bo-drives",
      label: "Storage drives",
      category: "Electronics",
      mid: { title: "LaCie Rugged ×4", price: 740, url: "https://www.google.com/search?q=LaCie+Rugged+SSD", brand: "LaCie" },
      premium: { title: "LaCie 2big RAID ×2", price: 1200, url: "https://www.google.com/search?q=LaCie+2big", brand: "LaCie" },
    },
    {
      id: "bo-gimbal",
      label: "Gimbal",
      category: "Electronics",
      mid: { title: "DJI RS3 Pro", price: 1200, url: "https://www.google.com/search?q=DJI+RS3+Pro", brand: "DJI" },
      premium: { title: "DJI RS4 Pro combo", price: 1600, url: "https://www.google.com/search?q=DJI+RS4", brand: "DJI" },
    },
    {
      id: "bo-shades",
      label: "Blackout shades",
      category: "Textiles",
      mid: { title: "Lutron Serena ×4", price: 3400, url: "https://www.google.com/search?q=Lutron+Serena", brand: "Lutron" },
      premium: { title: "Lutron Palladiom ×4", price: 8200, url: "https://www.google.com/search?q=Lutron+Palladiom", brand: "Lutron" },
    },
  ],
  "Bedroom Rafe": [
    {
      id: "br-jersey-case",
      label: "Jersey display cases",
      category: "Collectibles",
      mid: { title: "UV-protected cases ×6", price: 2280, url: "https://www.google.com/search?q=UV+jersey+display+case", brand: "Custom" },
      premium: { title: "Museum jersey cases ×6", price: 4200, url: "https://www.google.com/search?q=museum+jersey+frame", brand: "Custom" },
    },
    {
      id: "br-mattress",
      label: "Mattress upgrade",
      category: "Furniture",
      mid: { title: "Saatva Classic", price: 1800, url: "https://www.google.com/search?q=Saatva+Classic", brand: "Saatva" },
      premium: { title: "Saatva Solaire", price: 3500, url: "https://www.google.com/search?q=Saatva+Solaire", brand: "Saatva" },
    },
    {
      id: "br-bed",
      label: "Bed frame",
      category: "Furniture",
      mid: { title: "Pottery Barn Toulouse", price: 1400, url: "https://www.google.com/search?q=Pottery+Barn+Toulouse+bed", brand: "Pottery Barn" },
      premium: { title: "RH canopy bed frame", price: 4200, url: "https://www.google.com/search?q=RH+canopy+bed", brand: "RH" },
    },
    {
      id: "br-photo",
      label: "Signed sports photography ×3",
      category: "Art",
      mid: { title: "Signed prints ×3", price: 2550, url: "https://www.google.com/search?q=signed+sports+photography", brand: "Various" },
      premium: { title: "Framed museum prints ×3", price: 4500, url: "https://www.google.com/search?q=sports+photography+framed", brand: "Various" },
    },
    {
      id: "br-desk",
      label: "Standing desk",
      category: "Furniture",
      mid: { title: "Uplift V2", price: 1200, url: "https://www.google.com/search?q=Uplift+V2+desk", brand: "Uplift" },
      premium: { title: "Fully Jarvis Bamboo", price: 1600, url: "https://www.google.com/search?q=Fully+Jarvis+desk", brand: "Fully" },
    },
  ],
  Patio: [
    {
      id: "pt-dining",
      label: "Outdoor dining set",
      category: "Furniture",
      mid: { title: "Brown Jordan table + chairs", price: 6800, url: "https://www.google.com/search?q=Brown+Jordan+dining", brand: "Brown Jordan" },
      premium: { title: "Brown Jordan premium dining", price: 12500, url: "https://www.google.com/search?q=Brown+Jordan+patio", brand: "Brown Jordan" },
    },
    {
      id: "pt-umbrella",
      label: "Umbrella",
      category: "Outdoor",
      mid: { title: "Tuuci Ocean Master", price: 3800, url: "https://www.google.com/search?q=Tuuci+Ocean+Master", brand: "Tuuci" },
      premium: { title: "Tuuci Ocean Master Max", price: 6200, url: "https://www.google.com/search?q=Tuuci+umbrella", brand: "Tuuci" },
    },
    {
      id: "pt-light",
      label: "Outdoor lighting",
      category: "Lighting",
      mid: { title: "Kichler outdoor lighting set", price: 4200, url: "https://www.google.com/search?q=Kichler+outdoor+lighting", brand: "Kichler" },
      premium: { title: "Hinkley landscape premium", price: 7800, url: "https://www.google.com/search?q=Hinkley+landscape", brand: "Hinkley" },
    },
    {
      id: "pt-fire",
      label: "Fire pit",
      category: "Outdoor",
      mid: { title: "Solo Stove Yukon", price: 800, url: "https://www.google.com/search?q=Solo+Stove+Yukon", brand: "Solo Stove" },
      premium: { title: "Breeo X Series", price: 1400, url: "https://www.google.com/search?q=Breeo+X+Series", brand: "Breeo" },
    },
    {
      id: "pt-rug",
      label: "Outdoor rug",
      category: "Textiles",
      mid: { title: "Gandia Blasco outdoor rug", price: 4200, url: "https://www.google.com/search?q=Gandia+Blasco+rug", brand: "Gandia Blasco" },
      premium: { title: "Dedon outdoor rug", price: 6800, url: "https://www.google.com/search?q=Dedon+outdoor+rug", brand: "Dedon" },
    },
  ],
  Garage: [
    {
      id: "gr-surf",
      label: "Surf storage rack",
      category: "Sports",
      mid: { title: "StoreYourBoard surf rack", price: 480, url: "https://www.google.com/search?q=StoreYourBoard+surf", brand: "StoreYourBoard" },
      premium: { title: "Ceiling rack system ×2", price: 920, url: "https://www.google.com/search?q=surfboard+ceiling+rack", brand: "Various" },
    },
    {
      id: "gr-bike",
      label: "Bike storage",
      category: "Sports",
      mid: { title: "Feedback Sports Velo Column", price: 480, url: "https://www.google.com/search?q=Feedback+Sports+bike+stand", brand: "Feedback Sports" },
      premium: { title: "Park Tool storage rack", price: 890, url: "https://www.google.com/search?q=Park+Tool+bike+rack", brand: "Park Tool" },
    },
    {
      id: "gr-gym",
      label: "Gym equipment",
      category: "Sports",
      mid: { title: "Rogue adjustable dumbbells", price: 1200, url: "https://www.google.com/search?q=Rogue+adjustable+dumbbells", brand: "Rogue" },
      premium: { title: "Bowflex SelectTech 552 pair", price: 800, url: "https://www.google.com/search?q=Bowflex+SelectTech", brand: "Bowflex" },
    },
    {
      id: "gr-cooler",
      label: "Cooler",
      category: "Outdoor",
      mid: { title: "YETI Tundra 65", price: 450, url: "https://www.google.com/search?q=YETI+Tundra+65", brand: "YETI" },
      premium: { title: "YETI Tundra Haul", price: 550, url: "https://www.google.com/search?q=YETI+Tundra+Haul", brand: "YETI" },
    },
    {
      id: "gr-camp",
      label: "Camping upgrade",
      category: "Outdoor",
      mid: { title: "REI Kingdom 6 tent", price: 580, url: "https://www.google.com/search?q=REI+Kingdom+6", brand: "REI" },
      premium: { title: "Big Agnes Copper Spur HV", price: 720, url: "https://www.google.com/search?q=Big+Agnes+Copper+Spur", brand: "Big Agnes" },
    },
  ],
  "Bathroom Master": [
    {
      id: "bm-towel",
      label: "Towel set",
      category: "Textiles",
      mid: { title: "Frette hotel towels ×8", price: 1480, url: "https://www.google.com/search?q=Frette+towels", brand: "Frette" },
      premium: { title: "Frette Luxe ×8", price: 2200, url: "https://www.google.com/search?q=Frette+luxe", brand: "Frette" },
    },
    {
      id: "bm-robe",
      label: "Bath robes",
      category: "Textiles",
      mid: { title: "Frette cashmere robes ×2", price: 1360, url: "https://www.google.com/search?q=Frette+cashmere+robe", brand: "Frette" },
      premium: { title: "Restoration Hardware robe ×2", price: 980, url: "https://www.google.com/search?q=RH+bath+robe", brand: "RH" },
    },
    {
      id: "bm-mirror",
      label: "Mirror",
      category: "Decorative",
      mid: { title: "RH arch mirror", price: 1200, url: "https://www.google.com/search?q=Restoration+Hardware+arch+mirror", brand: "RH" },
      premium: { title: "Waterworks brass mirror", price: 2400, url: "https://www.google.com/search?q=Waterworks+mirror", brand: "Waterworks" },
    },
    {
      id: "bm-skin",
      label: "Skincare",
      category: "Personal",
      mid: { title: "La Mer complete regimen", price: 2800, url: "https://www.google.com/search?q=La+Mer+set", brand: "La Mer" },
      premium: { title: "La Mer premium collection", price: 4200, url: "https://www.google.com/search?q=La+Mer+collection", brand: "La Mer" },
    },
    {
      id: "bm-shower",
      label: "Shower upgrade",
      category: "Fixtures",
      mid: { title: "Kohler DTV+ digital shower", price: 4200, url: "https://www.google.com/search?q=Kohler+DTV%2B", brand: "Kohler" },
      premium: { title: "Kohler Anthem + steam", price: 7800, url: "https://www.google.com/search?q=Kohler+steam+shower", brand: "Kohler" },
    },
  ],
  "Bathroom White": [
    {
      id: "bw-towel",
      label: "Towel set",
      category: "Textiles",
      mid: { title: "Brooklinen Super-Plush ×6", price: 510, url: "https://www.google.com/search?q=Brooklinen+towels", brand: "Brooklinen" },
      premium: { title: "Parachute waffle ×6", price: 420, url: "https://www.google.com/search?q=Parachute+towels", brand: "Parachute" },
    },
    {
      id: "bw-mirror",
      label: "Mirror",
      category: "Decorative",
      mid: { title: "West Elm arch mirror", price: 480, url: "https://www.google.com/search?q=West+Elm+arch+mirror", brand: "West Elm" },
      premium: { title: "Rejuvenation brass mirror", price: 890, url: "https://www.google.com/search?q=Rejuvenation+mirror", brand: "Rejuvenation" },
    },
    {
      id: "bw-med",
      label: "Medicine cabinet",
      category: "Fixtures",
      mid: { title: "Kohler Verdera", price: 680, url: "https://www.google.com/search?q=Kohler+Verdera", brand: "Kohler" },
      premium: { title: "Robern Uplift", price: 1400, url: "https://www.google.com/search?q=Robern+medicine+cabinet", brand: "Robern" },
    },
    {
      id: "bw-robe",
      label: "Bath robes",
      category: "Textiles",
      mid: { title: "Parachute robe ×2", price: 360, url: "https://www.google.com/search?q=Parachute+bath+robe", brand: "Parachute" },
      premium: { title: "Coyuchi organic ×2", price: 520, url: "https://www.google.com/search?q=Coyuchi+robe", brand: "Coyuchi" },
    },
    {
      id: "bw-shower",
      label: "Shower accessories",
      category: "Personal",
      mid: { title: "Aesop body care set", price: 380, url: "https://www.google.com/search?q=Aesop+body", brand: "Aesop" },
      premium: { title: "Aesop complete bath", price: 620, url: "https://www.google.com/search?q=Aesop+gift+set", brand: "Aesop" },
    },
  ],
};

export function suggestionAlreadyInClaim(items: ClaimItem[], label: string): boolean {
  const L = label.toLowerCase();
  const words = L.split(/\s+/).filter((w) => w.length > 2);
  return items.some((i) => {
    const d = i.description.toLowerCase();
    if (d.includes(L) || L.includes(d.slice(0, Math.min(12, d.length)))) return true;
    return words.some((w) => d.includes(w));
  });
}
