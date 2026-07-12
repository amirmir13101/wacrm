import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pricing page copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/pricing/page.tsx'), 'utf8')

  it('describes Free as a 14-day trial with a broadcast message limit', () => {
    expect(source).toContain('14-Day Free Trial')
    expect(source).toContain('$0 for 14 days')
    expect(source).toContain('1,000 broadcast messages included during trial')
    expect(source).toContain('1 team member seat included')
    expect(source).not.toContain('1,000 trial broadcast messages')
    expect(source).toContain('Access all CRM features during trial')
  })

  it('describes the Pro monthly broadcast and team member limits', () => {
    expect(source).toContain('250,000 broadcast messages per month')
    expect(source).toContain('Up to 10 team members')
    expect(source).not.toContain('Unlimited messages inside Talk Wagon CRM')
  })

  it('clearly explains the Pro first-month promotional price and renewal price', () => {
    expect(source).toContain('regularPrice: "$9.90"')
    expect(source).toContain('price: "$1"')
    expect(source).toContain('offerLabel: "First month promo"')
    expect(source).toContain('billing: "$1 first month, then $9.90/month"')
    expect(source).toContain('New workspaces pay $1 for the first month only')
    expect(source).toContain('Renewals continue at $9.90/month')
    expect(source).not.toContain('regularPrice: "$5"')
    expect(source).not.toContain('Now $1/month, regular $5/month')
    expect(source).not.toContain('offerLabel: "90% OFF"')
  })

  it('does not show yearly Pro pricing or yearly CTAs on the public pricing page', () => {
    expect(source).not.toContain('yearlyCta')
    expect(source).not.toContain('yearlyHref')
    expect(source).not.toContain('yearlyPrice')
    expect(source).not.toContain('/checkout/pro-yearly')
    expect(source).not.toContain('$12/year')
    expect(source).not.toContain('Choose monthly or yearly')
  })

  it('keeps the featured Pro CTA taller without changing the full-width card button layout', () => {
    expect(source).toContain('inline-flex w-full items-center justify-center rounded-full')
    expect(source).toContain('? "min-h-[60px] py-4 bg-[#3ddf84] text-[#07130e]')
    expect(source).toContain(': "h-12 bg-[#181818] text-white')
  })
})
