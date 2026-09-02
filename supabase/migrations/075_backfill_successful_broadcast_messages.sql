-- 075_backfill_successful_broadcast_messages.sql
--
-- Mirrors historical successful Broadcast recipients into the normal Inbox
-- conversation history. Migration 074 handles all future sends; this one-time,
-- idempotent backfill covers successful sends that happened before 074.

DO $$
DECLARE
  recipient RECORD;
  variable RECORD;
  rendered_body TEXT;
  resolved_value TEXT;
  custom_field_id UUID;
  recorded_message_id UUID;
BEGIN
  FOR recipient IN
    SELECT
      broadcast_recipient.id AS recipient_id,
      broadcast_recipient.contact_id,
      broadcast_recipient.whatsapp_message_id,
      broadcast_recipient.sent_at,
      broadcast_recipient.status AS recipient_status,
      broadcast.user_id,
      broadcast.workspace_id,
      broadcast.template_name,
      broadcast.template_language,
      COALESCE(broadcast.template_variables, '{}'::JSONB) AS template_variables,
      template.body_text,
      contact.name AS contact_name,
      contact.phone AS contact_phone,
      contact.email AS contact_email,
      contact.company AS contact_company
    FROM public.broadcast_recipients AS broadcast_recipient
    JOIN public.broadcasts AS broadcast
      ON broadcast.id = broadcast_recipient.broadcast_id
    JOIN public.contacts AS contact
      ON contact.id = broadcast_recipient.contact_id
     AND contact.workspace_id = broadcast.workspace_id
    LEFT JOIN LATERAL (
      SELECT message_template.body_text
      FROM public.message_templates AS message_template
      WHERE message_template.workspace_id = broadcast.workspace_id
        AND message_template.name = broadcast.template_name
        AND message_template.language = broadcast.template_language
      ORDER BY message_template.updated_at DESC NULLS LAST,
               message_template.created_at DESC NULLS LAST
      LIMIT 1
    ) AS template ON TRUE
    WHERE broadcast.workspace_id IS NOT NULL
      AND broadcast_recipient.contact_id IS NOT NULL
      AND broadcast_recipient.whatsapp_message_id IS NOT NULL
      AND broadcast_recipient.sent_at IS NOT NULL
      AND broadcast_recipient.status IN ('sent', 'delivered', 'read', 'replied')
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages AS message
        JOIN public.conversations AS conversation
          ON conversation.id = message.conversation_id
        WHERE conversation.workspace_id = broadcast.workspace_id
          AND message.message_id = broadcast_recipient.whatsapp_message_id
      )
    ORDER BY broadcast_recipient.sent_at ASC, broadcast_recipient.id ASC
  LOOP
    rendered_body := COALESCE(
      NULLIF(BTRIM(recipient.body_text), ''),
      '[' || COALESCE(NULLIF(BTRIM(recipient.template_name), ''), 'template') || ']'
    );

    FOR variable IN
      SELECT entry.key, entry.value
      FROM JSONB_EACH(recipient.template_variables) AS entry
      ORDER BY
        CASE WHEN entry.key ~ '^[0-9]+$' THEN entry.key::INTEGER ELSE 2147483647 END,
        entry.key
    LOOP
      resolved_value := '';

      CASE variable.value ->> 'type'
        WHEN 'static' THEN
          resolved_value := COALESCE(variable.value ->> 'value', '');
        WHEN 'field' THEN
          resolved_value := CASE variable.value ->> 'value'
            WHEN 'name' THEN COALESCE(recipient.contact_name, '')
            WHEN 'phone' THEN COALESCE(recipient.contact_phone, '')
            WHEN 'email' THEN COALESCE(recipient.contact_email, '')
            WHEN 'company' THEN COALESCE(recipient.contact_company, '')
            ELSE ''
          END;
        WHEN 'custom_field' THEN
          BEGIN
            custom_field_id := (variable.value ->> 'value')::UUID;
            SELECT COALESCE(contact_value.value, '')
            INTO resolved_value
            FROM public.contact_custom_values AS contact_value
            WHERE contact_value.contact_id = recipient.contact_id
              AND contact_value.custom_field_id = custom_field_id
            LIMIT 1;
            resolved_value := COALESCE(resolved_value, '');
          EXCEPTION WHEN invalid_text_representation THEN
            resolved_value := '';
          END;
        ELSE
          resolved_value := '';
      END CASE;

      rendered_body := REPLACE(
        rendered_body,
        '{{' || variable.key || '}}',
        resolved_value
      );
    END LOOP;

    SELECT inbox_message_id
    INTO recorded_message_id
    FROM public.record_outbound_inbox_message(
      recipient.workspace_id,
      recipient.user_id,
      recipient.contact_id,
      recipient.whatsapp_message_id,
      recipient.template_name,
      rendered_body,
      recipient.sent_at
    );

    UPDATE public.messages
    SET status = recipient.recipient_status
    WHERE id = recorded_message_id
      AND recipient.recipient_status IN ('sent', 'delivered', 'read');
  END LOOP;
END;
$$;
