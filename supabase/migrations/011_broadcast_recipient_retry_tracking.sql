-- Track retry attempts for failed broadcast recipients.
-- These fields let the CRM show when a failed recipient was retried,
-- how many retry attempts happened, the latest retry error, and whether
-- the latest failure looks temporary, permanent, or unknown.
ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS failure_type TEXT
    CHECK (failure_type IS NULL OR failure_type IN ('temporary', 'permanent', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_failed_retry
  ON broadcast_recipients (broadcast_id, status, retry_count)
  WHERE status = 'failed';
