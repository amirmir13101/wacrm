-- ============================================================
-- 065_ai_agent_workspace.sql
-- Separate workspace-scoped AI Agent module.
--
-- This intentionally does NOT reuse the removed ai_knowledge_* tables
-- or the existing RAG chatbot tables. The AI Agent tab owns its own
-- config, knowledge documents, chunks, and usage log.
--
-- Safe to apply manually in Supabase. No destructive changes.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'openai',
  encrypted_api_key text,
  api_key_last4 text,
  base_url text,
  chat_model text NOT NULL DEFAULT 'gpt-4o-mini',
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_dimensions integer NOT NULL DEFAULT 1536,
  system_prompt text NOT NULL DEFAULT 'You are a helpful AI agent for this business. Answer only from approved workspace knowledge when business-specific facts are requested. If the information is missing, say you do not have that information and suggest handing off to a team member.',
  is_active boolean NOT NULL DEFAULT false,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  auto_reply_max_per_conversation integer NOT NULL DEFAULT 3 CHECK (auto_reply_max_per_conversation BETWEEN 1 AND 20),
  handoff_message text NOT NULL DEFAULT 'I can connect you with a team member for this.',
  last_tested_at timestamptz,
  last_test_status text CHECK (last_test_status IS NULL OR last_test_status IN ('not_tested', 'success', 'failed')),
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'website', 'faq', 'policy', 'product', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.ai_agent_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('playground', 'draft', 'test', 'auto_reply')),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  question text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_workspace
  ON public.ai_agent_configs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_documents_workspace
  ON public.ai_agent_knowledge_documents(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chunks_workspace_document
  ON public.ai_agent_knowledge_chunks(workspace_id, document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chunks_search_vector
  ON public.ai_agent_knowledge_chunks USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chunks_embedding_hnsw
  ON public.ai_agent_knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_agent_usage_workspace_created
  ON public.ai_agent_usage_log(workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_ai_agent_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ai_agent_configs_updated_at ON public.ai_agent_configs;
CREATE TRIGGER set_ai_agent_configs_updated_at
  BEFORE UPDATE ON public.ai_agent_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_agent_updated_at();

DROP TRIGGER IF EXISTS set_ai_agent_documents_updated_at ON public.ai_agent_knowledge_documents;
CREATE TRIGGER set_ai_agent_documents_updated_at
  BEFORE UPDATE ON public.ai_agent_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_agent_updated_at();

CREATE OR REPLACE FUNCTION public.match_ai_agent_knowledge(
  p_workspace_id uuid,
  p_query text,
  p_match_count integer DEFAULT 6
)
RETURNS TABLE(id uuid, document_id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.document_id,
         c.content,
         ts_rank(c.search_vector, plainto_tsquery('simple', p_query)) AS rank
  FROM public.ai_agent_knowledge_chunks c
  JOIN public.ai_agent_knowledge_documents d
    ON d.id = c.document_id
   AND d.workspace_id = c.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND d.status = 'active'
    AND c.search_vector @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_agent_knowledge(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_agent_knowledge(uuid, text, integer) TO authenticated, service_role;

ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_agent_configs_select ON public.ai_agent_configs;
CREATE POLICY ai_agent_configs_select ON public.ai_agent_configs FOR SELECT
  USING (public.workspace_has_permission(workspace_id, 'view_ai_agent'));

DROP POLICY IF EXISTS ai_agent_configs_insert ON public.ai_agent_configs;
CREATE POLICY ai_agent_configs_insert ON public.ai_agent_configs FOR INSERT
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_configs_update ON public.ai_agent_configs;
CREATE POLICY ai_agent_configs_update ON public.ai_agent_configs FOR UPDATE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_configs_delete ON public.ai_agent_configs;
CREATE POLICY ai_agent_configs_delete ON public.ai_agent_configs FOR DELETE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_documents_select ON public.ai_agent_knowledge_documents;
CREATE POLICY ai_agent_documents_select ON public.ai_agent_knowledge_documents FOR SELECT
  USING (public.workspace_has_permission(workspace_id, 'view_ai_agent'));

DROP POLICY IF EXISTS ai_agent_documents_insert ON public.ai_agent_knowledge_documents;
CREATE POLICY ai_agent_documents_insert ON public.ai_agent_knowledge_documents FOR INSERT
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_documents_update ON public.ai_agent_knowledge_documents;
CREATE POLICY ai_agent_documents_update ON public.ai_agent_knowledge_documents FOR UPDATE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_documents_delete ON public.ai_agent_knowledge_documents;
CREATE POLICY ai_agent_documents_delete ON public.ai_agent_knowledge_documents FOR DELETE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_chunks_select ON public.ai_agent_knowledge_chunks;
CREATE POLICY ai_agent_chunks_select ON public.ai_agent_knowledge_chunks FOR SELECT
  USING (public.workspace_has_permission(workspace_id, 'view_ai_agent'));

DROP POLICY IF EXISTS ai_agent_chunks_insert ON public.ai_agent_knowledge_chunks;
CREATE POLICY ai_agent_chunks_insert ON public.ai_agent_knowledge_chunks FOR INSERT
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_chunks_update ON public.ai_agent_knowledge_chunks;
CREATE POLICY ai_agent_chunks_update ON public.ai_agent_knowledge_chunks FOR UPDATE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_chunks_delete ON public.ai_agent_knowledge_chunks;
CREATE POLICY ai_agent_chunks_delete ON public.ai_agent_knowledge_chunks FOR DELETE
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

DROP POLICY IF EXISTS ai_agent_usage_select ON public.ai_agent_usage_log;
CREATE POLICY ai_agent_usage_select ON public.ai_agent_usage_log FOR SELECT
  USING (public.workspace_has_permission(workspace_id, 'manage_ai_agent'));

-- Usage log writes are done by server/service code. No authenticated
-- insert/update/delete policies are required.
