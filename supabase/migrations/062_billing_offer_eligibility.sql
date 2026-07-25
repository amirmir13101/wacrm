-- Permanent billing offer eligibility and redemption history.
--
-- Additive and production-safe:
--   * preserves all existing users, workspaces, payments, and subscriptions
--   * backfills historical trial and first-month Pro usage
--   * protects both manual payments and future automated providers
--   * stores provider/card/PayPal identifiers only as application-generated hashes

ALTER TABLE public.manual_payment_requests
  ADD COLUMN IF NOT EXISTS normalized_email TEXT,
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

UPDATE public.manual_payment_requests AS request
SET
  normalized_email = COALESCE(
    request.normalized_email,
    NULLIF(LOWER(TRIM(request.payer_email)), '')
  ),
  normalized_phone = COALESCE(
    request.normalized_phone,
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(request.phone, '[^0-9]', '', 'g'),
        '^00',
        ''
      ),
      ''
    )
  )
WHERE request.normalized_email IS NULL
  OR request.normalized_phone IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_pending_email
  ON public.manual_payment_requests(status, normalized_email)
  WHERE status = 'pending' AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_pending_phone
  ON public.manual_payment_requests(status, normalized_phone)
  WHERE status = 'pending' AND normalized_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_offer_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_code TEXT NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  normalized_email TEXT,
  normalized_phone TEXT,
  payment_provider TEXT,
  provider_customer_hash TEXT,
  payment_method_fingerprint_hash TEXT,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  amount NUMERIC(10, 2),
  currency TEXT,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT billing_offer_redemptions_offer_code_check
    CHECK (offer_code IN ('free_trial_14_day', 'pro_first_month')),
  CONSTRAINT billing_offer_redemptions_source_type_check
    CHECK (source_type IN ('workspace_trial', 'manual_payment', 'automated_payment', 'legacy_backfill')),
  CONSTRAINT billing_offer_redemptions_identity_check
    CHECK (
      workspace_id IS NOT NULL
      OR user_id IS NOT NULL
      OR normalized_email IS NOT NULL
      OR normalized_phone IS NOT NULL
      OR provider_customer_hash IS NOT NULL
      OR payment_method_fingerprint_hash IS NOT NULL
    )
);

ALTER TABLE public.billing_offer_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_offer_redemptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_offer_redemptions TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_workspace
  ON public.billing_offer_redemptions(offer_code, workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_user
  ON public.billing_offer_redemptions(offer_code, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_email
  ON public.billing_offer_redemptions(offer_code, normalized_email)
  WHERE normalized_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_phone
  ON public.billing_offer_redemptions(offer_code, normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_provider_customer
  ON public.billing_offer_redemptions(offer_code, payment_provider, provider_customer_hash)
  WHERE payment_provider IS NOT NULL AND provider_customer_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_payment_method
  ON public.billing_offer_redemptions(
    offer_code,
    payment_provider,
    payment_method_fingerprint_hash
  )
  WHERE payment_provider IS NOT NULL AND payment_method_fingerprint_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_offer_redemption_source
  ON public.billing_offer_redemptions(offer_code, source_type, source_reference)
  WHERE source_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_offer_redemptions_redeemed_at
  ON public.billing_offer_redemptions(redeemed_at DESC);

CREATE OR REPLACE FUNCTION public.billing_offer_is_eligible(
  p_offer_code TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_normalized_email TEXT DEFAULT NULL,
  p_normalized_phone TEXT DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_provider_customer_hash TEXT DEFAULT NULL,
  p_payment_method_fingerprint_hash TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.billing_offer_redemptions AS redemption
    WHERE redemption.offer_code = p_offer_code
      AND (
        (p_workspace_id IS NOT NULL AND redemption.workspace_id = p_workspace_id)
        OR (p_user_id IS NOT NULL AND redemption.user_id = p_user_id)
        OR (
          NULLIF(LOWER(TRIM(p_normalized_email)), '') IS NOT NULL
          AND redemption.normalized_email = NULLIF(LOWER(TRIM(p_normalized_email)), '')
        )
        OR (
          NULLIF(REGEXP_REPLACE(p_normalized_phone, '[^0-9]', '', 'g'), '') IS NOT NULL
          AND redemption.normalized_phone =
            NULLIF(
              REGEXP_REPLACE(
                REGEXP_REPLACE(p_normalized_phone, '[^0-9]', '', 'g'),
                '^00',
                ''
              ),
              ''
            )
        )
        OR (
          NULLIF(LOWER(TRIM(p_payment_provider)), '') IS NOT NULL
          AND p_provider_customer_hash IS NOT NULL
          AND redemption.payment_provider = NULLIF(LOWER(TRIM(p_payment_provider)), '')
          AND redemption.provider_customer_hash = p_provider_customer_hash
        )
        OR (
          NULLIF(LOWER(TRIM(p_payment_provider)), '') IS NOT NULL
          AND p_payment_method_fingerprint_hash IS NOT NULL
          AND redemption.payment_provider = NULLIF(LOWER(TRIM(p_payment_provider)), '')
          AND redemption.payment_method_fingerprint_hash = p_payment_method_fingerprint_hash
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.billing_offer_is_eligible(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_offer_is_eligible(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_billing_offer(
  p_offer_code TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_normalized_email TEXT DEFAULT NULL,
  p_normalized_phone TEXT DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_provider_customer_hash TEXT DEFAULT NULL,
  p_payment_method_fingerprint_hash TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT 'automated_payment',
  p_source_reference TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_redeemed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  redemption_id UUID;
  normalized_email_value TEXT := NULLIF(LOWER(TRIM(p_normalized_email)), '');
  normalized_phone_value TEXT :=
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(p_normalized_phone, '[^0-9]', '', 'g'),
        '^00',
        ''
      ),
      ''
    );
  payment_provider_value TEXT := NULLIF(LOWER(TRIM(p_payment_provider)), '');
BEGIN
  IF NOT public.billing_offer_is_eligible(
    p_offer_code,
    p_workspace_id,
    p_user_id,
    normalized_email_value,
    normalized_phone_value,
    payment_provider_value,
    p_provider_customer_hash,
    p_payment_method_fingerprint_hash
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.billing_offer_redemptions (
    offer_code,
    workspace_id,
    user_id,
    normalized_email,
    normalized_phone,
    payment_provider,
    provider_customer_hash,
    payment_method_fingerprint_hash,
    source_type,
    source_reference,
    amount,
    currency,
    redeemed_at
  )
  VALUES (
    p_offer_code,
    p_workspace_id,
    p_user_id,
    normalized_email_value,
    normalized_phone_value,
    payment_provider_value,
    p_provider_customer_hash,
    p_payment_method_fingerprint_hash,
    p_source_type,
    NULLIF(TRIM(p_source_reference), ''),
    p_amount,
    NULLIF(UPPER(TRIM(p_currency)), ''),
    COALESCE(p_redeemed_at, NOW())
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO redemption_id;

  RETURN redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_billing_offer(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_billing_offer(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TIMESTAMPTZ
) TO service_role;

-- Every existing owned workspace counts as the owner's historical free-trial use.
-- DISTINCT ON keeps the earliest workspace when legacy data contains more than one.
INSERT INTO public.billing_offer_redemptions (
  offer_code,
  workspace_id,
  user_id,
  normalized_email,
  source_type,
  source_reference,
  amount,
  currency,
  redeemed_at
)
SELECT DISTINCT ON (workspace.owner_user_id)
  'free_trial_14_day',
  workspace.id,
  workspace.owner_user_id,
  NULLIF(LOWER(TRIM(profile.email)), ''),
  'legacy_backfill',
  workspace.id::TEXT,
  0,
  'USD',
  COALESCE(workspace.trial_started_at, workspace.created_at, NOW())
FROM public.workspaces AS workspace
LEFT JOIN public.profiles AS profile
  ON profile.user_id = workspace.owner_user_id
WHERE workspace.owner_user_id IS NOT NULL
ORDER BY
  workspace.owner_user_id,
  COALESCE(workspace.trial_started_at, workspace.created_at, NOW()) ASC
ON CONFLICT DO NOTHING;

-- Backfill approved historical $1 Pro payments into the permanent ledger.
INSERT INTO public.billing_offer_redemptions (
  offer_code,
  workspace_id,
  user_id,
  normalized_email,
  normalized_phone,
  payment_provider,
  source_type,
  source_reference,
  amount,
  currency,
  redeemed_at
)
SELECT DISTINCT ON (
  COALESCE(
    request.user_id::TEXT,
    NULLIF(LOWER(TRIM(request.payer_email)), ''),
    request.workspace_id::TEXT,
    request.id::TEXT
  )
)
  'pro_first_month',
  request.workspace_id,
  request.user_id,
  NULLIF(LOWER(TRIM(request.payer_email)), ''),
  NULLIF(
    REGEXP_REPLACE(
      REGEXP_REPLACE(request.phone, '[^0-9]', '', 'g'),
      '^00',
      ''
    ),
    ''
  ),
  'manual',
  'legacy_backfill',
  request.id::TEXT,
  COALESCE(request.charged_amount, request.amount),
  COALESCE(NULLIF(UPPER(TRIM(request.currency)), ''), 'USD'),
  COALESCE(request.approved_at, request.updated_at, request.created_at, NOW())
FROM public.manual_payment_requests AS request
WHERE request.plan_type = 'pro'
  AND request.status = 'approved'
  AND (
    request.is_first_month_promo = TRUE
    OR request.amount <= 1.00
    OR request.charged_amount <= 1.00
  )
ORDER BY
  COALESCE(
    request.user_id::TEXT,
    NULLIF(LOWER(TRIM(request.payer_email)), ''),
    request.workspace_id::TEXT,
    request.id::TEXT
  ),
  COALESCE(request.approved_at, request.updated_at, request.created_at, NOW()) ASC
ON CONFLICT DO NOTHING;

-- Preserve workspace markers that may predate or outlive a payment request.
INSERT INTO public.billing_offer_redemptions (
  offer_code,
  workspace_id,
  user_id,
  normalized_email,
  payment_provider,
  source_type,
  source_reference,
  amount,
  currency,
  redeemed_at
)
SELECT
  'pro_first_month',
  workspace.id,
  workspace.owner_user_id,
  NULLIF(LOWER(TRIM(profile.email)), ''),
  'manual',
  'legacy_backfill',
  'workspace:' || workspace.id::TEXT,
  1,
  'USD',
  workspace.first_month_promo_used_at
FROM public.workspaces AS workspace
LEFT JOIN public.profiles AS profile
  ON profile.user_id = workspace.owner_user_id
WHERE workspace.first_month_promo_used_at IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_single_workspace_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_email TEXT;
  redemption_id UUID;
BEGIN
  IF NEW.plan_type <> 'trial' OR NEW.subscription_status <> 'trialing' THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(LOWER(TRIM(profile.email)), '')
  INTO owner_email
  FROM public.profiles AS profile
  WHERE profile.user_id = NEW.owner_user_id
  LIMIT 1;

  SELECT public.redeem_billing_offer(
    'free_trial_14_day',
    NEW.id,
    NEW.owner_user_id,
    owner_email,
    NULL,
    'system',
    NULL,
    NULL,
    'workspace_trial',
    NEW.id::TEXT,
    0,
    'USD',
    COALESCE(NEW.trial_started_at, NOW())
  )
  INTO redemption_id;

  IF redemption_id IS NULL THEN
    UPDATE public.workspaces AS workspace
    SET
      subscription_status = 'expired',
      trial_started_at = COALESCE(workspace.trial_started_at, NOW()),
      trial_ends_at = LEAST(COALESCE(workspace.trial_ends_at, NOW()), NOW()),
      plan_updated_at = NOW(),
      updated_at = NOW()
    WHERE workspace.id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_single_workspace_trial() OWNER TO postgres;

DROP TRIGGER IF EXISTS enforce_single_workspace_trial_on_insert ON public.workspaces;
CREATE TRIGGER enforce_single_workspace_trial_on_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_workspace_trial();

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
  renewal_base_at TIMESTAMPTZ;
  current_subscription_ends_at TIMESTAMPTZ;
  workspace_owner_id UUID;
  customer_name TEXT;
  charged NUMERIC(10, 2);
  expected_regular_amount NUMERIC(10, 2);
  redemption_id UUID;
  normalized_phone_value TEXT;
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

  charged := COALESCE(payment.charged_amount, payment.amount);
  expected_regular_amount := COALESCE(
    payment.original_amount,
    CASE WHEN payment.is_first_month_promo THEN NULL ELSE payment.amount END,
    charged
  );
  normalized_phone_value := COALESCE(
    payment.normalized_phone,
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(payment.phone, '[^0-9]', '', 'g'),
        '^00',
        ''
      ),
      ''
    )
  );

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

  IF payment.is_first_month_promo = TRUE THEN
    IF charged <> 1.00 THEN
      RAISE EXCEPTION 'First-month promotional payment must be exactly $1.00';
    END IF;

    SELECT public.redeem_billing_offer(
      'pro_first_month',
      target_workspace_id,
      customer_user_id,
      COALESCE(payment.normalized_email, payment.payer_email),
      normalized_phone_value,
      'manual',
      NULL,
      NULL,
      'manual_payment',
      payment.id::TEXT,
      charged,
      payment.currency,
      p_now
    )
    INTO redemption_id;

    IF redemption_id IS NULL THEN
      RAISE EXCEPTION
        'This customer has already used the first-month promotion. Renewal price is the current regular monthly price.';
    END IF;
  ELSE
    IF expected_regular_amount <= 1.00 OR charged <> expected_regular_amount THEN
      RAISE EXCEPTION
        'Monthly renewal payment must match the current regular monthly checkout price.';
    END IF;
  END IF;

  SELECT workspace.owner_user_id, workspace.subscription_ends_at
  INTO workspace_owner_id, current_subscription_ends_at
  FROM public.workspaces AS workspace
  WHERE workspace.id = target_workspace_id
  FOR UPDATE;

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
  renewal_base_at := GREATEST(p_now, COALESCE(current_subscription_ends_at, p_now));
  target_ends_at := CASE
    WHEN target_billing_period = 'yearly' THEN renewal_base_at + INTERVAL '1 year'
    ELSE renewal_base_at + INTERVAL '1 month'
  END;

  UPDATE public.workspaces AS workspace
  SET
    plan_type = 'pro',
    subscription_status = 'active',
    billing_period = target_billing_period,
    subscription_started_at = CASE
      WHEN workspace.subscription_started_at IS NULL THEN p_now
      ELSE workspace.subscription_started_at
    END,
    subscription_ends_at = target_ends_at,
    first_month_promo_used_at = CASE
      WHEN payment.is_first_month_promo = TRUE
        THEN COALESCE(workspace.first_month_promo_used_at, p_now)
      ELSE workspace.first_month_promo_used_at
    END,
    plan_updated_at = p_now,
    updated_at = p_now
  WHERE workspace.id = target_workspace_id;

  UPDATE public.manual_payment_requests AS request
  SET
    user_id = customer_user_id,
    workspace_id = target_workspace_id,
    original_amount = expected_regular_amount,
    charged_amount = charged,
    amount = charged,
    pricing_label = CASE
      WHEN request.is_first_month_promo
        THEN 'First month promotional price: $1'
      ELSE
        'Monthly renewal price: $' || TO_CHAR(expected_regular_amount, 'FM999999990.00') || '/month'
    END,
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
