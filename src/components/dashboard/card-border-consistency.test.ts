import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const normalBorder = 'border-[#3ddf84]/60'
const hoverBorder = 'hover:border-[#3ddf84]/80'

describe('CRM dashboard card border consistency', () => {
  it('keeps the shared Card component on the Dashboard/AI card border style', () => {
    const card = source('src/components/ui/card.tsx')

    expect(card).toContain(normalBorder)
    expect(card).toContain(hoverBorder)
  })

  it('keeps Dashboard home cards as the source-of-truth border style', () => {
    const metricCard = source('src/components/dashboard/metric-card.tsx')
    const conversationsChart = source('src/components/dashboard/conversations-chart.tsx')
    const activityFeed = source('src/components/dashboard/activity-feed.tsx')

    for (const file of [metricCard, conversationsChart, activityFeed]) {
      expect(file).toContain(normalBorder)
      expect(file).toContain(hoverBorder)
    }
  })

  it('keeps AI Chatbot cards on the same green border family', () => {
    const aiChatbot = source('src/app/(dashboard)/ai-chatbot/page.tsx')

    expect(aiChatbot).toContain(normalBorder)
    expect(aiChatbot).toContain(hoverBorder)
  })

  it('applies the same border and hover border to key dashboard areas', () => {
    const files = [
      'src/app/(dashboard)/billing/page.tsx',
      'src/app/(dashboard)/automations/page.tsx',
      'src/app/(dashboard)/flows/page.tsx',
      'src/app/(dashboard)/team/page.tsx',
      'src/components/broadcasts/step2-select-audience.tsx',
      'src/components/pipelines/pipeline-board.tsx',
    ].map(source)

    for (const file of files) {
      expect(file).toContain(normalBorder)
      expect(file).toContain(hoverBorder)
    }
  })
})
