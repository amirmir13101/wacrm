-- ============================================================
-- Account approval system
-- Adds profile approval metadata and makes future signups pending
-- until an approved admin changes their status.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Existing profile rows become pending by default. Approve your real
-- admin account explicitly after running this migration.
UPDATE profiles
SET
  role = CASE WHEN role IN ('admin', 'user') THEN role ELSE 'user' END,
  approval_status = CASE
    WHEN approval_status IN ('pending', 'approved', 'rejected', 'suspended')
      THEN approval_status
    ELSE 'pending'
  END
WHERE role IS NULL
   OR role NOT IN ('admin', 'user')
   OR approval_status IS NULL
   OR approval_status NOT IN ('pending', 'approved', 'rejected', 'suspended');

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user'));

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check,
  ADD CONSTRAINT profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Browser/client updates may edit normal profile fields, but they must
-- not self-approve, self-promote, or change approval metadata. Admin
-- changes go through service-role API routes.
CREATE OR REPLACE FUNCTION public.prevent_profile_approval_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND CURRENT_USER <> 'postgres'
     AND (
       NEW.role IS DISTINCT FROM OLD.role OR
       NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
       NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
       NEW.approved_by IS DISTINCT FROM OLD.approved_by
     ) THEN
    RAISE EXCEPTION 'Approval fields can only be changed by an administrator';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_approval_self_update ON profiles;
CREATE TRIGGER prevent_profile_approval_self_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_approval_self_update();

-- Recreate signup trigger so new users are always normal users with a
-- pending approval status.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    role,
    approval_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'user',
    'pending'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
