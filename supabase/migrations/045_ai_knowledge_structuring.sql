-- ============================================================
-- 045_ai_knowledge_structuring.sql
-- Phase 8 AI-assisted knowledge structuring.
-- Additive only: enables workspace settings, import/restructure
-- draft metadata, and per-page grounded structured fact proof data.
-- ============================================================

ALTER TABLE ai_chatbot_provider_settings
  ADD COLUMN IF NOT EXISTS ai_structuring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_structuring_call_cap INTEGER NOT NULL DEFAULT 10;

ALTER TABLE ai_chatbot_provider_settings
  DROP CONSTRAINT IF EXISTS ai_chatbot_provider_ai_structuring_call_cap_check;

ALTER TABLE ai_chatbot_provider_settings
  ADD CONSTRAINT ai_chatbot_provider_ai_structuring_call_cap_check
  CHECK (ai_structuring_call_cap BETWEEN 0 AND 50);

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_provider_ai_structuring_enabled
  ON ai_chatbot_provider_settings(workspace_id, ai_structuring_enabled);

ALTER TABLE ai_website_import_jobs
  ADD COLUMN IF NOT EXISTS import_kind TEXT NOT NULL DEFAULT 'website_import',
  ADD COLUMN IF NOT EXISTS restructure_source_id UUID REFERENCES ai_knowledge_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_structuring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_structuring_status TEXT,
  ADD COLUMN IF NOT EXISTS ai_structuring_call_cap INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_pages_attempted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_pages_succeeded INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_pages_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_fields_kept INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_fields_dropped INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_structuring_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_website_import_jobs
  DROP CONSTRAINT IF EXISTS ai_website_import_jobs_import_kind_check;

ALTER TABLE ai_website_import_jobs
  ADD CONSTRAINT ai_website_import_jobs_import_kind_check CHECK (
    import_kind IN ('website_import', 'restructure_existing')
  );

ALTER TABLE ai_website_import_jobs
  DROP CONSTRAINT IF EXISTS ai_website_import_jobs_ai_structuring_status_check;

ALTER TABLE ai_website_import_jobs
  ADD CONSTRAINT ai_website_import_jobs_ai_structuring_status_check CHECK (
    ai_structuring_status IS NULL
    OR ai_structuring_status IN ('disabled', 'unavailable', 'running', 'completed', 'partial', 'failed')
  );

ALTER TABLE ai_website_import_jobs
  DROP CONSTRAINT IF EXISTS ai_website_import_jobs_ai_structuring_counts_check;

ALTER TABLE ai_website_import_jobs
  ADD CONSTRAINT ai_website_import_jobs_ai_structuring_counts_check CHECK (
    ai_structuring_call_cap >= 0
    AND ai_structuring_pages_attempted >= 0
    AND ai_structuring_pages_succeeded >= 0
    AND ai_structuring_pages_failed >= 0
    AND ai_structuring_fields_kept >= 0
    AND ai_structuring_fields_dropped >= 0
  );

CREATE INDEX IF NOT EXISTS idx_ai_website_import_jobs_restructure_source
  ON ai_website_import_jobs(workspace_id, restructure_source_id, created_at DESC)
  WHERE restructure_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_website_import_jobs_ai_structuring
  ON ai_website_import_jobs(workspace_id, ai_structuring_enabled, ai_structuring_status, created_at DESC);

ALTER TABLE ai_website_import_pages
  ADD COLUMN IF NOT EXISTS structured_facts JSONB,
  ADD COLUMN IF NOT EXISTS structuring_source TEXT NOT NULL DEFAULT 'deterministic',
  ADD COLUMN IF NOT EXISTS structuring_grounding JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_website_import_pages
  DROP CONSTRAINT IF EXISTS ai_website_import_pages_structuring_source_check;

ALTER TABLE ai_website_import_pages
  ADD CONSTRAINT ai_website_import_pages_structuring_source_check CHECK (
    structuring_source IN ('deterministic', 'ai_structured', 'mixed', 'disabled', 'unavailable', 'failed')
  );

CREATE INDEX IF NOT EXISTS idx_ai_website_import_pages_structured_facts
  ON ai_website_import_pages USING GIN(structured_facts);

CREATE INDEX IF NOT EXISTS idx_ai_website_import_pages_structuring_source
  ON ai_website_import_pages(import_job_id, structuring_source, created_at);
