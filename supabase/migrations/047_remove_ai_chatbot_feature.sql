-- ============================================================
-- 047_remove_ai_chatbot_feature.sql
-- Phase B AI Chatbot database cleanup proposal.
--
-- IMPORTANT:
-- - This migration deletes the old AI Chatbot feature data if applied.
-- - It intentionally does not drop shared extensions such as uuid-ossp or vector.
-- - It intentionally does not delete or modify already-applied migration files.
-- - It keeps shared CRM permission/RLS infrastructure and only removes AI-only
--   permission names from defaults and JSONB permission bags.
-- ============================================================

BEGIN;

-- Drop triggers on AI-only tables before dropping AI-only helper functions.
-- The search-field trigger depends on public.set_ai_knowledge_chunk_search_fields().
DROP TRIGGER IF EXISTS set_ai_knowledge_chunk_search_fields ON public.ai_knowledge_chunks;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_chatbot_settings;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_knowledge_sources;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_chatbot_provider_settings;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_conversation_controls;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_website_import_jobs;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_firecrawl_settings;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_scrape_schedules;
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_contact_memories;

-- Remove AI-only RPC/trigger helper functions after dependent triggers are gone.
DROP FUNCTION IF EXISTS public.match_ai_knowledge_chunks(UUID, TEXT, VECTOR(1536), INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.set_ai_knowledge_chunk_search_fields();

-- Drop AI-only tables. Their indexes, triggers, constraints, and RLS policies
-- are table-owned and are removed with the table. CASCADE is limited to the
-- AI-only dependency graph below, including foreign keys between these tables.
DROP TABLE IF EXISTS public.ai_import_history CASCADE;
DROP TABLE IF EXISTS public.ai_scrape_schedules CASCADE;
DROP TABLE IF EXISTS public.ai_website_import_pages CASCADE;
DROP TABLE IF EXISTS public.ai_website_import_jobs CASCADE;
DROP TABLE IF EXISTS public.ai_knowledge_gaps CASCADE;
DROP TABLE IF EXISTS public.ai_knowledge_chunks CASCADE;
DROP TABLE IF EXISTS public.ai_chatbot_logs CASCADE;
DROP TABLE IF EXISTS public.ai_chatbot_settings CASCADE;
DROP TABLE IF EXISTS public.ai_chatbot_provider_settings CASCADE;
DROP TABLE IF EXISTS public.ai_conversation_controls CASCADE;
DROP TABLE IF EXISTS public.ai_firecrawl_settings CASCADE;
DROP TABLE IF EXISTS public.ai_contact_memories CASCADE;
DROP TABLE IF EXISTS public.ai_conversation_summaries CASCADE;
DROP TABLE IF EXISTS public.ai_knowledge_sources CASCADE;

-- Remove now-unused AI permission keys from explicit member/invitation JSONB
-- permissions. These keys no longer exist in application code after Phase A.
UPDATE workspace_members
SET permissions = permissions
  - 'view_ai_chatbot'
  - 'manage_ai_chatbot'
  - 'enable_ai_auto_reply'
WHERE permissions ?| ARRAY[
  'view_ai_chatbot',
  'manage_ai_chatbot',
  'enable_ai_auto_reply'
];

UPDATE workspace_invitations
SET permissions = permissions
  - 'view_ai_chatbot'
  - 'manage_ai_chatbot'
  - 'enable_ai_auto_reply'
WHERE permissions ?| ARRAY[
  'view_ai_chatbot',
  'manage_ai_chatbot',
  'enable_ai_auto_reply'
];

-- Restore default workspace permissions without the removed AI Chatbot keys.
-- Keep owner/admin behavior and all non-AI CRM permissions intact.
CREATE OR REPLACE FUNCTION public.default_workspace_permission(
  p_role TEXT,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('owner', 'admin') THEN TRUE
    WHEN p_role = 'manager' THEN p_permission = ANY (ARRAY[
      'view_dashboard',
      'view_inbox',
      'view_all_conversations',
      'view_assigned_conversations',
      'view_unassigned_conversations',
      'reply_to_conversations',
      'assign_conversations',
      'close_conversations',
      'view_contacts',
      'view_all_contacts',
      'create_contacts',
      'edit_contacts',
      'export_contacts',
      'view_broadcasts',
      'create_broadcasts',
      'queue_broadcasts',
      'pause_resume_cancel_broadcasts',
      'view_broadcast_reports',
      'view_templates',
      'sync_templates',
      'manage_local_templates',
      'view_automations',
      'create_automations',
      'edit_automations',
      'activate_deactivate_automations',
      'view_pipeline',
      'view_all_deals',
      'create_deals',
      'edit_deals',
      'assign_deals',
      'mark_deal_won_lost',
      'view_reports',
      'view_pricing',
      'use_cost_calculator',
      'view_settings',
      'view_team',
      'manage_team_members',
      'edit_team_permissions',
      'use_workspace_whatsapp_config'
    ])
    WHEN p_role = 'agent' THEN p_permission = ANY (ARRAY[
      'view_dashboard',
      'view_inbox',
      'view_assigned_conversations',
      'view_unassigned_conversations',
      'reply_to_conversations',
      'view_contacts',
      'view_assigned_contacts',
      'create_contacts',
      'edit_contacts',
      'view_pipeline',
      'view_assigned_deals',
      'edit_deals',
      'view_pricing',
      'use_cost_calculator',
      'view_settings',
      'use_workspace_whatsapp_config'
    ])
    ELSE FALSE
  END;
$$;

ALTER FUNCTION public.default_workspace_permission(TEXT, TEXT) OWNER TO postgres;

COMMIT;
