import { NextResponse } from "next/server";

const ISRAEL_PROFILE = {
  design_tier: "High-end modern / Italian / British luxury",
  aesthetic: "Warm modern, natural materials, ceramics, curated not decorated",
  art_engagement: "Active collector — photography, prints, framed works, art books",
  active_lifestyle: ["surfing", "tennis", "cycling", "golf", "swimming", "basketball", "beach"],
  professional: "Entertainment industry — Emmy and Golden Globe winner, video production",
  avoid: ["mass market", "big box", "matching sets", "generic brands"],
  prioritize: ["Italian furniture", "gallery art", "craft ceramics", "designer lighting", "signed pieces"],
  suggested_brands: {
    furniture: ["Minotti", "B&B Italia", "Holly Hunt", "De Padova", "George Smith"],
    lighting: ["Apparatus Studio", "Roll & Hill", "Workstead", "Allied Maker"],
    kitchen: ["Sub-Zero", "Wolf", "Miele", "La Cornue", "Bertazzoni"],
    art: ["Gallery direct", "Secondary market blue chip", "Photography editions"],
    outdoor: ["Gandia Blasco", "Dedon", "Brown Jordan", "Kettal"],
    textiles: ["Dedar Milano", "Osborne & Little", "Rogers & Goffigon", "Christopher Farr"],
  },
  room_context: {
    "Living Room": { type: "primary_living", occupant: "family" },
    "Kitchen": { type: "kitchen", occupant: "family" },
    "Bedroom Rafe": { type: "kids_bedroom", occupant: "Rafe (child)" },
    "Bedroom Orly": { type: "kids_bedroom", occupant: "Orly (child)" },
    "Patio": { type: "outdoor", occupant: "family" },
    "Garage": { type: "garage_active", occupant: "family" },
    "Bathroom White": { type: "bathroom", occupant: "shared" },
    "Master Bedroom": { type: "primary_bedroom", occupant: "David & Jacquie" },
    "Master Bathroom": { type: "bathroom", occupant: "David & Jacquie" },
    "Master Closet": { type: "closet", occupant: "David & Jacquie" },
    "Bathroom Master": { type: "bathroom", occupant: "David" },
    "David Office / Guest Room": { type: "office_guest", occupant: "David" },
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  return NextResponse.json(ISRAEL_PROFILE);
}
