import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const notFoundPage = readFileSync(join(process.cwd(), 'src/app/not-found.tsx'), 'utf8')

describe('custom not found page', () => {
  it('provides a branded 404 page with safe recovery links', () => {
    expect(notFoundPage).toContain('404 · Page not found')
    expect(notFoundPage).toContain('This Talk Wagon page does not exist.')
    expect(notFoundPage).toContain('href="/dashboard"')
    expect(notFoundPage).toContain('href="/"')
  })
})
