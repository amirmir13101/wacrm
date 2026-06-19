import { describe, expect, it } from 'vitest'

import { hybridRetrieveFromRows, validateGroundedAnswer } from './retrieval'

const source = { id: 'source-1', title: 'Business knowledge', source_type: 'website', status: 'active' }

describe('AI hybrid retrieval', () => {
  it('keeps exact product/package facts ahead of similar alternatives', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the 4GB plan price?',
      rows: [
        { id: '4gb', source_id: 'source-1', source, chunk_text: 'Starter 4GB plan price is $10/month with 2 CPU cores.' },
        { id: '8gb', source_id: 'source-1', source, chunk_text: 'Growth 8GB plan price is $18/month with 4 CPU cores.' },
      ],
    })

    expect(result.evidence[0]?.id).toBe('4gb')
    expect(result.chunks.join('\n')).toContain('4GB plan')
    expect(result.chunks.join('\n')).not.toMatch(/Growth 8GB plan[\s\S]*Starter 4GB/)
  })

  it('finds paraphrased service, hours, returns, shipping, FAQ, and location questions generically', () => {
    const rows = [
      { id: 'returns', source_id: 'source-1', source, chunk_text: 'Return policy: customers may exchange unopened products within 14 days.' },
      { id: 'hours', source_id: 'source-1', source, chunk_text: 'Business hours: Monday to Friday, 9:00 AM to 6:00 PM.' },
      { id: 'shipping', source_id: 'source-1', source, chunk_text: 'Delivery and shipping: orders dispatch by courier in 2 business days.' },
      { id: 'location', source_id: 'source-1', source, chunk_text: 'Address: Main Market, Lahore. Phone: +92 300 1234567.' },
      { id: 'faq', source_id: 'source-1', source, chunk_text: 'FAQ: Appointment booking is available online and by phone.' },
    ]

    expect(hybridRetrieveFromRows({ question: 'Can I bring it back?', rows }).evidence[0]?.id).toBe('returns')
    expect(hybridRetrieveFromRows({ question: 'When do you close?', rows }).evidence[0]?.id).toBe('hours')
    expect(hybridRetrieveFromRows({ question: 'Do you send orders by courier?', rows }).evidence[0]?.id).toBe('shipping')
    expect(hybridRetrieveFromRows({ question: 'Where are you located?', rows }).evidence[0]?.id).toBe('location')
    expect(hybridRetrieveFromRows({ question: 'How can I book?', rows }).evidence[0]?.id).toBe('faq')
  })

  it('excludes archived source chunks and isolates rows supplied for one workspace', () => {
    const archivedSource = { ...source, id: 'archived', status: 'archived' }
    const result = hybridRetrieveFromRows({
      question: 'What is the price?',
      rows: [
        { id: 'active', source_id: 'source-1', source, chunk_text: 'Active price is $20/month.' },
        { id: 'archived', source_id: 'archived', source: archivedSource, chunk_text: 'Archived price is $1/month.' },
      ],
    })
    expect(result.chunks.join('\n')).toContain('$20/month')
    expect(result.chunks.join('\n')).not.toContain('$1/month')
  })

  it('uses semantic matching without literal overlap but does not let vector-like matches override exact conflicts', () => {
    const semantic = hybridRetrieveFromRows({
      question: 'Can I bring it back?',
      rows: [{ id: 'policy', source_id: 'source-1', source, chunk_text: 'Refund and exchange policy: unopened items are accepted within 7 days.' }],
    })
    expect(semantic.evidence[0]?.id).toBe('policy')

    const conflict = hybridRetrieveFromRows({
      question: 'What is Pro price?',
      rows: [
        { id: 'pro-a', source_id: 'source-1', source, chunk_text: 'Pro price is $10/month.' },
        { id: 'pro-b', source_id: 'source-1', source, chunk_text: 'Pro price is $25/month.' },
      ],
    })
    expect(conflict.fallbackReason).toBe('no_relevant_knowledge')
  })

  it('routes derived numeric questions through calculation results and falls back on missing facts', () => {
    const computed = hybridRetrieveFromRows({
      question: 'Yearly price has 15% discount, what is monthly?',
      rows: [{ id: 'yearly', source_id: 'source-1', source, chunk_text: 'Pro plan yearly price is $40/year. Annual discount is 15% off.' }],
    })
    expect(computed.calculation?.status).toBe('computed')
    expect(computed.chunks.join('\n')).toContain('Computed fact')

    const missing = hybridRetrieveFromRows({
      question: 'What is monthly after discount?',
      rows: [{ id: 'yearly', source_id: 'source-1', source, chunk_text: 'Pro plan yearly price is $40/year.' }],
    })
    expect(missing.calculation).toBeNull()
  })

  it('rejects unsupported numeric facts from mocked model answers', () => {
    const validation = validateGroundedAnswer({
      answer: 'The price is $99/month.',
      evidence: ['Chunk ID: p1\nThe price is $20/month.'],
      fallback: 'Fallback',
    })
    expect(validation).toEqual({ ok: false, reason: 'unsupported_numeric_fact', answer: 'Fallback' })
  })
})
