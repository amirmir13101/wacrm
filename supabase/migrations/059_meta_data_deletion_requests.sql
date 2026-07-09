-- Meta/Facebook Data Deletion request receipts.
-- Additive only: stores confirmation/status metadata for Meta app review callbacks.
-- It intentionally does not store signed_request payloads, app secrets, access tokens,
-- or other sensitive credentials.

CREATE TABLE IF NOT EXISTS public.meta_data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  confirmation_code TEXT NOT NULL UNIQUE,
  meta_user_id_hash TEXT,
  status TEXT NOT NULL DEFAULT 'manual_review_required'
    CHECK (
      status IN (
        'received',
        'manual_review_required',
        'no_matching_user_data_found',
        'processing',
        'completed',
        'failed'
      )
    ),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_data_deletion_requests_confirmation_code
  ON public.meta_data_deletion_requests(confirmation_code);

CREATE INDEX IF NOT EXISTS idx_meta_data_deletion_requests_meta_user_hash
  ON public.meta_data_deletion_requests(meta_user_id_hash);

ALTER TABLE public.meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage meta deletion requests" ON public.meta_data_deletion_requests;
CREATE POLICY "Service role can manage meta deletion requests"
  ON public.meta_data_deletion_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_updated_at ON public.meta_data_deletion_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.meta_data_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
