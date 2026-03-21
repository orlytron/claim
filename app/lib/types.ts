export interface ClaimItem {
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
  vendor_url?: string;
  vendor_name?: string;
}

export type TierKey = "keep" | "entry" | "mid" | "premium" | "ultra";

export type TierSuggestion = {
  tier: TierKey;
  label: string;
  brand: string;
  model: string;
  material: string;
  origin: string;
  vendor: string;
  vendor_url: string;
  unit_cost: number;
  plausibility: "green" | "yellow" | "red";
  plausibility_reason: string;
  adjuster_narrative: string;
  upgrade_multiple: number;
};

export type ItemWithTiers = ClaimItem & {
  id: string;
  tiers: TierSuggestion[];
  selected_tier: TierKey;
  is_loading_tiers: boolean;
};

export type RoomContext = {
  type: string;
  occupant: string;
};

export type LifestyleProfile = {
  design_tier: string;
  aesthetic: string;
  art_engagement: string;
  active_lifestyle: string[];
  professional: string;
  avoid: string[];
  prioritize: string[];
  suggested_brands: {
    furniture: string[];
    lighting: string[];
    kitchen: string[];
    art: string[];
    outdoor: string[];
    textiles: string[];
  };
  room_context?: Record<string, RoomContext>;
};

export type StoredItemTier = {
  tiers: TierSuggestion[];
  selected_tier: TierKey;
};
