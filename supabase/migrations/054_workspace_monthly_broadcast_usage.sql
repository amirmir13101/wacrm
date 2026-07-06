-- Workspace-scoped monthly broadcast usage for hosted Pro plans.
-- One eligible broadcast recipient counts as one broadcast message.

CREATE TABLE IF NOT EXISTS public.workspace_broadcast_usage (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  messages_used INTEGER NOT NULL DEFAULT 0 CHECK (messages_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, period_start),
  CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_workspace_broadcast_usage_workspace_period
  ON public.workspace_broadcast_usage(workspace_id, period_start DESC);

ALTER TABLE public.workspace_broadcast_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view broadcast usage" ON public.workspace_broadcast_usage;
CREATE POLICY "Workspace members can view broadcast usage"
  ON public.workspace_broadcast_usage
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.workspace_has_permission(workspace_id, 'view_broadcasts')
  );

CREATE OR REPLACE FUNCTION public.reserve_workspace_broadcast_usage(
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
  pro_limit INTEGER := 250000;
  period_start_date DATE := (date_trunc('month', NOW() AT TIME ZONE 'UTC'))::DATE;
  period_end_date DATE := ((date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'))::DATE;
  usage_row workspace_broadcast_usage%ROWTYPE;
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
    INSERT INTO public.workspace_broadcast_usage (
      workspace_id,
      period_start,
      period_end,
      messages_used
    )
    VALUES (
      p_workspace_id,
      period_start_date,
      period_end_date,
      0
    )
    ON CONFLICT (workspace_id, period_start) DO NOTHING;

    SELECT *
    INTO usage_row
    FROM public.workspace_broadcast_usage
    WHERE workspace_id = p_workspace_id
      AND period_start = period_start_date
    FOR UPDATE;

    remaining := GREATEST(pro_limit - usage_row.messages_used, 0);

    IF requested > remaining THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'pro_limit_exceeded',
        'plan_type', workspace_row.plan_type,
        'subscription_status', workspace_row.subscription_status,
        'billing_period', workspace_row.billing_period,
        'subscription_ends_at', workspace_row.subscription_ends_at,
        'used', usage_row.messages_used,
        'limit', pro_limit,
        'remaining', remaining,
        'requested', requested,
        'period_start', usage_row.period_start,
        'period_end', usage_row.period_end
      );
    END IF;

    UPDATE public.workspace_broadcast_usage
    SET
      messages_used = messages_used + requested,
      updated_at = NOW()
    WHERE workspace_id = p_workspace_id
      AND period_start = period_start_date
    RETURNING * INTO usage_row;

    RETURN jsonb_build_object(
      'allowed', true,
      'reserved', requested,
      'plan_type', workspace_row.plan_type,
      'subscription_status', workspace_row.subscription_status,
      'billing_period', workspace_row.billing_period,
      'subscription_ends_at', workspace_row.subscription_ends_at,
      'used', usage_row.messages_used,
      'limit', pro_limit,
      'remaining', GREATEST(pro_limit - usage_row.messages_used, 0),
      'period_start', usage_row.period_start,
      'period_end', usage_row.period_end
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
      'used', 0,
      'limit', pro_limit,
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

CREATE OR REPLACE FUNCTION public.release_workspace_broadcast_usage(
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
  period_start_date DATE := (date_trunc('month', NOW() AT TIME ZONE 'UTC'))::DATE;
  workspace_row workspaces%ROWTYPE;
BEGIN
  IF requested = 0 THEN
    RETURN;
  END IF;

  SELECT *
  INTO workspace_row
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF workspace_row.plan_type = 'pro' THEN
    UPDATE public.workspace_broadcast_usage
    SET
      messages_used = GREATEST(messages_used - requested, 0),
      updated_at = NOW()
    WHERE workspace_id = p_workspace_id
      AND period_start = period_start_date;
    RETURN;
  END IF;

  UPDATE workspaces
  SET
    trial_broadcast_used = GREATEST(trial_broadcast_used - requested, 0),
    plan_updated_at = NOW()
  WHERE id = p_workspace_id
    AND plan_type = 'trial'
    AND subscription_status = 'trialing';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_workspace_broadcast_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_workspace_broadcast_usage(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_workspace_broadcast_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_workspace_broadcast_usage(UUID, INTEGER) TO service_role;
