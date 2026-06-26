import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  __ragWebsiteImportTestUtils,
  validateRagWebsiteUrl,
} from './website-import'
import { prepareRagKnowledgeSource, RAG_KNOWLEDGE_CHARACTER_LIMIT } from './knowledge'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const websiteImportRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/website-import/route.ts'),
  'utf8',
)
const websiteImport = readFileSync(
  join(process.cwd(), 'src/lib/rag/website-import.ts'),
  'utf8',
)
const knowledgeStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/knowledge-store.ts'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG Firecrawl website import', () => {
  it('validates URLs for website import', () => {
    expect(validateRagWebsiteUrl('https://example.com')).toBe('https://example.com/')
    expect(validateRagWebsiteUrl('http://example.com/page')).toBe('http://example.com/page')
    expect(() => validateRagWebsiteUrl('not-a-url')).toThrow('Enter a valid website URL.')
    expect(() => validateRagWebsiteUrl('ftp://example.com')).toThrow(
      'Only http and https website URLs are supported.',
    )
  })

  it('extracts markdown/text/title/final URL from Firecrawl responses', () => {
    const extracted = __ragWebsiteImportTestUtils.extractFirecrawlContent({
      success: true,
      data: {
        markdown: '# Hello\n\nSupport email is support@example.com',
        metadata: {
          title: 'Example Support',
          sourceURL: 'https://example.com/support',
        },
      },
    })

    expect(extracted.title).toBe('Example Support')
    expect(extracted.finalUrl).toBe('https://example.com/support')
    expect(extracted.content).toContain('Support email is support@example.com')
  })

  it('discovers and imports multiple public pages from Firecrawl map results', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 10,
      client: {
        map: async () => ({
          success: true,
          links: [
            'https://example.com/',
            'https://www.example.com/pricing',
            'https://example.com/about',
            'https://example.com/contact',
          ],
        }),
        scrape: async (url) => ({
          success: true,
          data: {
            markdown: [
              `# ${url}`,
              ...Array.from({ length: 150 }, (_item, index) => `Useful public business content ${index} for ${url}.`),
              `FINAL PAGE ${url}`,
            ].join('\n'),
            metadata: {
              title: url.includes('pricing') ? 'Pricing' : 'Example',
              sourceURL: url,
            },
          },
        }),
      },
    })

    expect(imported.stats.pagesImported).toBe(4)
    expect(imported.stats.savedCharacters).toBeGreaterThan(14_000)
    expect(imported.content).toContain('FINAL PAGE https://www.example.com/pricing')
    expect(imported.content).toContain('FINAL PAGE https://example.com/contact')
  })

  it('prefers old-style Firecrawl crawl pages with raw HTML extraction when available', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 10,
      client: {
        crawl: async () => [
          {
            markdown: '# Pricing\n\nStarter plan from $10/month.',
            rawHtml: `
              <html>
                <head>
                  <title>Pricing Page</title>
                  <meta name="description" content="Public pricing and support information">
                  <script type="application/ld+json">{"@type":"Organization","name":"Example Ltd","email":"support@example.com"}</script>
                </head>
                <body>
                  <main><h1>Pricing</h1><section><h2>Starter</h2><p>$10/month includes support.</p></section></main>
                  <footer><a href="mailto:support@example.com">Support Email</a><a href="tel:+123456789">Call us</a></footer>
                </body>
              </html>
            `,
            metadata: { title: 'Pricing Page', sourceURL: 'https://example.com/pricing' },
          },
          {
            markdown: `# FAQ\n\nRefund policy is 7 days. ${'Customers can contact support for billing, setup, and service questions. '.repeat(3)}`,
            metadata: { title: 'FAQ', sourceURL: 'https://example.com/faq' },
          },
        ],
        map: async () => {
          throw new Error('map should not be needed when crawl returns pages')
        },
        scrape: async () => {
          throw new Error('scrape should not be needed when crawl returns pages')
        },
      },
    })

    expect(imported.stats.pagesFound).toBe(2)
    expect(imported.stats.pagesImported).toBe(2)
    expect(imported.content).toContain('## Structured Website Data')
    expect(imported.content).toContain('Example Ltd')
    expect(imported.content).toContain('## Contact Links')
    expect(imported.content).toContain('support@example.com')
    expect(imported.content).toContain('+123456789')
  })

  it('structures website knowledge, reduces repeated boilerplate, and preserves global contact facts once', async () => {
    const repeatedFooter = 'Footer: Support email support@example.com WhatsApp https://wa.me/1234567890 Facebook Twitter Instagram'
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 10,
      client: {
        crawl: async () => [
          {
            markdown: `# Home\n\nMain Navigation\nAccessibility widget Increase Text Decrease Text\nExample Hosting provides VPS hosting, web hosting, and managed automation hosting.\n${repeatedFooter}`,
            metadata: { title: 'Home', sourceURL: 'https://example.com/' },
          },
          {
            markdown: `# VPS Pricing\n\n## Plan: Wagon VPS x4\nCurrent price: $5.40/mo\nOriginal price: $6.50/mo\nSpecs: 4GB RAM, 2 Core CPU, 80GB NVMe Storage.\n${repeatedFooter}`,
            metadata: { title: 'VPS Pricing', sourceURL: 'https://example.com/vps/' },
          },
          {
            markdown: `# FAQ\n\n## Question: Are backups included?\nAnswer: Daily backups are included with managed plans.\n${repeatedFooter}`,
            metadata: { title: 'FAQ', sourceURL: 'https://example.com/faq/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('# Global Business Facts')
    expect(imported.content).toContain('support@example.com')
    expect(imported.content).toContain('https://wa.me/1234567890')
    expect(imported.content).toContain('# Plans / Packages / Pricing')
    expect(imported.content).toContain('Wagon VPS x4')
    expect(imported.content).toContain('$5.40/mo')
    expect(imported.content).toContain('4GB RAM')
    expect(imported.content).toContain('# FAQs')
    expect(imported.content).toContain('Are backups included?')
    expect(imported.content).toContain('Daily backups are included')
    expect(imported.content).not.toContain('Accessibility widget Increase Text')
    expect(imported.content.match(/Footer: Support email/g)?.length ?? 0).toBeLessThanOrEqual(1)
    expect(imported.stats.duplicateJunkCharactersRemoved).toBeGreaterThan(0)
  })

  it('skips low-value WordPress, sitemap, client, ticket, cart, and checkout pages after discovery', async () => {
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/hello-world/', 'https://example.com')).toBe('low_value_wordpress_default')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/author/admin/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/category/uncategorized/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/tag/sale/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/sitemap.xml', 'https://example.com')).toBe('sitemap_xml_not_knowledge')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/client-area/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/submit-ticket/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/cart/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/checkout/', 'https://example.com')).toBe('private_path')
  })

  it('removes JavaScript, canvas code, and base64 image junk while keeping business facts', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://clinic.example/',
      pageLimit: 5,
      client: {
        crawl: async () => [
          {
            markdown: `# Clinic Services\n\n<script>function draw(){ const canvas = document.getElementById('x'); window.alert('x') }</script>\ndata:image/png;base64,${'A'.repeat(400)}\nDental Cleaning appointment fee: $80.\nOpening hours: Monday to Friday 9am-5pm.\nPhone: +1 555 100 2000.`,
            metadata: { title: 'Clinic Services', sourceURL: 'https://clinic.example/services/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('Dental Cleaning appointment fee: $80')
    expect(imported.content).toContain('Monday to Friday 9am-5pm')
    expect(imported.content).toContain('+1 555 100 2000')
    expect(imported.content).not.toContain('function draw')
    expect(imported.content).not.toContain('data:image/png;base64')
  })

  it('keeps tables and business categories generic for restaurant, clinic, and ecommerce examples', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://business.example/',
      pageLimit: 10,
      client: {
        crawl: async () => [
          {
            rawHtml: `
              <html><body>
                <h1>Restaurant Menu</h1>
                <table><tr><th>Item</th><th>Price</th></tr><tr><td>Margherita Pizza</td><td>$12</td></tr></table>
              </body></html>
            `,
            metadata: { title: 'Restaurant Menu', sourceURL: 'https://business.example/menu/' },
          },
          {
            markdown: '# Clinic Fees\n\nPhysiotherapy session fee is $45. Appointment booking is available online.',
            metadata: { title: 'Clinic Fees', sourceURL: 'https://business.example/clinic-fees/' },
          },
          {
            markdown: '# Product Catalog\n\nProduct: Travel Backpack\nVariant: 30L\nPrice: $59\nShipping: Free delivery over $100.',
            metadata: { title: 'Product Catalog', sourceURL: 'https://business.example/products/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('Margherita Pizza')
    expect(imported.content).toContain('$12')
    expect(imported.content).toContain('Physiotherapy session fee is $45')
    expect(imported.content).toContain('Travel Backpack')
    expect(imported.content).toContain('Free delivery over $100')
    expect(imported.content).toContain('# Products and Services')
  })

  it('keeps public business pages and blocks private or unrelated URLs', () => {
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/pricing', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/features', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/services', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/contact', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/faq', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/terms', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/privacy', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/refund-policy', 'https://example.com')).toBeNull()

    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/login', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/admin/users', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/checkout', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/wp-admin', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://evil.example.net/pricing', 'https://example.com')).toBe('external_domain')
  })

  it('treats root and www as the same website but rejects other domains', () => {
    expect(__ragWebsiteImportTestUtils.isSameRootOrWww('https://www.example.com/about', 'https://example.com')).toBe(true)
    expect(__ragWebsiteImportTestUtils.isSameRootOrWww('https://example.com/about', 'https://www.example.com')).toBe(true)
    expect(__ragWebsiteImportTestUtils.isSameRootOrWww('https://example.net/about', 'https://example.com')).toBe(false)
  })

  it('caps imported website content at the knowledge limit and reports the cap', () => {
    const pages = Array.from({ length: 12 }, (_, index) => {
      const content = [
        `Page ${index}.`,
        ...Array.from({ length: 2400 }, (_item, lineIndex) => `Large useful business content page ${index} line ${lineIndex}.`),
      ].join('\n')
      return {
        url: `https://example.com/page-${index}`,
        title: `Page ${index}`,
        hash: `hash-${index}`,
        content,
        rawCharacters: content.length,
      }
    })

    const built = __ragWebsiteImportTestUtils.buildWebsiteKnowledgeContent({
      startUrl: 'https://example.com',
      pages,
    })

    expect(built.capped).toBe(true)
    expect(built.savedCharacters).toBeLessThanOrEqual(RAG_KNOWLEDGE_CHARACTER_LIMIT)
    expect(built.content.length).toBeLessThanOrEqual(RAG_KNOWLEDGE_CHARACTER_LIMIT)
  })

  it('does not force content to exactly 500,000 characters when the website has about 150,000 useful characters', async () => {
    const pageText = 'Useful public website service and policy content. '.repeat(1000)
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => Array.from({ length: 4 }, (_item, index) => ({
          markdown: `# Page ${index}\n\n${pageText}\nUnique ending ${index}`,
          metadata: {
            title: `Page ${index}`,
            sourceURL: `https://example.com/page-${index}`,
          },
        })),
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.stats.savedCharacters).toBeGreaterThan(150_000)
    expect(imported.stats.savedCharacters).toBeLessThan(RAG_KNOWLEDGE_CHARACTER_LIMIT)
    expect(imported.stats.capped).toBe(false)
  })

  it('chunks imported large content fully so late imported facts remain searchable', () => {
    const lateFact = 'FINAL IMPORTED FACT: Support escalation goes to final-import@example.com.'
    const content = [
      '# Website Knowledge Import',
      ...Array.from({ length: 210 }, (_, index) =>
        `## Page ${index}\n\n${'Useful imported service detail. '.repeat(25)}`,
      ),
      lateFact,
    ].join('\n\n')
    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Imported website',
      sourceType: 'website',
      sourceUrl: 'https://example.com',
      content,
    })

    expect(prepared.chunks.length).toBeGreaterThan(160)
    expect(prepared.chunks.some((chunk) => chunk.content.includes(lateFact))).toBe(true)
  })

  it('adds the website import API route with workspace permission and no key exposure', () => {
    expect(websiteImportRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(websiteImportRoute).toContain('importRagWebsiteKnowledge')
    expect(websiteImportRoute).toContain('embedRagManualKnowledgeSource')
    expect(websiteImportRoute).toContain('shouldAutoEmbedRagKnowledge')
    expect(websiteImportRoute).toContain('createSkippedRagEmbeddingSummary')
    expect(websiteImportRoute).toContain('embeddingSummary')
    expect(websiteImportRoute).toContain('sanitizeProviderError')
    expect(websiteImportRoute).not.toContain('encrypted_api_key')

    expect(websiteImport).toContain("from('rag_firecrawl_settings')")
    expect(websiteImport).toContain('decrypt(row.encrypted_api_key)')
    expect(websiteImport).toContain('Add your Firecrawl API key first.')
    expect(websiteImport).toContain('https://api.firecrawl.dev/v1/scrape')
    expect(websiteImport).toContain('https://api.firecrawl.dev/v1/map')
    expect(websiteImport).toContain('https://api.firecrawl.dev/v2')
    expect(websiteImport).toContain("sitemap: 'include'")
    expect(websiteImport).toContain('crawlEntireDomain: true')
    expect(websiteImport).toContain("formats: ['markdown', 'rawHtml', 'links']")
    expect(websiteImport).toContain("formats: ['markdown', 'html']")
  })

  it('enforces readable content and the shared 500,000 character limit', () => {
    expect(websiteImport).toContain('no readable website content was found')
    expect(websiteImport).toContain('RAG_KNOWLEDGE_CHARACTER_LIMIT')
    expect(websiteImport).toContain('capped')
  })

  it('saves website sources and chunks in rag tables only', () => {
    expect(knowledgeStore).toContain('createRagWebsiteKnowledge')
    expect(knowledgeStore).toContain("source_type: 'website'")
    expect(knowledgeStore).toContain("from('rag_knowledge_sources')")
    expect(knowledgeStore).toContain("from('rag_knowledge_chunks')")
    expect(knowledgeStore).not.toContain("from('ai_")
    expect(websiteImport).not.toContain("from('ai_")
  })

  it('adds simple website import UI and keeps WhatsApp auto-reply guarded', () => {
    expect(page).toContain('Website Import')
    expect(page).toContain('https://example.com')
    expect(page).toContain('Import Website')
    expect(page).toContain('Website import summary')
    expect(page).toContain('pages imported')
    expect(page).toContain('characters saved')
    expect(page).toContain('Content limit reached')
    expect(page).toContain('Importing website...')
    expect(page).toContain('Reading website content...')
    expect(page).toContain('Add your Firecrawl API key first.')
    expect(page).toContain('/api/rag/website-import')
    expect(page).not.toContain('scrape depth')
    expect(page).not.toContain('crawler settings')
    expect(page).not.toContain('raw Firecrawl')
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
