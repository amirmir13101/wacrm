import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sidebar = readFileSync(
  join(process.cwd(), 'src/components/layout/sidebar.tsx'),
  'utf8',
)

const settingsPage = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'),
  'utf8',
)

const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')
const permissions = readFileSync(join(process.cwd(), 'src/lib/team/permissions.ts'), 'utf8')

describe('dashboard sidebar navigation organization', () => {
  it('adds Billing and WhatsApp API Pricing as main sidebar tabs', () => {
    expect(sidebar).toContain('href: "/billing", label: "Billing"')
    expect(sidebar).toContain('href: "/whatsapp-api-pricing"')
    expect(sidebar).toContain('label: "WhatsApp API Pricing"')
    expect(sidebar).toContain('anyPermissions: ["view_pricing", "use_cost_calculator"]')
  })

  it('removes WhatsApp API Pricing from Settings tabs', () => {
    expect(settingsPage).not.toContain("value: 'pricing'")
    expect(settingsPage).not.toContain('<WhatsAppPricingManager />')
    expect(settingsPage).toContain("value: 'whatsapp'")
    expect(settingsPage).toContain("value: 'templates'")
  })

  it('protects the new dashboard routes with the existing workspace guard', () => {
    expect(middleware).toContain("'/billing'")
    expect(middleware).toContain("'/whatsapp-api-pricing'")
    expect(permissions).toContain("pathname.startsWith('/billing')")
    expect(permissions).toContain("pathname.startsWith('/whatsapp-api-pricing')")
    expect(permissions).toContain("hasWorkspacePermission(subject, 'use_cost_calculator')")
  })
})
