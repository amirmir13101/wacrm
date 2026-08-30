-- Allow 0 as the explicit Unlimited sentinel for the AI Agent's
-- per-conversation auto-reply limit. Existing finite values remain 1-20.

ALTER TABLE public.ai_agent_configs
  DROP CONSTRAINT IF EXISTS ai_agent_configs_auto_reply_max_per_conversation_check;

ALTER TABLE public.ai_agent_configs
  ADD CONSTRAINT ai_agent_configs_auto_reply_max_per_conversation_check
  CHECK (auto_reply_max_per_conversation BETWEEN 0 AND 20);

COMMENT ON COLUMN public.ai_agent_configs.auto_reply_max_per_conversation IS
  'Maximum automatic replies per conversation; 0 means Unlimited.';
