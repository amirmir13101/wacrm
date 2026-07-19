import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'src/components/marketing/tawk-to-widget.tsx'),
  'utf8',
)

describe('Tawk marketing widget domain guard', () => {
  it('loads only on marketing hosts and never on the CRM app subdomain', () => {
    expect(source).toContain("'talkwagon.chat'")
    expect(source).toContain("'www.talkwagon.chat'")
    expect(source).toContain("if (hostname === 'app.talkwagon.chat') return false")
    expect(source).toContain('isMarketingHost(window.location.hostname.toLowerCase())')
  })

  it('keeps the widget limited to public marketing paths', () => {
    expect(source).toContain('const TAWK_PUBLIC_EXACT_PATHS = new Set')
    expect(source).toContain('const TAWK_PUBLIC_PATH_PREFIXES = [')
    expect(source).toContain('function isTawkPublicPath(pathname: string): boolean')
    expect(source).toContain("'/features/'")
    expect(source).toContain("'/use-cases/'")
    expect(source).toContain("'/pricing'")
    expect(source).toContain("'/contact'")
    expect(source).toContain("'/data-deletion'")
    expect(source).toContain("'/wati-alternative'")
    expect(source).not.toContain("'/dashboard'")
    expect(source).not.toContain("'/settings'")
    expect(source).not.toContain("'/ai-chatbot'")
    expect(source).not.toContain("'/checkout/pro'")
    expect(source).not.toContain("'/checkout/lifetime'")
  })

  it('mounts once from the root layout for future public pages', () => {
    const rootLayout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(rootLayout.split('<TawkToWidget />')).toHaveLength(2)
    expect(source.match(/id="tawk-to-widget"/g)).toHaveLength(1)
  })

  it('covers completed public routes added after the original widget allowlist', () => {
    for (const route of [
      "'/features/'",
      "'/use-cases/'",
      "'/wati-alternative'",
      "'/data-deletion'",
    ]) {
      expect(source).toContain(route)
    }
  })
})
