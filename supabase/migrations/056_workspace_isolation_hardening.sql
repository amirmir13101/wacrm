-- ============================================================
-- 056_workspace_isolation_hardening.sql
-- Restricts tenant RLS helpers to the profile's selected workspace.
-- Also repairs accepted invitation profiles without deleting data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_active_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.active_workspace_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

ALTER FUNCTION public.current_active_workspace_id() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.is_active_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND p.active_workspace_id = p_workspace_id
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
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.user_id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND p.active_workspace_id = p_workspace_id
  LIMIT 1;
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
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.user_id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND p.active_workspace_id = p_workspace_id
  LIMIT 1;
$$;

ALTER FUNCTION public.is_active_workspace_member(UUID) OWNER TO postgres;
ALTER FUNCTION public.workspace_role(UUID) OWNER TO postgres;
ALTER FUNCTION public.workspace_has_permission(UUID, TEXT) OWNER TO postgres;

-- The old profile-sharing policy joined every membership. Keep profile
-- visibility limited to members of the selected workspace instead.
DROP POLICY IF EXISTS "Workspace members can view member profiles" ON public.profiles;
CREATE POLICY "Workspace members can view member profiles" ON public.profiles
  FOR SELECT USING (
    profiles.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members self
      JOIN public.workspace_members target ON target.workspace_id = self.workspace_id
      WHERE self.user_id = auth.uid()
        AND self.status = 'active'
        AND target.status = 'active'
        AND target.user_id = profiles.user_id
        AND public.current_active_workspace_id() = self.workspace_id
    )
  );

-- Defaults must follow the selected workspace instead of the first
-- membership, otherwise service-side inserts can silently land in a
-- different tenant after a user joins more than one workspace.
CREATE OR REPLACE FUNCTION public.set_default_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT p.active_workspace_id
    INTO NEW.workspace_id
    FROM public.profiles p
    JOIN public.workspace_members wm
      ON wm.workspace_id = p.active_workspace_id
     AND wm.user_id = p.user_id
     AND wm.status = 'active'
    WHERE p.user_id = NEW.user_id
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
    FROM public.pipelines p
    WHERE p.id = NEW.pipeline_id
    LIMIT 1;
  END IF;

  IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT p.active_workspace_id
    INTO NEW.workspace_id
    FROM public.profiles p
    JOIN public.workspace_members wm
      ON wm.workspace_id = p.active_workspace_id
     AND wm.user_id = p.user_id
     AND wm.status = 'active'
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_default_workspace_id() OWNER TO postgres;
ALTER FUNCTION public.set_deal_workspace_id() OWNER TO postgres;

-- Accepted invite accounts are team accounts. Pick the latest accepted
-- invite as their active workspace. Existing workspaces/data are kept.
WITH latest_invitation AS (
  SELECT DISTINCT ON (wi.accepted_by_user_id)
    wi.accepted_by_user_id AS user_id,
    wi.workspace_id
  FROM public.workspace_invitations wi
  WHERE wi.status = 'accepted'
    AND wi.accepted_by_user_id IS NOT NULL
  ORDER BY wi.accepted_by_user_id, wi.accepted_at DESC NULLS LAST, wi.created_at DESC
)
UPDATE public.profiles p
SET
  account_type = 'team_member',
  active_workspace_id = li.workspace_id,
  updated_at = NOW()
FROM latest_invitation li
WHERE p.user_id = li.user_id
  AND p.role <> 'admin';
