-- ============================================================
-- 015_contact_whatsapp_consent.sql
-- Adds explicit WhatsApp consent fields to contacts.
--
-- Existing contacts default to whatsapp_opt_in = false so no existing
-- number is treated as broadcast-eligible until an admin confirms consent.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opt_in_source TEXT,
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_consent_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_user_whatsapp_opt_in
  ON contacts(user_id, whatsapp_opt_in)
  WHERE whatsapp_opt_in = TRUE AND opted_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_opted_out
  ON contacts(user_id, opted_out_at)
  WHERE opted_out_at IS NOT NULL;

