import { describe, expect, it } from 'vitest'

import {
  applyPercentage,
  applyTax,
  bulkOrTieredPrice,
  convertBillingPeriod,
  detectCalculationIntent,
  prorate,
} from './calculations'

describe('deterministic AI calculation engine', () => {
  it('computes yearly price with discount into a monthly price without model math', () => {
    const discounted = applyPercentage(40, 15, 'discount', ['price', 'discount'], 'USD')
    expect(discounted).toMatchObject({ status: 'computed', value: 34 })

    const monthly = convertBillingPeriod(discounted.value ?? 0, 'yearly', 'monthly', discounted.sourceChunkIds, 'USD')
    expect(monthly.status).toBe('computed')
    expect(monthly.value).toBeCloseTo(2.79, 2)
    expect(monthly.formula).toContain('365')
  })

  it('computes per-unit totals and lets explicit bulk tiers override flat multiplication', () => {
    expect(bulkOrTieredPrice(5, 10, ['unit']).value).toBe(50)
    expect(bulkOrTieredPrice(5, 10, ['unit'], [{ minQuantity: 10, unitPrice: 4, sourceChunkId: 'tier' }]).value).toBe(40)
  })

  it('computes proration and tax modes deterministically', () => {
    expect(prorate(30, 30, 10, ['monthly']).value).toBe(10)
    expect(applyTax(100, 10, 'exclusive', ['tax']).value).toBe(110)
    expect(applyTax(110, 10, 'inclusive', ['tax']).value).toBe(100)
  })

  it('detects calculation intent without false positives for plain lookup questions', () => {
    expect(detectCalculationIntent('What is the Pro plan price?').hasIntent).toBe(false)
    expect(detectCalculationIntent('What is the monthly price after 15% off yearly?').hasIntent).toBe(true)
  })
})
