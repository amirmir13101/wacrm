import { describe, expect, it } from 'vitest'

import { buildChunkSearchMetadata, expandQuery, hybridRetrieveFromRows, rerankCandidates, validateGroundedAnswer } from './retrieval'

const source = { id: 'source-1', title: 'Business knowledge', source_type: 'website', status: 'active' }

describe('AI hybrid retrieval', () => {
  it('expands generic business queries without losing the original or named entities', () => {
    const price = expandQuery('What is the price of Acme Pro?')
    const phone = expandQuery('Acme Pro phone number')
    const refund = expandQuery('Acme Pro refund policy')

    expect(price[0]).toBe('What is the price of Acme Pro?')
    expect(price.length).toBeLessThanOrEqual(5)
    expect(new Set(price).size).toBe(price.length)
    expect(price.every((variant) => variant.includes('Acme Pro'))).toBe(true)
    expect(price.some((variant) => /\b(cost|fee|rate|pricing)\b/i.test(variant))).toBe(true)
    expect(phone.some((variant) => /\b(telephone|call|contact number)\b/i.test(variant))).toBe(true)
    expect(refund.some((variant) => /\b(return|money back|reimbursement)\b/i.test(variant))).toBe(true)
  })

  it('merges expanded-query candidates deterministically without race-sensitive ordering', async () => {
    const rows = [
      { id: 'pricing', source_id: 'source-1', source, chunk_text: 'Acme Pro pricing is $20 per month.' },
      { id: 'noise', source_id: 'source-1', source, chunk_text: 'General Acme company information.' },
    ]
    const results = await Promise.all(
      Array.from({ length: 5 }, async () => hybridRetrieveFromRows({ question: 'How much does Acme Pro cost?', rows })),
    )

    expect(results.every((result) => result.evidence[0]?.id === 'pricing')).toBe(true)
  })

  it('reranks exact and answer-bearing evidence above weak keyword and navigation matches', () => {
    const base = hybridRetrieveFromRows({
      question: 'refund policy',
      rows: [
        {
          id: 'exact',
          source_id: 'source-1',
          source: { ...source, title: 'Refund policy' },
          heading_path: 'Policies > Refund policy',
          chunk_text: 'Refund policy. Customers may return unopened items within 14 days for a full refund.',
        },
        {
          id: 'keyword',
          source_id: 'source-1',
          source,
          chunk_text: 'Our policy team can explain general account settings and business information.',
        },
        {
          id: 'navigation',
          source_id: 'source-1',
          source,
          chunk_text: 'Home\nProducts\nServices\nRefund Policy\nContact\nAbout\nFAQ\nLogin',
        },
      ],
      limit: 12,
    })
    const reranked = rerankCandidates('refund policy', base.evidence, 2)

    expect(reranked[0]?.id).toBe('exact')
    expect(reranked[0]?.rerankReasons).toContain('rerank_exact_phrase')
    expect(reranked).toHaveLength(2)
    expect(reranked.find((candidate) => candidate.id === 'navigation')?.rerankReasons).toContain('rerank_navigation_penalty')
  })

  it('penalizes mid-sentence and short chunks while never dropping a verified exact match', () => {
    const base = hybridRetrieveFromRows({
      question: 'support hours',
      rows: [
        { id: 'exact', source_id: 'source-1', source, chunk_text: 'support hours are Monday to Friday from 9:00 AM to 5:00 PM.' },
        { id: 'complete', source_id: 'source-1', source, chunk_text: 'Business support is available Monday to Friday from 9:00 AM to 5:00 PM. Customers may call during these hours for assistance.' },
      ],
      limit: 12,
    })
    const reranked = rerankCandidates('support hours', base.evidence, 1)

    expect(reranked).toHaveLength(1)
    expect(reranked[0]?.id).toBe('exact')
    expect(reranked[0]?.rerankReasons).toContain('rerank_mid_sentence_penalty')
  })
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

  it('uses recent conversation context for short follow-up retrieval', () => {
    const result = hybridRetrieveFromRows({
      question: 'and the starter?',
      contextualQuery: 'Customer: tell me about studio membership plans',
      rows: [
        { id: 'starter', source_id: 'source-1', source, chunk_text: 'Studio Starter membership plan includes 4 classes per month. Price: $29/month.' },
        { id: 'unrelated', source_id: 'source-1', source, chunk_text: 'Starter salad is available on the cafe menu for $8.' },
      ],
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.evidence[0]?.id).toBe('starter')
    expect(result.analysis.contextualQuery).toContain('studio membership plans')
  })

  it('detects comparison intent and retrieves evidence for both compared entities', () => {
    const result = hybridRetrieveFromRows({
      question: 'What is the difference between Basic and Pro?',
      rows: [
        { id: 'basic', source_id: 'source-1', source, chunk_text: 'Basic package includes email support and 5 projects. Price: $19/month.' },
        { id: 'pro', source_id: 'source-1', source, chunk_text: 'Pro package includes priority support and 20 projects. Price: $49/month.' },
      ],
    })

    expect(result.analysis.comparison.enabled).toBe(true)
    expect(result.evidence.map((item) => item.id)).toEqual(expect.arrayContaining(['basic', 'pro']))
    expect(result.chunks.join('\n')).toContain('Basic package')
    expect(result.chunks.join('\n')).toContain('Pro package')
  })

  it.each(['Basic vs Pro', 'Basic versus Pro', 'compare Basic and Pro', 'difference between Basic and Pro', 'which is better Basic or Pro'])(
    'detects comparison intent for %s',
    (question) => {
      expect(hybridRetrieveFromRows({ question, rows: [] }).analysis.comparison.enabled).toBe(true)
    },
  )

  it('enriches what-about follow-ups with prior context entity signals', () => {
    const result = hybridRetrieveFromRows({
      question: 'what about silver?',
      contextualQuery: 'Customer: compare wellness membership options',
      rows: [
        { id: 'silver', source_id: 'source-1', source, chunk_text: 'Wellness Silver membership includes 2 sessions per month for $40.' },
        { id: 'color', source_id: 'source-1', source, chunk_text: 'Silver gift box packaging is available for $4.' },
      ],
    })

    expect(result.evidence[0]?.id).toBe('silver')
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

  it('uses full-context fallback only when hybrid retrieval would otherwise miss existing active knowledge', () => {
    const rows = [
      {
        id: 'link-only-contact',
        workspace_id: 'workspace-a',
        source_id: 'source-1',
        source,
        chunk_text: 'Chat with our team here: https://wa.me/447478060494',
      },
    ]

    const result = hybridRetrieveFromRows({
      question: 'urgent help desk',
      rows,
      workspaceId: 'workspace-a',
    })
    const normalHit = hybridRetrieveFromRows({
      question: 'phone number',
      rows: [{ ...rows[0], chunk_text: 'Phone number: +44 7478 060494. WhatsApp: https://wa.me/447478060494' }],
      workspaceId: 'workspace-a',
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.debug.fullContextFallback).toMatchObject({ attempted: true, outcome: 'succeeded' })
    expect(result.chunks.join('\n')).toContain('Full active workspace knowledge fallback context')
    expect(result.chunks.join('\n')).toContain('wa.me/447478060494')
    expect(normalHit.debug.fullContextFallback).toMatchObject({ attempted: false, outcome: 'not_needed' })
  })

  it('skips full-context fallback cleanly when active knowledge exceeds the budget', () => {
    const result = hybridRetrieveFromRows({
      question: 'urgent help desk',
      rows: [
        {
          id: 'huge',
          source_id: 'source-1',
          source,
          chunk_text: `General knowledge ${'filler text '.repeat(1000)} https://wa.me/447478060494`,
        },
      ],
      fullContextTokenBudget: 10,
    })

    expect(result.fallbackReason).toBe('no_relevant_knowledge')
    expect(result.debug.fullContextFallback).toMatchObject({ attempted: true, outcome: 'skipped_budget' })
  })

  it('does not leak other workspace rows into full-context fallback', () => {
    const result = hybridRetrieveFromRows({
      question: 'support phone number',
      workspaceId: 'workspace-a',
      rows: [
        {
          id: 'workspace-a',
          workspace_id: 'workspace-a',
          source_id: 'source-1',
          source,
          chunk_text: 'Workspace A public information lists service categories only.',
        },
        {
          id: 'workspace-b',
          workspace_id: 'workspace-b',
          source_id: 'source-2',
          source: { ...source, id: 'source-2', title: 'Other workspace knowledge' },
          chunk_text: 'Workspace B WhatsApp: https://wa.me/15559999999',
        },
      ],
    })

    expect(result.fallbackReason).toBe('no_relevant_knowledge')
    expect(result.chunks.join('\n')).not.toContain('15559999999')
    expect(result.debug.fullContextFallback.sourceTitles).not.toContain('Other workspace knowledge')
  })

  it('keeps fallback when full active knowledge still does not contain the requested fact', () => {
    const result = hybridRetrieveFromRows({
      question: 'Do you sell laptops?',
      rows: [{ id: 'services', source_id: 'source-1', source, chunk_text: 'We provide accounting services and tax filing support.' }],
    })

    expect(result.fallbackReason).toBe('no_relevant_knowledge')
    expect(result.debug.fullContextFallback).toMatchObject({ attempted: true, outcome: 'still_fallback' })
  })

  it('defaults derived calculations to the current discounted price unless original price is requested', () => {
    const rows = [
      {
        id: 'pricing',
        source_id: 'source-1',
        source,
        chunk_text: 'Pro package regular monthly price: $10/month. Current discounted price: $8/month.',
      },
    ]
    const current = hybridRetrieveFromRows({ question: 'What is the yearly total for Pro package?', rows })
    const original = hybridRetrieveFromRows({ question: 'What is the yearly total for the original regular Pro package price?', rows })

    expect(current.calculation).toMatchObject({ status: 'computed', value: 96 })
    expect(original.calculation).toMatchObject({ status: 'computed', value: 120 })
  })

  it('uses flattened current discount pricing for a multi-plan infrastructure chunk without bleeding into neighbors', () => {
    const rows = [
      {
        id: 'vps-pricing',
        source_id: 'source-1',
        source,
        chunk_text: [
          '### Wagon VPS x4 - ◆ RYZEN™ CPU 2 CoreCPU 4GBRAM 40 GBNVME FREEBACKUP',
          'Starting at: - Price: $5.40/mo $6.50 17% OFF',
          '### Wagon VPS x8 - ◆ RYZEN™ CPU 4 CoreCPU 8GBRAM 60 GBNVME FREEBACKUP',
          'Starting at: - Price: $7.04/mo $8.80 20% OFF',
          '### Wagon VPS X24 - ◆ RYZEN™ CPU 6 CoreCPU 24GBRAM 240 GBNVME FREEBACKUP',
          'Starting at: - Price: $12.40/mo $15.50 20% OFF',
        ].join('\n'),
      },
    ]

    const result = hybridRetrieveFromRows({ question: '4gb ram vps price yearly price and monthly', rows })

    expect(result.calculation).toMatchObject({ status: 'computed', value: 64.8, unit: 'USD/yearly' })
    expect(result.calculation?.formula).toContain('5.4 USD/monthly')
    expect(result.calculation?.formula).not.toContain('6.5 USD/monthly')
    expect(result.calculation?.formula).not.toContain('12.4 USD/monthly')
  })

  it('handles reverse-phrased yearly-to-monthly discount questions for the selected offer', () => {
    const rows = [
      {
        id: 'vps-pricing',
        source_id: 'source-1',
        source,
        chunk_text: [
          '### Wagon VPS x4 - ◆ RYZEN™ CPU 2 CoreCPU 4GBRAM 40 GBNVME FREEBACKUP',
          'Starting at: - Price: $5.40/mo $6.50 17% OFF',
          '### Wagon VPS x8 - ◆ RYZEN™ CPU 4 CoreCPU 8GBRAM 60 GBNVME FREEBACKUP',
          'Starting at: - Price: $7.04/mo $8.80 20% OFF',
        ].join('\n'),
      },
      {
        id: 'course',
        source_id: 'source-1',
        source,
        chunk_text: '### Automation Course Business\nCurrent price $6.80/month. Total: $81.60 billed per Year.',
      },
    ]

    const result = hybridRetrieveFromRows({
      question: 'if i buy 4gb vps yearly discounted what should be the monthly price i will get',
      rows,
    })

    expect(result.fallbackReason).toBeNull()
    expect(result.calculation).toMatchObject({ status: 'computed', value: 5.4, unit: 'USD/monthly' })
    expect(result.chunks.join('\n')).toContain('Selected requested offer/entity')
  })

  it('rejects final answers that mix facts from neighboring offers or unrelated products', () => {
    const rows = [
      {
        id: 'mixed',
        source_id: 'source-1',
        source,
        chunk_text: [
          '### Wagon VPS x4 - ◆ RYZEN™ CPU 2 CoreCPU 4GBRAM 40 GBNVME FREEBACKUP',
          'Starting at: - Price: $5.40/mo $6.50 17% OFF',
          '### Wagon VPS x8 - ◆ RYZEN™ CPU 4 CoreCPU 8GBRAM 60 GBNVME FREEBACKUP',
          'Starting at: - Price: $7.04/mo $8.80 20% OFF',
          '### Automation Business Plan',
          'Price: $6.80/mo. Total: $81.60 billed per Year.',
        ].join('\n'),
      },
    ]
    const result = hybridRetrieveFromRows({ question: '4gb ram vps yearly discounted price', rows })
    const evidence = result.chunks

    expect(result.calculation).toMatchObject({ status: 'computed', value: 64.8 })
    expect(validateGroundedAnswer({
      question: '4gb ram vps yearly discounted price',
      answer: 'Plan: 4GB VPS. Monthly Price: $6.80. Yearly Total: $81.60. Resources: 4 Core CPU, 8GB RAM, 60GB NVMe Storage.',
      evidence,
      calculation: result.calculation,
      fallback: 'Fallback',
    })).toEqual({ ok: false, reason: 'cross_entity_fact_mix', answer: 'Fallback' })
    expect(validateGroundedAnswer({
      question: '4gb ram vps yearly discounted price',
      answer: 'Wagon VPS x4 has 2 Core CPU, 4GB RAM, 40GB NVMe Storage. The discounted monthly price is $5.40/mo, regular price is $6.50/mo, and yearly discounted total is $64.80/year.',
      evidence,
      calculation: result.calculation,
      fallback: 'Fallback',
    })).toEqual({ ok: true })
  })

  it('prefers an explicitly stored billing total over deriving one from monthly pricing', () => {
    const rows = [
      {
        id: 'n8n-basic',
        source_id: 'source-1',
        source,
        chunk_text: '### Basic n8n 4GB Great for small teams $2.00 1.70 15% OFF Total: $20.40 billed per Year - Price: 1.70/mo',
      },
    ]

    const result = hybridRetrieveFromRows({ question: 'Price of basic plan of n8n yearly discounted price', rows })

    expect(result.calculation).toMatchObject({ status: 'computed', value: 20.4, unit: 'USD/yearly' })
    expect(result.calculation?.formula).toContain('Stored yearly total')
  })

  it('generalizes discount pairs across restaurant, clinic, and course fixtures', () => {
    const rows = [
      {
        id: 'restaurant',
        source_id: 'source-1',
        source,
        chunk_text: '### Family Pasta Meal Subscription\nSeasonal menu deal: Price $18.00/month $24.00/month 25% off. Serves 4 people.',
      },
      {
        id: 'clinic',
        source_id: 'source-1',
        source,
        chunk_text: '### Dental Care Membership\nService fee: now $45 monthly, was $60 monthly. Save 25%. Appointment required.',
      },
      {
        id: 'course',
        source_id: 'source-1',
        source,
        chunk_text: '### Beginner English Course\nEarly-bird fee USD 120 monthly, original USD 150 monthly, 20% discount.',
      },
    ]

    const restaurant = hybridRetrieveFromRows({ question: 'yearly price for Family Pasta Meal Subscription', rows })
    const clinic = hybridRetrieveFromRows({ question: 'yearly price for Dental Care Membership', rows })
    const course = hybridRetrieveFromRows({ question: 'yearly price for Beginner English Course', rows })

    expect(restaurant.calculation).toMatchObject({ status: 'computed', value: 216 })
    expect(clinic.calculation).toMatchObject({ status: 'computed', value: 540 })
    expect(course.calculation).toMatchObject({ status: 'computed', value: 1440 })
  })

  it('stores generic structured pricing offers in chunk metadata for re-chunk backfills', () => {
    const metadata = buildChunkSearchMetadata('### Course Plus\nEarly bird price: USD 120/month. Original price USD 150/month. 20% discount.', 0)
    const facts = metadata.structured_facts as { pricing_offers?: Array<{ current_price?: { amount?: number }; original_price?: { amount?: number }; discount_percent?: number }> }

    expect(facts.pricing_offers?.[0]?.current_price?.amount).toBe(120)
    expect(facts.pricing_offers?.[0]?.original_price?.amount).toBe(150)
    expect(facts.pricing_offers?.[0]?.discount_percent).toBe(20)
  })

  it('accepts chained deterministic numbers traceable to evidence and still rejects invented numbers', () => {
    const evidence = ['Plan regular price is $20/month. Discount is 15% off.']
    expect(validateGroundedAnswer({
      answer: 'The discounted yearly total is $204/year.',
      evidence,
      fallback: 'Fallback',
    })).toEqual({ ok: true })
    expect(validateGroundedAnswer({
      answer: 'The discounted yearly total is $209/year.',
      evidence,
      fallback: 'Fallback',
    })).toEqual({ ok: false, reason: 'unsupported_numeric_fact', answer: 'Fallback' })
  })

  it('rejects unsupported numeric facts from mocked model answers', () => {
    const validation = validateGroundedAnswer({
      answer: 'The price is $99/month.',
      evidence: ['Chunk ID: p1\nThe price is $20/month.'],
      fallback: 'Fallback',
    })
    expect(validation).toEqual({ ok: false, reason: 'unsupported_numeric_fact', answer: 'Fallback' })
  })

  it('normalizes exact guardrail facts across phone links, money, dates, emails, and urls', () => {
    expect(validateGroundedAnswer({
      answer: 'The contact shown in the source is +44 7478 060494.',
      evidence: ['Contact link: https://wa.me/447478060494'],
      fallback: 'Fallback',
    })).toEqual({ ok: true })
    expect(validateGroundedAnswer({
      answer: 'The fee is USD 120/month. Email SUPPORT@EXAMPLE.COM. See https://example.com/contact/. Date: March 6, 2026.',
      evidence: ['Fee: $120/month. Email support@example.com. See https://example.com/contact. Page date: 2026-03-06.'],
      fallback: 'Fallback',
    })).toEqual({ ok: true })
  })
})
