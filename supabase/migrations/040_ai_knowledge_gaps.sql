-- ============================================================
-- 040_ai_knowledge_gaps.sql
-- Workspace-scoped unanswered-question tracking for improving
-- AI knowledge. Additive only; no existing data is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  fallback_reason TEXT NOT NULL,
  retrieval_score NUMERIC,
  chunk_count_retrieved INTEGER,
  embedding_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_workspace_created
  ON ai_knowledge_gaps(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_workspace_reason
  ON ai_knowledge_gaps(workspace_id, fallback_reason);

ALTER TABLE ai_knowledge_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chatbot knowledge gaps" ON ai_knowledge_gaps;
CREATE POLICY "Members can view chatbot knowledge gaps" ON ai_knowledge_gaps
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

-- No INSERT, UPDATE, or DELETE policy is intentionally created.
-- Writes are performed only by trusted server-side service-role code.
