-- ============================================================
-- 036_ai_website_knowledge_imports.sql
-- Phase 3 AI chatbot website knowledge imports.
-- Stores workspace-scoped crawl jobs/pages as drafts so owners can
-- review and publish into ai_knowledge_sources/chunks explicitly.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE ai_knowledge_sources
  DROP CONSTRAINT IF EXISTS ai_knowledge_sources_type_check;

ALTER TABLE ai_knowledge_sources
  ADD CONSTRAINT ai_knowledge_sources_type_check CHECK (
    source_type IN ('manual', 'faq', 'instructions', 'website')
  );

CREATE TABLE IF NOT EXISTS ai_website_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  website_url TEXT NOT NULL,
  normalized_origin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  page_limit INTEGER NOT NULL DEFAULT 50,
  pages_found INTEGER NOT NULL DEFAULT 0,
  pages_imported INTEGER NOT NULL DEFAULT 0,
  pages_skipped INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  duplicate_pages INTEGER NOT NULL DEFAULT 0,
  draft_title TEXT,
  draft_content TEXT,
  published_source_id UUID REFERENCES ai_knowledge_sources(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_website_import_jobs_status_check CHECK (
    status IN ('pending', 'running', 'draft_ready', 'completed', 'failed', 'discarded')
  ),
  CONSTRAINT ai_website_import_jobs_page_limit_check CHECK (
    page_limit BETWEEN 1 AND 100
  )
);

CREATE TABLE IF NOT EXISTS ai_website_import_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  import_job_id UUID NOT NULL REFERENCES ai_website_import_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT,
  meta_description TEXT,
  raw_text TEXT,
  cleaned_text TEXT,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'imported',
  skip_reason TEXT,
  http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_website_import_pages_status_check CHECK (
    status IN ('imported', 'skipped', 'failed', 'duplicate')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_website_import_jobs_workspace
  ON ai_website_import_jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_website_import_jobs_status
  ON ai_website_import_jobs(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_website_import_pages_job
  ON ai_website_import_pages(import_job_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_website_import_pages_workspace
  ON ai_website_import_pages(workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_website_import_pages_job_canonical
  ON ai_website_import_pages(import_job_id, canonical_url)
  WHERE canonical_url IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON ai_website_import_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_website_import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_website_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_website_import_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view website import jobs" ON ai_website_import_jobs;
CREATE POLICY "Members can view website import jobs" ON ai_website_import_jobs
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage website import jobs" ON ai_website_import_jobs;
CREATE POLICY "Members can manage website import jobs" ON ai_website_import_jobs
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can view website import pages" ON ai_website_import_pages;
CREATE POLICY "Members can view website import pages" ON ai_website_import_pages
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage website import pages" ON ai_website_import_pages;
CREATE POLICY "Members can manage website import pages" ON ai_website_import_pages
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );
