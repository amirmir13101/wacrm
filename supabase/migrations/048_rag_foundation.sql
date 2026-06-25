-- ============================================================
-- 048_rag_foundation.sql
-- New CRM-native RAG chatbot foundation proposal.
--
-- IMPORTANT:
-- - Proposal only until manually approved/applied.
-- - Creates new rag_* database structures only.
-- - Does not reuse old ai_* table or permission names.
-- - Keeps shared extensions; never drops vector or uuid-ossp.
-- - Keeps local RAG starter retrieval defaults: cosine similarity,
--   threshold 0.5, top 4 matches.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.rag_provider_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_api_key TEXT,
  api_key_last4 TEXT,
  api_key_configured_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_error TEXT,
  backend_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id),
  CONSTRAINT rag_provider_settings_provider_check CHECK (
    provider IN ('openai', 'openrouter', 'ollama', 'custom_openai_compatible')
  ),
  CONSTRAINT rag_provider_settings_last_test_status_check CHECK (
    last_test_status IS NULL OR last_test_status IN ('not_tested', 'success', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_firecrawl_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  encrypted_api_key TEXT,
  api_key_last4 TEXT,
  api_key_configured_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id),
  CONSTRAINT rag_firecrawl_settings_last_test_status_check CHECK (
    last_test_status IS NULL OR last_test_status IN ('not_tested', 'success', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  raw_content TEXT,
  cleaned_content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT rag_knowledge_sources_type_check CHECK (
    source_type IN ('manual', 'website', 'file', 'faq', 'note')
  ),
  CONSTRAINT rag_knowledge_sources_status_check CHECK (
    status IN ('draft', 'active', 'archived', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.rag_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  content_hash TEXT,
  token_count INTEGER,
  heading_path TEXT,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (source_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS public.rag_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES public.rag_knowledge_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
  embedding_status TEXT NOT NULL DEFAULT 'ready',
  embedded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chunk_id, embedding_model),
  CONSTRAINT rag_embeddings_dimensions_check CHECK (embedding_dimensions = 1536),
  CONSTRAINT rag_embeddings_status_check CHECK (
    embedding_status IN ('pending', 'ready', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS public.rag_chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  user_question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL,
  fallback_reason TEXT,
  provider TEXT,
  chat_model TEXT,
  embedding_model TEXT,
  retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  retrieval_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rag_chat_logs_channel_check CHECK (
    channel IN ('dashboard', 'whatsapp')
  ),
  CONSTRAINT rag_chat_logs_status_check CHECK (
    status IN ('answered', 'fallback', 'provider_error', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_rag_provider_settings_workspace
  ON public.rag_provider_settings(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rag_firecrawl_settings_workspace
  ON public.rag_firecrawl_settings(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_sources_workspace_status
  ON public.rag_knowledge_sources(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_sources_workspace_created
  ON public.rag_knowledge_sources(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_chunks_workspace_source
  ON public.rag_knowledge_chunks(workspace_id, source_id);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_chunks_workspace_hash
  ON public.rag_knowledge_chunks(workspace_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_workspace_status
  ON public.rag_embeddings(workspace_id, embedding_status);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_chunk
  ON public.rag_embeddings(chunk_id);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_vector_hnsw
  ON public.rag_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_rag_chat_logs_workspace_created
  ON public.rag_chat_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_chat_logs_conversation_created
  ON public.rag_chat_logs(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_provider_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_firecrawl_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_firecrawl_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_knowledge_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_knowledge_chunks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_embeddings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.default_workspace_permission(
  p_role TEXT,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('owner', 'admin') THEN TRUE
    WHEN p_role = 'manager' THEN p_permission = ANY (ARRAY[
      'view_dashboard',
      'view_inbox',
      'view_all_conversations',
      'view_assigned_conversations',
      'view_unassigned_conversations',
      'reply_to_conversations',
      'assign_conversations',
      'close_conversations',
      'view_contacts',
      'view_all_contacts',
      'create_contacts',
      'edit_contacts',
      'export_contacts',
      'view_broadcasts',
      'create_broadcasts',
      'queue_broadcasts',
      'pause_resume_cancel_broadcasts',
      'view_broadcast_reports',
      'view_templates',
      'sync_templates',
      'manage_local_templates',
      'view_automations',
      'create_automations',
      'edit_automations',
      'activate_deactivate_automations',
      'view_rag_chatbot',
      'manage_rag_chatbot',
      'view_pipeline',
      'view_all_deals',
      'create_deals',
      'edit_deals',
      'assign_deals',
      'mark_deal_won_lost',
      'view_reports',
      'view_pricing',
      'use_cost_calculator',
      'view_settings',
      'view_team',
      'manage_team_members',
      'edit_team_permissions',
      'use_workspace_whatsapp_config'
    ])
    WHEN p_role = 'agent' THEN p_permission = ANY (ARRAY[
      'view_dashboard',
      'view_inbox',
      'view_assigned_conversations',
      'view_unassigned_conversations',
      'reply_to_conversations',
      'view_contacts',
      'view_assigned_contacts',
      'create_contacts',
      'edit_contacts',
      'view_pipeline',
      'view_assigned_deals',
      'edit_deals',
      'view_pricing',
      'use_cost_calculator',
      'view_settings',
      'use_workspace_whatsapp_config'
    ])
    ELSE FALSE
  END;
$$;

ALTER FUNCTION public.default_workspace_permission(TEXT, TEXT) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.match_rag_knowledge_chunks(
  p_workspace_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 4,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.5
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  chunk_text TEXT,
  source_title TEXT,
  source_url TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    s.id AS source_id,
    c.chunk_text,
    s.title AS source_title,
    COALESCE(c.source_url, s.source_url) AS source_url,
    (1 - (e.embedding <=> p_query_embedding))::DOUBLE PRECISION AS similarity
  FROM public.rag_embeddings e
  JOIN public.rag_knowledge_chunks c
    ON c.id = e.chunk_id
   AND c.workspace_id = e.workspace_id
  JOIN public.rag_knowledge_sources s
    ON s.id = c.source_id
   AND s.workspace_id = c.workspace_id
  WHERE p_workspace_id IS NOT NULL
    AND public.workspace_has_permission(p_workspace_id, 'view_rag_chatbot')
    AND e.workspace_id = p_workspace_id
    AND c.workspace_id = p_workspace_id
    AND s.workspace_id = p_workspace_id
    AND e.embedding_status = 'ready'
    AND c.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.status = 'active'
    AND (1 - (e.embedding <=> p_query_embedding)) >= COALESCE(p_similarity_threshold, 0.5)
  ORDER BY similarity DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_match_count, 4), 20));
$$;

ALTER FUNCTION public.match_rag_knowledge_chunks(UUID, vector(1536), INTEGER, DOUBLE PRECISION)
  OWNER TO postgres;

ALTER TABLE public.rag_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_firecrawl_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view rag provider settings" ON public.rag_provider_settings;
CREATE POLICY "Members can view rag provider settings" ON public.rag_provider_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  );

DROP POLICY IF EXISTS "Members can manage rag provider settings" ON public.rag_provider_settings;
CREATE POLICY "Members can manage rag provider settings" ON public.rag_provider_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  );

DROP POLICY IF EXISTS "Members can view rag firecrawl settings" ON public.rag_firecrawl_settings;
CREATE POLICY "Members can view rag firecrawl settings" ON public.rag_firecrawl_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  );

DROP POLICY IF EXISTS "Members can manage rag firecrawl settings" ON public.rag_firecrawl_settings;
CREATE POLICY "Members can manage rag firecrawl settings" ON public.rag_firecrawl_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_provider')
  );

DROP POLICY IF EXISTS "Members can view rag knowledge sources" ON public.rag_knowledge_sources;
CREATE POLICY "Members can view rag knowledge sources" ON public.rag_knowledge_sources
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag knowledge sources" ON public.rag_knowledge_sources;
CREATE POLICY "Members can manage rag knowledge sources" ON public.rag_knowledge_sources
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag knowledge chunks" ON public.rag_knowledge_chunks;
CREATE POLICY "Members can view rag knowledge chunks" ON public.rag_knowledge_chunks
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag knowledge chunks" ON public.rag_knowledge_chunks;
CREATE POLICY "Members can manage rag knowledge chunks" ON public.rag_knowledge_chunks
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag embeddings" ON public.rag_embeddings;
CREATE POLICY "Members can view rag embeddings" ON public.rag_embeddings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag embeddings" ON public.rag_embeddings;
CREATE POLICY "Members can manage rag embeddings" ON public.rag_embeddings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can view rag chat logs" ON public.rag_chat_logs;
CREATE POLICY "Members can view rag chat logs" ON public.rag_chat_logs
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag chat logs" ON public.rag_chat_logs;
CREATE POLICY "Members can manage rag chat logs" ON public.rag_chat_logs
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
  );

COMMIT;
