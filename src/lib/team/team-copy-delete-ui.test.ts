import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const teamPage = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/team/page.tsx'),
  'utf8',
)

describe('team login details copy and delete UI', () => {
  it('copies login details only through a success-aware clipboard helper', () => {
    expect(teamPage).toContain('async function copyToClipboard')
    expect(teamPage).toContain('navigator.clipboard?.writeText')
    expect(teamPage).toContain('document.createElement("textarea")')
    expect(teamPage).toContain('document.execCommand("copy")')
    expect(teamPage).toContain('toast.success(successMessage)')
    expect(teamPage).toContain('toast.error("Copy failed. Please copy manually.")')
  })

  it('shows selectable one-time login details and specific copy feedback', () => {
    expect(teamPage).toContain('readOnly')
    expect(teamPage).toContain('onFocus={(event) => event.currentTarget.select()}')
    expect(teamPage).toContain('"URL copied"')
    expect(teamPage).toContain('"Email copied"')
    expect(teamPage).toContain('"Password copied"')
    expect(teamPage).toContain('Copy all login details')
    expect(teamPage).toContain('CRM Login URL:')
    expect(teamPage).toContain('Temporary Password:')
    expect(teamPage).toContain('"Login details copied"')
  })

  it('removes deleted agents immediately and guards against stale refetches', () => {
    expect(teamPage).toContain('deletedMemberIdsRef')
    expect(teamPage).toContain('setDeletingMemberIds')
    expect(teamPage).toContain('cache: "no-store"')
    expect(teamPage).toContain('deletedMemberIdsRef.current.add(member.id)')
    expect(teamPage).toContain('deletedMemberIdsRef.current.add(member.user_id)')
    expect(teamPage).toContain('item.id !== member.id && item.user_id !== member.user_id')
    expect(teamPage).toContain('router.refresh()')
    expect(teamPage).toContain('{deleting || isDeleting ? "Deleting..." : "Delete member"}')
  })
})
