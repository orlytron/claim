import type { Bundle } from "./bundles-data";
import { DAV_SPORTS_A, DAV_TEA_A } from "./bundles-cumulative-david-office";
import { ORL_MUSIC_A, ORL_STREAM_A, ORL_PC_A } from "./bundles-cumulative-bedroom-orly";
import { GAR_SPORTS_A, GAR_BEACH_A, GAR_CAMP_A, KIT_DOGS_A } from "./bundles-cumulative-garage-kitchen";

export { DAV_SPORTS_A, DAV_TEA_A } from "./bundles-cumulative-david-office";
export { ORL_MUSIC_A, ORL_STREAM_A, ORL_PC_A } from "./bundles-cumulative-bedroom-orly";
export { GAR_SPORTS_A, GAR_BEACH_A, GAR_CAMP_A, KIT_DOGS_A } from "./bundles-cumulative-garage-kitchen";
export { tiered5 } from "./bundles-five-tier-cumulative-helper";

/** Cumulative 5-tier focused bundles (see `Bundle.tiersCumulative`). */
export const CUMULATIVE_FIVE_TIER_FOCUS_BUNDLES: Bundle[] = [
  DAV_SPORTS_A,
  DAV_TEA_A,
  ORL_MUSIC_A,
  ORL_STREAM_A,
  ORL_PC_A,
  GAR_SPORTS_A,
  GAR_BEACH_A,
  GAR_CAMP_A,
  KIT_DOGS_A,
];
