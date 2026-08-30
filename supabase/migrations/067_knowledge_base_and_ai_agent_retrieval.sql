-- ============================================================
-- 067_knowledge_base_and_ai_agent_retrieval.sql
--
-- Non-destructive migration for the standalone Knowledge Base.
-- - Preserves all existing RAG knowledge, Firecrawl, import, and history data.
-- - Replaces legacy Chatbot permissions with Knowledge Base permissions.
-- - Adds bounded lexical and semantic Knowledge Base retrieval for AI Agent.
-- - Does not drop any table or column.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.default_workspace_permission(
  p_role text,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('owner', 'admin') THEN true
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
      'view_flows',
      'create_flows',
      'edit_flows',
      'activate_deactivate_flows',
      'view_ai_agent',
      'manage_ai_agent',
      'view_knowledge_base',
      'manage_knowledge_base',
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
    ELSE false
  END;
$$;

ALTER FUNCTION public.default_workspace_permission(text, text) OWNER TO postgres;

-- Preserve explicit per-member and invitation choices under the new names.
UPDATE public.workspace_members
SET permissions = permissions || jsonb_build_object(
  'view_knowledge_base',
    COALESCE((permissions ->> 'view_knowledge_base')::boolean, false)
    OR COALESCE((permissions ->> 'view_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_provider')::boolean, false),
  'manage_knowledge_base',
    COALESCE((permissions ->> 'manage_knowledge_base')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_provider')::boolean, false)
)
WHERE permissions ?| ARRAY[
  'view_knowledge_base',
  'manage_knowledge_base',
  'view_rag_chatbot',
  'manage_rag_chatbot',
  'manage_rag_provider'
];

UPDATE public.workspace_invitations
SET permissions = permissions || jsonb_build_object(
  'view_knowledge_base',
    COALESCE((permissions ->> 'view_knowledge_base')::boolean, false)
    OR COALESCE((permissions ->> 'view_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_provider')::boolean, false),
  'manage_knowledge_base',
    COALESCE((permissions ->> 'manage_knowledge_base')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_chatbot')::boolean, false)
    OR COALESCE((permissions ->> 'manage_rag_provider')::boolean, false)
)
WHERE permissions ?| ARRAY[
  'view_knowledge_base',
  'manage_knowledge_base',
  'view_rag_chatbot',
  'manage_rag_chatbot',
  'manage_rag_provider'
];

-- Make retained knowledge chunks searchable without changing their stored text.
ALTER TABLE public.rag_knowledge_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(chunk_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_chunks_search_vector
  ON public.rag_knowledge_chunks USING gin(search_vector);

CREATE OR REPLACE FUNCTION public.match_knowledge_base_fts(
  p_workspace_id uuid,
  p_query text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.chunk_text AS content,
    ts_rank(c.search_vector, plainto_tsquery('simple', p_query)) AS rank
  FROM public.rag_knowledge_chunks c
  JOIN public.rag_knowledge_sources s
    ON s.id = c.source_id
   AND s.workspace_id = c.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND (auth.role() = 'service_role'
      OR public.workspace_has_permission(p_workspace_id, 'view_knowledge_base'))
    AND c.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.status = 'active'
    AND c.search_vector @@ plainto_tsquery('simple', p_query)
  ORDER BY rank DESC
  LIMIT GREATEST(LEAST(COALESCE(p_match_count, 6), 20), 0);
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge_base_semantic(
  p_workspace_id uuid,
  p_query_embedding text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, distance real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.chunk_text AS content,
    (e.embedding <=> p_query_embedding::vector(1536))::real AS distance
  FROM public.rag_embeddings e
  JOIN public.rag_knowledge_chunks c
    ON c.id = e.chunk_id
   AND c.workspace_id = e.workspace_id
  JOIN public.rag_knowledge_sources s
    ON s.id = c.source_id
   AND s.workspace_id = c.workspace_id
  WHERE e.workspace_id = p_workspace_id
    AND (auth.role() = 'service_role'
      OR public.workspace_has_permission(p_workspace_id, 'view_knowledge_base'))
    AND e.embedding_status = 'ready'
    AND c.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.status = 'active'
  ORDER BY e.embedding <=> p_query_embedding::vector(1536)
  LIMIT GREATEST(LEAST(COALESCE(p_match_count, 6), 20), 0);
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_base_fts(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base_fts(uuid, text, integer)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_knowledge_base_semantic(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge_base_semantic(uuid, text, integer)
  TO authenticated, service_role;

-- Retain all category-C tables but move their RLS to Knowledge Base permissions.
DROP POLICY IF EXISTS "Members can view rag firecrawl settings" ON public.rag_firecrawl_settings;
CREATE POLICY "Members can view knowledge base firecrawl settings" ON public.rag_firecrawl_settings
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag firecrawl settings" ON public.rag_firecrawl_settings;
CREATE POLICY "Members can manage knowledge base firecrawl settings" ON public.rag_firecrawl_settings
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag knowledge sources" ON public.rag_knowledge_sources;
CREATE POLICY "Members can view knowledge base sources" ON public.rag_knowledge_sources
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag knowledge sources" ON public.rag_knowledge_sources;
CREATE POLICY "Members can manage knowledge base sources" ON public.rag_knowledge_sources
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag knowledge chunks" ON public.rag_knowledge_chunks;
CREATE POLICY "Members can view knowledge base chunks" ON public.rag_knowledge_chunks
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag knowledge chunks" ON public.rag_knowledge_chunks;
CREATE POLICY "Members can manage knowledge base chunks" ON public.rag_knowledge_chunks
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag embeddings" ON public.rag_embeddings;
CREATE POLICY "Members can view knowledge base embeddings" ON public.rag_embeddings
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag embeddings" ON public.rag_embeddings;
CREATE POLICY "Members can manage knowledge base embeddings" ON public.rag_embeddings
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag chat logs" ON public.rag_chat_logs;
CREATE POLICY "Members can view knowledge base activity" ON public.rag_chat_logs
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag chat logs" ON public.rag_chat_logs;
CREATE POLICY "Members can manage knowledge base activity" ON public.rag_chat_logs
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag website import jobs" ON public.rag_website_import_jobs;
CREATE POLICY "Members can view knowledge base import jobs" ON public.rag_website_import_jobs
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag website import jobs" ON public.rag_website_import_jobs;
CREATE POLICY "Members can manage knowledge base import jobs" ON public.rag_website_import_jobs
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag website import pages" ON public.rag_website_import_pages;
CREATE POLICY "Members can view knowledge base import pages" ON public.rag_website_import_pages
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag website import pages" ON public.rag_website_import_pages;
CREATE POLICY "Members can manage knowledge base import pages" ON public.rag_website_import_pages
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag import history" ON public.rag_import_history;
CREATE POLICY "Members can view knowledge base import history" ON public.rag_import_history
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag import history" ON public.rag_import_history;
CREATE POLICY "Members can manage knowledge base import history" ON public.rag_import_history
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag scrape schedules" ON public.rag_scrape_schedules;
CREATE POLICY "Members can view knowledge base schedules" ON public.rag_scrape_schedules
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag scrape schedules" ON public.rag_scrape_schedules;
CREATE POLICY "Members can manage knowledge base schedules" ON public.rag_scrape_schedules
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

DROP POLICY IF EXISTS "Members can view rag knowledge gaps" ON public.rag_knowledge_gaps;
CREATE POLICY "Members can view knowledge base gaps" ON public.rag_knowledge_gaps
  FOR SELECT USING (public.workspace_has_permission(workspace_id, 'view_knowledge_base'));
DROP POLICY IF EXISTS "Members can manage rag knowledge gaps" ON public.rag_knowledge_gaps;
CREATE POLICY "Members can manage knowledge base gaps" ON public.rag_knowledge_gaps
  FOR ALL USING (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'))
  WITH CHECK (public.workspace_has_permission(workspace_id, 'manage_knowledge_base'));

COMMIT;
