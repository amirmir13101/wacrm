import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { canAccessDashboardPath, defaultPermissionsForRole } from '../team/permissions'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/ai-chatbot/page.tsx'),
  'utf8',
)
const sidebar = readFileSync(
  join(process.cwd(), 'src/components/layout/sidebar.tsx'),
  'utf8',
)
const header = readFileSync(
  join(process.cwd(), 'src/components/layout/header.tsx'),
  'utf8',
)
const providerRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/provider/route.ts'),
  'utf8',
)
const firecrawlRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/firecrawl/route.ts'),
  'utf8',
)
const providerTestRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/provider/test/route.ts'),
  'utf8',
)
const firecrawlTestRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/firecrawl/test/route.ts'),
  'utf8',
)
const logsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/logs/route.ts'),
  'utf8',
)
const autoReplyRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/auto-reply/route.ts'),
  'utf8',
)
const ragSettings = readFileSync(
  join(process.cwd(), 'src/lib/rag/settings.ts'),
  'utf8',
)
const ragAutoReply = readFileSync(
  join(process.cwd(), 'src/lib/rag/auto-reply.ts'),
  'utf8',
)
const webhookRoute = readFileSync(
  join(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'),
  'utf8',
)

describe('RAG settings UI shell', () => {
  it('adds an AI Chatbot dashboard navigation item gated by the new rag permission', () => {
    expect(sidebar).toContain('href: "/ai-chatbot"')
    expect(sidebar).toContain('label: "AI Chatbot"')
    expect(sidebar).toContain('permission: "view_rag_chatbot"')
    expect(header).toContain('"/ai-chatbot": "AI Chatbot"')

    expect(canAccessDashboardPath({ role: 'manager' }, '/ai-chatbot')).toBe(true)
    expect(canAccessDashboardPath({ role: 'agent' }, '/ai-chatbot')).toBe(false)
  })

  it('keeps role defaults aligned with Phase 3 expectations', () => {
    const manager = defaultPermissionsForRole('manager')
    const agent = defaultPermissionsForRole('agent')

    expect(manager.view_rag_chatbot).toBe(true)
    expect(manager.manage_rag_chatbot).toBe(true)
    expect(manager.manage_rag_provider).not.toBe(true)
    expect(agent.view_rag_chatbot).not.toBe(true)
  })

  it('shows only simple customer-facing provider and Firecrawl fields', () => {
    expect(page).toContain('Provider')
    expect(page).toContain('API Key')
    expect(page).toContain('Firecrawl API Key')
    expect(page).toContain('Paste your API key')
    expect(page).toContain('Paste your Firecrawl API key')
    expect(page).toContain('Save')
    expect(page).toContain('Test')

    expect(page).not.toContain('Base URL')
    expect(page).not.toContain('Chat Model')
    expect(page).not.toContain('Embedding Model')
    expect(page).not.toContain('Embedding Dimensions')
    expect(page).not.toContain('Temperature')
    expect(page).not.toContain('Chunk Size')
    expect(page).not.toContain('Similarity Threshold')
    expect(page).not.toContain('Vector Settings')
  })

  it('activates logs and WhatsApp auto reply sections while website import and test chat remain active', () => {
    expect(page).toContain('Add Knowledge')
    expect(page).toContain('Test Chat')
    expect(page).toContain('Ask a question from your saved knowledge...')
    expect(page).toContain('Website Import')
    expect(page).toContain('Import Website')
    expect(page).toContain('Logs')
    expect(page).toContain('WhatsApp Auto Reply')
    expect(page).toContain('Enable AI replies on WhatsApp')
    expect(page).toContain('Do not send message if answer is not found')
    expect(page).toContain('Send fallback message')
    expect(page).not.toContain('Coming Soon')
    expect(page).not.toContain('Not active yet')
  })
})

describe('RAG settings APIs', () => {
  it('uses only new /api/rag routes and new rag permissions', () => {
    const routes = [
      providerRoute,
      firecrawlRoute,
      providerTestRoute,
      firecrawlTestRoute,
      logsRoute,
      autoReplyRoute,
    ].join('\n')

    expect(routes).toContain("requireRagPermission('view_rag_chatbot')")
    expect(routes).toContain("requireRagPermission('manage_rag_provider')")
    expect(routes).toContain("requireRagPermission('enable_rag_auto_reply')")
    expect(routes).not.toContain('view_ai_chatbot')
    expect(routes).not.toContain('manage_ai_chatbot')
    expect(routes).not.toContain('enable_ai_auto_reply')
  })

  it('stores encrypted keys and returns only masked settings views', () => {
    expect(ragSettings).toContain('encrypted_api_key: encrypt(apiKey)')
    expect(ragSettings).toContain('api_key_last4: getSecretLast4(apiKey)')
    expect(ragSettings).toContain('maskedKey')
    expect(ragSettings).toContain('decrypt(data.encrypted_api_key)')
    expect(ragSettings).not.toContain('return apiKey')
    expect(providerRoute).not.toContain('encrypted_api_key')
    expect(firecrawlRoute).not.toContain('encrypted_api_key')
  })

  it('keeps provider test placeholder but uses real Firecrawl account validation', () => {
    expect(providerTestRoute).toContain("testMode: 'placeholder'")
    expect(firecrawlTestRoute).not.toContain("testMode: 'placeholder'")
    expect(firecrawlTestRoute).toContain('testRagFirecrawlSettings')
    expect(ragSettings).toContain('/team/credit-usage')
    expect(providerTestRoute).not.toContain('generateText')
    expect(providerTestRoute).not.toContain('streamText')
    expect(firecrawlTestRoute).not.toContain('/scrape')
    expect(firecrawlTestRoute).not.toContain('/crawl')
  })

  it('adds safe auto reply settings with default disabled behavior', () => {
    expect(autoReplyRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(autoReplyRoute).toContain("requireRagPermission('enable_rag_auto_reply')")
    expect(ragAutoReply).toContain('enabled: row?.enabled === true')
    expect(ragAutoReply).toContain("fallbackMode: normalizeFallbackMode(row?.fallback_mode)")
    expect(ragAutoReply).toContain("RAG_AUTO_REPLY_DEFAULT_FALLBACK")
  })

  it('connects the webhook only through the conservative RAG auto-reply guard', () => {
    expect(webhookRoute).toContain('getRagAutoReplyRuntimeSettings')
    expect(webhookRoute).toContain('answerRagWhatsAppQuestion')
    expect(webhookRoute).toContain('maybeHandleRagAutoReply')
    expect(webhookRoute).toContain('if (!settings?.enabled) return')
  })
})
