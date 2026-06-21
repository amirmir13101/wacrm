-- ============================================================
-- 046_ai_knowledge_gap_diagnostics.sql
-- Additive diagnostics for AI unanswered questions.
-- Existing rows remain valid; all new fields are nullable/defaulted.
-- ============================================================

ALTER TABLE ai_knowledge_gaps
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS technical_reason TEXT,
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_model TEXT,
  ADD COLUMN IF NOT EXISTS provider_status INTEGER,
  ADD COLUMN IF NOT EXISTS provider_error_code TEXT,
  ADD COLUMN IF NOT EXISTS provider_error_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_error_message TEXT,
  ADD COLUMN IF NOT EXISTS selected_chunk_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_source_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_source_titles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retrieval_debug JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS guardrail_reason TEXT,
  ADD COLUMN IF NOT EXISTS handoff_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_action TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_source_id UUID REFERENCES ai_knowledge_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_workspace_category
  ON ai_knowledge_gaps(workspace_id, failure_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_workspace_channel
  ON ai_knowledge_gaps(workspace_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_unresolved
  ON ai_knowledge_gaps(workspace_id, created_at DESC)
  WHERE resolved_at IS NULL;
