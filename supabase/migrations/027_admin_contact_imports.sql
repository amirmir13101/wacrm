-- ============================================================
-- 027_admin_contact_imports.sql
-- Tracks CRM contact CSV uploads so platform admins can review
-- uploaded contact lists without exposing this feature in the
-- normal workspace UI. Safe additive migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_contact_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_name TEXT,
  source TEXT DEFAULT 'contacts_csv',
  total_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_contact_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES admin_contact_imports(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT,
  phone TEXT,
  city TEXT,
  category TEXT,
  opt_in_status TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_contact_imports_workspace
  ON admin_contact_imports(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_contact_imports_uploaded_by
  ON admin_contact_imports(uploaded_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_contact_import_rows_import
  ON admin_contact_import_rows(import_id);

ALTER TABLE admin_contact_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_contact_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view contact imports" ON admin_contact_imports;
CREATE POLICY "Platform admins can view contact imports" ON admin_contact_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Platform admins can view contact import rows" ON admin_contact_import_rows;
CREATE POLICY "Platform admins can view contact import rows" ON admin_contact_import_rows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.approval_status = 'approved'
    )
  );
