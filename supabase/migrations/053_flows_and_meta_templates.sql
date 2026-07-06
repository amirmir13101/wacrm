-- Add upstream Flows and advanced Meta WhatsApp template support.
-- Adapted for this CRM's workspace_id tenancy and workspace permissions.

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive'
  ));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT;

CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('keyword', 'first_inbound_message', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_node_id TEXT,
  fallback_policy JSONB NOT NULL DEFAULT
    '{"on_unknown_reply":"reprompt","max_reprompts":2,"on_timeout_hours":24,"on_exhaust":"handoff"}'::jsonb,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flows_workspace_created
  ON flows(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flows_active_trigger
  ON flows(workspace_id, trigger_type)
  WHERE status = 'active';

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view flows" ON flows;
CREATE POLICY "Workspace members can view flows" ON flows
  FOR SELECT USING (
    public.workspace_has_permission(workspace_id, 'view_flows')
  );

DROP POLICY IF EXISTS "Workspace members can create flows" ON flows;
CREATE POLICY "Workspace members can create flows" ON flows
  FOR INSERT WITH CHECK (
    public.workspace_has_permission(workspace_id, 'create_flows')
  );

DROP POLICY IF EXISTS "Workspace members can edit flows" ON flows;
CREATE POLICY "Workspace members can edit flows" ON flows
  FOR UPDATE USING (
    public.workspace_has_permission(workspace_id, 'edit_flows')
    OR public.workspace_has_permission(workspace_id, 'activate_deactivate_flows')
  )
  WITH CHECK (
    public.workspace_has_permission(workspace_id, 'edit_flows')
    OR public.workspace_has_permission(workspace_id, 'activate_deactivate_flows')
  );

DROP POLICY IF EXISTS "Workspace members can delete flows" ON flows;
CREATE POLICY "Workspace members can delete flows" ON flows
  FOR DELETE USING (
    public.workspace_has_permission(workspace_id, 'edit_flows')
  );

CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  )),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow
  ON flow_nodes(flow_id);

ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view flow nodes" ON flow_nodes;
CREATE POLICY "Workspace members can view flow nodes" ON flow_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_nodes.flow_id
        AND public.workspace_has_permission(f.workspace_id, 'view_flows')
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage flow nodes" ON flow_nodes;
CREATE POLICY "Workspace members can manage flow nodes" ON flow_nodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_nodes.flow_id
        AND public.workspace_has_permission(f.workspace_id, 'edit_flows')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM flows f
      WHERE f.id = flow_nodes.flow_id
        AND public.workspace_has_permission(f.workspace_id, 'edit_flows')
    )
  );

CREATE TABLE IF NOT EXISTS flow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'completed',
    'handed_off',
    'timed_out',
    'paused_by_agent',
    'failed'
  )),
  current_node_key TEXT,
  last_prompt_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  reprompt_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_advanced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_contact
  ON flow_runs(workspace_id, contact_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_flow_runs_active_advanced
  ON flow_runs(last_advanced_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_started
  ON flow_runs(flow_id, started_at DESC);

ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view flow runs" ON flow_runs;
CREATE POLICY "Workspace members can view flow runs" ON flow_runs
  FOR SELECT USING (
    public.workspace_has_permission(workspace_id, 'view_flows')
  );

CREATE TABLE IF NOT EXISTS flow_run_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'started',
    'node_entered',
    'message_sent',
    'reply_received',
    'fallback_fired',
    'handoff',
    'timeout',
    'error',
    'completed'
  )),
  node_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_run_events_run_type
  ON flow_run_events(flow_run_id, event_type);

CREATE INDEX IF NOT EXISTS idx_flow_run_events_run_time
  ON flow_run_events(flow_run_id, created_at DESC);

ALTER TABLE flow_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view flow events" ON flow_run_events;
CREATE POLICY "Workspace members can view flow events" ON flow_run_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM flow_runs r
      WHERE r.id = flow_run_events.flow_run_id
        AND public.workspace_has_permission(r.workspace_id, 'view_flows')
    )
  );

DROP TRIGGER IF EXISTS set_updated_at ON flows;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.increment_flow_execution_count(p_flow_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE flows
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_flow_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_flow_execution_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_flow_execution_count(UUID) TO service_role;

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS sample_values JSONB,
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS quality_score TEXT,
  ADD COLUMN IF NOT EXISTS header_handle TEXT,
  ADD COLUMN IF NOT EXISTS header_media_url TEXT,
  ADD COLUMN IF NOT EXISTS submission_error TEXT,
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE message_templates
    DROP CONSTRAINT IF EXISTS message_templates_status_check;

  ALTER TABLE message_templates
    ADD CONSTRAINT message_templates_status_check CHECK (status IN (
      'Draft',
      'Pending',
      'Approved',
      'Rejected',
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'PAUSED',
      'DISABLED',
      'IN_APPEAL',
      'PENDING_DELETION'
    ));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_workspace_name_language
  ON message_templates(workspace_id, name, language)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_templates_meta_template_id
  ON message_templates(meta_template_id)
  WHERE meta_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_templates_workspace_status
  ON message_templates(workspace_id, status);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('flow-media', 'flow-media', TRUE, 16777216),
  ('chat-media', 'chat-media', TRUE, 16777216)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = EXCLUDED.file_size_limit;

CREATE OR REPLACE FUNCTION public.workspace_id_from_storage_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[1] ~
      '^workspace-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN REPLACE((storage.foldername(p_name))[1], 'workspace-', '')::UUID
    ELSE NULL
  END;
$$;

DROP POLICY IF EXISTS "Workspace members can read flow media" ON storage.objects;
CREATE POLICY "Workspace members can read flow media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'flow-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'view_flows'
    )
  );

DROP POLICY IF EXISTS "Workspace members can upload flow media" ON storage.objects;
CREATE POLICY "Workspace members can upload flow media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'flow-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'edit_flows'
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage flow media" ON storage.objects;
CREATE POLICY "Workspace members can manage flow media" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'flow-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'edit_flows'
    )
  )
  WITH CHECK (
    bucket_id = 'flow-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'edit_flows'
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete flow media" ON storage.objects;
CREATE POLICY "Workspace members can delete flow media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'flow-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'edit_flows'
    )
  );

DROP POLICY IF EXISTS "Workspace members can read chat media" ON storage.objects;
CREATE POLICY "Workspace members can read chat media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'view_templates'
    )
  );

DROP POLICY IF EXISTS "Workspace members can upload chat media" ON storage.objects;
CREATE POLICY "Workspace members can upload chat media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'manage_local_templates'
    )
  );

DROP POLICY IF EXISTS "Workspace members can delete chat media" ON storage.objects;
CREATE POLICY "Workspace members can delete chat media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-media'
    AND public.workspace_has_permission(
      public.workspace_id_from_storage_path(name),
      'manage_local_templates'
    )
  );

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
      'view_flows',
      'create_flows',
      'edit_flows',
      'activate_deactivate_flows',
      'view_rag_chatbot',
      'manage_rag_chatbot',
      'manage_rag_provider',
      'enable_rag_auto_reply',
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
