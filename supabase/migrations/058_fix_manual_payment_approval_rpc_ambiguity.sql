-- ============================================================
-- 058_fix_manual_payment_approval_rpc_ambiguity.sql
-- Replaces the manual Pro approval RPC with explicit column
-- qualification so PL/pgSQL output column names cannot conflict
-- with table columns such as workspace_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_manual_pro_payment(
  p_request_id UUID,
  p_admin_profile_id UUID,
  p_admin_note TEXT,
  p_now TIMESTAMPTZ
)
RETURNS TABLE(id UUID, status TEXT, workspace_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  payment public.manual_payment_requests%ROWTYPE;
  customer_user_id UUID;
  target_workspace_id UUID;
  target_billing_period TEXT;
  target_ends_at TIMESTAMPTZ;
  workspace_owner_id UUID;
  customer_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS admin_profile
    WHERE admin_profile.id = p_admin_profile_id
      AND admin_profile.role = 'admin'
      AND admin_profile.approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT request.*
  INTO payment
  FROM public.manual_payment_requests AS request
  WHERE request.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;
  IF payment.status <> 'pending' THEN
    RAISE EXCEPTION 'This payment request has already been reviewed';
  END IF;
  IF payment.plan_type <> 'pro' THEN
    RAISE EXCEPTION 'Only Pro payments can use this approval function';
  END IF;

  customer_user_id := payment.user_id;
  IF customer_user_id IS NULL THEN
    SELECT customer.user_id
    INTO customer_user_id
    FROM public.profiles AS customer
    WHERE LOWER(customer.email) = LOWER(payment.payer_email)
      AND customer.account_type <> 'team_member'
    ORDER BY customer.created_at ASC
    LIMIT 1;
  END IF;

  IF customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Payment request is not linked to a customer account';
  END IF;

  SELECT COALESCE(NULLIF(TRIM(customer.full_name), ''), customer.email, 'CRM')
  INTO customer_name
  FROM public.profiles AS customer
  WHERE customer.user_id = customer_user_id;

  IF customer_name IS NULL THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  target_workspace_id := payment.workspace_id;
  IF target_workspace_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_members AS member
    WHERE member.workspace_id = target_workspace_id
      AND member.user_id = customer_user_id
      AND member.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Payment workspace does not belong to this customer';
  END IF;

  IF target_workspace_id IS NULL THEN
    SELECT workspace.id
    INTO target_workspace_id
    FROM public.workspaces AS workspace
    WHERE workspace.owner_user_id = customer_user_id
      AND workspace.archived_at IS NULL
    ORDER BY workspace.created_at ASC
    LIMIT 1;
  END IF;

  IF target_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_user_id)
    VALUES (customer_name || '''s Workspace', customer_user_id)
    RETURNING id INTO target_workspace_id;
  END IF;

  SELECT workspace.owner_user_id
  INTO workspace_owner_id
  FROM public.workspaces AS workspace
  WHERE workspace.id = target_workspace_id;

  IF workspace_owner_id = customer_user_id THEN
    INSERT INTO public.workspace_members (
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
    VALUES (
      target_workspace_id,
      customer_user_id,
      'owner',
      'active',
      '{}'::jsonb,
      FALSE,
      'all',
      'all',
      'all',
      p_now
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
      role = 'owner',
      status = 'active',
      updated_at = p_now;
  END IF;

  UPDATE public.profiles AS customer
  SET
    approval_status = 'approved',
    approved_at = p_now,
    approved_by = p_admin_profile_id,
    active_workspace_id = COALESCE(customer.active_workspace_id, target_workspace_id),
    updated_at = p_now
  WHERE customer.user_id = customer_user_id;

  target_billing_period := CASE
    WHEN payment.billing_period = 'yearly' THEN 'yearly'
    ELSE 'monthly'
  END;
  target_ends_at := CASE
    WHEN target_billing_period = 'yearly' THEN p_now + INTERVAL '1 year'
    ELSE p_now + INTERVAL '1 month'
  END;

  UPDATE public.workspaces AS workspace
  SET
    plan_type = 'pro',
    subscription_status = 'active',
    billing_period = target_billing_period,
    subscription_started_at = p_now,
    subscription_ends_at = target_ends_at,
    plan_updated_at = p_now,
    updated_at = p_now
  WHERE workspace.id = target_workspace_id;

  UPDATE public.manual_payment_requests AS request
  SET
    user_id = customer_user_id,
    workspace_id = target_workspace_id,
    status = 'approved',
    admin_note = NULLIF(TRIM(p_admin_note), ''),
    approved_by = p_admin_profile_id,
    approved_at = p_now,
    updated_at = p_now
  WHERE request.id = p_request_id;

  RETURN QUERY
  SELECT approved_request.id, approved_request.status, approved_request.workspace_id
  FROM public.manual_payment_requests AS approved_request
  WHERE approved_request.id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_manual_pro_payment(UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_manual_pro_payment(UUID, UUID, TEXT, TIMESTAMPTZ)
  TO service_role;
