-- ============================================================
-- Workspace / team assignment system
-- Adds shared workspaces, active members, assignment history, and
-- workspace ownership columns while preserving existing user_id data.
-- Safe to run once after migration 019.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id),
  CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'agent')),
  CONSTRAINT workspace_members_status_check CHECK (status IN ('active', 'invited', 'suspended'))
);

CREATE TABLE IF NOT EXISTS assignment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  assigned_from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assignment_history_target_check CHECK (
    conversation_id IS NOT NULL OR deal_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS agent_status (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  availability TEXT NOT NULL DEFAULT 'online',
  max_open_conversations INTEGER NOT NULL DEFAULT 25,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT agent_status_availability_check CHECK (availability IN ('online', 'offline', 'away', 'busy'))
);

CREATE TABLE IF NOT EXISTS workspace_assignment_state (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  last_round_robin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_pricing_rates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_workspace ON assignment_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_conversation ON assignment_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_deal ON assignment_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_agent ON conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_workspace ON broadcasts(workspace_id);

-- Default workspace for each existing profile.
INSERT INTO workspaces (name, owner_user_id)
SELECT
  COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'CRM Workspace') || '''s Workspace',
  p.user_id
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.owner_user_id = p.user_id
);

INSERT INTO workspace_members (workspace_id, user_id, role, status)
SELECT
  w.id,
  p.user_id,
  CASE WHEN p.role = 'admin' THEN 'owner' ELSE 'agent' END,
  CASE WHEN p.approval_status = 'approved' THEN 'active' ELSE 'invited' END
FROM profiles p
JOIN workspaces w ON w.owner_user_id = p.user_id
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO agent_status (workspace_id, user_id)
SELECT workspace_id, user_id
FROM workspace_members
WHERE status = 'active'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE contacts t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE tags t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE custom_fields t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE contact_notes n SET workspace_id = c.workspace_id
FROM contacts c
WHERE n.workspace_id IS NULL AND n.contact_id = c.id;

UPDATE conversations t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE whatsapp_config t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE message_templates t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE pipelines t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE deals d SET workspace_id = p.workspace_id
FROM pipelines p
WHERE d.workspace_id IS NULL AND d.pipeline_id = p.id;

UPDATE broadcasts t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE automations t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

UPDATE whatsapp_pricing_rates t SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL AND t.user_id = w.owner_user_id;

-- Helper predicates for RLS policies.
CREATE OR REPLACE FUNCTION public.is_active_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.role
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.workspace_role(p_workspace_id) IN ('owner', 'admin', 'manager'), FALSE);
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
    WHEN public.workspace_role(p_workspace_id) IN ('owner', 'admin', 'manager') THEN TRUE
    WHEN public.workspace_role(p_workspace_id) = 'agent' THEN
      p_assigned_agent_id IS NULL OR p_assigned_agent_id = auth.uid()
    ELSE FALSE
  END;
$$;

ALTER FUNCTION public.is_active_workspace_member(UUID) OWNER TO postgres;
ALTER FUNCTION public.workspace_role(UUID) OWNER TO postgres;
ALTER FUNCTION public.can_manage_workspace(UUID) OWNER TO postgres;
ALTER FUNCTION public.can_view_workspace_conversation(UUID, UUID) OWNER TO postgres;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_assignment_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active members can view workspace" ON workspaces;
CREATE POLICY "Active members can view workspace" ON workspaces
  FOR SELECT USING (public.is_active_workspace_member(id));

DROP POLICY IF EXISTS "Owners can manage workspace" ON workspaces;
CREATE POLICY "Owners can manage workspace" ON workspaces
  FOR ALL USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Active members can view members" ON workspace_members;
CREATE POLICY "Active members can view members" ON workspace_members
  FOR SELECT USING (public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can manage members" ON workspace_members;
CREATE POLICY "Managers can manage members" ON workspace_members
  FOR ALL USING (public.can_manage_workspace(workspace_id))
  WITH CHECK (public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS "Active members can view assignment history" ON assignment_history;
CREATE POLICY "Active members can view assignment history" ON assignment_history
  FOR SELECT USING (public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can insert assignment history" ON assignment_history;
CREATE POLICY "Managers can insert assignment history" ON assignment_history
  FOR INSERT WITH CHECK (public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Active members can view agent status" ON agent_status;
CREATE POLICY "Active members can view agent status" ON agent_status
  FOR SELECT USING (public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Members can update own agent status" ON agent_status;
CREATE POLICY "Members can update own agent status" ON agent_status
  FOR UPDATE USING (user_id = auth.uid() AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (user_id = auth.uid() AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view member profiles" ON profiles;
CREATE POLICY "Workspace members can view member profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM workspace_members self
      JOIN workspace_members target ON target.workspace_id = self.workspace_id
      WHERE self.user_id = auth.uid()
        AND self.status = 'active'
        AND target.status = 'active'
        AND target.user_id = profiles.user_id
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage contacts" ON contacts;
CREATE POLICY "Workspace members can manage contacts" ON contacts
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage tags" ON tags;
CREATE POLICY "Workspace members can manage tags" ON tags
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage contact tags" ON contact_tags;
CREATE POLICY "Workspace members can manage contact tags" ON contact_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(c.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_tags.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage custom fields" ON custom_fields;
CREATE POLICY "Workspace members can manage custom fields" ON custom_fields
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage custom values" ON contact_custom_values;
CREATE POLICY "Workspace members can manage custom values" ON contact_custom_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(c.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND c.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage contact notes" ON contact_notes;
CREATE POLICY "Workspace members can manage contact notes" ON contact_notes
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view assigned conversations" ON conversations;
CREATE POLICY "Workspace members can view assigned conversations" ON conversations
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.can_view_workspace_conversation(workspace_id, assigned_agent_id)
  );

DROP POLICY IF EXISTS "Workspace members can update assigned conversations" ON conversations;
CREATE POLICY "Workspace members can update assigned conversations" ON conversations
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND (
      public.can_manage_workspace(workspace_id)
      OR assigned_agent_id = auth.uid()
      OR assigned_agent_id IS NULL
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_active_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "Workspace members can insert conversations" ON conversations;
CREATE POLICY "Workspace members can insert conversations" ON conversations
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_active_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "Workspace members can manage messages" ON messages;
CREATE POLICY "Workspace members can manage messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = messages.conversation_id
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = messages.conversation_id
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can view whatsapp config" ON whatsapp_config;
CREATE POLICY "Workspace members can view whatsapp config" ON whatsapp_config
  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can manage whatsapp config" ON whatsapp_config;
CREATE POLICY "Managers can manage whatsapp config" ON whatsapp_config
  FOR ALL USING (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage templates" ON message_templates;
CREATE POLICY "Workspace members can manage templates" ON message_templates
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage pipelines" ON pipelines;
CREATE POLICY "Workspace members can manage pipelines" ON pipelines
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Workspace members can manage pipeline stages" ON pipeline_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND p.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(p.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND p.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(p.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage deals" ON deals;
CREATE POLICY "Workspace members can manage deals" ON deals
  FOR ALL USING (
    workspace_id IS NOT NULL
    AND (
      public.can_manage_workspace(workspace_id)
      OR assigned_to IS NULL
      OR assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_active_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "Workspace members can manage broadcasts" ON broadcasts;
CREATE POLICY "Workspace members can manage broadcasts" ON broadcasts
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Workspace members can manage broadcast recipients" ON broadcast_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND b.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(b.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND b.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(b.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage automations" ON automations;
CREATE POLICY "Workspace members can manage automations" ON automations
  FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage automation steps" ON automation_steps;
CREATE POLICY "Workspace members can manage automation steps" ON automation_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(a.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(a.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can view automation logs" ON automation_logs;
CREATE POLICY "Workspace members can view automation logs" ON automation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_logs.automation_id
        AND a.workspace_id IS NOT NULL
        AND public.is_active_workspace_member(a.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage message reactions" ON message_reactions;
CREATE POLICY "Workspace members can manage message reactions" ON message_reactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.can_view_workspace_conversation(c.workspace_id, c.assigned_agent_id)
    )
  );

DROP POLICY IF EXISTS "Workspace members can view pricing rates" ON whatsapp_pricing_rates;
CREATE POLICY "Workspace members can view pricing rates" ON whatsapp_pricing_rates
  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_active_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Managers can manage pricing rates" ON whatsapp_pricing_rates;
CREATE POLICY "Managers can manage pricing rates" ON whatsapp_pricing_rates
  FOR ALL USING (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_manage_workspace(workspace_id));

DROP TRIGGER IF EXISTS set_updated_at ON workspaces;
DROP TRIGGER IF EXISTS set_updated_at ON workspace_members;
DROP TRIGGER IF EXISTS set_updated_at ON agent_status;
DROP TRIGGER IF EXISTS set_updated_at ON workspace_assignment_state;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON agent_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON workspace_assignment_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_default_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT wm.workspace_id
    INTO NEW.workspace_id
    FROM workspace_members wm
    WHERE wm.user_id = NEW.user_id
      AND wm.status = 'active'
    ORDER BY wm.joined_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_deal_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT p.workspace_id
    INTO NEW.workspace_id
    FROM pipelines p
    WHERE p.id = NEW.pipeline_id
    LIMIT 1;
  END IF;

  IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT wm.workspace_id
    INTO NEW.workspace_id
    FROM workspace_members wm
    WHERE wm.user_id = NEW.user_id
      AND wm.status = 'active'
    ORDER BY wm.joined_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_default_workspace_id() OWNER TO postgres;
ALTER FUNCTION public.set_deal_workspace_id() OWNER TO postgres;

DROP TRIGGER IF EXISTS set_default_workspace_id ON contacts;
DROP TRIGGER IF EXISTS set_default_workspace_id ON tags;
DROP TRIGGER IF EXISTS set_default_workspace_id ON custom_fields;
DROP TRIGGER IF EXISTS set_default_workspace_id ON contact_notes;
DROP TRIGGER IF EXISTS set_default_workspace_id ON conversations;
DROP TRIGGER IF EXISTS set_default_workspace_id ON whatsapp_config;
DROP TRIGGER IF EXISTS set_default_workspace_id ON message_templates;
DROP TRIGGER IF EXISTS set_default_workspace_id ON pipelines;
DROP TRIGGER IF EXISTS set_default_workspace_id ON broadcasts;
DROP TRIGGER IF EXISTS set_default_workspace_id ON automations;
DROP TRIGGER IF EXISTS set_default_workspace_id ON whatsapp_pricing_rates;
DROP TRIGGER IF EXISTS set_deal_workspace_id ON deals;

CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON tags FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON custom_fields FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON contact_notes FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON conversations FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON whatsapp_config FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON message_templates FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON pipelines FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON broadcasts FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON automations FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_default_workspace_id BEFORE INSERT ON whatsapp_pricing_rates FOR EACH ROW EXECUTE FUNCTION public.set_default_workspace_id();
CREATE TRIGGER set_deal_workspace_id BEFORE INSERT ON deals FOR EACH ROW EXECUTE FUNCTION public.set_deal_workspace_id();
