-- ============================================================
-- 051_rag_dashboard_ui_support.sql
-- RAG-native dashboard support tables for the restored AI Chatbot UI.
--
-- IMPORTANT:
-- - Creates/updates rag_* structures only.
-- - Does not restore old ai_* tables.
-- - Does not touch WhatsApp credential/webhook tables.
-- - Keeps uuid-ossp and vector extensions.
-- ============================================================

BEGIN;

ALTER TABLE public.rag_provider_settings
  DROP CONSTRAINT IF EXISTS rag_provider_settings_provider_check;

ALTER TABLE public.rag_provider_settings
  ADD CONSTRAINT rag_provider_settings_provider_check CHECK (
    provider IN (
      'openai',
      'openrouter',
      'groq',
      'ollama',
      'custom_openai_compatible',
      'gemini'
    )
  );

ALTER TABLE public.rag_firecrawl_settings
  ADD COLUMN IF NOT EXISTS remaining_credits INTEGER,
  ADD COLUMN IF NOT EXISTS plan_credits INTEGER,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_concurrency INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.rag_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tone TEXT NOT NULL DEFAULT 'professional',
  handover_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fallback_message TEXT NOT NULL DEFAULT 'I do not see that information in the current knowledge base.',
  handover_message TEXT NOT NULL DEFAULT 'I can connect you with a team member if you want.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id),
  CONSTRAINT rag_chatbot_settings_tone_check CHECK (
    tone IN ('professional', 'friendly', 'concise', 'helpful')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_website_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  normalized_origin TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  page_limit INTEGER NOT NULL DEFAULT 25,
  pages_found INTEGER NOT NULL DEFAULT 0,
  pages_imported INTEGER NOT NULL DEFAULT 0,
  pages_skipped INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  duplicate_pages INTEGER NOT NULL DEFAULT 0,
  raw_characters INTEGER NOT NULL DEFAULT 0,
  saved_characters INTEGER NOT NULL DEFAULT 0,
  capped BOOLEAN NOT NULL DEFAULT FALSE,
  crawl_provider TEXT NOT NULL DEFAULT 'firecrawl',
  credits_used INTEGER,
  provider_status TEXT,
  draft_title TEXT,
  draft_content TEXT,
  published_source_id UUID REFERENCES public.rag_knowledge_sources(id) ON DELETE SET NULL,
  quality_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT rag_website_import_jobs_status_check CHECK (
    status IN ('running', 'draft_ready', 'published', 'failed', 'discarded')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_website_import_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  import_job_id UUID NOT NULL REFERENCES public.rag_website_import_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT,
  status TEXT NOT NULL,
  skip_reason TEXT,
  content_hash TEXT,
  character_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_website_import_pages_status_check CHECK (
    status IN ('imported', 'skipped', 'failed', 'duplicate')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_scrape_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  page_limit INTEGER NOT NULL DEFAULT 25,
  day_of_week INTEGER,
  hour_utc INTEGER,
  auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_pages_found INTEGER,
  last_run_pages_imported INTEGER,
  last_import_job_id UUID REFERENCES public.rag_website_import_jobs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_scrape_schedules_frequency_check CHECK (
    frequency IN ('daily', 'weekly', 'monthly')
  ),
  CONSTRAINT rag_scrape_schedules_day_check CHECK (
    day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)
  ),
  CONSTRAINT rag_scrape_schedules_hour_check CHECK (
    hour_utc IS NULL OR (hour_utc >= 0 AND hour_utc <= 23)
  )
);

CREATE TABLE IF NOT EXISTS public.rag_import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.rag_knowledge_sources(id) ON DELETE SET NULL,
  import_job_id UUID REFERENCES public.rag_website_import_jobs(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES public.rag_scrape_schedules(id) ON DELETE SET NULL,
  url TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL,
  pages_found INTEGER NOT NULL DEFAULT 0,
  pages_imported INTEGER NOT NULL DEFAULT 0,
  pages_skipped INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  duplicate_pages INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER,
  changes_detected BOOLEAN,
  change_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_import_history_trigger_check CHECK (
    trigger_type IN ('manual', 'scheduled', 'restructure')
  ),
  CONSTRAINT rag_import_history_status_check CHECK (
    status IN ('running', 'draft_ready', 'published', 'failed', 'discarded')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  normalized_question TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'dashboard',
  reason TEXT NOT NULL DEFAULT 'missing_knowledge',
  count INTEGER NOT NULL DEFAULT 1,
  suggested_action TEXT,
  language_code TEXT,
  language_name TEXT,
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_knowledge_gaps_channel_check CHECK (
    channel IN ('dashboard', 'whatsapp', 'unknown')
  ),
  CONSTRAINT rag_knowledge_gaps_reason_check CHECK (
    reason IN ('missing_knowledge', 'weak_context', 'fallback', 'provider_error', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_knowledge_gaps_workspace_normalized_channel
  ON public.rag_knowledge_gaps(workspace_id, normalized_question, channel)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rag_website_import_jobs_workspace_created
  ON public.rag_website_import_jobs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_website_import_pages_job
  ON public.rag_website_import_pages(import_job_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rag_import_history_workspace_created
  ON public.rag_import_history(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_scrape_schedules_workspace_active
  ON public.rag_scrape_schedules(workspace_id, is_active, next_run_at);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_gaps_workspace_last_asked
  ON public.rag_knowledge_gaps(workspace_id, last_asked_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_chatbot_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_chatbot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_website_import_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_website_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_scrape_schedules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_knowledge_gaps;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_knowledge_gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rag_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_website_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_website_import_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_scrape_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_knowledge_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view rag chatbot settings" ON public.rag_chatbot_settings;
CREATE POLICY "Members can view rag chatbot settings" ON public.rag_chatbot_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag chatbot settings" ON public.rag_chatbot_settings;
CREATE POLICY "Members can manage rag chatbot settings" ON public.rag_chatbot_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag website import jobs" ON public.rag_website_import_jobs;
CREATE POLICY "Members can view rag website import jobs" ON public.rag_website_import_jobs
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag website import jobs" ON public.rag_website_import_jobs;
CREATE POLICY "Members can manage rag website import jobs" ON public.rag_website_import_jobs
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag website import pages" ON public.rag_website_import_pages;
CREATE POLICY "Members can view rag website import pages" ON public.rag_website_import_pages
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag website import pages" ON public.rag_website_import_pages;
CREATE POLICY "Members can manage rag website import pages" ON public.rag_website_import_pages
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag import history" ON public.rag_import_history;
CREATE POLICY "Members can view rag import history" ON public.rag_import_history
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag import history" ON public.rag_import_history;
CREATE POLICY "Members can manage rag import history" ON public.rag_import_history
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag scrape schedules" ON public.rag_scrape_schedules;
CREATE POLICY "Members can view rag scrape schedules" ON public.rag_scrape_schedules
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag scrape schedules" ON public.rag_scrape_schedules;
CREATE POLICY "Members can manage rag scrape schedules" ON public.rag_scrape_schedules
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag knowledge gaps" ON public.rag_knowledge_gaps;
CREATE POLICY "Members can view rag knowledge gaps" ON public.rag_knowledge_gaps
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag knowledge gaps" ON public.rag_knowledge_gaps;
CREATE POLICY "Members can manage rag knowledge gaps" ON public.rag_knowledge_gaps
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

COMMIT;
