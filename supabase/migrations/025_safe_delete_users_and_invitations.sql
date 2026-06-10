-- ============================================================
-- 025_safe_delete_users_and_invitations.sql
-- Adds soft-delete metadata for platform users and workspace invitations.
-- Safe to run; does not hard-delete users, invitations, or CRM history.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check,
  ADD CONSTRAINT profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended', 'deleted'));

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

ALTER TABLE workspace_invitations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_deleted_at
  ON workspace_invitations(deleted_at);

