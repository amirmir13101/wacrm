import { describe, expect, it } from 'vitest'

import { diffContactTagIds, normalizeTagIds } from './tag-sync'

describe('contact tag sync helpers', () => {
  it('normalizes tag ids by trimming, ignoring empties, and removing duplicates', () => {
    expect(normalizeTagIds([' tag-1 ', '', 'tag-2', 'tag-1', null])).toEqual([
      'tag-1',
      'tag-2',
    ])
  })

  it('detects newly added tags so tag_added automations fire once', () => {
    expect(diffContactTagIds(['tag-1'], ['tag-1', 'tag-2'])).toEqual({
      added: ['tag-2'],
      removed: [],
    })
  })

  it('does not treat duplicate existing tags as newly added', () => {
    expect(diffContactTagIds(['tag-1'], ['tag-1'])).toEqual({
      added: [],
      removed: [],
    })
  })

  it('detects removals without reporting tag_added', () => {
    expect(diffContactTagIds(['tag-1', 'tag-2'], ['tag-1'])).toEqual({
      added: [],
      removed: ['tag-2'],
    })
  })
})

