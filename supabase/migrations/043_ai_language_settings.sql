ALTER TABLE ai_chatbot_provider_settings
  ADD COLUMN IF NOT EXISTS multilingual_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_response_language TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS supported_languages TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS translation_model TEXT DEFAULT NULL;

ALTER TABLE ai_knowledge_gaps
  ADD COLUMN IF NOT EXISTS detected_language TEXT,
  ADD COLUMN IF NOT EXISTS original_question TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_workspace_language
  ON ai_knowledge_gaps(workspace_id, detected_language, created_at DESC);
