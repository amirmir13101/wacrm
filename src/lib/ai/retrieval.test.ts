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

  it('does not penalize multi-plan pricing cards as conflicting facts', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the price of automation pro?',
      rows: [
        {
          id: 'faq',
          source_id: 'source-1',
          source,
          chunk_text: 'Automation hosting FAQ: higher resource plans support more workflows and complex jobs.',
        },
        {
          id: 'pricing-card',
          source_id: 'source-1',
          source,
          chunk_text: [
            '### Choose The Right Automation Hosting Plan',
            'Starter',
            '- Price: 0.99/mo',
            '- 1GB RAM',
            'Basic',
            'Automation 4GB Great for small teams',
            '$2.00',
            '1.70',
            'Total: $20.40 billed per Year',
            'Pro',
            'Automation 8GB Best for growing businesses',
            '$4.00',
            '3.40',
            'Total: $40.80 billed per Year',
            '- 4 Core CPU',
            '- 8GB RAM',
            'Business',
            'Automation 16GB For agencies',
            '$8.00',
            '6.80',
          ].join('\n'),
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.evidence[0]?.id).toBe('pricing-card')
    expect(result.chunks.join('\n')).toContain('Pro')
    expect(result.chunks.join('\n')).toContain('3.40')
  })

  it('finds clue-based plan pricing from small entity hints', () => {
    const result = hybridRetrieveFromRows({
      question: 'automation pro price',
      rows: [
        { id: 'generic', source_id: 'source-1', source, chunk_text: 'Automation hosting helps teams run workflows and integrations.' },
        {
          id: 'plans',
          source_id: 'source-1',
          source,
          chunk_text: [
            'Starter',
            '- Price: 0.99/mo',
            'Pro',
            'Automation 8GB Best for growing businesses',
            '$4.00',
            '3.40',
            'Total: $40.80 billed per Year',
            '- Price: 3.40/mo',
            'Business',
            '- Price: 6.80/mo',
          ].join('\n'),
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.evidence[0]?.id).toBe('plans')
    expect(result.chunks.join('\n')).toContain('Price: 3.40/mo')
  })

  it('expands neighboring chunks when entity and answer fact are separated', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the price of automation pro?',
      rows: [
        {
          id: 'plan-name',
          source_id: 'source-1',
          source,
          chunk_index: 10,
          chunk_text: '### Automation Pro\nBest for growing businesses with advanced workflow needs.',
        },
        {
          id: 'plan-price',
          source_id: 'source-1',
          source,
          chunk_index: 11,
          chunk_text: 'Billing details\nPrice: $33/month\nIncludes priority support and advanced workflows.',
        },
        {
          id: 'noise',
          source_id: 'source-1',
          source,
          chunk_index: 40,
          chunk_text: 'Automation FAQ with many general questions but no plan price.',
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.evidence.map((item) => item.id)).toContain('plan-name')
    expect(result.evidence.map((item) => item.id)).toContain('plan-price')
    expect(result.chunks.join('\n')).toContain('$33/month')
  })

  it('handles policy, hours, and contact paraphrases with answer-bearing evidence', () => {
    const rows = [
      { id: 'policy', source_id: 'source-1', source, chunk_text: 'Refund policy: customers can request a refund within 7 days if the service has not been activated.' },
      { id: 'hours', source_id: 'source-1', source, chunk_text: 'Business hours: Monday-Friday 9:00 AM to 6:00 PM. Saturday is closed.' },
      { id: 'contact', source_id: 'source-1', source, chunk_text: 'Contact support by email at support@example.com or phone +1 555 123 4567.' },
    ]

    expect(hybridRetrieveFromRows({ question: 'Can I get my money back?', rows }).evidence[0]?.id).toBe('policy')
    expect(hybridRetrieveFromRows({ question: 'When do you close?', rows }).evidence[0]?.id).toBe('hours')
    expect(hybridRetrieveFromRows({ question: 'What is your support email?', rows }).evidence[0]?.id).toBe('contact')
  })

  it('retrieves phone and WhatsApp contact facts from generic contact questions', () => {
    const rows = [
      {
        id: 'contact',
        source_id: 'source-1',
        source,
        chunk_text: 'Contact us: Phone +44 7478 060494. WhatsApp: https://wa.me/447478060494. Sales email sales@example.com.',
      },
    ]

    const phone = hybridRetrieveFromRows({ question: 'phone number of company', rows })
    expect(phone.fallbackReason).toBeNull()
    expect(phone.chunks.join('\n')).toContain('+44 7478 060494')

    const whatsapp = hybridRetrieveFromRows({ question: 'whatsapp number?', rows })
    expect(whatsapp.fallbackReason).toBeNull()
    expect(whatsapp.chunks.join('\n')).toContain('wa.me/447478060494')
    expect(whatsapp.chunks.join('\n')).toContain('Derived fact guidance')
  })

  it('retrieves support email and legal company number facts generically', () => {
    const rows = [
      {
        id: 'legal',
        source_id: 'source-1',
        source,
        chunk_text: 'Legal entity: Example Trading Ltd. Company Number: 16754997. Support email: support@example.com.',
      },
    ]

    const email = hybridRetrieveFromRows({ question: 'support email?', rows })
    expect(email.fallbackReason).toBeNull()
    expect(email.chunks.join('\n')).toContain('support@example.com')

    const company = hybridRetrieveFromRows({ question: 'company number', rows })
    expect(company.fallbackReason).toBeNull()
    expect(company.chunks.join('\n')).toContain('16754997')
    expect(company.chunks.join('\n')).toContain('Example Trading Ltd')
  })

  it('answers owner questions with legal company evidence without inventing an individual owner', () => {
    const result = hybridRetrieveFromRows({
      question: 'owner of example cloud',
      rows: [
        {
          id: 'company',
          source_id: 'source-1',
          source,
          chunk_text: 'Example Cloud is operated by Example Trading Ltd, Company Number: 16754997. The source does not list an individual founder.',
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.chunks.join('\n')).toContain('Example Trading Ltd')
    expect(result.chunks.join('\n')).toContain('does not explicitly name an individual owner')
  })

  it('uses page dates as related evidence when an exact built date is unavailable', () => {
    const result = hybridRetrieveFromRows({
      question: 'company built time and date',
      rows: [
        {
          id: 'dates',
          source_id: 'source-1',
          source,
          chunk_text: 'Sitemap page date: 2026-03-06. Homepage page date: 2026-05-05. No exact founded date is provided.',
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.chunks.join('\n')).toContain('2026-03-06')
    expect(result.chunks.join('\n')).toContain('2026-05-05')
    expect(result.chunks.join('\n')).toContain('exact built/founded/launch date is not provided')
  })

  it('falls back for missing products instead of guessing from generic business text', () => {
    const result = hybridRetrieveFromRows({
      question: 'Do you sell laptops?',
      rows: [
        { id: 'hosting', source_id: 'source-1', source, chunk_text: 'We offer managed cloud hosting, support, and migration services for businesses.' },
        { id: 'pricing', source_id: 'source-1', source, chunk_text: 'Business plan price is $20/month and includes email support.' },
      ],
    })

    expect(result.fallbackReason).toBe('no_relevant_knowledge')
    expect(result.evidence).toHaveLength(0)
  })

  it('does not leak knowledge across supplied workspace rows', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the company phone number?',
      rows: [
        { id: 'workspace-a', source_id: 'source-1', source, chunk_text: 'Company phone number is +1 555 100 2000.' },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.chunks.join('\n')).toContain('+1 555 100 2000')
    expect(result.chunks.join('\n')).not.toContain('+1 555 999 9999')
  })

  it('uses exact and keyword retrieval when embeddings are unavailable', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the Alpha Care package price?',
      rows: [
        { id: 'other', source_id: 'source-1', source, chunk_text: 'Beta Care package price is $50/month.' },
        { id: 'alpha', source_id: 'source-1', source, chunk_text: 'Alpha Care package price is $25/month and includes chat support.' },
      ],
    })

    expect(result.evidence[0]?.id).toBe('alpha')
    expect(result.chunks.join('\n')).toContain('$25/month')
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
      rows: [{ id: 'yearly', source_id: 'source-1', source, chunk_text: 'Pro plan yearly price is $40/year. Discount details are not listed.' }],
    })
    expect(missing.calculation).toBeNull()
    expect(missing.fallbackReason).toBe('cannot_compute')
  })

  it('computes a yearly billed total into a monthly equivalent and keeps supporting facts grounded', () => {
    const result = hybridRetrieveFromRows({
      question: 'so what should be the monthly price if total is $20.40 yearly',
      rows: [
        {
          id: 'basic-plan',
          source_id: 'source-1',
          source,
          chunk_text: [
            'Basic automation plan',
            'Regular monthly price: $2.00/mo',
            '15% discount',
            'Total: $20.40 billed per Year',
            'Specs: 2 Core CPU, 4GB RAM, 40GB NVMe',
          ].join('\n'),
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.calculation).toMatchObject({ status: 'computed', value: 1.7, unit: 'USD/monthly' })
    expect(result.chunks.join('\n')).toContain('$2.00/mo')
    expect(result.chunks.join('\n')).toContain('$20.40 billed per Year')
    expect(result.chunks.join('\n')).toContain('Computed fact')
    expect(validateGroundedAnswer({
      answer: 'The yearly discounted monthly equivalent is $1.70/mo. The total yearly billing is $20.40/year. The regular monthly price is $2.00/mo.',
      evidence: result.chunks,
      calculation: result.calculation,
      fallback: 'Fallback',
    })).toEqual({ ok: true })
  })

  it('computes monthly discount equivalents without treating specs as conflicting prices', () => {
    const result = hybridRetrieveFromRows({
      question: 'monthly $2.00 with 15% discount, what is the monthly price?',
      rows: [
        {
          id: 'basic-plan',
          source_id: 'source-1',
          source,
          chunk_text: 'Basic plan regular monthly price: $2.00/mo. Discount: 15% off. Specs include 2 Core CPU and 4GB RAM.',
        },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.calculation).toMatchObject({ status: 'computed', value: 1.7 })
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
