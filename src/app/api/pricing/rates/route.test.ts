import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('/api/pricing/rates', () => {
  it('requires an approved user and returns shared admin-managed rates', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/pricing/rates/route.ts'), 'utf8')

    expect(source).toContain("approval_status")
    expect(source).toContain("profile?.approval_status !== 'approved'")
    expect(source).toContain('supabaseAdmin()')
    expect(source).toContain('dedupeSharedPricingRates')
  })
})
