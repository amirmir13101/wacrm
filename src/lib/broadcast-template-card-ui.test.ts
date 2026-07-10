import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const step1 = readFileSync(
  join(process.cwd(), 'src/components/broadcasts/step1-choose-template.tsx'),
  'utf8',
)

describe('broadcast template card UI', () => {
  it('keeps selected template cards readable on the dark CRM green surface', () => {
    expect(step1).toContain("border-[#3ddf84] bg-[#0f3b2b]")
    expect(step1).toContain("isSelected ? 'text-[#d8fff1]' : 'text-slate-400'")
    expect(step1).toContain("isSelected ? 'text-[#a8f5d5]' : 'text-slate-500'")
    expect(step1).not.toContain('bg-[#3ddf84]')
  })

  it('shows broadcast templates as exact name, language, and status labels', () => {
    expect(step1).toContain("{template.name} — {template.language ?? 'No language'} — {template.status ?? 'Unknown'}")
    expect(step1).toContain("{template.language ?? 'No language'}")
    expect(step1).not.toContain("{template.language ?? 'en_US'}")
  })
})
