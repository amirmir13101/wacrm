import { describe, expect, it } from 'vitest'

import { tagTriggerMatches } from './engine'

describe('tagTriggerMatches', () => {
  it('matches the automation only when the newly added tag is configured', () => {
    expect(tagTriggerMatches({ tag_id: 'vip' }, 'vip')).toBe(true)
    expect(tagTriggerMatches({ tag_id: 'vip' }, 'cold')).toBe(false)
  })

  it('does not match missing or malformed trigger config', () => {
    expect(tagTriggerMatches({}, 'vip')).toBe(false)
    expect(tagTriggerMatches({ tag_id: null }, 'vip')).toBe(false)
  })
})

