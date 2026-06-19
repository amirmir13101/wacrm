import { describe, expect, it } from 'vitest'

import { detectChanges } from './change-detection'

describe('website knowledge change detection', () => {
  it('treats a first import as entirely new', () => {
    const result = detectChanges(null, '# Services\n\nConsulting is available.')
    expect(result.hasChanges).toBe(true)
    expect(result.changePercent).toBe(100)
  })

  it('detects identical and insignificant content as unchanged', () => {
    const content = `# Policy\n\n${Array.from({ length: 120 }, (_, index) => `detail${index}`).join(' ')}`
    expect(detectChanges(content, content).hasChanges).toBe(false)
    expect(detectChanges(content, `${content} minor`).hasChanges).toBe(false)
  })

  it('detects price and contact changes', () => {
    const price = detectChanges('# Plan\n\nPrice: $10/month.', '# Plan\n\nPrice: $15/month.')
    const contact = detectChanges('# Contact\n\nEmail: old@example.com', '# Contact\n\nEmail: new@example.com')
    expect(price.pricingChanged).toBe(true)
    expect(price.hasChanges).toBe(true)
    expect(contact.contactChanged).toBe(true)
  })

  it('reports added and removed headings with a factual summary', () => {
    const result = detectChanges(
      '# Services\n\nConsulting.\n\n# Old Policy\n\nOld details.',
      '# Services\n\nConsulting.\n\n# New Policy\n\nNew details.',
    )
    expect(result.addedSections).toContain('new policy')
    expect(result.removedSections).toContain('old policy')
    expect(result.summary.length).toBeGreaterThan(0)
  })
})
