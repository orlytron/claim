/** Fixed review walkthrough order — slugs must match `app/review/[room]` URLs. */
export const ROOM_ORDER = [
  { name: "Living Room", slug: "living-room" },
  { name: "Kitchen", slug: "kitchen" },
  { name: "David Office / Guest Room", slug: "david-office-guest-room" },
  { name: "Bedroom Orly", slug: "bedroom-orly" },
  { name: "Bedroom Rafe", slug: "bedroom-rafe" },
  { name: "Patio", slug: "patio" },
  { name: "Garage", slug: "garage" },
  { name: "Master Bedroom", slug: "master-bedroom" },
  { name: "Master Bathroom", slug: "master-bathroom" },
  { name: "Master Closet", slug: "master-closet" },
  { name: "Bathroom White", slug: "bathroom-white" },
] as const;

export type RoomOrderEntry = (typeof ROOM_ORDER)[number];
