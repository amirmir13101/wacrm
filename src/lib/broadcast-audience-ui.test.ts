import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const step2SelectAudience = readFileSync(
  join(process.cwd(), 'src/components/broadcasts/step2-select-audience.tsx'),
  'utf8',
)

describe('broadcast audience UI contrast', () => {
  it('uses CRM green selected cards with dark readable selected text', () => {
    expect(step2SelectAudience).toContain("bg-[#3ddf84]")
    expect(step2SelectAudience).toContain("text-[#06170f]")
    expect(step2SelectAudience).toContain("text-[#11442d]")
    expect(step2SelectAudience).not.toContain('border-violet-500 bg-violet-500/5')
    expect(step2SelectAudience).not.toContain("'bg-violet-500/10 text-violet-400'")
  })

  it('keeps unselected audience cards readable on the dark CRM background', () => {
    expect(step2SelectAudience).toContain("border-[#0f5f43]")
    expect(step2SelectAudience).toContain("bg-[#051b13]/80")
    expect(step2SelectAudience).toContain("text-[#b7d7cb]")
  })
})
