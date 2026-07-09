import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appDir = join(process.cwd(), 'src/app')

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Meta data deletion public pages', () => {
  it('creates the required instruction and status pages', () => {
    expect(existsSync(join(appDir, 'data-deletion/page.tsx'))).toBe(true)
    expect(existsSync(join(appDir, 'data-deletion/status/page.tsx'))).toBe(true)
  })

  it('renders app-review friendly deletion instructions', () => {
    const source = readSource('src/app/data-deletion/page.tsx')

    expect(source).toContain('Meta Data Deletion')
    expect(source).toContain('Remove Talk Wagon in Meta')
    expect(source).toContain('Facebook app user ID')
    expect(source).toContain('WhatsApp Business Account')
    expect(source).toContain('Stored Meta access tokens')
    expect(source).toContain('billing, tax, security, fraud-prevention')
    expect(source).toContain('support@talkwagon.chat')
  })

  it('renders a safe status page for confirmation codes', () => {
    const source = readSource('src/app/data-deletion/status/page.tsx')

    expect(source).toContain('Data Deletion Status')
    expect(source).toContain('confirmation code')
    expect(source).toContain('Request received or pending review')
    expect(source).toContain('support@talkwagon.chat')
    expect(source).toContain('meta_data_deletion_requests')
  })

  it('keeps data deletion pages on the public root domain and sitemap', () => {
    const domainRouting = readSource('src/lib/domain-routing.ts')
    const sitemap = readSource('src/app/sitemap.ts')

    expect(domainRouting).toContain("'/data-deletion'")
    expect(sitemap).toContain('`${siteUrl}/data-deletion`')
  })

  it('adds the additive storage migration without storing signed requests or secrets', () => {
    const migration = readSource('supabase/migrations/059_meta_data_deletion_requests.sql')

    expect(migration).toContain('meta_data_deletion_requests')
    expect(migration).toContain('confirmation_code')
    expect(migration).toContain('meta_user_id_hash')
    expect(migration).not.toMatch(/\bsigned_request\s+(TEXT|JSONB|JSON)/i)
    expect(migration).not.toMatch(/\baccess_token\s+(TEXT|JSONB|JSON)/i)
  })
})
