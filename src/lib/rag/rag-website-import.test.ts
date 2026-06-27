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
    expect(validateRagWebsiteUrl('example.com')).toBe('https://example.com/')
    expect(() => validateRagWebsiteUrl('http://localhost')).toThrow('Enter a public website URL.')
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

    expect(imported.content).toContain('# Business Profile')
    expect(imported.content).toContain('# Contact & Support')
    expect(imported.content).toContain('support@example.com')
    expect(imported.content).toContain('https://wa.me/1234567890')
    expect(imported.content).toContain('# Website Knowledge Summary')
    expect(imported.content).toContain('## Important Pages Imported')
    expect(imported.content).toContain('Wagon VPS x4')
    expect(imported.content).toContain('$5.40/mo')
    expect(imported.content).toContain('4GB RAM')
    expect(imported.content).toContain('### Page: FAQ')
    expect(imported.content).toContain('Are backups included?')
    expect(imported.content).toContain('Daily backups are included')
    expect(imported.content).not.toContain('Accessibility widget Increase Text')
    expect(imported.content.match(/Footer: Support email/g)?.length ?? 0).toBeGreaterThan(0)
    expect(imported.stats.duplicateJunkCharactersRemoved).toBeGreaterThan(0)
  })

  it('skips low-value WordPress, sitemap, client, ticket, cart, and checkout pages after discovery', async () => {
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/hello-world/', 'https://example.com')).toBeNull()
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/author/admin/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/category/uncategorized/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/tag/sale/', 'https://example.com')).toBe('low_value_archive_or_feed')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/sitemap.xml', 'https://example.com')).toBe('sitemap_xml_not_knowledge')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/client-area/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/submit-ticket/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/cart/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/checkout/', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/panel/submitticket.php', 'https://example.com')).toBe('private_path')
    expect(__ragWebsiteImportTestUtils.unsafeWebsiteSkipReason('https://example.com/clientarea.php', 'https://example.com')).toBe('private_path')
  })

  it('classifies phones, WhatsApp links, IPs, prices, and technical specs separately', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => [
          {
            markdown: [
              '# Contact and VPS Locations',
              'Support phone: +44 7478 060494',
              'WhatsApp support: https://wa.me/447478060494',
              'Singapore Test IP: 45.38.210.3',
              'SVG viewBox 0 0 30 20 should not be a phone.',
              'Wagon VPS x8 price is $7.04/mo, original price $8.80/mo.',
              'Specs: 8GB RAM, 4 Core CPU, 2048 IOPS, 160GB NVMe Storage.',
            ].join('\n'),
            metadata: { title: 'Contact and Locations', sourceURL: 'https://example.com/locations/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('Phone numbers: +447478060494')
    expect(imported.content).toContain('WhatsApp links: https://wa.me/447478060494')
    expect(imported.content).toContain('IP: 45.38.210.3')
    expect(imported.content).not.toContain('Phone numbers: 45.38.210.3')
    expect(imported.content).not.toContain('Phone numbers: 2048')
    expect(imported.content).not.toContain('Phone numbers: 0 0 30 20')
    expect(imported.stats.structuredRecords.contacts).toBeGreaterThan(0)
    expect(imported.stats.structuredRecords.testEndpoints).toBeGreaterThan(0)
  })

  it('does not classify useful product pages as policies because of footer policy links', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => [
          {
            markdown: [
              '# VPS Hosting',
              'Wagon VPS x12 is for production workloads.',
              'Current price: $9.20/mo.',
              'Specs: 12GB RAM, 6 Core CPU, 240GB NVMe Storage.',
              '[Privacy Policy](https://example.com/privacy-policy/) [Refund Policy](https://example.com/refund-policy/)',
            ].join('\n'),
            metadata: { title: 'VPS Hosting', sourceURL: 'https://example.com/vps/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('# Website Knowledge Summary')
    expect(imported.content).toContain('### Page: VPS Hosting')
    expect(imported.content).toContain('Wagon VPS x12')
    expect(imported.content).not.toContain('# Policies\n\n## Page: VPS Hosting')
  })

  it('uses map plus batch scrape fallback when crawl is unavailable', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => {
          throw new Error('crawl failed')
        },
        map: async () => ({
          success: true,
          links: ['https://example.com/pricing', 'https://example.com/contact'],
        }),
        batchScrape: async (urls) => urls.map((url) => ({
          markdown: `# ${url}\n\nUseful page content for ${url}. Support email support@example.com. Price: $20/month.`,
          metadata: { title: url.includes('pricing') ? 'Pricing' : 'Contact', sourceURL: url },
        })),
        scrape: async () => {
          throw new Error('single scrape should not be needed')
        },
      },
    })

    expect(imported.stats.firecrawlModesUsed).toEqual(expect.arrayContaining(['crawl', 'fallback', 'map', 'batch_scrape']))
    expect(imported.stats.warnings.join(' ')).toContain('map/batch/scrape fallback')
    expect(imported.content).toContain('support@example.com')
    expect(imported.content).toContain('$20/month')
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

  it('removes Elementor, accessibility, sitemap, chat widget, nav JSON, and canvas fragments from imported knowledge', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => [
          {
            markdown: [
              '# VPS Plans',
              'Sitemap',
              'Text',
              'Visual',
              'Opens Chat This icon Opens the chat window',
              'Ally by Elementor go.elementor.com',
              '"library":"fa-solid"},"toggle":"burger"}" data-widget_type="nav-menu.default">',
              'p.t+=p.speed',
              'if(p.t>1)p.t=0',
              'landPoly(c)',
              '})();',
              'Wagon VPS x12 current price is $9.20/mo with 12GB RAM, 6 Core CPU, and 240GB NVMe Storage.',
            ].join('\n'),
            rawHtml: `
              <html>
                <body>
                  <nav data-widget_type="nav-menu.default">{"library":"fa-solid"},"toggle":"burger"}</nav>
                  <main>
                    <h1>VPS Plans</h1>
                    <script>p.t+=p.speed; if(p.t>1)p.t=0; landPoly(c);</script>
                    <section class="pricing-card">
                      <h2>Wagon VPS x12</h2>
                      <p>Starting at: $9.20/mo</p>
                      <p><s>$11.50</s> 20% OFF</p>
                      <p>12GB RAM, 6 Core CPU, 240GB NVMe Storage</p>
                    </section>
                  </main>
                </body>
              </html>
            `,
            metadata: { title: 'VPS Plans', sourceURL: 'https://example.com/vps/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('Wagon VPS x12')
    expect(imported.content).toContain('$9.20/mo')
    expect(imported.content).toContain('12GB RAM')
    expect(imported.content).not.toContain('Sitemap')
    expect(imported.content).not.toContain('Opens Chat This icon')
    expect(imported.content).not.toContain('Ally by Elementor')
    expect(imported.content).not.toContain('go.elementor.com')
    expect(imported.content).not.toContain('data-widget_type')
    expect(imported.content).not.toContain('fa-solid')
    expect(imported.content).not.toContain('p.t+=')
    expect(imported.content).not.toContain('landPoly')
  })

  it('classifies terms, privacy, and refund pages only as policies even when policy text mentions prices', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 10,
      client: {
        crawl: async () => [
          {
            markdown: '# Terms and Conditions\n\nRefunds are handled according to billing terms. Prices may change at renewal.',
            metadata: { title: 'Terms and Conditions', sourceURL: 'https://example.com/terms-and-conditions/' },
          },
          {
            markdown: '# Refund Policy\n\nCustomers may cancel according to the refund policy. Plan pricing is not refunded after service use.',
            metadata: { title: 'Refund Policy', sourceURL: 'https://example.com/refund-policy/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    expect(imported.content).toContain('# Website Knowledge Summary')
    expect(imported.content).toContain('### Page: Terms and Conditions')
    expect(imported.content).toContain('### Page: Refund Policy')
    expect(imported.content).not.toContain('# Plans / Packages / Pricing\n\n## Page: Terms and Conditions')
    expect(imported.content).not.toContain('# Plans / Packages / Pricing\n\n## Page: Refund Policy')
  })

  it('keeps legacy DOM pricing cards as one clean block with plan, current/original price, discount, specs, and order link', async () => {
    const imported = await __ragWebsiteImportTestUtils.importWebsiteWithClient({
      startUrl: 'https://example.com/',
      pageLimit: 5,
      client: {
        crawl: async () => [
          {
            rawHtml: `
              <html><body>
                <main>
                  <section class="pricing-grid">
                    <article class="plan-card">
                      <h2>Ultimate Hosting</h2>
                      <p>Starting at:</p>
                      <p>$2.70/mo</p>
                      <p><del>$3.00</del> 10% OFF</p>
                      <ul>
                        <li>Unlimited disk space</li>
                        <li>Unlimited email accounts</li>
                        <li>Free SSL and backups</li>
                      </ul>
                      <a href="/order/ultimate-hosting">Order Now</a>
                    </article>
                  </section>
                </main>
                <footer><a href="/privacy-policy/">Privacy Policy</a><a href="/refund-policy/">Refund Policy</a></footer>
              </body></html>
            `,
            metadata: { title: 'Web Hosting Plans', sourceURL: 'https://example.com/web-hosting/' },
          },
        ],
        map: async () => ({ success: true, links: [] }),
        scrape: async () => ({ success: true, data: { markdown: '' } }),
      },
    })

    const planIndex = imported.content.indexOf('Ultimate Hosting')
    const planBlock = imported.content.slice(planIndex, planIndex + 800)
    expect(planBlock).toContain('$2.70/mo')
    expect(planBlock).toContain('original price $3.00')
    expect(planBlock).toContain('Unlimited disk space')
    expect(planBlock).toContain('Unlimited email accounts')
    expect(planBlock).toContain('Free SSL and backups')
    expect(planBlock).toContain('Order Now')
    expect(imported.content).not.toContain('# Policies\n\n## Page: Web Hosting Plans')
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
    expect(imported.content).toContain('# Website Knowledge Summary')
    expect(imported.content).toContain('### Page: Product Catalog')
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
        links: [],
        qualityScore: 80,
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

  it('chunks structured sections so plan price/specs and FAQ answers stay together', () => {
    const content = [
      '# Website Knowledge Import',
      '# Plans / Packages / Pricing',
      '## Page: VPS Plans',
      'URL: https://example.com/vps/',
      'Important facts:',
      'Plan: Wagon VPS x4',
      'Current price: $5.40/mo',
      'Specs: 4GB RAM, 2 Core CPU, 80GB NVMe Storage',
      '# FAQs',
      '## Page: FAQ',
      'Question: Are backups included?',
      'Answer: Daily backups are included.',
    ].join('\n\n')
    const prepared = prepareRagKnowledgeSource({
      workspaceId: 'workspace-1',
      title: 'Structured website',
      sourceType: 'website',
      sourceUrl: 'https://example.com',
      content,
    })

    const planChunk = prepared.chunks.find((chunk) => chunk.content.includes('Wagon VPS x4'))
    expect(planChunk?.content).toContain('$5.40/mo')
    expect(planChunk?.content).toContain('4GB RAM')
    const faqChunk = prepared.chunks.find((chunk) => chunk.content.includes('Are backups included?'))
    expect(faqChunk?.content).toContain('Daily backups are included.')
  })

  it('adds the website import API route with workspace permission and no key exposure', () => {
    expect(websiteImportRoute).toContain("requireRagPermission('manage_rag_chatbot')")
    expect(websiteImportRoute).toContain('createRagWebsiteImportDraft')
    expect(websiteImportRoute).toContain('createRagWebsiteImportJob')
    expect(websiteImportRoute).toContain('createSkippedRagEmbeddingSummary')
    expect(websiteImportRoute).toContain('embeddingSummary')
    expect(websiteImportRoute).toContain('draftReady')
    expect(websiteImportRoute).not.toContain('embedRagManualKnowledgeSource')
    expect(websiteImportRoute).not.toContain('shouldAutoEmbedRagKnowledge')
    expect(websiteImportRoute).not.toContain('encrypted_api_key')

    expect(websiteImport).toContain("from('rag_firecrawl_settings')")
    expect(websiteImport).toContain('decrypt(row.encrypted_api_key)')
    expect(websiteImport).toContain('Add your Firecrawl API key first.')
    expect(websiteImport).toContain('https://api.firecrawl.dev/v2')
    expect(websiteImport).toContain("firecrawlRequest<FirecrawlMapResponse>('/map'")
    expect(websiteImport).toContain("firecrawlRequest<FirecrawlScrapeResponse>('/scrape'")
    expect(websiteImport).toContain("firecrawlRequest<FirecrawlBatchScrapeResponse>('/batch/scrape'")
    expect(websiteImport).toContain("sitemap: 'include'")
    expect(websiteImport).toContain('crawlEntireDomain: true')
    expect(websiteImport).toContain("formats: ['markdown', 'rawHtml', 'links']")
    expect(websiteImport).toContain("formats: ['markdown', 'html', 'links']")
  })

  it('enforces readable content and the shared 500,000 character limit', () => {
    expect(websiteImport).toContain('no readable website content was found')
    expect(websiteImport).toContain('RAG_KNOWLEDGE_CHARACTER_LIMIT')
    expect(websiteImport).toContain('capped')
    expect(websiteImport).toContain('Firecrawl API key is missing, invalid, or rejected.')
    expect(websiteImport).toContain('Firecrawl credits or billing issue.')
    expect(websiteImport).toContain('Firecrawl rate limit reached.')
    expect(websiteImport).toContain('Firecrawl service is temporarily unavailable.')
    expect(websiteImport).toContain('shouldRetryFirecrawl')
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
    expect(page).toContain('Website Knowledge Import')
    expect(page).toContain('https://example.com')
    expect(page).toContain('Import Website Knowledge')
    expect(page).toContain('WebsiteImportLiveScreen')
    expect(page).toContain('Live import screen')
    expect(page).toContain('Waiting for website URL')
    expect(page).toContain('Discovering sitemap/pages')
    expect(page).toContain('Removing duplicate/footer/widget junk')
    expect(page).toContain('Embeddings pending')
    expect(page).toContain('The import creates a review draft and chunks only.')
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
