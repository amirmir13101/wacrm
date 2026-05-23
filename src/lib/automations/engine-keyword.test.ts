import { describe, expect, it } from 'vitest'
import { keywordTriggerMatches } from './engine'

describe('keywordTriggerMatches', () => {
  it('matches contains case-insensitively', () => {
    expect(
      keywordTriggerMatches(
        { keywords: ['price'], match_type: 'contains' },
        'what is your PRICE?',
      ),
    ).toBe(true)
  })

  it('matches comma-normalized keyword lists', () => {
    expect(
      keywordTriggerMatches(
        { keywords: 'price, pricing, cost', match_type: 'contains' },
        'pricing please',
      ),
    ).toBe(true)
  })
})
