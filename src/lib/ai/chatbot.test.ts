import { describe, expect, it, vi } from 'vitest'

import {
  AI_HUMAN_REPLY_PAUSE_SECONDS,
  humanizeAiSkipReason,
  isInCooldown,
  isSimilarAiResponse,
} from './conversation-controls'
import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  aiMessageOfferedHumanHandoff,
  chunkKnowledgeText,
  formatForWhatsApp,
  generateChatbotAnswer,
  isHumanHandoffConfirmation,
  isHumanHandoffRequest,
  isOptOutMessage,
  retrieveRelevantChunks,
} from './chatbot'

describe('AI chatbot knowledge helpers', () => {
  it('chunks long manual knowledge into searchable pieces', () => {
    const chunks = chunkKnowledgeText(
      [
        'Support hours are Monday to Friday.',
        'Delivery usually takes three business days.',
        'Refunds are handled by the account owner.',
      ].join('\n\n'),
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('Support hours')
  })

  it('retrieves only chunks relevant to the customer question', () => {
    const chunks = [
      { chunk_text: 'Support hours are Monday to Friday from 9 AM to 6 PM.' },
      { chunk_text: 'Billing invoices are available in the pricing dashboard.' },
      { chunk_text: 'Delivery tracking is sent after dispatch.' },
    ]

    const results = retrieveRelevantChunks('What are your support hours?', chunks)

    expect(results[0]).toContain('Support hours')
    expect(results).not.toContain(chunks[1].chunk_text)
  })

  it('prefers exact VPS RAM matches so 4GB questions do not return the 8GB price', () => {
    const knowledge = [
      '## VPS Pricing',
      '### Wagon VPS x4',
      '- RAM: 4GB',
      '- CPU: 2 Core',
      '- Storage: 40GB NVMe',
      '- Price: $6.50/mo',
      '',
      '### Wagon VPS x8',
      '- RAM: 8GB',
      '- CPU: 4 Core',
      '- Storage: 60GB NVMe',
      '- Price: $8.80/mo',
    ].join('\n')

    const results = retrieveRelevantChunks('What is the price of 4GB VPS?', [{ chunk_text: knowledge }])

    expect(results[0]).toContain('Wagon VPS x4')
    expect(results[0]).toContain('4GB')
    expect(results[0]).toContain('$6.50/mo')
    expect(results[0]).not.toContain('$8.80/mo')
  })

  it('prefers exact VPS RAM matches for 8GB pricing questions', () => {
    const knowledge = [
      '## VPS Pricing',
      '### Wagon VPS x4',
      '- RAM: 4GB',
      '- Price: $6.50/mo',
      '',
      '### Wagon VPS x8',
      '- RAM: 8GB',
      '- Price: $8.80/mo',
    ].join('\n')

    const results = retrieveRelevantChunks('How much is 8GB VPS?', [{ chunk_text: knowledge }])

    expect(results[0]).toContain('Wagon VPS x8')
    expect(results[0]).toContain('8GB')
    expect(results[0]).toContain('$8.80/mo')
  })

  it('matches the exact restaurant menu item instead of a similar item', () => {
    const knowledge = [
      '## Menu Pricing',
      '### Chicken Burger',
      '- Price: $8.99',
      '- Includes: fries and drink',
      '',
      '### Chicken Pizza',
      '- Price: $14.99',
      '- Serves: 2 people',
    ].join('\n')

    const results = retrieveRelevantChunks('What is the price of Chicken Burger?', [{ chunk_text: knowledge }])

    expect(results[0]).toContain('Chicken Burger')
    expect(results[0]).toContain('$8.99')
    expect(results[0]).not.toContain('$14.99')
  })

  it('matches the exact clinic service instead of another dental treatment', () => {
    const knowledge = [
      '## Services',
      '### Dental Cleaning',
      '- Price: $50',
      '- Duration: 30 minutes',
      '',
      '### Dental Implant',
      '- Price: $900',
      '- Appointment required',
    ].join('\n')

    const results = retrieveRelevantChunks('How much is dental cleaning?', [{ chunk_text: knowledge }])

    expect(results[0]).toContain('Dental Cleaning')
    expect(results[0]).toContain('$50')
    expect(results[0]).not.toContain('$900')
  })

  it('matches SaaS plans, ecommerce products, opening hours, and delivery policies', () => {
    const knowledge = [
      '## Pricing Plans',
      '### Pro Plan',
      '- Price monthly: $10/month',
      '- Price yearly: $99/year',
      '',
      '## Products',
      '### Wireless Headphones',
      '- Price: USD 79',
      '- Delivery: free',
      '',
      '## Business Hours',
      '- Monday-Friday: 9 AM-6 PM',
      '',
      '## Delivery Policy',
      '- Delivery takes 2-3 business days.',
    ].join('\n')

    expect(retrieveRelevantChunks('What is the Pro plan yearly price?', [{ chunk_text: knowledge }])[0]).toContain('$99/year')
    expect(retrieveRelevantChunks('How much are Wireless Headphones?', [{ chunk_text: knowledge }])[0]).toContain('USD 79')
    expect(retrieveRelevantChunks('What are your opening hours?', [{ chunk_text: knowledge }])[0]).toContain('9 AM-6 PM')
    expect(retrieveRelevantChunks('Do you offer delivery?', [{ chunk_text: knowledge }])[0]).toContain('2-3 business days')
  })

  it('does not guess a similar priced item when the requested item is missing', () => {
    const knowledge = [
      '### Dental Cleaning',
      '- Price: $50',
      '',
      '### Dental Implant',
      '- Price: $900',
    ].join('\n')

    const results = retrieveRelevantChunks('What is the price of dental whitening?', [{ chunk_text: knowledge }])

    expect(results).toEqual([])
  })

  it('uses structured preview formatting for pricing questions without hallucinating missing prices', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await generateChatbotAnswer({
      question: 'What is the 4GB VPS price?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: ['### Wagon VPS x4\n- RAM: 4GB\n- CPU: 2 Core\n- Storage: 40GB NVMe\n- Price: $6.50/mo'],
    })
    const missing = await generateChatbotAnswer({
      question: 'What is n8n enterprise price?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [],
    })

    expect(result.answer).toContain('*Wagon VPS x4*')
    expect(result.answer).toContain('- Price: $6.50/mo')
    expect(result.answer).toContain('\n')
    expect(missing.answer).toBe(DEFAULT_AI_CHATBOT_SETTINGS.fallback_message)

    vi.unstubAllEnvs()
  })

  it('returns the workspace fallback when no knowledge matches', async () => {
    const result = await generateChatbotAnswer({
      question: 'Do you sell airport transfers?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [],
    })

    expect(result.status).toBe('fallback')
    expect(result.answer).toBe(DEFAULT_AI_CHATBOT_SETTINGS.fallback_message)
    expect(result.reason).toBe('no_relevant_knowledge')
  })

  it('formats model answers with WhatsApp-native formatting only', () => {
    const raw = [
      '## Service Summary',
      '',
      '```',
      'Plain detail',
      '```',
      '---',
      '*Price*: $20',
    ].join('\n')

    const formatted = formatForWhatsApp(raw)

    expect(formatted).toContain('*Service Summary*')
    expect(formatted).toContain('Plain detail')
    expect(formatted).toContain('*Price*: $20')
    expect(formatted).not.toContain('##')
    expect(formatted).not.toContain('```')
    expect(formatted).not.toContain('---')
  })

  it('keeps RTL WhatsApp formatting stable without English heading conversion', () => {
    const formatted = formatForWhatsApp('### الدعم\n\nالسعر $3.40/mo لخطة Pro.', true)
    expect(formatted).toContain('### الدعم')
    expect(formatted).toContain('$3.40/mo')
    expect(formatted).toContain('Pro')
  })

  it('keeps answer content while normalizing WhatsApp formatting', () => {
    const formatted = formatForWhatsApp('### Contact\n\n\nCall us at +1 555 123 4567.')
    expect(formatted).toBe('*Contact*\n\nCall us at +1 555 123 4567.')
  })

  it('keeps very long WhatsApp answers bounded after formatting', () => {
    const formatted = formatForWhatsApp(`## Summary\n${'Specific fact. '.repeat(120)}`)
    expect(formatted.length).toBeLessThanOrEqual(900)
    expect(formatted).toContain('*Summary*')
  })

  it('uses a safe knowledge preview for dashboard tests when OpenAI is not configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await generateChatbotAnswer({
      question: 'What are your support hours?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: ['Support hours are Monday to Friday from 9 AM to 6 PM.'],
    })

    expect(result.status).toBe('answered')
    expect(result.providerConfigured).toBe(false)
    expect(result.answer).toContain('Support hours')

    vi.unstubAllEnvs()
  })

  it('skips live replies when a provider is required but missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await generateChatbotAnswer({
      question: 'What are your support hours?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: ['Support hours are Monday to Friday from 9 AM to 6 PM.'],
      requireProvider: true,
    })

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('ai_provider_missing')

    vi.unstubAllEnvs()
  })

  it('retries once after a guardrail rejection and can answer with an equivalent contact channel', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'The phone number is +1 555 999 9999.' } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'The contact method shown in the source is https://wa.me/447478060494.' } }] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateChatbotAnswer({
      question: 'support phone number',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: ['Contact support through WhatsApp: https://wa.me/447478060494'],
      requireProvider: true,
    })

    expect(result.status).toBe('answered')
    expect(result.reason).toBe('answered_after_guardrail_retry')
    expect(result.answer).toContain('wa.me/447478060494')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses grounded extractive facts when the configured provider returns a billing error', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Payment required' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateChatbotAnswer({
      question: 'what is X1005 Enterprise price?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [
        [
          'Derived fact guidance from selected source evidence:',
          '- Selected requested offer/entity: X1005 Enterprise Dedicated Server',
          '- Selected offer current/effective price: USD 209/monthly',
          '- For a single requested item, answer only from the selected offer/entity facts above.',
        ].join('\n'),
      ],
      requireProvider: true,
    })

    expect(result.status).toBe('answered')
    expect(result.reason).toBe('provider_http_402_knowledge_preview')
    expect(result.answer).toContain('X1005 Enterprise')
    expect(result.answer).toContain('USD 209/monthly')

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses extractive billing guidance without converting true monthly billing into yearly equivalents', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limited' } }),
    }))

    const result = await generateChatbotAnswer({
      question: 'Can I get Basic Workflow Plan on monthly basis?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [
        [
          'Derived fact guidance from selected source evidence:',
          '- Customer asked for true month-to-month/monthly billing, not the monthly equivalent of a longer billing total.',
          '- Selected requested offer/entity: Basic Workflow Plan',
          '- Selected offer current/effective price: USD 1.7/monthly',
          '- Selected offer original/regular price: USD 2/monthly',
          '- Selected offer discount percent: 15%',
          '- Selected offer billing duration totals: USD 20.4 per 1 year ($20.40 billed per Year)',
        ].join('\n'),
      ],
      requireProvider: true,
    })

    expect(result.status).toBe('answered')
    expect(result.reason).toBe('provider_rate_limited_knowledge_preview')
    expect(result.answer).toContain('Monthly/list price: USD 2/monthly')
    expect(result.answer).toContain('Discounted equivalent shown: USD 1.7/monthly')

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses extractive policy and recommendation guidance when the provider rate-limits', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limited' } }),
    }))

    const policy = await generateChatbotAnswer({
      question: 'what happens to my service after refund cancellation?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [
        'Derived fact guidance from selected source evidence:\n- Policy facts found in source: Requesting a refund will result in cancellation or termination of the associated service. | Data associated with the cancelled service may be permanently removed.',
      ],
      requireProvider: true,
    })
    const recommendation = await generateChatbotAnswer({
      question: 'what plan is good for high traffic websites?',
      settings: DEFAULT_AI_CHATBOT_SETTINGS,
      chunks: [
        'Derived fact guidance from selected source evidence:\n- Answer mode: recommendation. Use suitability/product-description facts only; do not invent a recommendation.\n- Recommendation evidence found in source: Business VPS is suitable for demanding workloads and high traffic websites. | Dedicated Platform is recommended for mission-critical applications and high traffic platforms.',
      ],
      requireProvider: true,
    })

    expect(policy.status).toBe('answered')
    expect(policy.answer).toContain('cancellation or termination')
    expect(policy.answer).toContain('permanently removed')
    expect(recommendation.status).toBe('answered')
    expect(recommendation.answer).toContain('high traffic websites')
    expect(recommendation.answer).toContain('mission-critical')

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('detects opt-out messages before AI auto-reply', () => {
    expect(isOptOutMessage('STOP')).toBe(true)
    expect(isOptOutMessage('unsubscribe')).toBe(true)
    expect(isOptOutMessage('Tell me your support hours')).toBe(false)
  })

  it('detects human handoff requests before cooldown handling', () => {
    expect(isHumanHandoffRequest('want to talk to real human')).toBe(true)
    expect(isHumanHandoffRequest('connect me to agent')).toBe(true)
    expect(isHumanHandoffRequest('can someone help me')).toBe(true)
    expect(isHumanHandoffRequest('أريد التحدث مع إنسان')).toBe(true)
    expect(isHumanHandoffRequest('ایجنٹ سے ملاؤ')).toBe(true)
    expect(isHumanHandoffRequest('quiero hablar con una persona')).toBe(true)
    expect(isHumanHandoffRequest('je veux parler à un humain')).toBe(true)
    expect(isHumanHandoffRequest('What is your support hours?')).toBe(false)
  })

  it('detects follow-up human handoff confirmation only after the bot offered a team connection', () => {
    const fallbackOffer = 'I do not have information about this right now. If you want, I can connect you with our team.'
    expect(aiMessageOfferedHumanHandoff(fallbackOffer)).toBe(true)
    expect(isHumanHandoffConfirmation('yes please')).toBe(true)
    expect(isHumanHandoffConfirmation('support please')).toBe(true)
    expect(isHumanHandoffConfirmation('yes')).toBe(true)
    expect(isHumanHandoffConfirmation('yes') && aiMessageOfferedHumanHandoff('Your order is confirmed.')).toBe(false)
  })

  it('detects recent AI replies for cooldown protection', () => {
    expect(isInCooldown(new Date().toISOString(), 60)).toBe(true)
    expect(isInCooldown(new Date(Date.now() - 120_000).toISOString(), 60)).toBe(false)
    expect(isInCooldown(null, 60)).toBe(false)
  })

  it('detects repeated AI responses despite casing and punctuation', () => {
    expect(isSimilarAiResponse('Support hours are 9 AM - 6 PM.', 'support hours are 9 am 6 pm')).toBe(true)
    expect(isSimilarAiResponse('Support hours are 9 AM.', 'Delivery takes 3 days.')).toBe(false)
  })

  it('uses readable Phase 2 skipped reasons', () => {
    expect(AI_HUMAN_REPLY_PAUSE_SECONDS).toBe(300)
    expect(humanizeAiSkipReason('duplicate_inbound_message')).toContain('already processed')
    expect(humanizeAiSkipReason('human_replied_recently')).toContain('human agent replied recently')
    expect(humanizeAiSkipReason('conversation_ai_paused')).toContain('paused')
    expect(humanizeAiSkipReason('conversation_needs_human')).toContain('waiting for a human agent')
    expect(humanizeAiSkipReason('human_handoff_requested')).toBe('Customer asked to speak with a human.')
  })
})
