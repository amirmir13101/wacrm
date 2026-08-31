-- 073_knowledge_gap_workflow.sql
-- Additive activity and knowledge-gap review workflow. This migration does
-- not change AI retrieval, ranking, prompts, or handoff behavior.

ALTER TABLE public.rag_chat_logs
  ADD COLUMN IF NOT EXISTS retrieved_source_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rag_chat_logs_retrieved_source_count_check'
      AND conrelid = 'public.rag_chat_logs'::regclass
  ) THEN
    ALTER TABLE public.rag_chat_logs
      ADD CONSTRAINT rag_chat_logs_retrieved_source_count_check
      CHECK (retrieved_source_count >= 0);
  END IF;
END;
$$;

ALTER TABLE public.rag_knowledge_gaps
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority_score INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS first_asked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_log_id UUID REFERENCES public.rag_chat_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_answer TEXT,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

UPDATE public.rag_knowledge_gaps
SET first_asked_at = COALESCE(first_asked_at, created_at, last_asked_at)
WHERE first_asked_at IS NULL;

ALTER TABLE public.rag_knowledge_gaps
  ALTER COLUMN first_asked_at SET DEFAULT NOW(),
  ALTER COLUMN first_asked_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rag_knowledge_gaps_review_status_check'
      AND conrelid = 'public.rag_knowledge_gaps'::regclass
  ) THEN
    ALTER TABLE public.rag_knowledge_gaps
      ADD CONSTRAINT rag_knowledge_gaps_review_status_check
      CHECK (review_status IN (
        'new',
        'needs_knowledge',
        'needs_clarification',
        'retrieval_issue',
        'resolved',
        'ignored'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rag_knowledge_gaps_priority_score_check'
      AND conrelid = 'public.rag_knowledge_gaps'::regclass
  ) THEN
    ALTER TABLE public.rag_knowledge_gaps
      ADD CONSTRAINT rag_knowledge_gaps_priority_score_check
      CHECK (priority_score BETWEEN 0 AND 100);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_gaps_workspace_review_priority
  ON public.rag_knowledge_gaps(workspace_id, review_status, priority_score DESC, last_asked_at DESC);

CREATE OR REPLACE FUNCTION public.record_knowledge_activity(
  p_workspace_id UUID,
  p_conversation_id UUID,
  p_message_id UUID,
  p_channel TEXT,
  p_user_question TEXT,
  p_answer TEXT,
  p_status TEXT,
  p_fallback_reason TEXT,
  p_provider TEXT,
  p_chat_model TEXT,
  p_embedding_model TEXT,
  p_retrieved_source_count INTEGER,
  p_latency_ms INTEGER,
  p_create_gap BOOLEAN,
  p_gap_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_normalized_question TEXT;
  v_priority_increment INTEGER;
BEGIN
  IF p_workspace_id IS NULL OR NULLIF(BTRIM(p_user_question), '') IS NULL THEN
    RAISE EXCEPTION 'workspace and question are required';
  END IF;

  INSERT INTO public.rag_chat_logs (
    workspace_id,
    conversation_id,
    message_id,
    channel,
    user_question,
    answer,
    status,
    fallback_reason,
    provider,
    chat_model,
    embedding_model,
    retrieved_source_count,
    latency_ms
  ) VALUES (
    p_workspace_id,
    p_conversation_id,
    p_message_id,
    p_channel,
    BTRIM(p_user_question),
    NULLIF(BTRIM(COALESCE(p_answer, '')), ''),
    p_status,
    p_fallback_reason,
    p_provider,
    p_chat_model,
    p_embedding_model,
    GREATEST(0, COALESCE(p_retrieved_source_count, 0)),
    p_latency_ms
  )
  RETURNING id INTO v_log_id;

  IF COALESCE(p_create_gap, FALSE) THEN
    v_normalized_question := LOWER(REGEXP_REPLACE(BTRIM(p_user_question), '\s+', ' ', 'g'));
    v_priority_increment := CASE
      WHEN p_gap_reason IN ('provider_error', 'failed') THEN 2
      ELSE 5
    END;

    INSERT INTO public.rag_knowledge_gaps (
      workspace_id,
      question,
      normalized_question,
      channel,
      reason,
      count,
      suggested_action,
      last_asked_at,
      first_asked_at,
      source_log_id,
      conversation_id,
      last_answer,
      review_status,
      priority_score
    ) VALUES (
      p_workspace_id,
      BTRIM(p_user_question),
      v_normalized_question,
      p_channel,
      COALESCE(p_gap_reason, 'missing_knowledge'),
      1,
      CASE
        WHEN p_gap_reason = 'weak_context' THEN 'Review whether approved business knowledge should be added or retrieval needs improvement.'
        WHEN p_gap_reason = 'provider_error' THEN 'Review the provider error before changing knowledge.'
        WHEN p_gap_reason = 'failed' THEN 'Review the failed answer and retry after correcting the cause.'
        ELSE 'Add an approved answer to the Knowledge Base.'
      END,
      NOW(),
      NOW(),
      v_log_id,
      p_conversation_id,
      NULLIF(BTRIM(COALESCE(p_answer, '')), ''),
      'new',
      CASE WHEN p_gap_reason IN ('provider_error', 'failed') THEN 15 ELSE 20 END
    )
    ON CONFLICT (workspace_id, normalized_question, channel)
      WHERE resolved_at IS NULL
    DO UPDATE SET
      question = EXCLUDED.question,
      reason = EXCLUDED.reason,
      count = public.rag_knowledge_gaps.count + 1,
      last_asked_at = NOW(),
      source_log_id = EXCLUDED.source_log_id,
      conversation_id = COALESCE(EXCLUDED.conversation_id, public.rag_knowledge_gaps.conversation_id),
      last_answer = EXCLUDED.last_answer,
      priority_score = LEAST(100, public.rag_knowledge_gaps.priority_score + v_priority_increment),
      updated_at = NOW();
  END IF;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.flag_rag_knowledge_gap(
  p_workspace_id UUID,
  p_source_log_id UUID,
  p_review_status TEXT DEFAULT 'needs_knowledge'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.rag_chat_logs%ROWTYPE;
  v_gap_id UUID;
  v_normalized_question TEXT;
BEGIN
  SELECT * INTO v_log
  FROM public.rag_chat_logs
  WHERE id = p_source_log_id
    AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity record not found';
  END IF;

  v_normalized_question := LOWER(REGEXP_REPLACE(BTRIM(v_log.user_question), '\s+', ' ', 'g'));

  INSERT INTO public.rag_knowledge_gaps (
    workspace_id,
    question,
    normalized_question,
    channel,
    reason,
    count,
    suggested_action,
    last_asked_at,
    first_asked_at,
    source_log_id,
    conversation_id,
    last_answer,
    review_status,
    priority_score
  ) VALUES (
    p_workspace_id,
    v_log.user_question,
    v_normalized_question,
    v_log.channel,
    CASE WHEN v_log.retrieved_source_count > 0 THEN 'weak_context' ELSE 'missing_knowledge' END,
    1,
    'Review this answer and add or improve approved business knowledge.',
    v_log.created_at,
    v_log.created_at,
    v_log.id,
    v_log.conversation_id,
    v_log.answer,
    p_review_status,
    25
  )
  ON CONFLICT (workspace_id, normalized_question, channel)
    WHERE resolved_at IS NULL
  DO UPDATE SET
    source_log_id = EXCLUDED.source_log_id,
    conversation_id = COALESCE(EXCLUDED.conversation_id, public.rag_knowledge_gaps.conversation_id),
    last_answer = EXCLUDED.last_answer,
    review_status = p_review_status,
    priority_score = GREATEST(public.rag_knowledge_gaps.priority_score, 25),
    updated_at = NOW()
  RETURNING id INTO v_gap_id;

  RETURN v_gap_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_knowledge_activity(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_knowledge_activity(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.flag_rag_knowledge_gap(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_rag_knowledge_gap(UUID, UUID, TEXT) TO service_role;
