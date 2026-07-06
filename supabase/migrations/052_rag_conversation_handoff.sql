-- ============================================================
-- 052_rag_conversation_handoff.sql
-- RAG AI Chatbot human-handoff conversation controls.
--
-- IMPORTANT:
-- - Creates a small rag_* control table only.
-- - Does not alter WhatsApp credentials, webhook verification, payments,
--   broadcasts, checkout, pricing, contacts, or core conversation status.
-- - AI is paused only after a workspace user accepts human handoff.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.rag_conversation_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  human_request_status TEXT NOT NULL DEFAULT 'none',
  waiting_for_human_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  ai_paused BOOLEAN NOT NULL DEFAULT FALSE,
  requested_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  ai_resumed_at TIMESTAMPTZ,
  last_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, conversation_id),
  CONSTRAINT rag_conversation_controls_status_check CHECK (
    human_request_status IN ('none', 'requested', 'accepted', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_rag_conversation_controls_workspace
  ON public.rag_conversation_controls(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rag_conversation_controls_conversation
  ON public.rag_conversation_controls(conversation_id);

CREATE INDEX IF NOT EXISTS idx_rag_conversation_controls_requested
  ON public.rag_conversation_controls(workspace_id, human_request_status)
  WHERE human_request_status = 'requested';

DROP TRIGGER IF EXISTS set_updated_at ON public.rag_conversation_controls;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rag_conversation_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rag_conversation_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view rag conversation controls" ON public.rag_conversation_controls;
CREATE POLICY "Members can view rag conversation controls" ON public.rag_conversation_controls
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_rag_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage rag conversation controls" ON public.rag_conversation_controls;
CREATE POLICY "Members can manage rag conversation controls" ON public.rag_conversation_controls
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
      OR public.workspace_has_permission(workspace_id, 'reply_to_conversations')
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'manage_rag_chatbot')
      OR public.workspace_has_permission(workspace_id, 'reply_to_conversations')
    )
  );

COMMIT;
