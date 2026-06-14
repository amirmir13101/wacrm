-- ============================================================
-- Workspace trial / plan fields and atomic broadcast usage reserve
-- First billing phase only: no payment gateway, no destructive changes.
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS trial_broadcast_limit INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS trial_broadcast_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_plan_type_check,
  ADD CONSTRAINT workspaces_plan_type_check
    CHECK (plan_type IN ('trial', 'pro', 'lifetime'));

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_subscription_status_check,
  ADD CONSTRAINT workspaces_subscription_status_check
    CHECK (subscription_status IN ('trialing', 'active', 'expired', 'cancelled', 'manual'));

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_trial_broadcast_limit_check,
  ADD CONSTRAINT workspaces_trial_broadcast_limit_check
    CHECK (trial_broadcast_limit >= 0);

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_trial_broadcast_used_check,
  ADD CONSTRAINT workspaces_trial_broadcast_used_check
    CHECK (trial_broadcast_used >= 0);

CREATE INDEX IF NOT EXISTS idx_workspaces_plan_type ON workspaces(plan_type);
CREATE INDEX IF NOT EXISTS idx_workspaces_subscription_status ON workspaces(subscription_status);
CREATE INDEX IF NOT EXISTS idx_workspaces_trial_ends_at ON workspaces(trial_ends_at);

-- Existing production workspaces get a fresh 14-day trial window from
-- migration time so rollout does not unexpectedly lock old approved users.
UPDATE workspaces
SET
  plan_type = COALESCE(NULLIF(plan_type, ''), 'trial'),
  subscription_status = COALESCE(NULLIF(subscription_status, ''), 'trialing'),
  trial_started_at = COALESCE(trial_started_at, NOW()),
  trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days'),
  trial_broadcast_limit = COALESCE(trial_broadcast_limit, 1000),
  trial_broadcast_used = COALESCE(trial_broadcast_used, 0),
  plan_updated_at = COALESCE(plan_updated_at, NOW());

CREATE OR REPLACE FUNCTION public.reserve_workspace_trial_broadcast_usage(
  p_workspace_id UUID,
  p_message_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_row workspaces%ROWTYPE;
  requested INTEGER := GREATEST(COALESCE(p_message_count, 0), 0);
  remaining INTEGER;
BEGIN
  SELECT *
  INTO workspace_row
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'workspace_missing',
      'message', 'Workspace not found.'
    );
  END IF;

  IF workspace_row.plan_type IN ('pro', 'lifetime')
     OR workspace_row.subscription_status IN ('active', 'manual') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', NULL
    );
  END IF;

  IF workspace_row.subscription_status IN ('expired', 'cancelled')
     OR workspace_row.trial_ends_at <= NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'trial_expired',
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', GREATEST(workspace_row.trial_broadcast_limit - workspace_row.trial_broadcast_used, 0),
      'trial_ends_at', workspace_row.trial_ends_at
    );
  END IF;

  remaining := GREATEST(workspace_row.trial_broadcast_limit - workspace_row.trial_broadcast_used, 0);

  IF requested > remaining THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'trial_limit_exceeded',
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', remaining,
      'requested', requested
    );
  END IF;

  UPDATE workspaces
  SET
    trial_broadcast_used = trial_broadcast_used + requested,
    plan_updated_at = NOW()
  WHERE id = p_workspace_id
  RETURNING * INTO workspace_row;

  RETURN jsonb_build_object(
    'allowed', true,
    'plan_type', workspace_row.plan_type,
    'subscription_status', workspace_row.subscription_status,
    'used', workspace_row.trial_broadcast_used,
    'limit', workspace_row.trial_broadcast_limit,
    'remaining', GREATEST(workspace_row.trial_broadcast_limit - workspace_row.trial_broadcast_used, 0),
    'reserved', requested
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_workspace_trial_broadcast_usage(
  p_workspace_id UUID,
  p_message_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested INTEGER := GREATEST(COALESCE(p_message_count, 0), 0);
BEGIN
  UPDATE workspaces
  SET
    trial_broadcast_used = GREATEST(trial_broadcast_used - requested, 0),
    plan_updated_at = NOW()
  WHERE id = p_workspace_id
    AND plan_type = 'trial'
    AND subscription_status = 'trialing';
END;
$$;

ALTER FUNCTION public.reserve_workspace_trial_broadcast_usage(UUID, INTEGER) OWNER TO postgres;
ALTER FUNCTION public.release_workspace_trial_broadcast_usage(UUID, INTEGER) OWNER TO postgres;
