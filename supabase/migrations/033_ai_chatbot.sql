-- ============================================================
-- 033_ai_chatbot.sql
-- Phase 1 AI chatbot foundation: workspace-scoped settings,
-- manual knowledge, searchable chunks, and reply/test logs.
-- No website scraping, no vector extension, and no existing data changes.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_chatbot_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tone TEXT NOT NULL DEFAULT 'friendly',
  fallback_message TEXT NOT NULL DEFAULT 'I am not sure about that yet. I can ask a team member to help you.',
  handover_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  handover_message TEXT NOT NULL DEFAULT 'A team member will follow up with you shortly.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id),
  CONSTRAINT ai_chatbot_settings_tone_check CHECK (
    tone IN ('friendly', 'professional', 'concise', 'supportive')
  )
);

CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_knowledge_sources_type_check CHECK (
    source_type IN ('manual', 'faq', 'instructions')
  ),
  CONSTRAINT ai_knowledge_sources_status_check CHECK (
    status IN ('active', 'archived')
  )
);

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES ai_knowledge_sources(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chatbot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  user_message TEXT,
  ai_response TEXT,
  status TEXT NOT NULL DEFAULT 'skipped',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_chatbot_logs_status_check CHECK (
    status IN ('answered', 'fallback', 'skipped', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_settings_workspace
  ON ai_chatbot_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_workspace
  ON ai_knowledge_sources(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_workspace
  ON ai_knowledge_chunks(workspace_id, source_id);
CREATE INDEX IF NOT EXISTS idx_ai_chatbot_logs_workspace
  ON ai_chatbot_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chatbot_logs_conversation
  ON ai_chatbot_logs(conversation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_chatbot_logs_message_once
  ON ai_chatbot_logs(message_id)
  WHERE message_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON ai_chatbot_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_chatbot_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON ai_knowledge_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_chatbot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Extend workspace permission defaults for the new AI Chatbot tab.
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
      'view_ai_chatbot',
      'manage_ai_chatbot',
      'enable_ai_auto_reply',
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

DROP POLICY IF EXISTS "Members can view chatbot settings" ON ai_chatbot_settings;
CREATE POLICY "Members can view chatbot settings" ON ai_chatbot_settings
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage chatbot settings" ON ai_chatbot_settings;
CREATE POLICY "Members can manage chatbot settings" ON ai_chatbot_settings
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can view chatbot knowledge" ON ai_knowledge_sources;
CREATE POLICY "Members can view chatbot knowledge" ON ai_knowledge_sources
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage chatbot knowledge" ON ai_knowledge_sources;
CREATE POLICY "Members can manage chatbot knowledge" ON ai_knowledge_sources
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can view chatbot chunks" ON ai_knowledge_chunks;
CREATE POLICY "Members can view chatbot chunks" ON ai_knowledge_chunks
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage chatbot chunks" ON ai_knowledge_chunks;
CREATE POLICY "Members can manage chatbot chunks" ON ai_knowledge_chunks
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can view chatbot logs" ON ai_chatbot_logs;
CREATE POLICY "Members can view chatbot logs" ON ai_chatbot_logs
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_ai_chatbot')
  );

DROP POLICY IF EXISTS "Members can manage chatbot logs" ON ai_chatbot_logs;
CREATE POLICY "Members can manage chatbot logs" ON ai_chatbot_logs
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_ai_chatbot')
  );
