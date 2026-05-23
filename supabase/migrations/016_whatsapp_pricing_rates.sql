-- ============================================================
-- 016_whatsapp_pricing_rates.sql
-- Admin-managed WhatsApp pricing rates for cost estimation.
--
-- Rates are manual estimates copied from Meta/WhatsApp pricing sources.
-- Actual billing remains controlled by Meta.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_pricing_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_name TEXT NOT NULL,
  iso_country_code TEXT NOT NULL,
  phone_country_code TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  marketing_rate NUMERIC(12, 6),
  utility_rate NUMERIC(12, 6),
  authentication_rate NUMERIC(12, 6),
  service_rate NUMERIC(12, 6),
  source_url TEXT,
  source_note TEXT,
  official_rate_source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  verified_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  effective_from DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_pricing_rates_user_country_currency
  ON whatsapp_pricing_rates(user_id, iso_country_code, currency);

CREATE INDEX IF NOT EXISTS idx_whatsapp_pricing_rates_user_phone_code
  ON whatsapp_pricing_rates(user_id, phone_country_code);

ALTER TABLE whatsapp_pricing_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own WhatsApp pricing rates" ON whatsapp_pricing_rates;
CREATE POLICY "Users can manage own WhatsApp pricing rates"
  ON whatsapp_pricing_rates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_pricing_rates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON whatsapp_pricing_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

