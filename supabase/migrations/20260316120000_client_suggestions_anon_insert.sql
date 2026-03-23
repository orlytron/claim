-- Allow anonymous clients to insert client_suggestions (simple “send a note” form).
-- Smart-item-request uses the service role and does not rely on this policy.
DROP POLICY IF EXISTS "allow anon insert" ON client_suggestions;
CREATE POLICY "allow anon insert"
ON client_suggestions
FOR INSERT
TO anon
WITH CHECK (true);
