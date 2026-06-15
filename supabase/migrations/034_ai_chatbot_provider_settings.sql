-- ============================================================
-- 034_ai_chatbot_provider_settings.sql
-- Workspace-owned AI provider settings for Phase 1 chatbot.
-- Stores encrypted API keys server-side only; never exposed to client.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_chatbot_provider_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  base_url TEXT,
  encrypted_api_key TEXT,
  api_key_last4 TEXT,
  api_key_configured_at TIMESTAMPTZ,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_test_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id),
  CONSTRAINT ai_chatbot_provider_provider_check CHECK (
    provider IN ('openai', 'openrouter', 'groq', 'ollama', 'custom', 'anthropic')
  ),
  CONSTRAINT ai_chatbot_provider_test_status_check CHECK (
    last_test_status IS NULL OR last_test_status IN ('success', 'failed', 'not_tested')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_provider_settings_workspace
  ON ai_chatbot_provider_settings(workspace_id);

DROP TRIGGER IF EXISTS set_updated_at ON ai_chatbot_provider_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_chatbot_provider_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_chatbot_provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chatbot provider settings" ON ai_chatbot_provider_settings;
CREATE POLICY "Members can view chatbot provider settings" ON ai_chatbot_provider_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage chatbot provider settings" ON ai_chatbot_provider_settings;
CREATE POLICY "Members can manage chatbot provider settings" ON ai_chatbot_provider_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );
