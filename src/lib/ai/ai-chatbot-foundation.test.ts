import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('AI chatbot Phase 1 foundation', () => {
  it('creates workspace-scoped chatbot tables with RLS', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_chatbot_settings')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_knowledge_sources')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_knowledge_chunks')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS ai_chatbot_logs')
    expect(migration).toContain('workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE')
    expect(migration).toContain('ALTER TABLE ai_chatbot_settings ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_knowledge_sources ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE ai_chatbot_logs ENABLE ROW LEVEL SECURITY')
  })

  it('adds AI chatbot permissions to defaults and RLS policies', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql')
    const permissions = read('src/lib/team/permissions.ts')
    const permissionUi = read('src/lib/team/permission-ui.ts')

    for (const permission of ['view_ai_chatbot', 'manage_ai_chatbot', 'enable_ai_auto_reply']) {
      expect(migration).toContain(permission)
      expect(permissions).toContain(permission)
      expect(permissionUi).toContain(permission)
    }
  })

  it('routes the dashboard and APIs through permission checks', () => {
    const middleware = read('src/middleware.ts')
    const sidebar = read('src/components/layout/sidebar.tsx')

    expect(middleware).toContain("'/ai-chatbot'")
    expect(middleware).toContain("path.startsWith('/api/ai-chatbot')")
    expect(middleware).toContain("'view_ai_chatbot'")
    expect(middleware).toContain("'manage_ai_chatbot'")
    expect(sidebar).toContain('AI Chatbot')
    expect(sidebar).toContain('view_ai_chatbot')
  })

  it('keeps live auto-reply guarded by plan, provider, opt-out, and human assignment checks', () => {
    const autoReply = read('src/lib/ai/auto-reply.ts')
    const api = read('src/app/api/ai-chatbot/route.ts')

    expect(autoReply).toContain('isOptOutMessage')
    expect(autoReply).toContain('getAiPlanAccess')
    expect(autoReply).toContain('conversation.assigned_agent_id')
    expect(autoReply).toContain('requireProvider: true')
    expect(autoReply).toContain("sender_type: 'bot'")
    expect(api).toContain('canUseAutoReply')
    expect(api).toContain('isAiProviderConfigured')
    expect(api).toContain('enable_ai_auto_reply')
  })

  it('does not add website scraping or vector search in Phase 1', () => {
    const migration = read('supabase/migrations/033_ai_chatbot.sql').toLowerCase()
    const pkg = read('package.json').toLowerCase()

    expect(migration).not.toContain('vector(')
    expect(migration).not.toContain('pgvector')
    expect(pkg).not.toContain('firecrawl')
    expect(pkg).not.toContain('cheerio')
    expect(pkg).not.toContain('puppeteer')
  })
})
