-- Track hosted Pro subscription periods separately from trial usage and
-- lifetime self-hosted setup requests.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_period TEXT;

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_billing_period_check,
  ADD CONSTRAINT workspaces_billing_period_check
    CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'yearly', 'lifetime_setup'));

CREATE INDEX IF NOT EXISTS idx_workspaces_subscription_ends_at
  ON workspaces(subscription_ends_at);

CREATE INDEX IF NOT EXISTS idx_workspaces_billing_period
  ON workspaces(billing_period);

ALTER TABLE manual_payment_requests
  ADD COLUMN IF NOT EXISTS billing_period TEXT;

ALTER TABLE manual_payment_requests
  DROP CONSTRAINT IF EXISTS manual_payment_requests_billing_period_check,
  ADD CONSTRAINT manual_payment_requests_billing_period_check
    CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'yearly', 'lifetime_setup'));

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_billing_period
  ON manual_payment_requests(billing_period);

UPDATE manual_payment_requests
SET billing_period = CASE
  WHEN plan_type = 'pro' THEN 'monthly'
  WHEN plan_type = 'lifetime' THEN 'lifetime_setup'
  ELSE billing_period
END
WHERE billing_period IS NULL;

UPDATE workspaces
SET
  billing_period = 'monthly',
  subscription_started_at = COALESCE(subscription_started_at, plan_updated_at, NOW()),
  subscription_ends_at = COALESCE(subscription_ends_at, COALESCE(plan_updated_at, NOW()) + INTERVAL '1 month')
WHERE plan_type = 'pro'
  AND subscription_status = 'active'
  AND billing_period IS NULL;

UPDATE workspaces
SET
  billing_period = 'lifetime_setup',
  subscription_started_at = NULL,
  subscription_ends_at = NULL,
  subscription_status = CASE WHEN subscription_status = 'active' THEN 'manual' ELSE subscription_status END,
  plan_updated_at = NOW()
WHERE plan_type = 'lifetime';

UPDATE workspaces
SET
  subscription_status = 'expired',
  plan_updated_at = NOW()
WHERE plan_type = 'pro'
  AND subscription_status = 'active'
  AND subscription_ends_at IS NOT NULL
  AND subscription_ends_at <= NOW();

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
  IF requested = 0 THEN
    RETURN jsonb_build_object('allowed', true, 'reserved', 0, 'remaining', NULL);
  END IF;

  SELECT *
  INTO workspace_row
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'workspace_not_found');
  END IF;

  IF workspace_row.plan_type = 'pro'
     AND workspace_row.subscription_status = 'active'
     AND workspace_row.subscription_ends_at IS NOT NULL
     AND workspace_row.subscription_ends_at > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reserved', 0,
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'billing_period', workspace_row.billing_period,
      'subscription_ends_at', workspace_row.subscription_ends_at,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', NULL
    );
  END IF;

  IF workspace_row.plan_type = 'pro'
     AND (
       workspace_row.subscription_status IN ('expired', 'cancelled')
       OR workspace_row.subscription_ends_at IS NULL
       OR workspace_row.subscription_ends_at <= NOW()
     ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'pro_expired',
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'billing_period', workspace_row.billing_period,
      'subscription_ends_at', workspace_row.subscription_ends_at,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', 0
    );
  END IF;

  IF workspace_row.plan_type = 'lifetime'
     OR workspace_row.billing_period = 'lifetime_setup' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'lifetime_setup_not_hosted',
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'billing_period', workspace_row.billing_period,
      'used', workspace_row.trial_broadcast_used,
      'limit', workspace_row.trial_broadcast_limit,
      'remaining', 0
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
    'reserved', requested,
    'plan_type', workspace_row.plan_type,
    'subscription_status', workspace_row.subscription_status,
    'used', workspace_row.trial_broadcast_used,
    'limit', workspace_row.trial_broadcast_limit,
    'remaining', GREATEST(workspace_row.trial_broadcast_limit - workspace_row.trial_broadcast_used, 0),
    'trial_ends_at', workspace_row.trial_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_workspace_trial_broadcast_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_workspace_trial_broadcast_usage(UUID, INTEGER) TO service_role;
