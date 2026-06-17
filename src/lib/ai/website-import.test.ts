import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { chunkKnowledgeText, retrieveRelevantChunks } from './chatbot'
import {
  MAX_WEBSITE_DRAFT_CONTENT_LENGTH,
  buildWebsiteKnowledgeDraft,
  cleanHtmlToText,
  crawlWebsiteForKnowledge,
  extractFaqSectionsAsText,
  extractPricingCardsAsText,
  extractTablesAsMarkdown,
  extractWebsiteKnowledgeText,
  normalizeWebsiteUrl,
  parseRobotsTxt,
  shouldSkipWebsiteUrl,
} from './website-import'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function response(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  })
}

describe('AI website knowledge import', () => {
  it('normalizes public http and https URLs and rejects unsupported URLs', () => {
    expect(normalizeWebsiteUrl('example.com/about?x=1#top')).toBe('https://example.com/about')
    expect(normalizeWebsiteUrl('http://example.com/')).toBe('http://example.com/')
    expect(() => normalizeWebsiteUrl('ftp://example.com')).toThrow('Only HTTP and HTTPS')
    expect(() => normalizeWebsiteUrl('http://localhost:3000')).toThrow('public website')
  })

  it('skips external, private, media, checkout, search, and policy URLs', () => {
    const origin = 'https://example.com'
    expect(shouldSkipWebsiteUrl('https://other.com/page', origin)).toBe('external_domain')
    expect(shouldSkipWebsiteUrl('https://example.com/wp-admin', origin)).toBe('private_or_low_value_path')
    expect(shouldSkipWebsiteUrl('https://example.com/checkout', origin)).toBe('private_or_low_value_path')
    expect(shouldSkipWebsiteUrl('https://example.com/search?q=test', origin)).toBe('private_or_low_value_path')
    expect(shouldSkipWebsiteUrl('https://example.com/photo.webp', origin)).toBe('media_or_file_url')
    expect(shouldSkipWebsiteUrl('https://example.com/privacy-policy', origin)).toBe('policy_page_skipped')
    expect(shouldSkipWebsiteUrl('https://example.com/services', origin)).toBeNull()
  })

  it('parses robots.txt disallow rules for the generic crawler', () => {
    expect(parseRobotsTxt('User-agent: *\nDisallow: /private\nDisallow: /cart').disallow).toEqual([
      '/private',
      '/cart',
    ])
  })

  it('cleans HTML into useful page text without scripts, nav, forms, or duplicated boilerplate', () => {
    const text = cleanHtmlToText(`
      <html>
        <head><title>Ignored</title><script>secret()</script></head>
        <body>
          <nav>Home Pricing Login</nav>
          <main><h1>Support plans</h1><p>We help customers with onboarding and WhatsApp CRM setup.</p></main>
          <form><input value="private"></form>
        </body>
      </html>
    `)

    expect(text).toContain('Support plans')
    expect(text).toContain('WhatsApp CRM setup')
    expect(text).not.toContain('secret')
    expect(text).not.toContain('private')
  })

  it('converts HTML pricing tables into markdown and preserves prices, currencies, plan names, and billing periods', () => {
    const markdown = extractTablesAsMarkdown(`
      <table>
        <thead><tr><th>Plan</th><th>Price</th><th>Included Features</th></tr></thead>
        <tbody>
          <tr><td>Free</td><td>$0/month</td><td>Basic CRM access</td></tr>
          <tr><td>Pro</td><td>$5/month now $1/month</td><td>AI chatbot, broadcasts, contacts</td></tr>
          <tr><td>Yearly</td><td>USD 12/year</td><td>Annual hosted access</td></tr>
          <tr><td>Pakistan setup</td><td>PKR 4,999 / Rs 4,999</td><td>Setup support</td></tr>
        </tbody>
      </table>
    `)

    expect(markdown).toContain('| Plan | Price | Included Features |')
    expect(markdown).toContain('| Free | $0/month | Basic CRM access |')
    expect(markdown).toContain('| Pro | $5/month now $1/month | AI chatbot, broadcasts, contacts |')
    expect(markdown).toContain('USD 12/year')
    expect(markdown).toContain('PKR 4,999 / Rs 4,999')
  })

  it('extracts pricing cards, package details, and FAQ accordion content from div layouts', () => {
    const html = `
      <section class="pricing-cards">
        <article class="plan-card">
          <h2>Growth Package</h2>
          <p>Price: £19 monthly</p>
          <ul><li>Team inbox</li><li>Opening hours routing</li></ul>
        </article>
      </section>
      <div id="faq-accordion">
        <h3>Can I import contacts?</h3>
        <p>Yes, customers can import opted-in contacts and keep their data in their workspace.</p>
      </div>
    `

    const pricing = extractPricingCardsAsText(html)
    const faqs = extractFaqSectionsAsText(html)

    expect(pricing).toContain('Growth Package')
    expect(pricing).toContain('£19 monthly')
    expect(pricing).toContain('Opening hours routing')
    expect(faqs).toContain('Can I import contacts?')
    expect(faqs).toContain('opted-in contacts')
  })

  it('combines structured tables/cards/FAQs with plain text for stronger website knowledge', () => {
    const text = extractWebsiteKnowledgeText(`
      <main>
        <h1>Plans</h1>
        <table><tr><th>Plan</th><th>Price</th></tr><tr><td>Pro</td><td>$1/month</td></tr></table>
        <div class="faq"><h2>Support hours?</h2><p>Monday to Friday, 9 AM to 5 PM.</p></div>
      </main>
    `)

    expect(text).toContain('## Structured Tables')
    expect(text).toContain('| Pro | $1/month |')
    expect(text).toContain('## FAQs')
    expect(text).toContain('Monday to Friday')
  })

  it('crawls same-domain pages, honors robots, page limit, duplicates, and failures', async () => {
    const pages = new Map<string, Response>([
      ['https://example.com/robots.txt', response('User-agent: *\nDisallow: /private', { headers: { 'content-type': 'text/plain' } })],
      [
        'https://example.com/sitemap.xml',
        response('<urlset><url><loc>https://example.com/about</loc></url><url><loc>https://example.com/private</loc></url></urlset>', {
          headers: { 'content-type': 'application/xml' },
        }),
      ],
      [
        'https://example.com/',
        response(`
          <html>
            <head><title>Home</title><meta name="description" content="CRM overview"></head>
            <body>
              <main>
                <h1>Talk Wagon CRM</h1>
                <p>Talk Wagon helps teams manage WhatsApp conversations, contacts, broadcasts, automations, and pipelines with clear ownership.</p>
                <p>Business owners can train the chatbot with public website knowledge and use safe handoff rules.</p>
                <a href="/about">About</a><a href="/image.png">Image</a><a href="https://other.com/">Other</a>
              </main>
            </body>
          </html>
        `),
      ],
      [
        'https://example.com/about',
        response(`
          <html>
            <head><title>About</title><link rel="canonical" href="https://example.com/about"></head>
            <body><main><h1>About Talk Wagon</h1><p>Our team supports sales, support, and agency workflows with WhatsApp CRM features, agent permissions, and follow-up visibility.</p><p>Our team supports sales, support, and agency workflows with WhatsApp CRM features, agent permissions, and follow-up visibility.</p></main></body>
          </html>
        `),
      ],
    ])

    const fetchImpl = (async (url: string | URL | Request) => {
      const key = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
      return pages.get(key) ?? response('not found', { status: 404 })
    }) as typeof fetch

    const result = await crawlWebsiteForKnowledge({
      startUrl: 'https://example.com',
      pageLimit: 2,
      fetchImpl,
    })

    expect(result.pagesImported).toBe(2)
    expect(result.pagesSkipped).toBeGreaterThanOrEqual(3)
    expect(result.pages.some((page) => page.skipReason === 'robots_disallowed')).toBe(true)
    expect(result.pages.some((page) => page.skipReason === 'external_domain')).toBe(true)
    expect(result.pages.some((page) => page.skipReason === 'media_or_file_url')).toBe(true)
    expect(result.draftContent).toContain('Talk Wagon CRM')
    expect(result.draftContent).toContain('URL: https://example.com/about')
  })

  it('builds a review draft from imported website pages only', () => {
    const draft = buildWebsiteKnowledgeDraft([
      {
        url: 'https://example.com/a',
        canonicalUrl: 'https://example.com/a',
        title: 'Services',
        metaDescription: 'Service summary',
        rawText: 'raw',
        cleanedText: 'Detailed service text for customers.',
        contentHash: 'a',
        status: 'imported',
        skipReason: null,
        httpStatus: 200,
      },
      {
        url: 'https://example.com/admin',
        canonicalUrl: null,
        title: null,
        metaDescription: null,
        rawText: null,
        cleanedText: null,
        contentHash: null,
        status: 'skipped',
        skipReason: 'private_or_low_value_path',
        httpStatus: null,
      },
    ])

    expect(draft).toContain('Page: Services')
    expect(draft).toContain('# Website Knowledge Summary')
    expect(draft).toContain('## Important Pages Imported')
    expect(draft).toContain('## Business Overview, Services, Pricing, FAQs and Policies')
    expect(draft).toContain('Service summary')
    expect(draft).not.toContain('private_or_low_value_path')
  })

  it('does not silently truncate long website imports before the documented safe limit', () => {
    const longContent = Array.from({ length: 400 }, (_item, index) =>
      `Pricing detail ${index}: Pro plan costs $1/month and regular price is $5/month with automation, broadcasts, contacts, and AI chatbot.`,
    ).join('\n')
    const draft = buildWebsiteKnowledgeDraft([
      {
        url: 'https://example.com/pricing',
        canonicalUrl: 'https://example.com/pricing',
        title: 'Pricing',
        metaDescription: 'Pricing details',
        rawText: longContent,
        cleanedText: longContent,
        contentHash: 'pricing',
        status: 'imported',
        skipReason: null,
        httpStatus: 200,
      },
    ])

    expect(draft.length).toBeGreaterThan(45_000)
    expect(draft.length).toBeLessThanOrEqual(MAX_WEBSITE_DRAFT_CONTENT_LENGTH)
    expect(draft).toContain('Pricing detail 399')
  })

  it('creates chunks from full imported content and can retrieve pricing answers from website knowledge', () => {
    const content = [
      'Website pricing knowledge',
      'Free plan: $0/month for trial users.',
      'Pro Plan: $5/month regular price, limited time offer $1/month.',
      'Lifetime setup: $499 one-time self-hosted setup.',
      'Support package includes WhatsApp team inbox, broadcasts, AI chatbot, and automation workflows.',
    ].join('\n\n')

    const chunks = chunkKnowledgeText(content)
    const relevant = retrieveRelevantChunks('What is the Pro monthly price?', chunks.map((chunk) => ({ chunk_text: chunk })))

    expect(chunks.join('\n')).toContain('$499')
    expect(relevant.join('\n')).toContain('$1/month')
    expect(relevant.join('\n')).toContain('$5/month')
  })

  it('adds website import schema, source type, RLS, API routes, and review UI', () => {
    const migration = read('supabase/migrations/036_ai_website_knowledge_imports.sql')
    const route = read('src/app/api/ai-chatbot/website-import/route.ts')
    const publishRoute = read('src/app/api/ai-chatbot/website-import/[id]/route.ts')
    const sourceRoute = read('src/app/api/ai-chatbot/route.ts')
    const sourceUpdateRoute = read('src/app/api/ai-chatbot/sources/[id]/route.ts')
    const page = read('src/app/(dashboard)/ai-chatbot/page.tsx')

    expect(migration).toContain("source_type IN ('manual', 'faq', 'instructions', 'website')")
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_website_import_jobs')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_website_import_pages')
    expect(migration).toContain('ALTER TABLE ai_website_import_jobs ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain("workspace_has_permission(workspace_id, 'manage_ai_chatbot')")
    expect(route).toContain('crawlWebsiteForKnowledge')
    expect(route).toContain('getWorkspaceTrialStatus')
    expect(route).toContain('TRIAL_IMPORT_LIMIT')
    expect(publishRoute).toContain("action !== 'publish'")
    expect(publishRoute).toContain("sourceType: 'website'")
    expect(publishRoute).toContain('MAX_WEBSITE_DRAFT_CONTENT_LENGTH')
    expect(sourceRoute).toContain('MAX_WEBSITE_DRAFT_CONTENT_LENGTH')
    expect(sourceUpdateRoute).toContain('MAX_WEBSITE_DRAFT_CONTENT_LENGTH')
    expect(page).toContain('Import Website Knowledge')
    expect(page).toContain('Publish to Knowledge Base')
    expect(page).toContain('Website import')
    expect(page).toContain('setState((prev) =>')
    expect(page).toContain('body.source as KnowledgeSource')
  })
})
