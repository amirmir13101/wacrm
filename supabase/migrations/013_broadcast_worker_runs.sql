-- Store each server-side broadcast worker run for production monitoring.
-- This gives operators a durable history of cron/worker executions instead
-- of relying only on VPS console logs.

CREATE TABLE IF NOT EXISTS broadcast_worker_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  processed_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_worker_runs_started_at
  ON broadcast_worker_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_worker_runs_status
  ON broadcast_worker_runs(status, started_at DESC);

ALTER TABLE broadcast_worker_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view broadcast worker runs" ON broadcast_worker_runs;
CREATE POLICY "Authenticated users can view broadcast worker runs"
  ON broadcast_worker_runs FOR SELECT
  USING (auth.role() = 'authenticated');
