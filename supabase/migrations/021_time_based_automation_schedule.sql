-- ============================================================
-- 021_time_based_automation_schedule.sql
-- Adds server-side schedule tracking for time_based automations.
-- Safe to rerun; does not delete or reset existing automation data.
-- ============================================================

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_scheduled_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE INDEX IF NOT EXISTS idx_automations_time_based_due
  ON automations(next_scheduled_run_at)
  WHERE trigger_type = 'time_based' AND is_active = TRUE;

