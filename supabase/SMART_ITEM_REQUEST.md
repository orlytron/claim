# Smart item request

- **API:** `POST /api/smart-item-request` (uses `ANTHROPIC_API_KEY` + `supabaseAdmin`).
- **Env:** Set `ANTHROPIC_API_KEY` in `.env.local` (see `.env.local.example`).

## Optional: anon insert on `client_suggestions`

If the simple fallback form should work with the browser `anon` key, apply the migration:

`supabase/migrations/20260316120000_client_suggestions_anon_insert.sql`

Or run in the Supabase SQL editor:

```sql
DROP POLICY IF EXISTS "allow anon insert" ON client_suggestions;
CREATE POLICY "allow anon insert"
ON client_suggestions
FOR INSERT
TO anon
WITH CHECK (true);
```
