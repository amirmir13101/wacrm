import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { __ragWebsiteImportTestUtils } from './website-import'
import { structureRagWebsiteKnowledge } from './website-structuring'

const structuringSource = readFileSync(
  join(process.cwd(), 'src/lib/rag/website-structuring.ts'),
  'utf8',
)

describe('RAG website knowledge AI structuring', () => {
  it('creates a generic chatbot-ready structure while preserving exact billing periods and sources', async () => {
    const rootUrl = 'https://business.example/'
    const plansUrl = 'https://business.example/packages/'
    const contactUrl = 'https://business.example/contact/'
    const faqUrl = 'https://business.example/faq/'
    const result = await structureRagWebsiteKnowledge({
      startUrl: rootUrl,
      callCap: 1,
      pages: [
        {
          url: rootUrl,
          title: 'Business Home',
          content: 'North Star Studio provides brand strategy and campaign management for growing businesses.',
        },
        {
          url: plansUrl,
          title: 'Packages',
          content: [
            'Growth Package includes Campaign setup and Monthly reporting.',
            'Growth Package monthly price: $120 per month.',
            'Growth Package yearly price: $1,200 per year.',
            'Growth Package 2-year price: $2,160 per 2 years.',
            'Growth Package 3-year price: $2,880 per 3 years.',
            'Growth Package weekly consultation price: $35 per week.',
            'Growth Package onboarding fee: $75 one-time.',
          ].join('\n'),
        },
        {
          url: contactUrl,
          title: 'Contact',
          content: [
            'Support email: help@business.example',
            'WhatsApp: https://wa.me/15551234567',
            'Legal company name: North Star Studio Ltd',
            'Company number: 998877',
          ].join('\n'),
        },
        {
          url: faqUrl,
          title: 'FAQ',
          content: 'Question: Can I cancel? Answer: You can cancel before the next billing date.',
        },
      ],
      generate: async () => JSON.stringify({
        business_summary: [{
          label: 'Business overview',
          value: 'North Star Studio provides brand strategy and campaign management for growing businesses.',
          source_url: rootUrl,
          evidence: 'North Star Studio provides brand strategy and campaign management for growing businesses.',
        }],
        offerings: [{
          name: 'Growth Package',
          description: 'Growth Package includes Campaign setup and Monthly reporting.',
          features: ['Campaign setup', 'Monthly reporting'],
          source_url: plansUrl,
          evidence: 'Growth Package includes Campaign setup and Monthly reporting.',
        }],
        pricing: [
          ['monthly price', '$120', 'per month'],
          ['yearly price', '$1,200', 'per year'],
          ['2-year price', '$2,160', 'per 2 years'],
          ['3-year price', '$2,880', 'per 3 years'],
          ['weekly consultation price', '$35', 'per week'],
          ['onboarding fee', '$75', 'one-time'],
        ].map(([variant, price, billingPeriod]) => ({
          name: 'Growth Package',
          variant,
          price,
          billing_period: billingPeriod,
          price_type: variant === 'onboarding fee' ? 'setup fee' : 'current',
          source_url: plansUrl,
          evidence: `Growth Package ${variant}: ${price} ${billingPeriod}.`,
        })),
        faqs: [{
          question: 'Can I cancel?',
          answer: 'You can cancel before the next billing date.',
          source_url: faqUrl,
          evidence: 'Question: Can I cancel? Answer: You can cancel before the next billing date.',
        }],
        contacts: [
          {
            label: 'Support email',
            value: 'help@business.example',
            source_url: contactUrl,
            evidence: 'Support email: help@business.example',
          },
          {
            label: 'WhatsApp',
            value: 'https://wa.me/15551234567',
            source_url: contactUrl,
            evidence: 'WhatsApp: https://wa.me/15551234567',
          },
        ],
        legal_details: [
          {
            label: 'Legal company name',
            value: 'North Star Studio Ltd',
            source_url: contactUrl,
            evidence: 'Legal company name: North Star Studio Ltd',
          },
          {
            label: 'Company number',
            value: '998877',
            source_url: contactUrl,
            evidence: 'Company number: 998877',
          },
        ],
        important_notes: [],
      }),
    })

    expect(result.used).toBe(true)
    expect(result.batchesAttempted).toBe(1)
    expect(result.batchesSucceeded).toBe(1)
    expect(result.markdown).toContain('# Business Summary')
    expect(result.markdown).toContain('# Services / Products / Plans')
    expect(result.markdown).toContain('# Pricing')
    expect(result.markdown).toContain('# FAQs')
    expect(result.markdown).toContain('# Contact Details')
    expect(result.markdown).toContain('# Legal / Company Details')
    expect(result.markdown).toContain('$120')
    expect(result.markdown).toContain('per month')
    expect(result.markdown).toContain('$1,200')
    expect(result.markdown).toContain('per year')
    expect(result.markdown).toContain('per 2 years')
    expect(result.markdown).toContain('per 3 years')
    expect(result.markdown).toContain('per week')
    expect(result.markdown).toContain('one-time')
    expect(result.markdown).toContain('help@business.example')
    expect(result.markdown).toContain('North Star Studio Ltd')
    expect(result.markdown).toContain(plansUrl)
  })

  it('drops invented prices and cross-offering price mixes that are not proved by nearby evidence', async () => {
    const sourceUrl = 'https://shop.example/catalog/'
    const result = await structureRagWebsiteKnowledge({
      startUrl: 'https://shop.example/',
      callCap: 1,
      pages: [{
        url: sourceUrl,
        title: 'Catalog',
        content: [
          'Starter Box price: $20 one-time.',
          'Premium Box price: $45 one-time.',
        ].join('\n'),
      }],
      generate: async () => JSON.stringify({
        business_summary: [],
        offerings: [],
        pricing: [
          {
            name: 'Starter Box',
            price: '$20',
            billing_period: 'one-time',
            source_url: sourceUrl,
            evidence: 'Starter Box price: $20 one-time.',
          },
          {
            name: 'Starter Box',
            price: '$45',
            billing_period: 'one-time',
            source_url: sourceUrl,
            evidence: 'Premium Box price: $45 one-time.',
          },
          {
            name: 'Premium Box',
            price: '$999',
            billing_period: 'one-time',
            source_url: sourceUrl,
            evidence: 'Premium Box price: $45 one-time.',
          },
        ],
        faqs: [],
        contacts: [],
        legal_details: [],
        important_notes: [],
      }),
    })

    expect(result.markdown).toContain('Starter Box')
    expect(result.markdown).toContain('$20')
    expect(result.markdown).not.toContain('$999')
    expect(result.markdown).not.toContain('## Starter Box\n- Price: $45')
    expect(result.recordsAccepted).toBe(1)
    expect(result.recordsDropped).toBe(2)
  })

  it('keeps the deterministic draft and raw visible evidence when AI structuring fails', async () => {
    const sourceUrl = 'https://clinic.example/services/'
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://clinic.example/',
      pageLimit: 5,
      client: {
        crawl: async () => [{
          markdown: '# Services\n\nDental cleaning costs $80 one-time. Opening hours are Monday to Friday, 9am to 5pm.',
          metadata: { title: 'Services', sourceURL: sourceUrl },
        }],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
      structureKnowledge: async ({ startUrl, pages }) => structureRagWebsiteKnowledge({
        startUrl,
        pages,
        callCap: 1,
        generate: async () => {
          throw new Error('provider unavailable')
        },
      }),
    })

    expect(imported.stats.aiStructuringUsed).toBe(false)
    expect(imported.stats.deterministicFallbackUsed).toBe(true)
    expect(imported.content).toContain('Dental cleaning costs $80 one-time')
    expect(imported.content).toContain('Monday to Friday, 9am to 5pm')
    expect(imported.stats.warnings.join(' ')).toContain('visible Firecrawl evidence was preserved')
  })

  it('places grounded AI structure before the unchanged visible Firecrawl evidence in the review draft', async () => {
    const sourceUrl = 'https://course.example/programs/'
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://course.example/',
      pageLimit: 5,
      client: {
        crawl: async () => [{
          markdown: '# Programs\n\nData Skills Course costs $300 one-time and includes 12 lessons. Contact learn@course.example.',
          metadata: { title: 'Programs', sourceURL: sourceUrl },
        }],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
      structureKnowledge: async ({ startUrl, pages }) => structureRagWebsiteKnowledge({
        startUrl,
        pages,
        callCap: 1,
        generate: async () => JSON.stringify({
          business_summary: [],
          offerings: [{
            name: 'Data Skills Course',
            features: ['12 lessons'],
            source_url: sourceUrl,
            evidence: 'Data Skills Course costs $300 one-time and includes 12 lessons.',
          }],
          pricing: [{
            name: 'Data Skills Course',
            price: '$300',
            billing_period: 'one-time',
            source_url: sourceUrl,
            evidence: 'Data Skills Course costs $300 one-time and includes 12 lessons.',
          }],
          faqs: [],
          contacts: [{
            label: 'Contact email',
            value: 'learn@course.example',
            source_url: sourceUrl,
            evidence: 'Contact learn@course.example.',
          }],
          legal_details: [],
          important_notes: [],
        }),
      }),
    })

    expect(imported.stats.aiStructuringUsed).toBe(true)
    expect(imported.stats.deterministicFallbackUsed).toBe(false)
    expect(imported.content.indexOf('# Structured Website Knowledge')).toBeLessThan(
      imported.content.indexOf('# Raw Visible Firecrawl Evidence'),
    )
    expect(imported.content).toContain('# Services / Products / Plans')
    expect(imported.content).toContain('Data Skills Course')
    expect(imported.content).toContain('$300')
    expect(imported.content).toContain('learn@course.example')
    expect(imported.content).toContain('# Website Knowledge Summary')
    expect(imported.content).toContain('Data Skills Course costs $300 one-time and includes 12 lessons.')
    expect(imported.content).toContain(sourceUrl)
  })

  it('keeps the structuring module generic and isolated from retrieval, embeddings, and WhatsApp', () => {
    expect(structuringSource).not.toMatch(/vpswagon|n8n/i)
    expect(structuringSource).not.toContain("from './chat'")
    expect(structuringSource).not.toContain('embedding-store')
    expect(structuringSource).not.toContain('whatsapp/webhook')
    expect(structuringSource).toContain('for any type of business')
  })
})

