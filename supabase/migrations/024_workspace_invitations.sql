-- ============================================================
-- 024_workspace_invitations.sql
-- Adds secure workspace invitations and fixes approved normal
-- users so their own workspace membership is owner/full access.
-- Safe to run; does not delete or reset existing data.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_visibility TEXT NOT NULL DEFAULT 'assigned_only',
  conversation_visibility TEXT NOT NULL DEFAULT 'assigned_only',
  deal_visibility TEXT NOT NULL DEFAULT 'assigned_only',
  can_connect_own_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workspace_invitations_role_check CHECK (role IN ('admin', 'manager', 'agent')),
  CONSTRAINT workspace_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CONSTRAINT workspace_invitations_contact_visibility_check CHECK (contact_visibility IN ('all', 'assigned_only', 'none')),
  CONSTRAINT workspace_invitations_conversation_visibility_check CHECK (conversation_visibility IN ('all', 'assigned_only', 'unassigned_and_assigned', 'none')),
  CONSTRAINT workspace_invitations_deal_visibility_check CHECK (deal_visibility IN ('all', 'assigned_only', 'none'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash
  ON workspace_invitations(token_hash);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_status
  ON workspace_invitations(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email
  ON workspace_invitations(LOWER(invited_email));

-- Every approved user owns their personal/default workspace. This fixes
-- older rows created before the SaaS owner/member split existed.
INSERT INTO workspaces (name, owner_user_id)
SELECT
  COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'CRM Workspace') || '''s Workspace',
  p.user_id
FROM profiles p
WHERE p.approval_status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.owner_user_id = p.user_id
  );

INSERT INTO workspace_members (
  workspace_id,
  user_id,
  role,
  status,
  permissions,
  can_connect_own_whatsapp,
  contact_visibility,
  conversation_visibility,
  deal_visibility,
  joined_at
)
SELECT
  w.id,
  p.user_id,
  'owner',
  'active',
  '{}'::jsonb,
  FALSE,
  'all',
  'all',
  'all',
  NOW()
FROM profiles p
JOIN workspaces w ON w.owner_user_id = p.user_id
WHERE p.approval_status = 'approved'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
  role = 'owner',
  status = 'active',
  permissions = '{}'::jsonb,
  can_connect_own_whatsapp = FALSE,
  contact_visibility = 'all',
  conversation_visibility = 'all',
  deal_visibility = 'all',
  updated_at = NOW();

UPDATE profiles p
SET active_workspace_id = w.id
FROM workspaces w
WHERE p.active_workspace_id IS NULL
  AND p.user_id = w.owner_user_id
  AND p.approval_status = 'approved';

CREATE OR REPLACE FUNCTION public.touch_workspace_invitations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_workspace_invitations_updated_at ON workspace_invitations;
CREATE TRIGGER touch_workspace_invitations_updated_at
  BEFORE UPDATE ON workspace_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_workspace_invitations_updated_at();

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace managers can view invitations" ON workspace_invitations;
CREATE POLICY "Workspace managers can view invitations" ON workspace_invitations
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_team_members')
  );

DROP POLICY IF EXISTS "Workspace managers can create invitations" ON workspace_invitations;
CREATE POLICY "Workspace managers can create invitations" ON workspace_invitations
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_team_members')
  );

DROP POLICY IF EXISTS "Workspace managers can update invitations" ON workspace_invitations;
CREATE POLICY "Workspace managers can update invitations" ON workspace_invitations
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_team_members')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'manage_team_members')
  );
