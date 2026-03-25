-- Shopping list / rebuild planning: user-selected replacement prices per claim line.

CREATE TABLE IF NOT EXISTS replacement_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_description text NOT NULL,
  room text NOT NULL,
  claimed_price numeric NOT NULL,
  replacement_price numeric NOT NULL,
  brand text,
  model text,
  retailer_url text,
  source text NOT NULL CHECK (source IN ('similar', 'upgrade', 'manual')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS replacement_prices_line_lookup
  ON replacement_prices (item_description, room, claimed_price);

ALTER TABLE replacement_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replacement_prices_select" ON replacement_prices FOR SELECT USING (true);
CREATE POLICY "replacement_prices_insert" ON replacement_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "replacement_prices_update" ON replacement_prices FOR UPDATE USING (true);
