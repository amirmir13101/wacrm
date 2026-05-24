-- Store the broadcast preflight counts and pricing estimate used when
-- a campaign is queued. This is audit metadata only; recipients are still
-- stored in broadcast_recipients and processed by the server-side worker.

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS preflight_total_selected INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_eligible_count INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_skipped_not_opted_in INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_skipped_opted_out INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_skipped_invalid_phone INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_skipped_duplicate_phone INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_cost_summary JSONB,
  ADD COLUMN IF NOT EXISTS pricing_missing_count INTEGER,
  ADD COLUMN IF NOT EXISTS preflight_acknowledged_at TIMESTAMPTZ;
