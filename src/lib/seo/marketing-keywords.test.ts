import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('public marketing keyword coverage', () => {
  it('keeps core WhatsApp CRM software and team inbox phrases on relevant public pages', () => {
    const home = readSource('src/app/page.tsx')
    const features = readSource('src/app/features/page.tsx')
    const teamInbox = readSource('src/app/features/team-inbox/page.tsx')

    expect(home).toContain('WhatsApp CRM software')
    expect(features).toContain('WhatsApp CRM software')
    expect(teamInbox).toContain('WhatsApp team inbox')
  })

  it('keeps broadcast and marketing keyword phrases on the broadcast page', () => {
    const broadcasts = readSource('src/app/features/broadcasts/page.tsx')

    expect(broadcasts).toContain('WhatsApp broadcast software')
    expect(broadcasts).toContain('WhatsApp broadcast message')
    expect(broadcasts).toContain('WhatsApp marketing tool')
    expect(broadcasts).toContain('WhatsApp marketing software')
    expect(broadcasts).toContain('WhatsApp broadcast limit')
    expect(broadcasts).toContain('How many contacts can be added in a WhatsApp broadcast workflow?')
    expect(broadcasts).toContain('How does WhatsApp broadcast work in Talk Wagon?')
    expect(broadcasts).toContain('example of WhatsApp broadcast message')
  })

  it('keeps automation, chatbot, and Business API phrases on relevant public pages', () => {
    const automation = readSource('src/app/features/automation/page.tsx')
    const flows = readSource('src/app/features/flows/page.tsx')
    const pricing = readSource('src/app/pricing/page.tsx')

    expect(automation).toContain('WhatsApp automation software')
    expect(automation).toContain('WhatsApp chatbot')
    expect(flows).toContain('WhatsApp chatbot')
    expect(pricing).toContain('WhatsApp Business API')
  })
})
