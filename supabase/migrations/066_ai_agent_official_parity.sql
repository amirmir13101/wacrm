-- ============================================================
-- 066_ai_agent_official_parity.sql
--
-- Adds the official upstream AI Agent migrations 029-033 behavior to
-- the isolated workspace-scoped ai_agent_* module created in 065.
--
-- Important:
-- - Does NOT create or alter the older ai_knowledge_chunks table used
--   by previous chatbot/RAG history.
-- - Uses workspace_id instead of upstream account_id.
-- - Idempotent and safe to run after 065.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.ai_agent_configs
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS embeddings_api_key text,
  ADD COLUMN IF NOT EXISTS handoff_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.ai_agent_configs
SET
  model = COALESCE(model, chat_model, 'gpt-4o-mini'),
  api_key = COALESCE(api_key, encrypted_api_key)
WHERE model IS NULL OR api_key IS NULL;

ALTER TABLE public.ai_agent_configs
  ALTER COLUMN model SET DEFAULT 'gpt-4o-mini';

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_autoreply_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reply_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_handoff_summary text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_ai_reply_slot(
  conversation_id uuid,
  max_replies integer
)
RETURNS boolean AS $$
  WITH claimed AS (
    UPDATE public.conversations
    SET ai_reply_count = ai_reply_count + 1
    WHERE id = conversation_id
      AND ai_reply_count < max_replies
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.match_ai_agent_knowledge_fts(
  p_workspace_id uuid,
  p_query text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
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

CREATE OR REPLACE FUNCTION public.match_ai_agent_knowledge_semantic(
  p_workspace_id uuid,
  p_query_embedding text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector(1536)) AS distance
  FROM public.ai_agent_knowledge_chunks c
  JOIN public.ai_agent_knowledge_documents d
    ON d.id = c.document_id
   AND d.workspace_id = c.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND d.status = 'active'
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector(1536)
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_agent_knowledge_fts(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_agent_knowledge_fts(uuid, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_ai_agent_knowledge_semantic(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_agent_knowledge_semantic(uuid, text, integer) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_ai_agent_usage_log_workspace_created
  ON public.ai_agent_usage_log(workspace_id, created_at DESC);
