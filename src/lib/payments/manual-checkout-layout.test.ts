import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const checkoutForm = readFileSync(
  join(process.cwd(), 'src/components/checkout/manual-checkout-form.tsx'),
  'utf8',
)

describe('manual checkout responsive layout', () => {
  it('shows the account/payment request form before payment details on mobile', () => {
    expect(checkoutForm).toContain('aside className="order-2 space-y-5 lg:order-1"')
    expect(checkoutForm).toContain('section className="order-1 rounded-[30px]')
    expect(checkoutForm).toContain('lg:order-2')
    expect(checkoutForm.indexOf('Create account and payment request')).toBeGreaterThan(
      checkoutForm.indexOf('Payment details'),
    )
  })
})

