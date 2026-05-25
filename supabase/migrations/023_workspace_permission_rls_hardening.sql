-- ============================================================
-- 023_workspace_permission_rls_hardening.sql
-- Tightens workspace RLS so member permissions are enforced at
-- database level, not only by hidden UI controls.
-- Safe to rerun; does not delete or reset existing data.
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.workspace_has_permission(
  p_workspace_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN wm.role = 'owner' THEN TRUE
      WHEN wm.permissions ? p_permission THEN (wm.permissions ->> p_permission)::BOOLEAN
      WHEN p_permission = 'connect_own_whatsapp_config' THEN COALESCE(wm.can_connect_own_whatsapp, FALSE)
      ELSE public.default_workspace_permission(wm.role, p_permission)
    END,
    FALSE
  )
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_view_workspace_conversation(
  p_workspace_id UUID,
  p_assigned_agent_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.workspace_has_permission(p_workspace_id, 'view_all_conversations') THEN TRUE
    WHEN p_assigned_agent_id IS NULL THEN public.workspace_has_permission(p_workspace_id, 'view_unassigned_conversations')
    WHEN p_assigned_agent_id = auth.uid() THEN public.workspace_has_permission(p_workspace_id, 'view_assigned_conversations')
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_workspace_contact(
  p_workspace_id UUID,
  p_contact_id UUID,
  p_contact_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.workspace_has_permission(p_workspace_id, 'view_all_contacts') THEN TRUE
    WHEN NOT public.workspace_has_permission(p_workspace_id, 'view_assigned_contacts') THEN FALSE
    WHEN p_contact_owner_user_id = auth.uid() THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.workspace_id = p_workspace_id
        AND c.contact_id = p_contact_id
        AND c.assigned_agent_id = auth.uid()
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM deals d
      JOIN profiles p ON p.id = d.assigned_to
      WHERE d.workspace_id = p_workspace_id
        AND d.contact_id = p_contact_id
        AND p.user_id = auth.uid()
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_workspace_deal(
  p_workspace_id UUID,
  p_assigned_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.workspace_has_permission(p_workspace_id, 'view_all_deals') THEN TRUE
    WHEN NOT public.workspace_has_permission(p_workspace_id, 'view_assigned_deals') THEN FALSE
    WHEN p_assigned_profile_id IS NULL THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = p_assigned_profile_id
        AND p.user_id = auth.uid()
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

ALTER FUNCTION public.default_workspace_permission(TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.workspace_has_permission(UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.can_view_workspace_conversation(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.can_view_workspace_contact(UUID, UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.can_view_workspace_deal(UUID, UUID) OWNER TO postgres;

-- Remove permissive legacy personal policies and broad workspace policies.
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
DROP POLICY IF EXISTS "Workspace members can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS "Workspace members can manage tags" ON tags;
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
DROP POLICY IF EXISTS "Workspace members can manage contact tags" ON contact_tags;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
DROP POLICY IF EXISTS "Workspace members can manage custom fields" ON custom_fields;
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
DROP POLICY IF EXISTS "Workspace members can manage custom values" ON contact_custom_values;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
DROP POLICY IF EXISTS "Workspace members can manage contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS "Workspace members can view assigned conversations" ON conversations;
DROP POLICY IF EXISTS "Workspace members can update assigned conversations" ON conversations;
DROP POLICY IF EXISTS "Workspace members can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Workspace members can manage messages" ON messages;
DROP POLICY IF EXISTS "Workspace members can manage message reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
DROP POLICY IF EXISTS "Workspace members can view whatsapp config" ON whatsapp_config;
DROP POLICY IF EXISTS "Managers can manage whatsapp config" ON whatsapp_config;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
DROP POLICY IF EXISTS "Workspace members can manage templates" ON message_templates;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Workspace members can manage pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Workspace members can manage pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
DROP POLICY IF EXISTS "Workspace members can manage deals" ON deals;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Workspace members can manage broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
DROP POLICY IF EXISTS "Workspace members can manage broadcast recipients" ON broadcast_recipients;
DROP POLICY IF EXISTS "Workspace members can manage automations" ON automations;
DROP POLICY IF EXISTS "Workspace members can manage automation steps" ON automation_steps;
DROP POLICY IF EXISTS "Workspace members can view automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Workspace members can view pricing rates" ON whatsapp_pricing_rates;
DROP POLICY IF EXISTS "Managers can manage pricing rates" ON whatsapp_pricing_rates;

-- Contacts and tags.
CREATE POLICY "Members can view permitted contacts" ON contacts
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
    AND public.can_view_workspace_contact(workspace_id, id, user_id)
  );

CREATE POLICY "Members can create permitted contacts" ON contacts
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'create_contacts')
  );

CREATE POLICY "Members can update permitted contacts" ON contacts
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
    AND public.can_view_workspace_contact(workspace_id, id, user_id)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

CREATE POLICY "Members can delete permitted contacts" ON contacts
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'delete_contacts')
    AND public.can_view_workspace_contact(workspace_id, id, user_id)
  );

CREATE POLICY "Members can view permitted tags" ON tags
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
  );

CREATE POLICY "Members can manage permitted tags" ON tags
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

CREATE POLICY "Members can view permitted contact tags" ON contact_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'view_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  );

CREATE POLICY "Members can manage permitted contact tags" ON contact_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'edit_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'edit_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  );

CREATE POLICY "Members can view permitted custom fields" ON custom_fields
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
  );

CREATE POLICY "Members can manage permitted custom fields" ON custom_fields
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

CREATE POLICY "Members can view permitted custom values" ON contact_custom_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'view_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  );

CREATE POLICY "Members can manage permitted custom values" ON contact_custom_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'edit_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'edit_contacts')
        AND public.can_view_workspace_contact(c.workspace_id, c.id, c.user_id)
    )
  );

CREATE POLICY "Members can view permitted contact notes" ON contact_notes
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_contacts')
  );

CREATE POLICY "Members can manage permitted contact notes" ON contact_notes
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

-- Conversations, messages, and reactions.
CREATE POLICY "Members can view permitted conversations" ON conversations
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_inbox')
    AND public.can_view_workspace_conversation(workspace_id, assigned_agent_id)
  );

CREATE POLICY "Members can update permitted conversations" ON conversations
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_inbox')
    AND public.can_view_workspace_conversation(workspace_id, assigned_agent_id)
    AND (
      public.workspace_has_permission(workspace_id, 'reply_to_conversations')
      OR public.workspace_has_permission(workspace_id, 'close_conversations')
      OR public.workspace_has_permission(workspace_id, 'assign_conversations')
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_inbox')
  );

CREATE POLICY "Members can insert permitted conversations" ON conversations
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_inbox')
  );

CREATE POLICY "Members can view permitted messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'view_inbox')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

CREATE POLICY "Members can insert permitted messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'reply_to_conversations')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

CREATE POLICY "Members can update permitted messages" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'reply_to_conversations')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'reply_to_conversations')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

CREATE POLICY "Members can view permitted message reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'view_inbox')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

CREATE POLICY "Members can manage permitted message reactions" ON message_reactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'reply_to_conversations')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.workspace_has_permission(c.workspace_id, 'reply_to_conversations')
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

-- WhatsApp config secrets are visible only to members who can manage config
-- or explicitly connect their own WhatsApp API.
CREATE POLICY "Permitted members can view whatsapp config" ON whatsapp_config
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'manage_whatsapp_config')
      OR public.workspace_has_permission(workspace_id, 'connect_own_whatsapp_config')
    )
  );

CREATE POLICY "Permitted members can manage whatsapp config" ON whatsapp_config
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'manage_whatsapp_config')
      OR public.workspace_has_permission(workspace_id, 'connect_own_whatsapp_config')
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'manage_whatsapp_config')
      OR public.workspace_has_permission(workspace_id, 'connect_own_whatsapp_config')
    )
  );

-- Templates.
CREATE POLICY "Members can view permitted templates" ON message_templates
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_templates')
  );

CREATE POLICY "Members can manage permitted templates" ON message_templates
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_local_templates')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_local_templates')
  );

-- Pipeline and deals.
CREATE POLICY "Members can view permitted pipelines" ON pipelines
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_pipeline')
  );

CREATE POLICY "Members can manage permitted pipelines" ON pipelines
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'create_deals')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'create_deals')
  );

CREATE POLICY "Members can view permitted pipeline stages" ON pipeline_stages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND p.workspace_id IS NOT NULL
        AND public.workspace_has_permission(p.workspace_id, 'view_pipeline')
    )
  );

CREATE POLICY "Members can manage permitted pipeline stages" ON pipeline_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND p.workspace_id IS NOT NULL
        AND public.workspace_has_permission(p.workspace_id, 'create_deals')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND p.workspace_id IS NOT NULL
        AND public.workspace_has_permission(p.workspace_id, 'create_deals')
    )
  );

CREATE POLICY "Members can view permitted deals" ON deals
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_pipeline')
    AND public.can_view_workspace_deal(workspace_id, assigned_to)
  );

CREATE POLICY "Members can create permitted deals" ON deals
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'create_deals')
  );

CREATE POLICY "Members can update permitted deals" ON deals
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_deals')
    AND public.can_view_workspace_deal(workspace_id, assigned_to)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_deals')
  );

-- Broadcasts.
CREATE POLICY "Members can view permitted broadcasts" ON broadcasts
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_broadcasts')
  );

CREATE POLICY "Members can create permitted broadcasts" ON broadcasts
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'queue_broadcasts')
  );

CREATE POLICY "Members can update permitted broadcasts" ON broadcasts
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'pause_resume_cancel_broadcasts')
      OR public.workspace_has_permission(workspace_id, 'queue_broadcasts')
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND (
      public.workspace_has_permission(workspace_id, 'pause_resume_cancel_broadcasts')
      OR public.workspace_has_permission(workspace_id, 'queue_broadcasts')
    )
  );

CREATE POLICY "Members can view permitted broadcast recipients" ON broadcast_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND b.workspace_id IS NOT NULL
        AND public.workspace_has_permission(b.workspace_id, 'view_broadcasts')
    )
  );

CREATE POLICY "Members can manage permitted broadcast recipients" ON broadcast_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND b.workspace_id IS NOT NULL
        AND public.workspace_has_permission(b.workspace_id, 'queue_broadcasts')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND b.workspace_id IS NOT NULL
        AND public.workspace_has_permission(b.workspace_id, 'queue_broadcasts')
    )
  );

-- Automations.
CREATE POLICY "Members can view permitted automations" ON automations
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_automations')
  );

CREATE POLICY "Members can create permitted automations" ON automations
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'create_automations')
  );

CREATE POLICY "Members can update permitted automations" ON automations
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_automations')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_automations')
  );

CREATE POLICY "Members can delete permitted automations" ON automations
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'edit_automations')
  );

CREATE POLICY "Members can view permitted automation steps" ON automation_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.workspace_has_permission(a.workspace_id, 'view_automations')
    )
  );

CREATE POLICY "Members can manage permitted automation steps" ON automation_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.workspace_has_permission(a.workspace_id, 'edit_automations')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.workspace_has_permission(a.workspace_id, 'edit_automations')
    )
  );

CREATE POLICY "Members can view permitted automation logs" ON automation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_logs.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.workspace_has_permission(a.workspace_id, 'view_automations')
    )
  );

-- Pricing rates are globally readable through /api/pricing/rates, and
-- workspace rows remain editable only by members with pricing permission.
CREATE POLICY "Members can view workspace pricing rates" ON whatsapp_pricing_rates
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.workspace_has_permission(workspace_id, 'view_pricing')
    OR public.workspace_has_permission(workspace_id, 'use_cost_calculator')
  );

CREATE POLICY "Members can manage permitted pricing rates" ON whatsapp_pricing_rates
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_pricing_rates')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_pricing_rates')
  );
