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

  it('shows restored provider and Firecrawl fields without semantic embedding controls', () => {
    expect(page).toContain('Provider')
    expect(page).toContain('OpenAI')
    expect(page).toContain('OpenRouter')
    expect(page).toContain('Groq')
    expect(page).toContain('Ollama')
    expect(page).toContain('Custom OpenAI-compatible')
    expect(page).toContain('Gemini')
    expect(page).toContain('API Key')
    expect(page).toContain('Model')
    expect(page).toContain('Base URL')
    expect(page).toContain('Firecrawl API Key')
    expect(page).toContain('Paste your API key')
    expect(page).toContain('Paste your Firecrawl API key')
    expect(page).toContain('Save')
    expect(page).toContain('Test')

    expect(page).not.toContain('Embedding Model')
    expect(page).not.toContain('Embedding Dimensions')
    expect(page).not.toContain('Temperature')
    expect(page).not.toContain('Chunk Size')
    expect(page).not.toContain('Similarity Threshold')
    expect(page).not.toContain('Vector Settings')
  })

  it('shows the redesigned AI Chatbot dashboard sections in the approved order', () => {
    const sectionOrder = [
      'data-ai-status-cards',
      'title="AI Provider Settings"',
      'title="Firecrawl Settings"',
      '<h2 className="text-lg font-bold text-white">Website Knowledge Import</h2>',
      '<h2 className="text-lg font-bold text-white">Manual Knowledge Base</h2>',
      '<h2 className="text-lg font-bold text-white">Saved Knowledge</h2>',
      '<h2 className="text-lg font-bold text-white">Chatbot Instructions</h2>',
      '<h2 className="text-lg font-bold text-white">Test Chatbot</h2>',
      '<h2 className="text-lg font-bold text-white">Schedule & Import History</h2>',
      '<h2 className="text-lg font-bold text-white">Chatbot Activity & Unanswered Questions</h2>',
    ].map((label) => page.indexOf(label))

    expect(page).not.toContain('<h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">AI Chatbot</h1>')
    expect(page).not.toContain('Manage AI replies, knowledge, website imports, and chatbot testing.')
    expect(page).not.toContain('Keys stay encrypted and hidden')
    expect(page).toContain('min-h-44 rounded-[2rem] border border-[#245940]')
    expect(page).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(page).toContain('hover:bg-[#ffbd29]')
    expect(page).toContain('Test Connection')
    expect(page).toContain('border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] transition hover:bg-[#123226]')
    expect(page).toContain("border-[#ffbd29]/70 bg-[#ffbd29]")
    expect(page).toContain('AI Provider')
    expect(page).toContain('WhatsApp Auto Reply')
    expect(page).toContain('Knowledge Base')
    expect(page).toContain('Save Knowledge')
    expect(page).toContain('Test Chatbot')
    expect(page).toContain('Ask a question from your saved knowledge...')
    expect(page).toContain('Website Knowledge Import')
    expect(page).toContain('Import Website Knowledge')
    expect(page).toContain('Chatbot Instructions')
    expect(page).toContain('Live WhatsApp auto-reply')
    expect(page).toContain('Tone & Style')
    expect(page).toContain('General Instructions')
    expect(page).toContain('Fallback Message')
    expect(page).toContain('Handoff Message')
    expect(page).toContain('Schedule & Import History')
    expect(page).toContain('Chatbot Activity & Unanswered Questions')
    expect(page).toContain('Answered')
    expect(page).toContain('Fallback / Failed')
    expect(page).toContain('Do not send message if answer is not found')
    expect(page).toContain('Firecrawl credits')
    expect(page).toContain('Credits left')
    expect(page).not.toContain('<dt className="text-[#8bb4a5]">Used</dt>')
    expect(page).not.toContain('<dt className="text-[#8bb4a5]">Plan</dt>')
    expect(page).toContain('WebsiteImportLiveScreen')
    expect(page).toContain('Ready to import website')
    expect(page).toContain('Live import screen')
    expect(page).toContain('Starting website import...')
    expect(page).toContain('Checking website pages...')
    expect(page).toContain('Reading useful website content...')
    expect(page).toContain('Cleaning unnecessary website text...')
    expect(page).toContain('Embeddings pending')
    expect(page).not.toContain('Removing duplicate/footer/widget junk')
    expect(page).not.toContain('Crawling current page')
    expect(page).toContain('ManualKnowledgeStatusScreen')
    expect(page).toContain('Ready to save knowledge')
    expect(page).toContain('Manual save progress')
    expect(page).toContain('manualKnowledgeProgress')
    expect(page).toContain('websiteImportProgress')
    expect(page).toContain('Next step: Prepare for Chatbot when you are ready.')
    expect(page).toContain('selectedKnowledge &&')
    expect(page).toContain('editingKnowledgeId &&')
    expect(page).toContain('Update Knowledge')
    expect(page).toContain('activityVisibleCount')
    expect(page).toContain('Load More')
    expect(page).toContain('Review & Publish')
    expect(page).toContain('Add to Knowledge Base')
    expect(sectionOrder.every((index) => index >= 0)).toBe(true)
    expect(sectionOrder).toEqual([...sectionOrder].sort((a, b) => a - b))
    expect(page).not.toContain('New RAG AI Chatbot')
    expect(page).not.toContain('retrieval debug')
    expect(page).not.toContain('<h2 className="text-lg font-bold text-white">Logs</h2>')
    expect(page).not.toContain('<h2 className="text-lg font-bold text-white">Unanswered Questions</h2>')
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
    expect(ragSettings).toContain('normalizeFirecrawlCreditUsage')
    expect(ragSettings).toContain('remainingCredits')
    expect(ragSettings).toContain('totalCredits')
    expect(ragSettings).toContain('usedCredits')
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
