import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getFirecrawlCrawlStatus,
  maskFirecrawlApiKey,
  startFirecrawlWebsiteCrawl,
} from './firecrawl'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Firecrawl website import helpers', () => {
  it('masks workspace API keys without exposing the stored key', () => {
    expect(maskFirecrawlApiKey('1234')).toBe('•••• 1234')
    expect(maskFirecrawlApiKey(null)).toBeNull()
  })

  it('starts a same-domain Firecrawl crawl with safe knowledge-import formats', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toMatchObject({
        url: 'https://example.com/',
        limit: 25,
        sitemap: 'include',
        crawlEntireDomain: true,
        allowExternalLinks: false,
        allowSubdomains: false,
        ignoreQueryParameters: true,
        maxConcurrency: 5,
      })
      expect(body.scrapeOptions).toMatchObject({
        formats: ['markdown', 'rawHtml', 'links'],
        onlyMainContent: false,
        blockAds: true,
        proxy: 'auto',
        parsers: [],
      })
      return new Response(JSON.stringify({ success: true, id: 'crawl-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      startFirecrawlWebsiteCrawl({
        apiKey: 'fc-test-key',
        url: 'https://example.com/',
        pageLimit: 25,
      }),
    ).resolves.toEqual({ id: 'crawl-123' })
  })

  it('reads Firecrawl crawl results and follows paginated result URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'completed',
            total: 2,
            completed: 2,
            creditsUsed: 2,
            next: 'https://api.firecrawl.dev/v2/crawl/crawl-123?skip=1',
            data: [{ markdown: 'Page one', metadata: { sourceURL: 'https://example.com/one' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'completed',
            total: 2,
            completed: 2,
            creditsUsed: 2,
            next: null,
            data: [{ markdown: 'Page two', metadata: { sourceURL: 'https://example.com/two' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFirecrawlCrawlStatus('fc-test-key', 'crawl-123')

    expect(result.status).toBe('completed')
    expect(result.creditsUsed).toBe(2)
    expect(result.data).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns scraping progress immediately without following next result pages', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'scraping',
          total: 20,
          completed: 4,
          creditsUsed: 4,
          next: 'https://api.firecrawl.dev/v2/crawl/crawl-123?skip=4',
          data: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getFirecrawlCrawlStatus('fc-test-key', 'crawl-123')

    expect(result).toMatchObject({
      status: 'scraping',
      total: 20,
      completed: 4,
      creditsUsed: 4,
      data: [],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns a useful error when Firecrawl rate limits the workspace account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '12' },
        }),
      ),
    )

    await expect(
      startFirecrawlWebsiteCrawl({
        apiKey: 'fc-test-key',
        url: 'https://example.com/',
        pageLimit: 5,
      }),
    ).rejects.toThrow('retry after 12 seconds')
  })
})
