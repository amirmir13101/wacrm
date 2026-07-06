import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/027_admin_contact_imports.sql'),
  'utf8',
)
const adminLayout = readFileSync(join(process.cwd(), 'src/app/admin/layout.tsx'), 'utf8')
const adminShell = readFileSync(
  join(process.cwd(), 'src/components/admin/platform-admin-shell.tsx'),
  'utf8',
)
const adminPage = readFileSync(join(process.cwd(), 'src/app/admin/page.tsx'), 'utf8')
const adminTopsPage = readFileSync(join(process.cwd(), 'src/app/admintops/page.tsx'), 'utf8')
const adminTopsLayout = readFileSync(join(process.cwd(), 'src/app/admintops/layout.tsx'), 'utf8')
const adminDashboardComponent = readFileSync(
  join(process.cwd(), 'src/components/admin/platform-admin-dashboard.tsx'),
  'utf8',
)
const adminProfilePage = readFileSync(join(process.cwd(), 'src/app/admin/profile/page.tsx'), 'utf8')
const adminPasswordForm = readFileSync(
  join(process.cwd(), 'src/components/admin/admin-password-form.tsx'),
  'utf8',
)
const adminPasswordRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/profile/password/route.ts'),
  'utf8',
)
const adminContactsPage = readFileSync(join(process.cwd(), 'src/app/admin/contacts/page.tsx'), 'utf8')
const adminContactDetailPage = readFileSync(
  join(process.cwd(), 'src/app/admin/contacts/[id]/page.tsx'),
  'utf8',
)
const adminContactImportsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/contact-imports/route.ts'),
  'utf8',
)
const adminContactImportDetailRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/contact-imports/[id]/route.ts'),
  'utf8',
)
const contactImportAuditRoute = readFileSync(
  join(process.cwd(), 'src/app/api/contacts/imports/route.ts'),
  'utf8',
)
const importModal = readFileSync(join(process.cwd(), 'src/components/contacts/import-modal.tsx'), 'utf8')

describe('separate platform admin dashboard', () => {
  it('uses a dedicated admin shell with only platform admin navigation', () => {
    expect(adminLayout).toContain('PlatformAdminShell')
    expect(adminTopsLayout).toContain('PlatformAdminShell')
    expect(adminShell).toContain('/admintops')
    expect(adminShell).toContain('/admin/users')
    expect(adminShell).toContain('/admin/contacts')
    expect(adminShell).toContain('/admin/profile')
    expect(adminShell).toContain('Profile')
    expect(adminShell).toContain('Logout')
    expect(adminShell).not.toContain('/inbox')
    expect(adminShell).not.toContain('/broadcasts')
    expect(adminShell).not.toContain('/settings')
  })

  it('adds an admin overview page with platform metrics', () => {
    expect(adminPage).toContain('redirect("/admintops")')
    expect(adminTopsPage).toContain('PlatformAdminDashboard')
    expect(adminDashboardComponent).toContain('/api/admin/summary')
    expect(adminDashboardComponent).toContain('Pending users')
    expect(adminDashboardComponent).toContain('Uploaded Contact Lists')
    expect(adminDashboardComponent).toContain('uploaded_contacts')
  })

  it('creates admin contact import tables with platform-admin-only select policies', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS admin_contact_imports')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS admin_contact_import_rows')
    expect(migration).toContain('Platform admins can view contact imports')
    expect(migration).toContain("p.role = 'admin'")
    expect(migration).toContain("p.approval_status = 'approved'")
  })

  it('records normal contact imports for platform admin visibility', () => {
    expect(contactImportAuditRoute).toContain('requireCurrentWorkspace')
    expect(contactImportAuditRoute).toContain('admin_contact_imports')
    expect(contactImportAuditRoute).toContain('admin_contact_import_rows')
    expect(importModal).toContain("fetch('/api/contacts/imports'")
    expect(importModal).toContain('campaign_name: campaignName')
  })

  it('exposes admin-only list and detail APIs for uploaded contact lists', () => {
    expect(adminContactImportsRoute).toContain('requirePlatformAdmin')
    expect(adminContactImportsRoute).toContain('admin_contact_imports')
    expect(adminContactImportsRoute).toContain('count: "exact"')
    expect(adminContactImportsRoute).toContain('.range(from, to)')
    expect(adminContactImportsRoute).toContain('export async function DELETE')
    expect(adminContactImportsRoute).toContain('admin_contact_import_rows')
    expect(adminContactImportsRoute).toContain('.delete()')
    expect(adminContactImportDetailRoute).toContain('requirePlatformAdmin')
    expect(adminContactImportDetailRoute).toContain('admin_contact_import_rows')
    expect(adminContactImportDetailRoute).toContain('count: "exact"')
    expect(adminContactImportDetailRoute).toContain('.range(from, to)')
  })

  it('renders admin contact list and detail pages', () => {
    expect(adminContactsPage).toContain('/api/admin/contact-imports')
    expect(adminContactsPage).toContain('Uploaded contact lists')
    expect(adminContactsPage).toContain('Rows per page')
    expect(adminContactsPage).toContain('Bulk Delete')
    expect(adminContactsPage).toContain('No uploaded contact lists yet.')
    expect(adminContactsPage).toContain('Showing {rangeStart}-{rangeEnd} of {total} lists')
    expect(adminContactsPage).toContain('Select all contact lists on this page')
    expect(adminContactDetailPage).toContain('/api/admin/contact-imports/${id}')
    expect(adminContactDetailPage).toContain('Opt-in')
    expect(adminContactDetailPage).toContain('Rows per page')
    expect(adminContactDetailPage).toContain('Showing {rangeStart}-{rangeEnd} of {total} contacts')
  })

  it('renders a separate admin profile page without workspace settings', () => {
    expect(adminProfilePage).toContain('Admin account')
    expect(adminProfilePage).toContain('Change Password')
    expect(adminProfilePage).toContain('approval_status')
    expect(adminProfilePage).not.toContain('WhatsApp')
    expect(adminProfilePage).not.toContain('workspace settings')
  })

  it('supports platform-admin-only password changes with current password verification', () => {
    expect(adminPasswordForm).toContain('Current password')
    expect(adminPasswordForm).toContain('New password')
    expect(adminPasswordForm).toContain('Confirm new password')
    expect(adminPasswordForm).toContain('New password and confirmation do not match.')
    expect(adminPasswordForm).toContain('Password updated successfully.')
    expect(adminPasswordRoute).toContain('requirePlatformAdmin')
    expect(adminPasswordRoute).toContain('signInWithPassword')
    expect(adminPasswordRoute).toContain('Current password is incorrect.')
    expect(adminPasswordRoute).toContain('updateUserById')
    expect(adminPasswordRoute).not.toContain('console.log')
  })
})
