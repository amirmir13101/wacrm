-- ============================================================
-- 037_ai_firecrawl_settings.sql
-- Workspace-owned Firecrawl Cloud credentials and crawl tracking.
-- API keys are encrypted by the application before storage and are
-- never returned to browser clients.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_firecrawl_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  encrypted_api_key TEXT,
  api_key_last4 TEXT,
  api_key_configured_at TIMESTAMPTZ,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_error TEXT,
  remaining_credits INTEGER,
  plan_credits INTEGER,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  max_concurrency INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id),
  CONSTRAINT ai_firecrawl_test_status_check CHECK (
    last_test_status IS NULL OR last_test_status IN ('success', 'failed', 'not_tested')
  )
);

ALTER TABLE ai_website_import_jobs
  ADD COLUMN IF NOT EXISTS crawl_provider TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS external_crawl_id TEXT,
  ADD COLUMN IF NOT EXISTS credits_used INTEGER,
  ADD COLUMN IF NOT EXISTS provider_status TEXT;

ALTER TABLE ai_website_import_jobs
  DROP CONSTRAINT IF EXISTS ai_website_import_jobs_crawl_provider_check;

ALTER TABLE ai_website_import_jobs
  ADD CONSTRAINT ai_website_import_jobs_crawl_provider_check CHECK (
    crawl_provider IN ('legacy', 'firecrawl')
  );

CREATE INDEX IF NOT EXISTS idx_ai_firecrawl_settings_workspace
  ON ai_firecrawl_settings(workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_website_import_jobs_external_crawl
  ON ai_website_import_jobs(workspace_id, external_crawl_id)
  WHERE external_crawl_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON ai_firecrawl_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_firecrawl_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_firecrawl_settings ENABLE ROW LEVEL SECURITY;

-- Intentionally no browser-facing RLS policies. Firecrawl credentials are
-- accessed only through authenticated server routes using the service role,
-- which return masked metadata and never return encrypted_api_key.
