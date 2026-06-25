-- ============================================================
-- 049_rag_auto_reply_settings.sql
-- RAG WhatsApp auto-reply settings and webhook-safe retrieval.
--
-- IMPORTANT:
-- - Proposal only until manually approved/applied.
-- - Creates new rag_* database structures only.
-- - Default auto reply is OFF.
-- - Does not touch WhatsApp credentials, webhook tokens, or old ai_* tables.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.rag_auto_reply_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_mode TEXT NOT NULL DEFAULT 'do_not_reply',
  fallback_message TEXT NOT NULL DEFAULT 'Sorry, I don''t have that information right now. A team member will help you soon.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id),
  CONSTRAINT rag_auto_reply_settings_fallback_mode_check CHECK (
    fallback_mode IN ('do_not_reply', 'send_fallback')
  )
);

CREATE INDEX IF NOT EXISTS idx_rag_auto_reply_settings_workspace
  ON public.rag_auto_reply_settings(workspace_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_auto_reply_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_auto_reply_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rag_auto_reply_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view rag auto reply settings" ON public.rag_auto_reply_settings;
CREATE POLICY "Members can view rag auto reply settings" ON public.rag_auto_reply_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag auto reply settings" ON public.rag_auto_reply_settings;
CREATE POLICY "Members can manage rag auto reply settings" ON public.rag_auto_reply_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'enable_rag_auto_reply')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'enable_rag_auto_reply')
  );

-- The WhatsApp webhook runs server-side without an authenticated browser
-- session. This service RPC keeps retrieval workspace-scoped and active-source
-- scoped without using auth.uid(). The app calls this only after loading a
-- workspace-owned whatsapp_config row and confirming auto reply is enabled.
CREATE OR REPLACE FUNCTION public.match_rag_knowledge_chunks_for_service(
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

ALTER FUNCTION public.match_rag_knowledge_chunks_for_service(UUID, vector(1536), INTEGER, DOUBLE PRECISION)
  OWNER TO postgres;

COMMIT;
