-- Phase 5 website import history. Additive only.
CREATE TABLE IF NOT EXISTS ai_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id UUID REFERENCES ai_knowledge_sources(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES ai_scrape_schedules(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual','scheduled','api')),
  status TEXT NOT NULL CHECK (status IN (
    'running','completed','failed','cancelled','draft_ready','published','no_changes'
  )),
  firecrawl_job_id TEXT,
  pages_found INTEGER NOT NULL DEFAULT 0,
  pages_imported INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  pages_skipped INTEGER NOT NULL DEFAULT 0,
  draft_length INTEGER,
  changes_detected BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary TEXT,
  credits_used INTEGER,
  quality_warnings JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_import_history_workspace_created
  ON ai_import_history(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_import_history_source_created
  ON ai_import_history(workspace_id, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_import_history_schedule_created
  ON ai_import_history(schedule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_import_history_running
  ON ai_import_history(status, started_at) WHERE status = 'running';

ALTER TABLE ai_import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view import history" ON ai_import_history;
CREATE POLICY "Members can view import history" ON ai_import_history
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_ai_chatbot'));

-- Service-role server code performs all writes.
