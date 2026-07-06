import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSiteUrl } from './site-url'

describe('canonical site URL', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the configured deployment domain without a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://crm.example.com/')
    expect(getSiteUrl()).toBe('https://crm.example.com')
  })

  it('uses a safe local fallback instead of an old client domain', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })
})
