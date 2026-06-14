import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pricing page copy', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/pricing/page.tsx'), 'utf8')

  it('describes Free as a 14-day trial with a broadcast message limit', () => {
    expect(source).toContain('14-Day Free Trial')
    expect(source).toContain('$0 for 14 days')
    expect(source).toContain('1,000 trial broadcast messages')
    expect(source).toContain('Access all CRM features during trial')
  })

  it('keeps the Pro promotional price as an old/current price display', () => {
    expect(source).toContain('regularPrice: "$5"')
    expect(source).toContain('price: "$1"')
    expect(source).toContain('line-through')
    expect(source).not.toContain('Now $1/month, regular $5/month')
  })
})
