import { describe, expect, it, vi } from 'vitest'

import {
  AI_HUMAN_REPLY_PAUSE_SECONDS,
  humanizeAiSkipReason,
  isInCooldown,
  isSimilarAiResponse,
} from './conversation-controls'
import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  chunkKnowledgeText,
  generateChatbotAnswer,
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

  it('detects opt-out messages before AI auto-reply', () => {
    expect(isOptOutMessage('STOP')).toBe(true)
    expect(isOptOutMessage('unsubscribe')).toBe(true)
    expect(isOptOutMessage('Tell me your support hours')).toBe(false)
  })

  it('detects human handoff requests before cooldown handling', () => {
    expect(isHumanHandoffRequest('want to talk to real human')).toBe(true)
    expect(isHumanHandoffRequest('connect me to agent')).toBe(true)
    expect(isHumanHandoffRequest('can someone help me')).toBe(true)
    expect(isHumanHandoffRequest('What is your support hours?')).toBe(false)
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
