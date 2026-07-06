import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pricing page copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/pricing/page.tsx'), 'utf8')

  it('describes Free as a 14-day trial with a broadcast message limit', () => {
    expect(source).toContain('14-Day Free Trial')
    expect(source).toContain('$0 for 14 days')
    expect(source).toContain('1,000 broadcast messages included during trial')
    expect(source).not.toContain('1,000 trial broadcast messages')
    expect(source).toContain('Access all CRM features during trial')
  })

  it('describes the Pro monthly broadcast message limit', () => {
    expect(source).toContain('250,000 broadcast messages per month')
    expect(source).not.toContain('Unlimited messages inside Talk Wagon CRM')
  })

  it('keeps the Pro promotional price as an old/current price display', () => {
    expect(source).toContain('regularPrice: "$5"')
    expect(source).toContain('price: "$1"')
    expect(source).toContain('line-through')
    expect(source).not.toContain('Now $1/month, regular $5/month')
  })

  it('does not show yearly Pro pricing or yearly CTAs on the public pricing page', () => {
    expect(source).not.toContain('yearlyCta')
    expect(source).not.toContain('yearlyHref')
    expect(source).not.toContain('yearlyPrice')
    expect(source).not.toContain('/checkout/pro-yearly')
    expect(source).not.toContain('$12/year')
    expect(source).not.toContain('Choose monthly or yearly')
  })
})
