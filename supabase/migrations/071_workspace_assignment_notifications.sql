-- Workspace-adapted port of upstream migration 027_notifications.sql.
-- Assignment alerts are historical events; active AI handoff membership is
-- still determined by conversations.ai_autoreply_disabled.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'conversation_assigned'
    CHECK (type IN ('conversation_assigned')),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_conversation_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_name text;
  v_actor_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_agent_id IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.assigned_agent_id IS NULL
       OR NEW.assigned_agent_id IS NOT DISTINCT FROM OLD.assigned_agent_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Match upstream behavior: agents do not need an alert for assigning a
  -- conversation to themselves.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.assigned_agent_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(name, ''), phone) INTO v_contact_name
  FROM public.contacts WHERE id = NEW.contact_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT full_name INTO v_actor_name
    FROM public.profiles WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.notifications (
    workspace_id,
    user_id,
    type,
    conversation_id,
    contact_id,
    actor_user_id,
    title,
    body
  ) VALUES (
    NEW.workspace_id,
    NEW.assigned_agent_id,
    'conversation_assigned',
    NEW.id,
    NEW.contact_id,
    auth.uid(),
    'New conversation assigned',
    COALESCE(v_actor_name, 'Someone') || ' assigned you a conversation with '
      || COALESCE(v_contact_name, 'a contact')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create assignment notification for conversation %: %',
    NEW.id,
    SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_conversation_assigned() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_conversation_assigned ON public.conversations;
CREATE TRIGGER on_conversation_assigned
  AFTER INSERT OR UPDATE OF assigned_agent_id ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_assigned();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
