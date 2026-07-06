import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SITE_URL, getCanonicalUrl, getSiteUrl } from './site-url'

describe('canonical site URL', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the configured deployment domain without a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://crm.example.com/')
    expect(getSiteUrl()).toBe('https://crm.example.com')
  })

  it('uses the Talk Wagon production domain fallback instead of an old client domain', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
  })

  it('builds canonical URLs from the configured site URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://talkwagon.chat/')
    expect(getCanonicalUrl('/pricing')).toBe('https://talkwagon.chat/pricing')
    expect(getCanonicalUrl('/')).toBe('https://talkwagon.chat/')
  })
})
