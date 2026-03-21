import { createClient } from "@supabase/supabase-js";

/** Server-only: use ONLY from `app/api/**` routes. Never import from client components or session.ts. */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
