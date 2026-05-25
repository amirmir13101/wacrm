import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = () =>
  readFileSync(join(process.cwd(), 'src/components/settings/whatsapp-pricing-manager.tsx'), 'utf8')

describe('WhatsAppPricingManager', () => {
  it('loads shared pricing rates for any approved user', () => {
    expect(source()).toContain("fetch('/api/pricing/rates')")
  })

  it('keeps editing controls permission-gated while the calculator remains visible', () => {
    const text = source()

    expect(text).toContain("workspace.has('manage_pricing_rates')")
    expect(text).toContain('{canManagePricing && (')
    expect(text).toContain('Cost Calculator')
    expect(text).toContain('Pricing is admin-managed. You can view rates and calculate estimates.')
  })

  it('uses concise pricing copy without repeated long disclaimers', () => {
    const text = source()

    expect(text.match(/Actual Meta billing and FX rates may differ/g)?.length).toBe(1)
    expect(text).toContain('Totals are rounded for display. Converted with admin-maintained FX rates.')
  })
})
