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
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  return NextResponse.json(ISRAEL_PROFILE);
}
