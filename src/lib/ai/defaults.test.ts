import { describe, expect, it } from 'vitest'

import { HANDOFF_SENTINEL, buildSystemPrompt } from './defaults'

describe('buildSystemPrompt', () => {
  it('answers supported parts instead of handing off for one missing detail', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      knowledge: ['Starter plan includes 2 GB RAM.'],
    })

    expect(prompt).toContain('answer every part supported by the conversation or business knowledge')
    expect(prompt).toContain('explain which detail is not stated')
    expect(prompt).toContain('do not infer or hand off merely because the excerpts are incomplete')
    expect(prompt).toContain(HANDOFF_SENTINEL)
  })

  it('keeps the no-guessing guard for item-specific claims and follow-ups', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      knowledge: ['Support is available through the shared inbox.'],
    })

    expect(prompt).toContain('use the recent conversation if it resolves the reference')
    expect(prompt).toContain('facts already established in the recent conversation')
    expect(prompt).toContain('not specifically stated')
    expect(prompt).toContain('Never guess in order to avoid a handoff')
  })

  it('asks recommendations to include useful supported decision facts', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      knowledge: ['Option A costs 10 and includes 2 units.'],
    })

    expect(prompt).toContain('most decision-useful supported facts')
    expect(prompt).toContain('price, capacity, a key limitation, or the reason')
  })

  it('clarifies contextless references and does not hand off for unrelated requests', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      knowledge: [],
    })

    expect(prompt).toContain('otherwise ask what the customer means')
    expect(prompt).toContain('For an unrelated request')
    expect(prompt).toContain('do not hand off')
  })

  it('offers human assistance first and requires explicit consent to hand off', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      knowledge: ['General support information.'],
    })

    expect(prompt).toContain('offer to connect the customer with a human')
    expect(prompt).toContain('do not initiate the handoff yet')
    expect(prompt).toContain('clearly accepts a prior offer of human assistance')
    expect(prompt).toContain('explicit business safety rule requires immediate escalation')
    expect(prompt).toContain(`exactly ${HANDOFF_SENTINEL} and nothing else`)
  })
})
