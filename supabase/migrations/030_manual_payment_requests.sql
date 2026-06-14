-- Manual payment requests for Pro and Lifetime plan activation.
-- Payment proof is handled outside the app through WhatsApp/Tawk.to; this table
-- stores the customer's request and the platform admin approval decision.

CREATE TABLE IF NOT EXISTS manual_payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('pro', 'lifetime')),
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('easypaisa', 'bank_transfer')),
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  workspace_name TEXT,
  transaction_reference TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_status
  ON manual_payment_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_workspace_id
  ON manual_payment_requests(workspace_id);

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_user_id
  ON manual_payment_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_payer_email
  ON manual_payment_requests(LOWER(payer_email));

DROP TRIGGER IF EXISTS set_updated_at ON manual_payment_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON manual_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE manual_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage manual payment requests" ON manual_payment_requests;
CREATE POLICY "Platform admins manage manual payment requests"
  ON manual_payment_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.approval_status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Workspace users read their manual payment requests" ON manual_payment_requests;
CREATE POLICY "Workspace users read their manual payment requests"
  ON manual_payment_requests
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = manual_payment_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );
