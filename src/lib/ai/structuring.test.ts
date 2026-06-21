import { describe, expect, it, vi } from 'vitest'

import {
  enhanceWebsiteImportWithAiStructuring,
  groundStructuredFacts,
  mergeStructuredFacts,
  structurePageWithProvider,
} from './structuring'
import type { WebsiteImportResult } from './website-import'

const provider = {
  baseUrl: 'https://provider.test/v1',
  apiKey: 'test-key',
  model: 'test-model',
}

function jsonResponse(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(content) } }],
  }), { status, headers: { 'content-type': 'application/json' } })
}

describe('AI knowledge structuring', () => {
  it('drops AI values that are not present in source text', () => {
    const result = groundStructuredFacts({
      pricing_offers: [
        {
          entity: 'Gym Gold',
          current_price: { amount: 49, currency: 'USD', period: 'monthly' },
          original_price: { amount: 99, currency: 'USD', period: 'monthly' },
        },
      ],
    }, 'Gym Gold membership costs $49/month.')

    const offer = (result.facts.pricing_offers as Array<Record<string, unknown>>)[0]
    expect(offer.current_price).toMatchObject({ amount: 49 })
    expect(offer.original_price).toBeUndefined()
    expect(result.grounding.kept).toBeGreaterThan(0)
    expect(result.grounding.dropped).toBeGreaterThan(0)
  })

  it('uses fully grounded AI fields and merges them without duplicating offers', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      pricing_offers: [
        {
          entity: 'Dinner Combo',
          category: 'restaurant menu',
          current_price: { amount: 18, currency: 'USD', period: 'item' },
          source_excerpt: 'Dinner Combo $18 includes rice and drink',
        },
      ],
    }))
    const result = await structurePageWithProvider({
      provider,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      page: {
        url: 'https://example.test/menu',
        title: 'Menu',
        text: 'Dinner Combo $18 includes rice and drink',
      },
    })

    expect(result.source).toBe('mixed')
    expect(result.grounding.dropped).toBe(0)
    const merged = mergeStructuredFacts({
      pricing_offers: [{ entity: 'Dinner Combo', current_price: { amount: 18, currency: 'USD' } }],
    }, result.facts)
    expect(merged.pricing_offers).toHaveLength(1)
  })

  it('falls back to deterministic extraction when provider fails', async () => {
    const result = await structurePageWithProvider({
      provider,
      fetchImpl: vi.fn(async () => new Response('payment required', { status: 402 })) as unknown as typeof fetch,
      page: {
        url: 'https://example.test/pricing',
        title: 'Pricing',
        text: 'Course Starter price: $120. Duration: 6 weeks.',
      },
    })

    expect(result.source).toBe('unavailable')
    expect(result.message).toContain('provider error')
    expect(Array.isArray(result.facts.prices)).toBe(true)
  })

  it('falls back to deterministic extraction when provider is too slow', async () => {
    const result = await structurePageWithProvider({
      provider,
      timeoutMs: 50,
      fetchImpl: vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal instanceof AbortSignal) {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        }
      })) as unknown as typeof fetch,
      page: {
        url: 'https://example.test/pricing',
        title: 'Pricing',
        text: 'Course Starter price: $120. Duration: 6 weeks.',
      },
    })

    expect(result.source).toBe('unavailable')
    expect(result.message).toContain('provider error')
    expect(Array.isArray(result.facts.prices)).toBe(true)
  })

  it('stops AI structuring when the safe request time budget is reached', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ contact_info: [{ type: 'phone', value: '+1 555 0100' }] }))
    const result = await enhanceWebsiteImportWithAiStructuring({
      workspaceId: 'workspace-a',
      result: buildImportResult([
        'https://example.test/pricing',
        'https://example.test/contact',
        'https://example.test/services',
      ]),
      settings: { enabled: true, callCap: 3 },
      dependencies: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveProvider: async () => provider,
        maxDurationMs: 1,
      },
    })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.aiStructuring?.pagesAttempted).toBe(0)
    expect(result.aiStructuring?.messages.join(' ')).toContain('safe request time budget')
  })

  it('keeps disabled imports deterministic-only', async () => {
    const base = buildImportResult(['https://example.test/pricing'])
    const result = await enhanceWebsiteImportWithAiStructuring({
      workspaceId: 'workspace-a',
      result: base,
      settings: { enabled: false, callCap: 10 },
    })

    expect(result.aiStructuring?.status).toBe('disabled')
    expect(result.pages[0]?.structuringSource).toBe('disabled')
    expect(result.pages[0]?.structuredFacts).toBeTruthy()
  })

  it('preserves labeled plan current, original, and duration-total facts deterministically', async () => {
    const result = await enhanceWebsiteImportWithAiStructuring({
      workspaceId: 'workspace-a',
      result: buildImportResult([
        'https://example.test/pricing',
      ], '### Pro Package $0.90 - Price: 0.63/mo Total: $22.68 billed per 3 Years\n### Basic Automation Plan $2.00 - Price: $2.00/mo Total: $20.40 billed per Year'),
      settings: { enabled: false, callCap: 10 },
    })

    const offers = result.pages[0]?.structuredFacts?.pricing_offers as Array<Record<string, unknown>>
    const pro = offers.find((offer) => offer.entity === 'Pro Package')
    const basic = offers.find((offer) => offer.entity === 'Basic Automation Plan')
    expect(pro?.current_price).toMatchObject({ amount: 0.63, period: 'monthly' })
    expect(pro?.original_price).toMatchObject({ amount: 0.9, period: 'monthly' })
    expect(pro?.billing_totals).toMatchObject([{ amount: 22.68, duration_count: 3, duration_unit: 'year' }])
    expect(basic?.current_price).toMatchObject({ amount: 2, period: 'monthly' })
    expect(basic?.billing_totals).toMatchObject([{ amount: 20.4, duration_count: 1, duration_unit: 'year' }])
  })

  it('does not let weaker AI pricing overwrite stronger deterministic plan pricing', () => {
    const merged = mergeStructuredFacts({
      pricing_offers: [{
        entity: 'Pro Package',
        current_price: { amount: 0.63, period: 'monthly', currency: 'USD' },
        original_price: { amount: 0.9, period: 'monthly', currency: 'USD' },
        billing_totals: [{ amount: 22.68, duration_count: 3, duration_unit: 'year', currency: 'USD' }],
      }],
    }, {
      pricing_offers: [{
        entity: 'Pro Package',
        current_price: { amount: 0.9, period: 'monthly', currency: 'USD' },
      }],
    })

    const offer = (merged.pricing_offers as Array<Record<string, unknown>>)[0]
    expect(offer.current_price).toMatchObject({ amount: 0.63 })
    expect(offer.original_price).toMatchObject({ amount: 0.9 })
    expect(offer.billing_totals).toHaveLength(1)
  })

  it('keeps grounded fields and falls back for ungrounded fields in a mixed result', async () => {
    const result = groundStructuredFacts({
      contact_info: [
        { type: 'phone', value: '+44 7478 060494' },
        { type: 'email', value: 'fake@example.test' },
      ],
    }, 'Contact us on WhatsApp +44 7478 060494.')

    const contacts = result.facts.contact_info as Array<Record<string, unknown>>
    expect(contacts).toHaveLength(1)
    expect(contacts[0]?.value).toBe('+44 7478 060494')
    expect(result.grounding.dropped).toBeGreaterThanOrEqual(1)
  })

  it('respects per-import AI call cap on multi-page imports', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ contact_info: [{ type: 'phone', value: '+1 555 0100' }] }))
    const result = await enhanceWebsiteImportWithAiStructuring({
      workspaceId: 'workspace-a',
      result: buildImportResult([
        'https://example.test/pricing',
        'https://example.test/contact',
        'https://example.test/services',
      ]),
      settings: { enabled: true, callCap: 2 },
      dependencies: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveProvider: async () => provider,
      },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.aiStructuring?.pagesAttempted).toBe(2)
  })
})

function buildImportResult(urls: readonly string[], text?: string): WebsiteImportResult {
  return {
    startUrl: urls[0] ?? 'https://example.test',
    normalizedOrigin: 'https://example.test',
    pages: urls.map((url, index) => ({
      url,
      canonicalUrl: url,
      title: `Page ${index + 1}`,
      metaDescription: null,
      rawText: null,
      cleanedText: text ?? `${url.includes('contact') ? 'Contact +1 555 0100.' : 'Pricing plan Pro costs $20/month.'}`,
      contentHash: `hash-${index}`,
      status: 'imported',
      skipReason: null,
      httpStatus: 200,
    })),
    draftTitle: 'Example website knowledge',
    draftContent: 'Draft',
    qualityWarnings: [],
    pagesFound: urls.length,
    pagesImported: urls.length,
    pagesSkipped: 0,
    pagesFailed: 0,
    duplicatePages: 0,
  }
}
