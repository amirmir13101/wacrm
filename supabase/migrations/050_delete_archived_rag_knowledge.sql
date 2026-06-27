-- Permanently remove legacy archived/deleted RAG knowledge rows.
-- This migration is intentionally scoped to the new rag_* knowledge tables only.
-- It does not touch old ai_* tables, CRM contacts, conversations, payments,
-- WhatsApp configuration, broadcasts, checkout, or authentication data.

DELETE FROM public.rag_embeddings e
USING public.rag_knowledge_chunks c, public.rag_knowledge_sources s
WHERE e.chunk_id = c.id
  AND e.workspace_id = c.workspace_id
  AND c.source_id = s.id
  AND c.workspace_id = s.workspace_id
  AND (
    s.status = 'archived'
    OR s.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  );

DELETE FROM public.rag_knowledge_chunks c
USING public.rag_knowledge_sources s
WHERE c.source_id = s.id
  AND c.workspace_id = s.workspace_id
  AND (
    s.status = 'archived'
    OR s.deleted_at IS NOT NULL
    OR c.deleted_at IS NOT NULL
  );

DELETE FROM public.rag_knowledge_sources
WHERE status = 'archived'
   OR deleted_at IS NOT NULL;
