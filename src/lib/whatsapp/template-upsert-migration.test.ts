import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const submitRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/templates/submit/route.ts'),
  'utf8',
)

const syncRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/templates/sync/route.ts'),
  'utf8',
)

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/055_message_templates_unique_conflict_key.sql'),
  'utf8',
)

describe('WhatsApp template upsert conflict migration', () => {
  it('matches the submit route upsert conflict key exactly', () => {
    expect(submitRoute).toContain("onConflict: 'workspace_id,name,language'")
    expect(migration).toContain(
      'ON public.message_templates(workspace_id, name, language);',
    )
    expect(migration).not.toContain(
      'message_templates_workspace_name_language_unique\n  ON public.message_templates(workspace_id, name, language)\n  WHERE',
    )
  })

  it('deduplicates and archives existing rows before creating the unique index', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.message_template_duplicate_archive')
    expect(migration).toContain('ALTER TABLE public.message_template_duplicate_archive ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('TO_JSONB(duplicates)')
    expect(migration).toContain('DELETE FROM public.message_templates target')
    expect(migration).toContain('archive.duplicate_template_id = ranked.id')
    expect(migration.indexOf('DELETE FROM public.message_templates target')).toBeLessThan(
      migration.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS message_templates_workspace_name_language_unique'),
    )
  })

  it('keeps template sync workspace scoped and keyed by name plus language', () => {
    expect(syncRoute).toContain(".eq('workspace_id', guard.workspace.workspaceId)")
    expect(syncRoute).toContain(".eq('name', template.name)")
    expect(syncRoute).toContain(".eq('language', template.language)")
  })

  it('marks locally approved Meta templates unavailable when the connected WABA no longer returns them', () => {
    expect(syncRoute).toContain('currentMetaPairs')
    expect(syncRoute).toContain('local-template-cleanup')
    expect(syncRoute).toContain("status: 'PENDING_DELETION'")
    expect(syncRoute).toContain('marked_unavailable')
    expect(syncRoute).toContain('not returned by the connected Meta WABA')
  })
})
