import { redirect } from "next/navigation";
import { loadSession } from "../lib/session";
import { slugify } from "../lib/utils";

export default async function ReviewIndexPage() {
  const session = await loadSession();

  if (!session?.claim_items?.length) {
    redirect("/");
  }

  const rooms = session.room_summary?.map((r) => r.room) ??
    [...new Set(session.claim_items.map((i) => i.room))];

  if (!rooms.length) redirect("/");

  redirect(`/review/${slugify(rooms[0])}`);
}
