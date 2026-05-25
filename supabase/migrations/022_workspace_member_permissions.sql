-- ============================================================
-- 022_workspace_member_permissions.sql
-- Adds production SaaS/team permission controls for workspace members.
-- Safe to rerun; does not delete or reset existing data.
-- ============================================================

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS can_connect_own_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contact_visibility TEXT NOT NULL DEFAULT 'assigned_only',
  ADD COLUMN IF NOT EXISTS conversation_visibility TEXT NOT NULL DEFAULT 'assigned_only',
  ADD COLUMN IF NOT EXISTS deal_visibility TEXT NOT NULL DEFAULT 'assigned_only';

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_contact_visibility_check,
  ADD CONSTRAINT workspace_members_contact_visibility_check
    CHECK (contact_visibility IN ('all', 'assigned_only', 'none'));

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_conversation_visibility_check,
  ADD CONSTRAINT workspace_members_conversation_visibility_check
    CHECK (conversation_visibility IN ('all', 'assigned_only', 'unassigned_and_assigned', 'none'));

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_deal_visibility_check,
  ADD CONSTRAINT workspace_members_deal_visibility_check
    CHECK (deal_visibility IN ('all', 'assigned_only', 'none'));

UPDATE workspace_members
SET
  permissions = '{}'::jsonb,
  can_connect_own_whatsapp = FALSE,
  contact_visibility = 'all',
  conversation_visibility = 'all',
  deal_visibility = 'all'
WHERE role IN ('owner', 'admin', 'manager');

UPDATE workspace_members
SET
  permissions = '{}'::jsonb,
  can_connect_own_whatsapp = FALSE,
  contact_visibility = 'assigned_only',
  conversation_visibility = 'unassigned_and_assigned',
  deal_visibility = 'assigned_only'
WHERE role = 'agent';

