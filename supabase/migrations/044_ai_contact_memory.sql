-- ============================================================
-- 044_ai_contact_memory.sql
-- Customer memory retention for workspace-scoped AI chatbot.
-- Additive only; no existing data is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_contact_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  memory_summary TEXT,
  key_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  topics_discussed TEXT[] NOT NULL DEFAULT '{}',
  last_intent TEXT,
  sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  preferred_language TEXT,
  unresolved_questions TEXT[] NOT NULL DEFAULT '{}',
  conversation_count INTEGER NOT NULL DEFAULT 0,
  last_conversation_at TIMESTAMPTZ,
  memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_contact_memories_workspace_contact
  ON ai_contact_memories(workspace_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_ai_contact_memories_workspace_last_conversation
  ON ai_contact_memories(workspace_id, last_conversation_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_contact_memories_workspace_last_intent
  ON ai_contact_memories(workspace_id, last_intent);

DROP TRIGGER IF EXISTS set_updated_at ON ai_contact_memories;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_contact_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_contact_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view contact memories" ON ai_contact_memories;
CREATE POLICY "Members can view contact memories" ON ai_contact_memories
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
  );

DROP POLICY IF EXISTS "Members can update contact memory enabled" ON ai_contact_memories;
CREATE POLICY "Members can update contact memory enabled" ON ai_contact_memories
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

-- No INSERT or DELETE policy is intentionally created.
-- Server-side service-role code writes memory contents.

CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  summary TEXT,
  topics TEXT[] NOT NULL DEFAULT '{}',
  intent TEXT,
  sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  unresolved_questions TEXT[] NOT NULL DEFAULT '{}',
  key_facts_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  ai_message_count INTEGER NOT NULL DEFAULT 0,
  language_detected TEXT,
  summarized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_workspace_contact_created
  ON ai_conversation_summaries(workspace_id, contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_workspace_conversation
  ON ai_conversation_summaries(workspace_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_summaries_contact_summarized
  ON ai_conversation_summaries(contact_id, summarized_at DESC);

ALTER TABLE ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view conversation summaries" ON ai_conversation_summaries;
CREATE POLICY "Members can view conversation summaries" ON ai_conversation_summaries
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
  );

-- No INSERT, UPDATE, or DELETE policy is intentionally created.
-- Writes and retention deletes are performed only by trusted service-role code.

ALTER TABLE ai_chatbot_provider_settings
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS memory_summarize_after INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS memory_retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS memory_clear_on_human BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ai_chatbot_provider_settings
  DROP CONSTRAINT IF EXISTS ai_chatbot_provider_memory_summarize_after_check;

ALTER TABLE ai_chatbot_provider_settings
  ADD CONSTRAINT ai_chatbot_provider_memory_summarize_after_check
  CHECK (memory_summarize_after BETWEEN 3 AND 20);

ALTER TABLE ai_chatbot_provider_settings
  DROP CONSTRAINT IF EXISTS ai_chatbot_provider_memory_retention_days_check;

ALTER TABLE ai_chatbot_provider_settings
  ADD CONSTRAINT ai_chatbot_provider_memory_retention_days_check
  CHECK (
    memory_retention_days IS NULL
    OR memory_retention_days IN (30, 60, 90, 180)
  );
