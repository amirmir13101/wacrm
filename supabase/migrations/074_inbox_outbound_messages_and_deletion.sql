-- 074_inbox_outbound_messages_and_deletion.sql
--
-- Keeps successful outbound Broadcast messages in the same conversation and
-- message history used by Inbox, and provides an atomic service-only message
-- deletion operation that recalculates the conversation preview.

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_contact
  ON public.conversations(workspace_id, contact_id, created_at);

CREATE OR REPLACE FUNCTION public.record_outbound_inbox_message(
  p_workspace_id UUID,
  p_user_id UUID,
  p_contact_id UUID,
  p_whatsapp_message_id TEXT,
  p_template_name TEXT,
  p_content_text TEXT,
  p_sent_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  conversation_id UUID,
  inbox_message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_preview TEXT;
BEGIN
  IF p_workspace_id IS NULL OR p_user_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'workspace, user, and contact are required';
  END IF;

  IF NULLIF(BTRIM(p_whatsapp_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'WhatsApp message ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts AS contact
    WHERE contact.id = p_contact_id
      AND contact.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'contact does not belong to workspace';
  END IF;

  -- Serialize outbound-first conversation creation for this workspace/contact
  -- without imposing a destructive uniqueness migration on historical data.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::TEXT || ':' || p_contact_id::TEXT, 0)
  );

  -- Idempotency: worker retries must never duplicate a message already mirrored
  -- after Meta accepted the original send.
  SELECT message.id, message.conversation_id
  INTO v_message_id, v_conversation_id
  FROM public.messages AS message
  JOIN public.conversations AS conversation
    ON conversation.id = message.conversation_id
  WHERE conversation.workspace_id = p_workspace_id
    AND message.message_id = p_whatsapp_message_id
  ORDER BY message.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_conversation_id, v_message_id;
    RETURN;
  END IF;

  SELECT conversation.id
  INTO v_conversation_id
  FROM public.conversations AS conversation
  WHERE conversation.workspace_id = p_workspace_id
    AND conversation.contact_id = p_contact_id
  ORDER BY conversation.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      user_id,
      workspace_id,
      contact_id,
      status,
      unread_count,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_workspace_id,
      p_contact_id,
      'open',
      0,
      p_sent_at,
      p_sent_at
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  v_preview := COALESCE(
    NULLIF(BTRIM(p_content_text), ''),
    '[' || COALESCE(NULLIF(BTRIM(p_template_name), ''), 'template') || ']'
  );

  INSERT INTO public.messages (
    conversation_id,
    sender_type,
    sender_id,
    content_type,
    content_text,
    template_name,
    message_id,
    status,
    created_at
  ) VALUES (
    v_conversation_id,
    'agent',
    p_user_id,
    'template',
    v_preview,
    NULLIF(BTRIM(p_template_name), ''),
    p_whatsapp_message_id,
    'sent',
    p_sent_at
  )
  RETURNING id INTO v_message_id;

  UPDATE public.conversations AS conversation
  SET
    last_message_text = v_preview,
    last_message_at = p_sent_at,
    updated_at = p_sent_at
  WHERE conversation.id = v_conversation_id
    AND (
      conversation.last_message_at IS NULL
      OR conversation.last_message_at <= p_sent_at
    );

  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_inbox_message(
  p_workspace_id UUID,
  p_message_id UUID
)
RETURNS TABLE (
  deleted_message_id UUID,
  conversation_id UUID,
  updated_last_message_text TEXT,
  updated_last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_latest_content TEXT;
  v_latest_type TEXT;
  v_latest_at TIMESTAMPTZ;
BEGIN
  SELECT message.conversation_id
  INTO v_conversation_id
  FROM public.messages AS message
  JOIN public.conversations AS conversation
    ON conversation.id = message.conversation_id
  WHERE message.id = p_message_id
    AND conversation.workspace_id = p_workspace_id
  FOR UPDATE OF conversation;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'message not found in workspace';
  END IF;

  DELETE FROM public.messages AS message
  WHERE message.id = p_message_id
    AND message.conversation_id = v_conversation_id;

  SELECT message.content_text, message.content_type, message.created_at
  INTO v_latest_content, v_latest_type, v_latest_at
  FROM public.messages AS message
  WHERE message.conversation_id = v_conversation_id
  ORDER BY message.created_at DESC, message.id DESC
  LIMIT 1;

  IF v_latest_at IS NULL THEN
    v_latest_content := NULL;
  ELSE
    v_latest_content := COALESCE(
      NULLIF(BTRIM(v_latest_content), ''),
      '[' || COALESCE(NULLIF(BTRIM(v_latest_type), ''), 'message') || ']'
    );
  END IF;

  UPDATE public.conversations AS conversation
  SET
    last_message_text = v_latest_content,
    last_message_at = v_latest_at,
    updated_at = NOW()
  WHERE conversation.id = v_conversation_id;

  RETURN QUERY
  SELECT p_message_id, v_conversation_id, v_latest_content, v_latest_at;
END;
$$;

REVOKE ALL ON FUNCTION public.record_outbound_inbox_message(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_outbound_inbox_message(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION public.delete_inbox_message(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_inbox_message(UUID, UUID) TO service_role;
