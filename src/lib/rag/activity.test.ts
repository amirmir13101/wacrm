import { describe, expect, it } from 'vitest'

import {
  knowledgeGapReason,
  normalizeKnowledgeQuestion,
  shouldCreateKnowledgeGap,
} from './activity'

describe('knowledge activity classification', () => {
  it('normalizes repeated whitespace and casing', () => {
    expect(normalizeKnowledgeQuestion('  What   is the refund policy? ')).toBe('what is the refund policy?')
  })

  it('creates a reviewable gap when an answer used no workspace knowledge', () => {
    expect(shouldCreateKnowledgeGap({
      question: 'What is your delivery policy?',
      status: 'answered',
      retrievedSourceCount: 0,
      handoff: false,
    })).toBe(true)
  })

  it('does not turn greetings or explicit handoffs into knowledge gaps', () => {
    expect(shouldCreateKnowledgeGap({
      question: 'Hello!',
      status: 'answered',
      retrievedSourceCount: 0,
      handoff: false,
    })).toBe(false)
    expect(shouldCreateKnowledgeGap({
      question: 'Please connect me with a person',
      status: 'fallback',
      retrievedSourceCount: 0,
      handoff: true,
    })).toBe(false)
  })

  it('records provider failures for review without claiming knowledge is missing', () => {
    expect(knowledgeGapReason({ status: 'provider_error', retrievedSourceCount: 0 })).toBe('provider_error')
  })
})
