-- ============================================================
-- 035_ai_chatbot_conversation_controls.sql
-- Phase 2 AI chatbot controls: per-conversation pause/handoff
-- state and durable skipped-reason visibility.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_conversation_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ai_active',
  paused_at TIMESTAMPTZ,
  paused_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handoff_reason TEXT,
  last_skipped_reason TEXT,
  last_skipped_at TIMESTAMPTZ,
  last_ai_reply_at TIMESTAMPTZ,
  last_ai_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, conversation_id),
  CONSTRAINT ai_conversation_controls_status_check CHECK (
    status IN ('ai_active', 'ai_paused', 'needs_human')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_controls_workspace
  ON ai_conversation_controls(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_controls_conversation
  ON ai_conversation_controls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_controls_status
  ON ai_conversation_controls(workspace_id, status);

DROP TRIGGER IF EXISTS set_updated_at ON ai_conversation_controls;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_conversation_controls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_conversation_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view AI conversation controls" ON ai_conversation_controls;
CREATE POLICY "Members can view AI conversation controls" ON ai_conversation_controls
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_inbox')
    AND public.can_view_workspace_conversation(
      workspace_id,
      (
        SELECT c.assigned_agent_id
        FROM conversations c
        WHERE c.id = ai_conversation_controls.conversation_id
          AND c.workspace_id = ai_conversation_controls.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Members can manage AI conversation controls" ON ai_conversation_controls;
CREATE POLICY "Members can manage AI conversation controls" ON ai_conversation_controls
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
    AND public.can_view_workspace_conversation(
      workspace_id,
      (
        SELECT c.assigned_agent_id
        FROM conversations c
        WHERE c.id = ai_conversation_controls.conversation_id
          AND c.workspace_id = ai_conversation_controls.workspace_id
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
    AND EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = ai_conversation_controls.conversation_id
        AND c.workspace_id = ai_conversation_controls.workspace_id
    )
  );
