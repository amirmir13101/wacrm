import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildWebsiteKnowledgeDraft,
  cleanHtmlToText,
  crawlWebsiteForKnowledge,
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
    expect(draft).toContain('Service summary')
    expect(draft).not.toContain('private_or_low_value_path')
  })

  it('adds website import schema, source type, RLS, API routes, and review UI', () => {
    const migration = read('supabase/migrations/036_ai_website_knowledge_imports.sql')
    const route = read('src/app/api/ai-chatbot/website-import/route.ts')
    const publishRoute = read('src/app/api/ai-chatbot/website-import/[id]/route.ts')
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
    expect(page).toContain('Import Website Knowledge')
    expect(page).toContain('Publish to Knowledge Base')
    expect(page).toContain('Website import')
  })
})
