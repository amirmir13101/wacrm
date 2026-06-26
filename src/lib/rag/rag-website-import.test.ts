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
            markdown: `# ${url}\n\n${'Useful public business content. '.repeat(150)}\nFINAL PAGE ${url}`,
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
    const pages = Array.from({ length: 12 }, (_, index) => ({
      url: `https://example.com/page-${index}`,
      title: `Page ${index}`,
      hash: `hash-${index}`,
      content: `Page ${index}. ${'Large useful business content. '.repeat(2000)}`,
    }))

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
