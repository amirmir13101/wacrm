-- A manual Resume AI starts a fresh model context window without deleting
-- visible conversation history. This prevents a previous human request from
-- being interpreted as a new handoff request on the next customer message.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_resumed_at timestamptz;

COMMENT ON COLUMN public.conversations.ai_resumed_at IS
  'Messages at or before this timestamp are excluded from AI auto-reply context after a manual resume.';
