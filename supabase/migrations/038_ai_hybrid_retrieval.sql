-- ============================================================
-- 038_ai_hybrid_retrieval.sql
-- Phase 4 AI chatbot hybrid retrieval: full-text, pgvector,
-- embedding metadata, and structured fact storage.
-- Non-destructive: adds nullable columns/indexes/functions only.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_knowledge_chunks
  ADD COLUMN IF NOT EXISTS search_text TEXT,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR,
  ADD COLUMN IF NOT EXISTS embedding VECTOR(1536),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS heading_path TEXT,
  ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
  ADD COLUMN IF NOT EXISTS token_count INTEGER,
  ADD COLUMN IF NOT EXISTS structured_facts JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ai_knowledge_chunks
  DROP CONSTRAINT IF EXISTS ai_knowledge_chunks_embedding_status_check;

ALTER TABLE ai_knowledge_chunks
  ADD CONSTRAINT ai_knowledge_chunks_embedding_status_check CHECK (
    embedding_status IN ('pending', 'ready', 'failed', 'skipped')
  );

UPDATE ai_knowledge_chunks
SET
  search_text = COALESCE(search_text, chunk_text),
  search_vector = COALESCE(search_vector, to_tsvector('simple', COALESCE(chunk_text, ''))),
  content_hash = COALESCE(content_hash, md5(COALESCE(chunk_text, ''))),
  token_count = COALESCE(token_count, GREATEST(1, CEIL(length(COALESCE(chunk_text, '')) / 4.0)::INTEGER)),
  updated_at = NOW()
WHERE search_text IS NULL
   OR search_vector IS NULL
   OR content_hash IS NULL
   OR token_count IS NULL;

CREATE OR REPLACE FUNCTION public.set_ai_knowledge_chunk_search_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := COALESCE(NULLIF(NEW.search_text, ''), NEW.chunk_text);
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.search_text, NEW.chunk_text, ''));
  NEW.content_hash := COALESCE(NULLIF(NEW.content_hash, ''), md5(COALESCE(NEW.search_text, NEW.chunk_text, '')));
  NEW.token_count := COALESCE(NEW.token_count, GREATEST(1, CEIL(length(COALESCE(NEW.search_text, NEW.chunk_text, '')) / 4.0)::INTEGER));
  NEW.updated_at := NOW();
  IF TG_OP = 'UPDATE' AND OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
    NEW.embedding_status := 'pending';
    NEW.embedding := NULL;
    NEW.embedded_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ai_knowledge_chunk_search_fields ON ai_knowledge_chunks;
CREATE TRIGGER set_ai_knowledge_chunk_search_fields
  BEFORE INSERT OR UPDATE ON ai_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_knowledge_chunk_search_fields();

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_workspace_source_active
  ON ai_knowledge_chunks(workspace_id, source_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_search_vector
  ON ai_knowledge_chunks USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_content_hash
  ON ai_knowledge_chunks(workspace_id, content_hash);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_structured_facts
  ON ai_knowledge_chunks USING GIN(structured_facts);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_embedding_ready
  ON ai_knowledge_chunks(workspace_id, embedding_status)
  WHERE embedding_status = 'ready';

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_embedding_hnsw
  ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_chunks(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_query_embedding VECTOR(1536) DEFAULT NULL,
  p_match_count INTEGER DEFAULT 30,
  p_candidate_count INTEGER DEFAULT 120
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  chunk_text TEXT,
  search_text TEXT,
  source_title TEXT,
  source_type TEXT,
  source_url TEXT,
  heading_path TEXT,
  chunk_index INTEGER,
  structured_facts JSONB,
  lexical_score REAL,
  vector_score REAL,
  final_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH query AS (
    SELECT websearch_to_tsquery('simple', COALESCE(p_query_text, '')) AS tsq
  ),
  candidates AS (
    SELECT
      c.id AS chunk_id,
      c.source_id,
      c.chunk_text,
      COALESCE(c.search_text, c.chunk_text) AS search_text,
      s.title AS source_title,
      s.source_type,
      c.source_url,
      c.heading_path,
      c.chunk_index,
      c.structured_facts,
      ts_rank_cd(c.search_vector, query.tsq) AS lexical_score,
      CASE
        WHEN p_query_embedding IS NULL OR c.embedding IS NULL THEN 0
        ELSE 1 - (c.embedding <=> p_query_embedding)
      END AS vector_score
    FROM ai_knowledge_chunks c
    JOIN ai_knowledge_sources s
      ON s.id = c.source_id
     AND s.workspace_id = c.workspace_id
     AND s.status = 'active'
    CROSS JOIN query
    WHERE c.workspace_id = p_workspace_id
      AND (
        c.search_vector @@ query.tsq
        OR (p_query_embedding IS NOT NULL AND c.embedding IS NOT NULL)
      )
    ORDER BY
      GREATEST(
        ts_rank_cd(c.search_vector, query.tsq),
        CASE
          WHEN p_query_embedding IS NULL OR c.embedding IS NULL THEN 0
          ELSE 1 - (c.embedding <=> p_query_embedding)
        END
      ) DESC
    LIMIT LEAST(GREATEST(p_candidate_count, p_match_count), 200)
  )
  SELECT
    chunk_id,
    source_id,
    chunk_text,
    search_text,
    source_title,
    source_type,
    source_url,
    heading_path,
    chunk_index,
    structured_facts,
    lexical_score::REAL,
    vector_score::REAL,
    ((lexical_score * 0.4) + (vector_score * 0.6))::REAL AS final_score
  FROM candidates
  ORDER BY final_score DESC
  LIMIT LEAST(GREATEST(p_match_count, 1), 50);
$$;

ALTER FUNCTION public.match_ai_knowledge_chunks(UUID, TEXT, VECTOR(1536), INTEGER, INTEGER) OWNER TO postgres;
