import { describe, expect, it } from 'vitest'

import { formatMemoryContext, mergeContactMemory, type ContactMemory, type ConversationSummaryResult } from './memory'

const baseMemory: ContactMemory = {
  contactId: 'contact-1',
  memorySummary: 'Asked about the Pro plan.',
  keyFacts: { preference: 'yearly billing' },
  topicsDiscussed: ['Pro plan', 'migration'],
  lastIntent: 'purchase inquiry',
  sentiment: 'neutral',
  preferredLanguage: 'en',
  unresolvedQuestions: ['Asked about team discount'],
  conversationCount: 2,
  lastConversationAt: '2026-06-19T00:00:00.000Z',
}

function summary(overrides: Partial<ConversationSummaryResult> = {}): ConversationSummaryResult {
  return {
    summary: 'Customer asked about support and the issue was resolved.',
    topics: ['support', 'migration'],
    intent: 'support',
    sentiment: 'positive',
    resolved: true,
    unresolvedQuestions: [],
    keyFactsExtracted: { company: 'Acme Ltd' },
    languageDetected: 'en',
    ...overrides,
  }
}

describe('customer memory helpers', () => {
  it('deduplicates topics and caps them at 20 items', () => {
    const merged = mergeContactMemory({
      ...baseMemory,
      topicsDiscussed: Array.from({ length: 19 }, (_, index) => `topic-${index}`),
    }, summary({ topics: ['topic-1', 'new-topic', 'another-topic'] }))

    expect(merged.topicsDiscussed).toHaveLength(20)
    expect(merged.topicsDiscussed).toContain('new-topic')
    expect(merged.topicsDiscussed?.filter((topic) => topic === 'topic-1')).toHaveLength(1)
  })

  it('caps unresolved questions at 10 and uses latest sentiment', () => {
    const merged = mergeContactMemory({
      ...baseMemory,
      unresolvedQuestions: Array.from({ length: 12 }, (_, index) => `question ${index}`),
    }, summary({
      resolved: false,
      sentiment: 'negative',
      unresolvedQuestions: ['new unresolved question'],
    }))

    expect(merged.unresolvedQuestions).toHaveLength(10)
    expect(merged.sentiment).toBe('negative')
  })

  it('lets newer key facts override older key facts', () => {
    const merged = mergeContactMemory(baseMemory, summary({
      keyFactsExtracted: { preference: 'monthly billing', need: 'fast setup' },
    }))

    expect(merged.keyFacts).toMatchObject({
      preference: 'monthly billing',
      need: 'fast setup',
    })
  })

  it('formats memory context under 200 words and removes phone-like values', () => {
    const context = formatMemoryContext({
      ...baseMemory,
      keyFacts: {
        name: 'Ehsan',
        phone: '+44 7478 060494',
        preference: 'yearly billing',
      },
      unresolvedQuestions: ['Please call +44 7478 060494 about discount'],
    })

    expect(context.split(/\s+/).length).toBeLessThanOrEqual(200)
    expect(context).not.toContain('+44 7478 060494')
    expect(context).toContain('yearly billing')
  })

  it('handles null-ish fields gracefully', () => {
    const context = formatMemoryContext({
      contactId: 'contact-2',
      memorySummary: null,
      keyFacts: {},
      topicsDiscussed: [],
      lastIntent: null,
      sentiment: null,
      preferredLanguage: null,
      unresolvedQuestions: [],
      conversationCount: 0,
      lastConversationAt: null,
    })

    expect(context).toContain('Returning Customer Context')
    expect(context).toContain('1 time')
  })
})
