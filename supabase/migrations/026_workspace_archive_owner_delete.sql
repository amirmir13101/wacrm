-- ============================================================
-- 026_workspace_archive_owner_delete.sql
-- Adds workspace archive metadata and blocks archived workspaces
-- from normal member access. Safe to run; keeps all CRM history.
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_workspaces_archived_at ON workspaces(archived_at);

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
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND w.archived_at IS NULL
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
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND w.archived_at IS NULL
  LIMIT 1;
$$;

