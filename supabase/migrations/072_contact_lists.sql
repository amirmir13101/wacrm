-- ============================================================
-- Contact lists
--
-- Adds a tenant-scoped list entity, safely assigns all existing
-- contacts to a system list, and guarantees future workspace contacts
-- always belong to a list. No contact or broadcast data is deleted.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_key TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contact_lists_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_lists_workspace_name
  ON public.contact_lists(workspace_id, name_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_lists_workspace_default
  ON public.contact_lists(workspace_id)
  WHERE is_system_default;

CREATE INDEX IF NOT EXISTS idx_contact_lists_workspace_created
  ON public.contact_lists(workspace_id, created_at DESC);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_list_id UUID REFERENCES public.contact_lists(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_contacts_workspace_contact_list
  ON public.contacts(workspace_id, contact_list_id);

-- Every existing workspace gets one safe destination for legacy and
-- system-created contacts. The name is reserved only within that workspace.
INSERT INTO public.contact_lists (
  workspace_id,
  created_by_user_id,
  name,
  is_system_default
)
SELECT
  workspace.id,
  workspace.owner_user_id,
  'Existing Contacts',
  TRUE
FROM public.workspaces AS workspace
ON CONFLICT DO NOTHING;

UPDATE public.contacts AS contact
SET contact_list_id = list.id
FROM public.contact_lists AS list
WHERE contact.workspace_id = list.workspace_id
  AND list.is_system_default = TRUE
  AND contact.contact_list_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_contact_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_list_id UUID;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.contact_list_id IS NOT NULL THEN
    SELECT id
      INTO resolved_list_id
    FROM public.contact_lists
    WHERE id = NEW.contact_list_id
      AND workspace_id = NEW.workspace_id;

    IF resolved_list_id IS NULL THEN
      RAISE EXCEPTION 'Contact list does not belong to the contact workspace';
    END IF;

    RETURN NEW;
  END IF;

  SELECT id
    INTO resolved_list_id
  FROM public.contact_lists
  WHERE workspace_id = NEW.workspace_id
    AND is_system_default = TRUE
  LIMIT 1;

  IF resolved_list_id IS NULL THEN
    BEGIN
      INSERT INTO public.contact_lists (
        workspace_id,
        created_by_user_id,
        name,
        is_system_default
      )
      VALUES (
        NEW.workspace_id,
        NEW.user_id,
        'Existing Contacts',
        TRUE
      )
      RETURNING id INTO resolved_list_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id
        INTO resolved_list_id
      FROM public.contact_lists
      WHERE workspace_id = NEW.workspace_id
        AND is_system_default = TRUE
      LIMIT 1;

      -- A user may already have created a list with the reserved display
      -- name before the first system-created contact. Reuse and promote it
      -- instead of failing or creating a confusing duplicate.
      IF resolved_list_id IS NULL THEN
        UPDATE public.contact_lists
        SET is_system_default = TRUE
        WHERE workspace_id = NEW.workspace_id
          AND name_key = 'existing contacts'
        RETURNING id INTO resolved_list_id;
      END IF;
    END;
  END IF;

  NEW.contact_list_id := resolved_list_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.assign_contact_list() OWNER TO postgres;

DROP TRIGGER IF EXISTS assign_contact_list ON public.contacts;
DROP TRIGGER IF EXISTS zz_assign_contact_list ON public.contacts;
-- Trigger names determine order for triggers with the same timing/event.
-- Run after set_default_workspace_id has populated workspace_id.
CREATE TRIGGER zz_assign_contact_list
  BEFORE INSERT OR UPDATE OF workspace_id, contact_list_id
  ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_contact_list();

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_workspace_requires_list;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_workspace_requires_list
  CHECK (workspace_id IS NULL OR contact_list_id IS NOT NULL) NOT VALID;
ALTER TABLE public.contacts
  VALIDATE CONSTRAINT contacts_workspace_requires_list;

DROP TRIGGER IF EXISTS set_updated_at ON public.contact_lists;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.contact_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view contact lists" ON public.contact_lists;
CREATE POLICY "Members can view contact lists" ON public.contact_lists
  FOR SELECT USING (
    public.workspace_has_permission(workspace_id, 'view_contacts')
  );

DROP POLICY IF EXISTS "Members can create contact lists" ON public.contact_lists;
CREATE POLICY "Members can create contact lists" ON public.contact_lists
  FOR INSERT WITH CHECK (
    public.workspace_has_permission(workspace_id, 'create_contacts')
  );

DROP POLICY IF EXISTS "Members can update contact lists" ON public.contact_lists;
CREATE POLICY "Members can update contact lists" ON public.contact_lists
  FOR UPDATE USING (
    public.workspace_has_permission(workspace_id, 'edit_contacts')
  )
  WITH CHECK (
    public.workspace_has_permission(workspace_id, 'edit_contacts')
  );

DROP POLICY IF EXISTS "Members can delete contact lists" ON public.contact_lists;
CREATE POLICY "Members can delete contact lists" ON public.contact_lists
  FOR DELETE USING (
    is_system_default = FALSE
    AND public.workspace_has_permission(workspace_id, 'delete_contacts')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contact_lists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_lists;
  END IF;
END $$;
