import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('dashboard card border styling', () => {
  const cardComponent = readFileSync(join(process.cwd(), 'src/components/ui/card.tsx'), 'utf8')
  const aiChatbotPage = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
    'utf8',
  )
  const dashboardCardFiles = [
    'src/components/dashboard/metric-card.tsx',
    'src/components/dashboard/quick-actions.tsx',
    'src/components/dashboard/activity-feed.tsx',
    'src/components/dashboard/conversations-chart.tsx',
    'src/components/dashboard/pipeline-donut.tsx',
    'src/components/dashboard/skeleton.tsx',
  ].map((file) => readFileSync(join(process.cwd(), file), 'utf8'))

  it('uses the AI Chatbot green border treatment in the shared Card component', () => {
    expect(aiChatbotPage).toContain("border border-[#3ddf84]/60")
    expect(aiChatbotPage).toContain("hover:border-[#3ddf84]/80")
    expect(cardComponent).toContain("border border-[#3ddf84]/60")
    expect(cardComponent).toContain("hover:border-[#3ddf84]/80")
    expect(cardComponent).toContain("shadow-[0_18px_50px_rgba(0,0,0,0.22)]")
    for (const source of dashboardCardFiles) {
      expect(source).toContain("border border-[#3ddf84]/60")
      expect(source).toContain("hover:border-[#3ddf84]/80")
    }
  })
})
