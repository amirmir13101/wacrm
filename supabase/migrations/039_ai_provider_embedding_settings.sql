-- ============================================================
-- 039_ai_provider_embedding_settings.sql
-- BYOK embedding settings for Phase 4 Retrieval.
-- Non-destructive: adds nullable/default columns only.
-- ============================================================

ALTER TABLE ai_chatbot_provider_settings
  ADD COLUMN IF NOT EXISTS embeddings_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER,
  ADD COLUMN IF NOT EXISTS last_embedding_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_embedding_test_status TEXT,
  ADD COLUMN IF NOT EXISTS last_embedding_test_error TEXT;

ALTER TABLE ai_chatbot_provider_settings
  DROP CONSTRAINT IF EXISTS ai_chatbot_provider_embedding_test_status_check;

ALTER TABLE ai_chatbot_provider_settings
  ADD CONSTRAINT ai_chatbot_provider_embedding_test_status_check CHECK (
    last_embedding_test_status IS NULL OR last_embedding_test_status IN ('success', 'failed', 'not_tested')
  );

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_provider_embeddings_enabled
  ON ai_chatbot_provider_settings(workspace_id, embeddings_enabled);
