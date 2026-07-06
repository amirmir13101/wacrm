-- Fix local Meta WhatsApp template upserts.
--
-- The submit route saves templates with:
--   ON CONFLICT (workspace_id, name, language)
--
-- Migration 053 added a partial unique index for this shape, but PostgREST /
-- Supabase upsert cannot infer a plain ON CONFLICT target from that partial
-- index. This follow-up migration safely deduplicates existing workspace-scoped
-- rows, archives removed duplicates, and then creates the full matching unique
-- index expected by the application.

CREATE TABLE IF NOT EXISTS public.message_template_duplicate_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL DEFAULT 'dedupe_for_workspace_name_language_unique_index',
  survivor_template_id UUID,
  duplicate_template_id UUID,
  workspace_id UUID,
  name TEXT,
  language TEXT,
  duplicate_row JSONB NOT NULL
);

ALTER TABLE public.message_template_duplicate_archive ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_template_duplicate_archive_duplicate_template_id
  ON public.message_template_duplicate_archive(duplicate_template_id);

-- Archive non-survivor duplicate rows before removing them. The survivor is the
-- most complete row first, then the newest updated/created row.
WITH scored AS (
  SELECT
    mt.*,
    (
      CASE WHEN mt.meta_template_id IS NOT NULL AND mt.meta_template_id <> '' THEN 32 ELSE 0 END +
      CASE UPPER(COALESCE(mt.status, ''))
        WHEN 'APPROVED' THEN 24
        WHEN 'PENDING' THEN 18
        WHEN 'REJECTED' THEN 12
        WHEN 'PAUSED' THEN 10
        WHEN 'DISABLED' THEN 8
        WHEN 'DRAFT' THEN 4
        ELSE 0
      END +
      CASE WHEN mt.body_text IS NOT NULL AND LENGTH(TRIM(mt.body_text)) > 0 THEN 16 ELSE 0 END +
      CASE WHEN mt.buttons IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.sample_values IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.header_handle IS NOT NULL OR mt.header_media_url IS NOT NULL THEN 6 ELSE 0 END +
      CASE WHEN mt.quality_score IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN mt.rejection_reason IS NOT NULL THEN 2 ELSE 0 END
    ) AS completeness_score
  FROM public.message_templates mt
  WHERE mt.workspace_id IS NOT NULL
    AND mt.name IS NOT NULL
    AND mt.language IS NOT NULL
),
ranked AS (
  SELECT
    scored.*,
    ROW_NUMBER() OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
      ORDER BY
        scored.completeness_score DESC,
        scored.updated_at DESC NULLS LAST,
        scored.created_at DESC NULLS LAST,
        scored.id DESC
    ) AS rank_in_key,
    COUNT(*) OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
    ) AS rows_in_key
  FROM scored
),
survivors AS (
  SELECT * FROM ranked WHERE rank_in_key = 1 AND rows_in_key > 1
),
duplicates AS (
  SELECT * FROM ranked WHERE rank_in_key > 1
)
INSERT INTO public.message_template_duplicate_archive (
  survivor_template_id,
  duplicate_template_id,
  workspace_id,
  name,
  language,
  duplicate_row
)
SELECT
  survivors.id,
  duplicates.id,
  duplicates.workspace_id,
  duplicates.name,
  duplicates.language,
  TO_JSONB(duplicates) - 'rank_in_key' - 'rows_in_key' - 'completeness_score'
FROM duplicates
JOIN survivors
  ON survivors.workspace_id = duplicates.workspace_id
 AND survivors.name = duplicates.name
 AND survivors.language = duplicates.language
ON CONFLICT (duplicate_template_id) DO NOTHING;

-- Merge useful nullable fields from duplicate rows into the chosen survivor
-- before deleting the duplicate rows. Existing survivor values are preferred
-- unless a duplicate has a longer body text or a more authoritative status.
WITH scored AS (
  SELECT
    mt.*,
    (
      CASE WHEN mt.meta_template_id IS NOT NULL AND mt.meta_template_id <> '' THEN 32 ELSE 0 END +
      CASE UPPER(COALESCE(mt.status, ''))
        WHEN 'APPROVED' THEN 24
        WHEN 'PENDING' THEN 18
        WHEN 'REJECTED' THEN 12
        WHEN 'PAUSED' THEN 10
        WHEN 'DISABLED' THEN 8
        WHEN 'DRAFT' THEN 4
        ELSE 0
      END +
      CASE WHEN mt.body_text IS NOT NULL AND LENGTH(TRIM(mt.body_text)) > 0 THEN 16 ELSE 0 END +
      CASE WHEN mt.buttons IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.sample_values IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.header_handle IS NOT NULL OR mt.header_media_url IS NOT NULL THEN 6 ELSE 0 END +
      CASE WHEN mt.quality_score IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN mt.rejection_reason IS NOT NULL THEN 2 ELSE 0 END
    ) AS completeness_score,
    CASE UPPER(COALESCE(mt.status, ''))
      WHEN 'APPROVED' THEN 7
      WHEN 'PENDING' THEN 6
      WHEN 'IN_APPEAL' THEN 5
      WHEN 'PAUSED' THEN 4
      WHEN 'REJECTED' THEN 3
      WHEN 'DISABLED' THEN 2
      WHEN 'DRAFT' THEN 1
      ELSE 0
    END AS status_score
  FROM public.message_templates mt
  WHERE mt.workspace_id IS NOT NULL
    AND mt.name IS NOT NULL
    AND mt.language IS NOT NULL
),
ranked AS (
  SELECT
    scored.*,
    ROW_NUMBER() OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
      ORDER BY
        scored.completeness_score DESC,
        scored.updated_at DESC NULLS LAST,
        scored.created_at DESC NULLS LAST,
        scored.id DESC
    ) AS rank_in_key,
    COUNT(*) OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
    ) AS rows_in_key
  FROM scored
),
survivors AS (
  SELECT id, workspace_id, name, language
  FROM ranked
  WHERE rank_in_key = 1 AND rows_in_key > 1
),
source_rows AS (
  SELECT
    survivors.id AS survivor_id,
    ranked.*
  FROM survivors
  JOIN ranked
    ON ranked.workspace_id = survivors.workspace_id
   AND ranked.name = survivors.name
   AND ranked.language = survivors.language
),
merged AS (
  SELECT
    survivor_id,
    (ARRAY_AGG(category ORDER BY (category IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS category,
    (ARRAY_AGG(header_type ORDER BY (header_type IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS header_type,
    (ARRAY_AGG(header_content ORDER BY (header_content IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS header_content,
    (ARRAY_AGG(body_text ORDER BY LENGTH(COALESCE(body_text, '')) DESC, completeness_score DESC, updated_at DESC NULLS LAST))[1] AS body_text,
    (ARRAY_AGG(footer_text ORDER BY (footer_text IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS footer_text,
    (ARRAY_AGG(buttons ORDER BY (buttons IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS buttons,
    (ARRAY_AGG(status ORDER BY status_score DESC, completeness_score DESC, updated_at DESC NULLS LAST))[1] AS status,
    (ARRAY_AGG(sample_values ORDER BY (sample_values IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS sample_values,
    (ARRAY_AGG(meta_template_id ORDER BY (meta_template_id IS NULL OR meta_template_id = ''), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS meta_template_id,
    (ARRAY_AGG(rejection_reason ORDER BY (rejection_reason IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS rejection_reason,
    (ARRAY_AGG(quality_score ORDER BY (quality_score IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS quality_score,
    (ARRAY_AGG(header_handle ORDER BY (header_handle IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS header_handle,
    (ARRAY_AGG(header_media_url ORDER BY (header_media_url IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS header_media_url,
    (ARRAY_AGG(submission_error ORDER BY (submission_error IS NULL), completeness_score DESC, updated_at DESC NULLS LAST))[1] AS submission_error,
    MAX(last_submitted_at) AS last_submitted_at,
    MAX(updated_at) AS updated_at
  FROM source_rows
  GROUP BY survivor_id
)
UPDATE public.message_templates target
SET
  category = COALESCE(merged.category, target.category),
  header_type = COALESCE(target.header_type, merged.header_type),
  header_content = COALESCE(target.header_content, merged.header_content),
  body_text = CASE
    WHEN LENGTH(COALESCE(merged.body_text, '')) > LENGTH(COALESCE(target.body_text, ''))
      THEN merged.body_text
    ELSE target.body_text
  END,
  footer_text = COALESCE(target.footer_text, merged.footer_text),
  buttons = COALESCE(target.buttons, merged.buttons),
  status = COALESCE(merged.status, target.status),
  sample_values = COALESCE(target.sample_values, merged.sample_values),
  meta_template_id = COALESCE(target.meta_template_id, merged.meta_template_id),
  rejection_reason = COALESCE(target.rejection_reason, merged.rejection_reason),
  quality_score = COALESCE(target.quality_score, merged.quality_score),
  header_handle = COALESCE(target.header_handle, merged.header_handle),
  header_media_url = COALESCE(target.header_media_url, merged.header_media_url),
  submission_error = COALESCE(target.submission_error, merged.submission_error),
  last_submitted_at = CASE
    WHEN target.last_submitted_at IS NULL THEN merged.last_submitted_at
    WHEN merged.last_submitted_at IS NULL THEN target.last_submitted_at
    ELSE GREATEST(target.last_submitted_at, merged.last_submitted_at)
  END,
  updated_at = CASE
    WHEN target.updated_at IS NULL THEN merged.updated_at
    WHEN merged.updated_at IS NULL THEN target.updated_at
    ELSE GREATEST(target.updated_at, merged.updated_at)
  END
FROM merged
WHERE target.id = merged.survivor_id;

-- Remove only archived duplicate rows. They are preserved in
-- message_template_duplicate_archive as JSONB before deletion.
WITH scored AS (
  SELECT
    mt.*,
    (
      CASE WHEN mt.meta_template_id IS NOT NULL AND mt.meta_template_id <> '' THEN 32 ELSE 0 END +
      CASE UPPER(COALESCE(mt.status, ''))
        WHEN 'APPROVED' THEN 24
        WHEN 'PENDING' THEN 18
        WHEN 'REJECTED' THEN 12
        WHEN 'PAUSED' THEN 10
        WHEN 'DISABLED' THEN 8
        WHEN 'DRAFT' THEN 4
        ELSE 0
      END +
      CASE WHEN mt.body_text IS NOT NULL AND LENGTH(TRIM(mt.body_text)) > 0 THEN 16 ELSE 0 END +
      CASE WHEN mt.buttons IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.sample_values IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN mt.header_handle IS NOT NULL OR mt.header_media_url IS NOT NULL THEN 6 ELSE 0 END +
      CASE WHEN mt.quality_score IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN mt.rejection_reason IS NOT NULL THEN 2 ELSE 0 END
    ) AS completeness_score
  FROM public.message_templates mt
  WHERE mt.workspace_id IS NOT NULL
    AND mt.name IS NOT NULL
    AND mt.language IS NOT NULL
),
ranked AS (
  SELECT
    scored.*,
    ROW_NUMBER() OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
      ORDER BY
        scored.completeness_score DESC,
        scored.updated_at DESC NULLS LAST,
        scored.created_at DESC NULLS LAST,
        scored.id DESC
    ) AS rank_in_key,
    COUNT(*) OVER (
      PARTITION BY scored.workspace_id, scored.name, scored.language
    ) AS rows_in_key
  FROM scored
)
DELETE FROM public.message_templates target
USING ranked
WHERE target.id = ranked.id
  AND ranked.rank_in_key > 1
  AND EXISTS (
    SELECT 1
    FROM public.message_template_duplicate_archive archive
    WHERE archive.duplicate_template_id = ranked.id
  );

-- This is the exact non-partial unique index required by:
--   upsert(..., { onConflict: 'workspace_id,name,language' })
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_workspace_name_language_unique
  ON public.message_templates(workspace_id, name, language);

COMMENT ON INDEX public.message_templates_workspace_name_language_unique IS
  'Matches Supabase upsert ON CONFLICT (workspace_id, name, language) for local Meta WhatsApp template saves.';
