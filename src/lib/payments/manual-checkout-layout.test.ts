import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const checkoutForm = readFileSync(
  join(process.cwd(), 'src/components/checkout/manual-checkout-form.tsx'),
  'utf8',
)

describe('manual checkout responsive layout', () => {
  it('shows plan, account form, then payment details on mobile while preserving desktop columns', () => {
    expect(checkoutForm).toContain('grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8')
    expect(checkoutForm).toContain('aside className="contents lg:order-1 lg:block lg:space-y-5"')
    expect(checkoutForm).toContain('div className="order-1 rounded-[24px]')
    expect(checkoutForm).toContain('section className="order-2 rounded-[30px]')
    expect(checkoutForm).toContain('div className="order-3 rounded-[28px]')
    expect(checkoutForm).toContain('lg:order-2')
  })

  it('keeps the mobile plan card slightly more compact without changing the desktop card size', () => {
    expect(checkoutForm).toContain('p-5 text-white')
    expect(checkoutForm).toContain('sm:rounded-[30px] sm:p-7')
    expect(checkoutForm).toContain('text-2xl font-extrabold sm:mt-3 sm:text-4xl')
    expect(checkoutForm).toContain('text-4xl font-extrabold text-[#ffbd29] sm:text-5xl')
  })
})
