-- 077_fix_inbox_conversation_deletion.sql
--
-- Migration 076 retained a cleanup statement for public.ai_knowledge_gaps,
-- but that obsolete Chatbot table was removed by migration 047. Calling the
-- function therefore failed before the conversation could be deleted.
--
-- Current retained AI/RAG tables already declare ON DELETE CASCADE or
-- ON DELETE SET NULL for their conversation references, so no manual update
-- is needed. Contacts remain preserved.

CREATE OR REPLACE FUNCTION public.delete_inbox_conversation(
  p_workspace_id UUID,
  p_conversation_id UUID
)
RETURNS TABLE (
  deleted_conversation_id UUID,
  preserved_contact_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  SELECT conversation.contact_id
  INTO v_contact_id
  FROM public.conversations AS conversation
  WHERE conversation.id = p_conversation_id
    AND conversation.workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found in workspace';
  END IF;

  -- Deals remain intact; only their optional conversation link is cleared.
  UPDATE public.deals
  SET conversation_id = NULL
  WHERE conversation_id = p_conversation_id;

  DELETE FROM public.conversations AS conversation
  WHERE conversation.id = p_conversation_id
    AND conversation.workspace_id = p_workspace_id;

  RETURN QUERY SELECT p_conversation_id, v_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_inbox_conversation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_inbox_conversation(UUID, UUID) TO service_role;
