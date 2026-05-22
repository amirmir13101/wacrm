-- Add server-side broadcast queue states and recipient locking fields.
-- This keeps sending on the VPS/worker side instead of in the browser.

ALTER TABLE broadcasts
  DROP CONSTRAINT IF EXISTS broadcasts_status_check;

ALTER TABLE broadcasts
  ADD CONSTRAINT broadcasts_status_check
  CHECK (
    status IN (
      'draft',
      'scheduled',
      'queued',
      'sending',
      'paused',
      'completed',
      'sent',
      'failed',
      'cancelled'
    )
  );

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queue_error TEXT,
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE broadcast_recipients
  DROP CONSTRAINT IF EXISTS broadcast_recipients_status_check;

ALTER TABLE broadcast_recipients
  ADD CONSTRAINT broadcast_recipients_status_check
  CHECK (
    status IN (
      'pending',
      'sending',
      'sent',
      'delivered',
      'read',
      'replied',
      'failed',
      'skipped'
    )
  );

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_broadcasts_queue_status
  ON broadcasts(status, created_at)
  WHERE status IN ('queued', 'sending');

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_queue
  ON broadcast_recipients(status, next_retry_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public._bcast_cols_for_status(s TEXT)
RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF s = 'sent'      THEN RETURN ARRAY['sent_count']; END IF;
  IF s = 'delivered' THEN RETURN ARRAY['sent_count','delivered_count']; END IF;
  IF s = 'read'      THEN RETURN ARRAY['sent_count','delivered_count','read_count']; END IF;
  IF s = 'replied'   THEN RETURN ARRAY['sent_count','delivered_count','read_count','replied_count']; END IF;
  IF s = 'failed'    THEN RETURN ARRAY['failed_count']; END IF;
  IF s = 'skipped'   THEN RETURN ARRAY['skipped_count']; END IF;
  RETURN ARRAY[]::TEXT[];
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_broadcast_counts(broadcast_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    sent_count      = agg.sent_count,
    delivered_count = agg.delivered_count,
    read_count      = agg.read_count,
    replied_count   = agg.replied_count,
    failed_count    = agg.failed_count,
    skipped_count   = agg.skipped_count,
    updated_at      = NOW()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent_count,
      COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('read','replied'))                    AS read_count,
      COUNT(*) FILTER (WHERE status = 'replied')                              AS replied_count,
      COUNT(*) FILTER (WHERE status = 'failed')                               AS failed_count,
      COUNT(*) FILTER (WHERE status = 'skipped')                              AS skipped_count
    FROM broadcast_recipients
    WHERE broadcast_id = broadcast_uuid
  ) agg
  WHERE b.id = broadcast_uuid;
END;
$$ LANGUAGE plpgsql;

-- Atomically claim pending/failed recipients for worker processing.
-- FOR UPDATE SKIP LOCKED prevents overlapping worker calls from selecting
-- the same recipient rows at the same time.
CREATE OR REPLACE FUNCTION public.claim_broadcast_queue_batch(
  p_batch_size INTEGER,
  p_lock_id TEXT
)
RETURNS TABLE(recipient_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT br.id
    FROM broadcast_recipients br
    JOIN broadcasts b ON b.id = br.broadcast_id
    WHERE b.status IN ('queued', 'sending')
      AND (
        br.status = 'pending'
        OR (br.status = 'failed' AND br.next_retry_at IS NOT NULL AND br.next_retry_at <= NOW())
      )
      AND (br.locked_at IS NULL OR br.locked_at < NOW() - INTERVAL '10 minutes')
    ORDER BY b.created_at ASC, br.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, p_batch_size)
  )
  UPDATE broadcast_recipients br
  SET
    status = 'sending',
    locked_at = NOW(),
    locked_by = p_lock_id,
    processing_started_at = NOW(),
    attempt_count = COALESCE(br.attempt_count, 0) + 1
  FROM claimable
  WHERE br.id = claimable.id
  RETURNING br.id;
END;
$$;
