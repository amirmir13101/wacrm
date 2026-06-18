import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { chunkKnowledgeText, retrieveRelevantChunks } from './chatbot'
import {
  MAX_WEBSITE_DRAFT_CONTENT_LENGTH,
  buildWebsiteImportFromFirecrawl,
  buildWebsiteKnowledgeDraft,
  cleanHtmlToText,
  crawlWebsiteForKnowledge,
  extractFaqSectionsAsText,
  extractBusinessDetailsAsText,
  extractBreadcrumbsAsText,
  extractContactLinksAsText,
  extractFooterFactsAsText,
  extractJsonLdAsText,
  extractPageHierarchyAsText,
  extractPageMetadataAsText,
  extractPricingCardsAsText,
  extractTablesAsMarkdown,
  extractWebsiteDocumentMetadata,
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
    expect(shouldSkipWebsiteUrl('https://example.com/privacy-policy', origin)).toBeNull()
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

  it('extracts nested n8n hosting cards with plan name, specs, and monthly prices', () => {
    const pricing = extractPricingCardsAsText(`
      <div id="n8n-price-root">
        <div class="nph"><h2 class="nph-h">Choose The Right n8n Hosting Plan</h2></div>
        <div class="ngrid">
          <div class="ncard">
            <div class="npname">Starter</div>
            <div class="npsub">n8n 2GB Perfect to get started</div>
            <div class="nprow"><span class="npcur">$</span><span class="npamt">0.99</span><span class="npperiod">/mo</span></div>
            <ul class="npfeats">
              <li><span><strong>1 Core</strong> CPU</span></li>
              <li><span><strong>2GB</strong> RAM</span></li>
              <li><span><strong>20GB</strong> NVMe Storage</span></li>
            </ul>
          </div>
          <div class="ncard npop">
            <div class="npname">Basic</div>
            <div class="npsub">n8n 4GB Great for small teams</div>
            <div class="nprow"><span class="npcur">$</span><span class="npamt">2.00</span><span class="npperiod">/mo</span></div>
            <ul class="npfeats">
              <li><span><strong>2 Core</strong> CPU</span></li>
              <li><span><strong>4GB</strong> RAM</span></li>
              <li><span><strong>40GB</strong> NVMe Storage</span></li>
            </ul>
          </div>
        </div>
      </div>
    `)

    expect(pricing).toContain('### Starter')
    expect(pricing).toContain('- Price: $0.99/mo')
    expect(pricing).toContain('2GB RAM')
    expect(pricing).toContain('### Basic')
    expect(pricing).toContain('- Price: $2.00/mo')
    expect(pricing).toContain('4GB RAM')
    expect(pricing).toContain('40GB NVMe Storage')
  })

  it('preserves monthly, quarterly, semi-annual, yearly and multi-year labels when present', () => {
    const pricing = extractPricingCardsAsText(`
      <div class="pricing package-card">
        <h3>Automation Pro</h3>
        <p>Monthly: USD 9/mo</p>
        <p>Quarterly: $24/quarter</p>
        <p>Semi-Annual: PKR 12,000</p>
        <p>Yearly: Rs 20,000 /year</p>
        <p>2-Year: $160</p>
        <p>3-Year: $210</p>
      </div>
    `)

    expect(pricing).toContain('USD 9/mo')
    expect(pricing).toContain('$24/quarter')
    expect(pricing).toContain('Semi-Annual: PKR 12,000')
    expect(pricing).toContain('Rs 20,000 /year')
    expect(pricing).toContain('2-Year: $160')
    expect(pricing).toContain('3-Year: $210')
  })

  it('extracts restaurant menu cards with item price and serving details', () => {
    const menu = extractPricingCardsAsText(`
      <section class="restaurant-menu">
        <article class="menu-item">
          <h3>Chicken Burger</h3>
          <p>$8.99</p>
          <p>Includes fries and drink</p>
        </article>
        <article class="menu-item">
          <h3>Family Pizza Deal</h3>
          <p>$19.99</p>
          <p>Serves 4 people</p>
        </article>
      </section>
    `)

    expect(menu).toContain('Chicken Burger')
    expect(menu).toContain('$8.99')
    expect(menu).toContain('Includes fries and drink')
    expect(menu).toContain('Family Pizza Deal')
    expect(menu).toContain('Serves 4 people')
  })

  it('extracts clinic services, course prices, and ecommerce product cards generically', () => {
    const content = extractPricingCardsAsText(`
      <div class="service-card treatment">
        <h3>Dental Cleaning</h3><p>Price: $50</p><p>Duration: 30 minutes</p><p>Appointment required</p>
      </div>
      <div class="course-card program">
        <h3>English Speaking Course</h3><p>PKR 12,000</p><p>Duration: 8 weeks</p>
      </div>
      <div class="product-card">
        <h3>Wireless Headphones</h3><p>USD 79</p><p>Free delivery</p>
      </div>
    `)

    expect(content).toContain('Dental Cleaning')
    expect(content).toContain('$50')
    expect(content).toContain('30 minutes')
    expect(content).toContain('English Speaking Course')
    expect(content).toContain('PKR 12,000')
    expect(content).toContain('Wireless Headphones')
    expect(content).toContain('USD 79')
  })

  it('extracts business hours, locations, booking, delivery, and return policies', () => {
    const details = extractBusinessDetailsAsText(`
      <section class="opening-hours"><h2>Opening Hours</h2><p>Monday-Friday: 9 AM-6 PM</p></section>
      <section class="booking-info"><h2>Appointments</h2><p>Booking is required.</p></section>
      <section class="branch-location"><h2>Downtown Branch</h2><p>12 Main Road, Lahore</p></section>
      <section class="delivery-policy"><h2>Delivery</h2><p>Delivery takes 2-3 business days.</p></section>
      <section class="return-policy"><h2>Returns</h2><p>Returns are accepted within 14 days.</p></section>
    `)

    expect(details).toContain('## Business Hours and Booking')
    expect(details).toContain('Monday-Friday: 9 AM-6 PM')
    expect(details).toContain('Booking is required')
    expect(details).toContain('## Contact and Locations')
    expect(details).toContain('12 Main Road, Lahore')
    expect(details).toContain('## Delivery, Returns and Policies')
    expect(details).toContain('Returns are accepted within 14 days')
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

  it('extracts JSON-LD schema.org facts without depending on one business industry', () => {
    const structured = extractJsonLdAsText(`
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "name": "North Star Works",
              "telephone": "+1 555 0100",
              "email": "hello@example.com",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "14 Market Street",
                "addressLocality": "Austin"
              }
            },
            {
              "@type": "Offer",
              "name": "Priority Support",
              "price": "49.00",
              "priceCurrency": "USD",
              "description": "Response within two business hours"
            }
          ]
        }
      </script>
    `)

    expect(structured).toContain('North Star Works')
    expect(structured).toContain('Telephone: +1 555 0100')
    expect(structured).toContain('Street Address: 14 Market Street')
    expect(structured).toContain('Priority Support')
    expect(structured).toContain('Price: 49.00')
    expect(structured).toContain('Price Currency: USD')
  })

  it('extracts metadata, Open Graph values, breadcrumbs, and contact links', () => {
    const html = `
      <html>
        <head>
          <title>Acme Services</title>
          <meta name="description" content="Professional support and repairs">
          <meta property="og:title" content="Acme Service Center">
          <meta property="og:locale" content="en_US">
          <link rel="canonical" href="/services">
        </head>
        <body>
          <nav aria-label="Breadcrumb"><a href="/">Home</a><a href="/services">Services</a></nav>
          <a href="tel:+15550100">Call our team</a>
          <a href="mailto:help@example.com?subject=Website">Email support</a>
        </body>
      </html>
    `
    const metadata = extractWebsiteDocumentMetadata(html, 'https://example.com/start')
    const metadataText = extractPageMetadataAsText(html, 'https://example.com/start')
    const breadcrumbs = extractBreadcrumbsAsText(html)
    const contacts = extractContactLinksAsText(html)

    expect(metadata.title).toBe('Acme Services')
    expect(metadata.description).toBe('Professional support and repairs')
    expect(metadata.canonicalUrl).toBe('https://example.com/services')
    expect(metadata.openGraph['og:title']).toBe('Acme Service Center')
    expect(metadataText).toContain('Open Graph Title: Acme Service Center')
    expect(breadcrumbs).toContain('Home > Services')
    expect(contacts).toContain('Phone: Call our team: +15550100')
    expect(contacts).toContain('Email: Email support: help@example.com')
  })

  it('preserves heading hierarchy and footer business facts before boilerplate cleanup', () => {
    const html = `
      <main>
        <h1>Customer Information</h1>
        <section>
          <h2>How It Works</h2>
          <p>Choose an option and submit your request.</p>
          <h3>Response Time</h3>
          <p>Most requests receive a reply within one business day.</p>
        </section>
      </main>
      <footer>
        <address>14 Market Street, Austin</address>
        <p>Monday-Friday: 8 AM-5 PM</p>
        <a href="tel:+15550100">+1 555 0100</a>
        <a href="mailto:hello@example.com">hello@example.com</a>
      </footer>
    `

    const hierarchy = extractPageHierarchyAsText(html)
    const footer = extractFooterFactsAsText(html)
    const cleaned = cleanHtmlToText(html)

    expect(hierarchy).toContain('## Customer Information')
    expect(hierarchy).toContain('### How It Works')
    expect(hierarchy).toContain('#### Response Time')
    expect(hierarchy).toContain('within one business day')
    expect(footer).toContain('14 Market Street, Austin')
    expect(footer).toContain('Monday-Friday: 8 AM-5 PM')
    expect(footer).toContain('hello@example.com')
    expect(cleaned).not.toContain('14 Market Street')
  })

  it('detects repeated information cards from DOM structure even with neutral generated classes', () => {
    const cards = extractPricingCardsAsText(`
      <section class="x-19a">
        <div class="z-001">
          <h3>Standard Consultation</h3>
          <p>USD 45</p>
          <p>30 minute session with a specialist</p>
        </div>
        <div class="z-002">
          <h3>Extended Consultation</h3>
          <p>USD 75</p>
          <p>60 minute session with a specialist</p>
        </div>
      </section>
    `)

    expect(cards).toContain('Standard Consultation')
    expect(cards).toContain('USD 45')
    expect(cards).toContain('30 minute session')
    expect(cards).toContain('Extended Consultation')
    expect(cards).toContain('USD 75')
  })

  it('builds one general knowledge document from metadata, structured data, sections, cards, and footer facts', () => {
    const text = extractWebsiteKnowledgeText(`
      <html>
        <head>
          <title>Willow & Co</title>
          <meta property="og:description" content="Appointments and customer support">
        </head>
        <body>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Organization","name":"Willow & Co","email":"team@willow.example"}
          </script>
          <main>
            <h1>Our Options</h1>
            <div class="row-a">
              <article class="unit-a"><h2>Essential</h2><p>$25</p><p>Includes email support</p></article>
              <article class="unit-b"><h2>Complete</h2><p>$60</p><p>Includes priority support</p></article>
            </div>
          </main>
          <footer><p>Open Monday-Saturday, 9 AM-6 PM</p><address>5 River Road</address></footer>
        </body>
      </html>
    `, 'https://willow.example/')

    expect(text).toContain('## Page Metadata')
    expect(text).toContain('Willow & Co')
    expect(text).toContain('## Structured Website Data')
    expect(text).toContain('Essential')
    expect(text).toContain('$25')
    expect(text).toContain('## Page Content by Section')
    expect(text).toContain('## Footer Information')
    expect(text).toContain('5 River Road')
  })

  it('converts Firecrawl markdown, raw HTML, and metadata into the existing review draft', () => {
    const result = buildWebsiteImportFromFirecrawl({
      startUrl: 'https://example.com',
      pages: [
        {
          markdown: '# Services\n\nPriority support costs **$49/month**.',
          rawHtml: `
            <html>
              <head><title>Services</title></head>
              <body>
                <main><h1>Services</h1><p>Priority support costs $49/month.</p></main>
                <footer><p>Open Monday-Friday, 9 AM-5 PM</p></footer>
              </body>
            </html>
          `,
          metadata: {
            sourceURL: 'https://example.com/services',
            title: 'Services',
            description: 'Service packages',
            statusCode: 200,
          },
        },
      ],
    })

    expect(result.pagesImported).toBe(1)
    expect(result.pages[0]?.canonicalUrl).toBe('https://example.com/services')
    expect(result.draftContent).toContain('Priority support costs')
    expect(result.draftContent).toContain('$49/month')
    expect(result.draftContent).toContain('Open Monday-Friday')
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

  it('limits saved knowledge and website drafts to 100,000 characters', () => {
    expect(MAX_WEBSITE_DRAFT_CONTENT_LENGTH).toBe(100_000)
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
    expect(route).toContain('startFirecrawlWebsiteCrawl')
    expect(route).toContain('resolveFirecrawlApiKey')
    expect(publishRoute).toContain('getFirecrawlCrawlStatus')
    expect(publishRoute).toContain('buildWebsiteImportFromFirecrawl')
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
