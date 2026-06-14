-- Store checkout account/contact fields for manual payment requests.
-- These fields let a public manual checkout submission create/link a customer
-- account and workspace before platform admin approval.

ALTER TABLE manual_payment_requests
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS auth_user_created BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_phone
  ON manual_payment_requests(phone);
