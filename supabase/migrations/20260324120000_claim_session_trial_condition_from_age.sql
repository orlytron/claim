-- Derive condition from age_years for session `trial` (UI / export alignment).
-- Safe for missing age_years (treated as 0) and empty claim_items arrays.

UPDATE claim_session cs
SET claim_items = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN COALESCE((item->>'age_years')::numeric, 0) = 0
        THEN jsonb_set(item, '{condition}', '"New"', true)
        WHEN COALESCE((item->>'age_years')::numeric, 0) <= 5
        THEN jsonb_set(item, '{condition}', '"Like New"', true)
        WHEN COALESCE((item->>'age_years')::numeric, 0) <= 10
        THEN jsonb_set(item, '{condition}', '"Good"', true)
        WHEN COALESCE((item->>'age_years')::numeric, 0) <= 15
        THEN jsonb_set(item, '{condition}', '"Decent"', true)
        ELSE jsonb_set(item, '{condition}', '"Used"', true)
      END
    )
    FROM jsonb_array_elements(cs.claim_items) AS item
  ),
  cs.claim_items
)
WHERE cs.id = 'trial'
  AND cs.claim_items IS NOT NULL
  AND jsonb_typeof(cs.claim_items) = 'array';
