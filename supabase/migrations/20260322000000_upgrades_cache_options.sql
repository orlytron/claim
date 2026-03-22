-- Accumulated mid/premium pairs from each search-upgrade fetch (refresh appends).
ALTER TABLE upgrades_cache
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;
