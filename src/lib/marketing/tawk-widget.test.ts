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

  it('keeps the widget limited to explicit public marketing paths', () => {
    expect(source).toContain('const TAWK_PUBLIC_PATHS = new Set')
    expect(source).toContain("'/pricing'")
    expect(source).toContain("'/contact'")
    expect(source).not.toContain("'/dashboard'")
    expect(source).not.toContain("'/settings'")
    expect(source).not.toContain("'/ai-chatbot'")
  })
})
