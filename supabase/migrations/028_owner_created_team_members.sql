-- ============================================================
-- 028_owner_created_team_members.sql
-- Adds explicit account type and first-login password-change
-- flags for owner-created team member accounts.
-- Safe additive migration; does not delete existing data.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'workspace_owner',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_password_set_at TIMESTAMPTZ;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check,
  ADD CONSTRAINT profiles_account_type_check
    CHECK (account_type IN ('platform_admin', 'workspace_owner', 'team_member'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password
  ON profiles(must_change_password)
  WHERE must_change_password = true;

-- Existing platform admins should be clearly classified as platform admins.
UPDATE profiles
SET account_type = 'platform_admin'
WHERE role = 'admin'
  AND account_type IS DISTINCT FROM 'platform_admin';

-- Existing accepted/invited team-only members should be classified as team members.
-- Workspace owners remain workspace owners.
WITH owned AS (
  SELECT DISTINCT owner_user_id AS user_id
  FROM workspaces
  WHERE owner_user_id IS NOT NULL
),
team_only AS (
  SELECT DISTINCT wm.user_id
  FROM workspace_members wm
  LEFT JOIN owned o ON o.user_id = wm.user_id
  WHERE wm.role <> 'owner'
    AND o.user_id IS NULL
)
UPDATE profiles p
SET account_type = 'team_member'
FROM team_only t
WHERE p.user_id = t.user_id
  AND p.role <> 'admin'
  AND p.account_type IS DISTINCT FROM 'team_member';

-- Keep ordinary approved/non-admin users as workspace owners by default.
UPDATE profiles
SET account_type = 'workspace_owner'
WHERE role <> 'admin'
  AND account_type IS NULL;
