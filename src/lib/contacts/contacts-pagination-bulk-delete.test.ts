import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/contacts/page.tsx'),
  'utf8',
)
const route = readFileSync(
  join(process.cwd(), 'src/app/api/contacts/route.ts'),
  'utf8',
)

describe('normal CRM contacts pagination and bulk delete', () => {
  it('uses 50 contacts per page by default with 100 and 200 as options', () => {
    expect(page).toContain('const PAGE_SIZE_OPTIONS = [50, 100, 200] as const')
    expect(page).toContain('const DEFAULT_PAGE_SIZE = 50')
    expect(route).toContain('const ALLOWED_PAGE_SIZES = [50, 100, 200] as const')
    expect(route).toContain('const DEFAULT_PAGE_SIZE = 50')
  })

  it('keeps page, page size, and search in the contacts URL', () => {
    expect(page).toContain("params.set('page', String(nextPage))")
    expect(page).toContain("params.set('pageSize', String(nextPageSize))")
    expect(page).toContain("params.set('search', nextSearch.trim())")
    expect(page).toContain("router.replace(query ? `/contacts?${query}` : '/contacts', { scroll: false })")
  })

  it('shows a range label and previous/next controls', () => {
    expect(page).toContain('Showing {rangeStart}-{rangeEnd} of {totalCount} contacts')
    expect(page).toContain('disabled={!hasPrev || loading}')
    expect(page).toContain('disabled={!hasNext || loading}')
    expect(page).toContain('Rows per page')
  })

  it('supports visible-page selection and clears selection when paging changes', () => {
    expect(page).toContain('Select All applies to the visible page only')
    expect(page).toContain('ref={selectAllRef}')
    expect(page).toContain('selectedIds.size > 0 && selectedIds.size < contacts.length')
    expect(page).toContain('setSelectedIds(new Set())')
    expect(page).toContain('toggleSelectVisible(e.target.checked)')
  })

  it('uses one bulk delete API request and updates the visible list after success', () => {
    expect(page).toContain("method: 'DELETE'")
    expect(page).toContain("body: JSON.stringify({ ids: deleteTargets.map((contact) => contact.id) })")
    expect(page).toContain('setContacts((current) => current.filter((contact) => !deletedIds.has(contact.id)))')
    expect(page).toContain('setTotalCount((current) => Math.max(0, current - (payload.deleted_count ?? deletedOnPage)))')
    expect(page).toContain('changePage(page - 1)')
  })

  it('enforces workspace and delete permissions in the contacts API', () => {
    expect(route).toContain('requireCurrentWorkspace')
    expect(route).toContain("hasWorkspacePermission(workspaceResult.workspace, 'view_contacts')")
    expect(route).toContain("hasWorkspacePermission(workspaceResult.workspace, 'delete_contacts')")
    expect(route).toContain(".eq('workspace_id', workspaceResult.workspace.workspaceId)")
    expect(route).toContain('Delete at most 200 contacts at a time')
  })

  it('preserves assigned-only contact visibility for agents', () => {
    expect(route).toContain('visibleContactIds')
    expect(route).toContain("workspace.contactVisibility === 'all'")
    expect(route).toContain("hasWorkspacePermission(workspace, 'view_all_contacts')")
    expect(route).toContain("hasWorkspacePermission(workspace, 'view_assigned_contacts')")
    expect(route).toContain(".eq('assigned_agent_id', workspace.userId)")
  })

  it('keeps imports refreshing the paginated list', () => {
    expect(page).toContain('onImported={() => {')
    expect(page).toContain('updateUrl({ page: 1 })')
    expect(page).toContain('void fetchContacts()')
  })
})
