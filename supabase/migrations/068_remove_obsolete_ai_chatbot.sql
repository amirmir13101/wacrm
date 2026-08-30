-- ============================================================
-- 068_remove_obsolete_ai_chatbot.sql
--
-- DESTRUCTIVE, REVIEW-REQUIRED migration.
-- Do not apply until 067 is applied and the preflight guard passes.
--
-- Drops only Category-A legacy Chatbot configuration/control tables.
-- Preserves AI Agent and all standalone Knowledge Base data.
-- ============================================================

BEGIN;

-- Refuse cleanup when a workspace with legacy provider state has not been
-- configured in AI Agent. This prevents silently discarding the only AI key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.rag_provider_settings legacy
    LEFT JOIN public.ai_agent_configs agent
      ON agent.workspace_id = legacy.workspace_id
    WHERE agent.id IS NULL
       OR (
         legacy.encrypted_api_key IS NOT NULL
         AND COALESCE(agent.api_key, agent.encrypted_api_key) IS NULL
       )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'AI Chatbot cleanup blocked: configure AI Agent for every workspace that has legacy provider settings first.';
  END IF;
END;
$$;

-- Legacy Chatbot retrieval RPCs are replaced by the Knowledge Base RPCs in 067.
DROP FUNCTION IF EXISTS public.match_rag_knowledge_chunks(
  uuid,
  vector(1536),
  integer,
  double precision
);
DROP FUNCTION IF EXISTS public.match_rag_knowledge_chunks_for_service(
  uuid,
  vector(1536),
  integer,
  double precision
);

-- Category A: obsolete Chatbot-only configuration and conversation controls.
-- No CASCADE is used: any unexpected external dependency aborts this migration.
DROP TABLE IF EXISTS public.rag_auto_reply_settings;
DROP TABLE IF EXISTS public.rag_chatbot_settings;
DROP TABLE IF EXISTS public.rag_conversation_controls;
DROP TABLE IF EXISTS public.rag_provider_settings;

-- New permission values were copied by 067. Remove only obsolete key names.
UPDATE public.workspace_members
SET permissions = permissions
  - 'view_rag_chatbot'
  - 'manage_rag_chatbot'
  - 'manage_rag_provider'
  - 'enable_rag_auto_reply'
WHERE permissions ?| ARRAY[
  'view_rag_chatbot',
  'manage_rag_chatbot',
  'manage_rag_provider',
  'enable_rag_auto_reply'
];

UPDATE public.workspace_invitations
SET permissions = permissions
  - 'view_rag_chatbot'
  - 'manage_rag_chatbot'
  - 'manage_rag_provider'
  - 'enable_rag_auto_reply'
WHERE permissions ?| ARRAY[
  'view_rag_chatbot',
  'manage_rag_chatbot',
  'manage_rag_provider',
  'enable_rag_auto_reply'
];

COMMIT;
