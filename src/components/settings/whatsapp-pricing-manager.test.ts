import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = () =>
  readFileSync(join(process.cwd(), 'src/components/settings/whatsapp-pricing-manager.tsx'), 'utf8')

describe('WhatsAppPricingManager', () => {
  it('loads shared pricing rates for any approved user', () => {
    expect(source()).toContain("fetch('/api/pricing/rates')")
  })

  it('shows a client-facing calculator without add-rate management controls', () => {
    const text = source()

    expect(text).toContain('Cost Calculator')
    expect(text).toContain('Markets and rates')
    expect(text).not.toContain('Add Example Countries')
    expect(text).not.toContain('Add Rate')
    expect(text).not.toContain('Verified by admin against official Meta calculator')
    expect(text).not.toContain("supabase.from('whatsapp_pricing_rates').insert")
    expect(text).not.toContain("supabase.from('whatsapp_pricing_rates').update")
    expect(text).not.toContain("supabase.from('whatsapp_pricing_rates').delete")
  })

  it('removes the internal right-side pricing summary cards from the client page', () => {
    const text = source()

    expect(text).not.toContain('Estimate before sending broadcasts')
    expect(text).not.toContain('Available rate data')
    expect(text).not.toContain('Rates are maintained inside Talk Wagon')
    expect(text).not.toContain('<Metric label="Markets"')
    expect(text).not.toContain('<Metric')
  })

  it('uses the full page width for the calculator after removing the side panel', () => {
    const text = source()

    expect(text).not.toContain('xl:grid-cols-[430px_minmax(0,1fr)]')
    expect(text).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]')
  })

  it('defaults the calculator market to United States when available and falls back safely', () => {
    const text = source()

    expect(text).toContain('findDefaultCalculatorRate')
    expect(text).toContain("rate.iso_country_code?.toUpperCase() === 'US'")
    expect(text).toContain("['united states', 'usa']")
    expect(text).toContain('rates[0]')
  })

  it('uses concise pricing copy without repeated long disclaimers', () => {
    const text = source()

    expect(text.match(/Actual Meta billing/g)?.length).toBe(1)
    expect(text).toContain('Totals are rounded for display. Converted totals use maintained FX estimate rates.')
  })
})
