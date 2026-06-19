-- Phase 5 scheduled website refresh configuration. Additive only.
CREATE TABLE IF NOT EXISTS ai_scrape_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id UUID REFERENCES ai_knowledge_sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','manual')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  hour_utc INTEGER NOT NULL DEFAULT 3 CHECK (hour_utc BETWEEN 0 AND 23),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
  page_limit INTEGER NOT NULL DEFAULT 50 CHECK (page_limit BETWEEN 1 AND 200),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_job_id TEXT,
  last_run_pages_found INTEGER,
  last_run_pages_imported INTEGER,
  last_run_changes_detected BOOLEAN,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_scrape_schedules_workspace
  ON ai_scrape_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_scrape_schedules_active_next
  ON ai_scrape_schedules(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_ai_scrape_schedules_due
  ON ai_scrape_schedules(next_run_at) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_scrape_schedules_active_url
  ON ai_scrape_schedules(workspace_id, url) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS set_updated_at ON ai_scrape_schedules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_scrape_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view scrape schedules" ON ai_scrape_schedules;
CREATE POLICY "Members can view scrape schedules" ON ai_scrape_schedules
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_ai_chatbot'));

DROP POLICY IF EXISTS "Members can create scrape schedules" ON ai_scrape_schedules;
CREATE POLICY "Members can create scrape schedules" ON ai_scrape_schedules
  FOR INSERT WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_chatbot'));

DROP POLICY IF EXISTS "Members can update scrape schedules" ON ai_scrape_schedules;
CREATE POLICY "Members can update scrape schedules" ON ai_scrape_schedules
  FOR UPDATE USING (public.workspace_has_permission(workspace_id, 'manage_ai_chatbot'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_chatbot'));

-- No browser DELETE policy. Schedules are deactivated instead.
