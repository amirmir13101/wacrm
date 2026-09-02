-- 076_delete_inbox_conversation.sql
--
-- Deletes an Inbox conversation and its message history while preserving the
-- underlying contact. Related deal and diagnostic references are detached;
-- ON DELETE CASCADE / SET NULL constraints handle the remaining dependants.

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

  -- Deals remain intact; only their link to the deleted conversation is cleared.
  UPDATE public.deals
  SET conversation_id = NULL
  WHERE conversation_id = p_conversation_id;

  -- Knowledge-gap diagnostics remain useful after a chat is removed.
  UPDATE public.ai_knowledge_gaps
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
