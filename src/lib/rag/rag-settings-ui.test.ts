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
const providerModelsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/provider-models/route.ts'),
  'utf8',
)
const providerConfig = readFileSync(
  join(process.cwd(), 'src/lib/rag/provider-config.ts'),
  'utf8',
)
const providerModels = readFileSync(
  join(process.cwd(), 'src/lib/rag/provider-models.ts'),
  'utf8',
)
const websiteImport = readFileSync(
  join(process.cwd(), 'src/lib/rag/website-import.ts'),
  'utf8',
)
const firecrawlTestRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/firecrawl/test/route.ts'),
  'utf8',
)
const websiteImportRoute = readFileSync(
  join(process.cwd(), 'src/app/api/rag/website-import/route.ts'),
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
const ragDashboardStore = readFileSync(
  join(process.cwd(), 'src/lib/rag/dashboard-store.ts'),
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

  it('shows a simplified provider setup without model or advanced controls', () => {
    expect(page).toContain('Provider')
    expect(providerConfig).toContain("label: 'OpenAI'")
    expect(providerConfig).toContain("label: 'OpenRouter'")
    expect(providerConfig).toContain("label: 'Ollama'")
    expect(providerConfig).toContain("label: 'Gemini'")
    expect(providerConfig).toContain('SIMPLE_RAG_PROVIDER_TYPES')
    expect(providerConfig).toContain("'openai'")
    expect(providerConfig).toContain("'openrouter'")
    expect(providerConfig).toContain("'ollama'")
    expect(providerConfig).toContain("'gemini'")
    expect(page).toContain('{providerConfig.label} API Key')
    expect(page).toContain('Ollama server URL')
    expect(page).toContain('The CRM chooses the best default models automatically.')
    expect(page).toContain('providerEmbeddingGuidance')
    expect(page).not.toContain('Search models...')
    expect(page).not.toContain('Add Custom Model')
    expect(page).not.toContain('Advanced Settings')
    expect(page).not.toContain('Custom Base URL')
    expect(page).not.toContain('Embedding model</span>')
    expect(page).not.toContain('Dimensions</span>')
    expect(page).not.toContain('fetch(`/api/rag/provider-models')
    expect(page).toContain('Firecrawl API Key')
    expect(page).toContain('Paste your API key')
    expect(page).toContain('Paste your Firecrawl API key')
    expect(page).toContain('Save')
    expect(page).toContain('Test')

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
    expect(page).toContain('chatbotCardBorderClass')
    expect(page).toContain('chatbotPanelBorderClass')
    expect(page).toContain('chatbotWarningCardClass')
    expect(page).toContain('chatbotStatusIconClass')
    expect(page).toContain('border border-[#3ddf84]/60')
    expect(page).toContain('hover:border-[#3ddf84]/80')
    expect(page).toContain('border border-[#ffbd29]/55')
    expect(page).toContain('hover:border-[#ffbd29]/75')
    expect(page).toContain("card.tone === 'good'")
    expect(page).toContain('min-h-44 rounded-[2rem]')
    expect(page).not.toContain('min-h-44 rounded-[2rem] border border-[#245940]')
    expect(page).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(page).toContain('hover:bg-[#ffbd29]')
    expect(page).toContain('brandDisabledSave')
    expect(page).toContain('saveDisabled={!firecrawlKey.trim()}')
    expect(page).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
    expect(page).toContain("border-[#3ddf84]/70 bg-[#3ddf84] text-[#07130e]")
    expect(page).toContain('Test Connection')
    expect(page).toContain('border border-[#315846] px-3 text-xs font-bold text-[#d8fff1] transition hover:bg-[#123226]')
    expect(page).toContain("border-[#ffbd29]/70 bg-[#ffbd29]")
    expect(page).toContain('AI Provider')
    expect(page).toContain('WhatsApp Auto Reply')
    expect(page).toContain('Knowledge Base')
    expect(page).toContain("autoReplyOn ? 'On' : 'Off'")
    expect(page).toContain("statusLabel(status?.provider.lastTestStatus")
    expect(page).toContain("knowledgeReady ? 'Ready' : failedEmbeddings > 0 ? 'Issues' : 'Automatic'")
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
    expect(page).toContain('<span className="text-sm font-bold text-[#a9c6bb]">Credits left:</span>')
    expect(page).toContain('<span className="text-right text-sm font-black text-emerald-100">{creditValue}</span>')
    expect(page).toContain('`${remaining.toLocaleString()} Credits`')
    expect(page).toContain('FirecrawlActivityPanel')
    expect(page).toContain('activities={importHistory.slice(0, 2)}')
    expect(page).not.toContain('activities={importHistory.slice(0, 5)}')
    expect(page).toContain('Latest 2')
    expect(page).toContain('View All')
    expect(page).toContain('FirecrawlActivityModal')
    expect(page).toContain('Firecrawl Activity')
    expect(page).toContain('FirecrawlActivityDetailsModal')
    expect(page).toContain('Activity Details')
    expect(page).toContain("['Credit used', typeof activity.creditsUsed === 'number' ? activity.creditsUsed.toLocaleString() : '—']")
    expect(page).toContain("['Page count', activity.pagesFound > 0 ? `${activity.pagesFound.toLocaleString()} found` : '—']")
    expect(page).toContain('onClick={() => onViewDetails(activity)}')
    expect(page).toContain('Recent Firecrawl website imports for this workspace.')
    expect(page).toContain('Endpoint')
    expect(page).toContain('URL')
    expect(page).toContain('Status')
    expect(page).toContain('# credits')
    expect(page).toContain('Time')
    expect(page).toContain('Actions')
    expect(page).toContain('Loading recent activity...')
    expect(page).toContain('Could not load Firecrawl activity.')
    expect(page).toContain('No Firecrawl activity yet')
    expect(page).toContain('Your recent website imports will appear here after you run a crawl or scrape.')
    expect(page).not.toContain('<dt className="text-[#8bb4a5]">Used</dt>')
    expect(page).not.toContain('<dt className="text-[#8bb4a5]">Plan</dt>')
    expect(page).toContain('WebsiteImportLiveScreen')
    expect(page).toContain('Ready to import website')
    expect(page).toContain('Live import screen')
    expect(page).toContain('Starting website import...')
    expect(page).toContain('Checking website pages...')
    expect(page).toContain('Reading useful website content...')
    expect(page).toContain('Cleaning unnecessary website text...')
    expect(page).toContain('Embeddings automatic')
    expect(page).not.toContain('Removing duplicate/footer/widget junk')
    expect(page).not.toContain('Crawling current page')
    expect(page).toContain('ManualKnowledgeStatusScreen')
    expect(page).toContain('Ready to save knowledge')
    expect(page).toContain('Manual save progress')
    expect(page).toContain('manualKnowledgeProgress')
    expect(page).toContain('websiteImportProgress')
    expect(page).toContain('Estimated time: Embeddings may take 1-3 minutes depending on content size and provider speed.')
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

  it('uses the brand-green website import button in active and disabled states', () => {
    const importButtonStart = page.indexOf('onClick={importWebsite}')
    const importButtonEnd = page.indexOf('</button>', importButtonStart)
    const importButton = page.slice(importButtonStart, importButtonEnd)

    expect(importButtonStart).toBeGreaterThan(-1)
    expect(importButton).toContain('Import Website Knowledge')
    expect(importButton).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(importButton).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
  })

  it('uses the brand-green Manual Knowledge save button in active and disabled states', () => {
    const manualButtonStart = page.indexOf('onClick={saveKnowledge}')
    const manualButtonEnd = page.indexOf('</button>', manualButtonStart)
    const manualButton = page.slice(manualButtonStart, manualButtonEnd)

    expect(manualButtonStart).toBeGreaterThan(-1)
    expect(manualButton).toContain('Save Knowledge')
    expect(manualButton).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(manualButton).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
  })

  it('keeps the Manual Knowledge chunks-ready status on one line', () => {
    expect(page).toContain('whitespace-nowrap rounded-full')
    expect(page).toContain("{saving ? 'Processing' : 'Chunks ready'}")
    expect(page).toContain('whitespace-nowrap rounded-xl')
    expect(page).toContain('>Chunks ready</div>')
  })

  it('limits Saved Knowledge to four items by default with See More and Show Less', () => {
    expect(page).toContain('SAVED_KNOWLEDGE_PREVIEW_LIMIT = 4')
    expect(page).toContain('const [showAllSavedKnowledge, setShowAllSavedKnowledge] = useState(false)')
    expect(page).toContain('const hiddenSavedKnowledgeCount = Math.max(knowledgeSources.length - SAVED_KNOWLEDGE_PREVIEW_LIMIT, 0)')
    expect(page).toContain('const visibleSavedKnowledgeSources = showAllSavedKnowledge')
    expect(page).toContain('knowledgeSources.slice(0, SAVED_KNOWLEDGE_PREVIEW_LIMIT)')
    expect(page).toContain('visibleSavedKnowledgeSources.map((source) => {')
    expect(page).toContain('knowledgeSources.length > SAVED_KNOWLEDGE_PREVIEW_LIMIT')
    expect(page).toContain('setShowAllSavedKnowledge((current) => !current)')
    expect(page).toContain("showAllSavedKnowledge ? 'Show Less' : `See More (${hiddenSavedKnowledgeCount.toLocaleString()})`")
    expect(page).toContain('{knowledgeSources.length.toLocaleString()} sources')
    expect(page).toContain('onClick={() => viewKnowledge(displaySource.id)}')
    expect(page).toContain('onClick={() => editKnowledge(displaySource.id)}')
    expect(page).toContain('onClick={() => deleteKnowledge(displaySource.id)}')
  })

  it('uses CRM green styling for Chatbot Instructions enabled badge', () => {
    expect(page).toContain("chatbotSettings?.enabled === false ? 'Paused' : 'Enabled'")
    expect(page).toContain("border-[#3ddf84] bg-[#3ddf84] text-[#07130e]")
    expect(page).toContain("'border-amber-300/40 bg-amber-300/10 text-amber-100'")
  })

  it('keeps the Test Chatbot dashboard-only badge on one line', () => {
    expect(page).toContain('whitespace-nowrap rounded-full border border-[#315846]')
    expect(page).toContain('Dashboard only')
  })

  it('uses the brand-green Test Chatbot ask button in active and disabled states', () => {
    const askButtonStart = page.indexOf('onClick={askTestChat}')
    const askButtonEnd = page.indexOf('</button>', askButtonStart)
    const askButton = page.slice(askButtonStart, askButtonEnd)

    expect(askButtonStart).toBeGreaterThan(-1)
    expect(askButton).toContain('Ask Test Question')
    expect(askButton).toContain('className={chatbotPrimaryActionButtonClass}')
    expect(page).toContain('const chatbotPrimaryActionButtonClass =')
    expect(page).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(page).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
  })

  it('uses the brand-green Chatbot Instructions save button in active and disabled states', () => {
    const instructionsSaveButtonStart = page.indexOf('onClick={() => saveChatbotSettings()}')
    const instructionsSaveButtonEnd = page.indexOf('</button>', instructionsSaveButtonStart)
    const instructionsSaveButton = page.slice(instructionsSaveButtonStart, instructionsSaveButtonEnd)
    const askButtonStart = page.indexOf('onClick={askTestChat}')
    const askButtonEnd = page.indexOf('</button>', askButtonStart)
    const askButton = page.slice(askButtonStart, askButtonEnd)

    expect(instructionsSaveButtonStart).toBeGreaterThan(-1)
    expect(instructionsSaveButton).toContain('Save Settings')
    expect(instructionsSaveButton).toContain('disabled={chatbotSettingsSaving || !chatbotSettings}')
    expect(instructionsSaveButton).toContain('className={chatbotPrimaryActionButtonClass}')
    expect(askButton).toContain('className={chatbotPrimaryActionButtonClass}')
  })

  it('uses the brand-green Schedule & Import History refresh button and safe reload handler', () => {
    const refreshFunctionStart = page.indexOf('async function refreshScheduleAndImportHistory()')
    const refreshFunctionEnd = page.indexOf('async function saveSchedule()', refreshFunctionStart)
    const refreshFunction = page.slice(refreshFunctionStart, refreshFunctionEnd)
    const refreshButtonStart = page.indexOf('onClick={refreshScheduleAndImportHistory}')
    const refreshButtonEnd = page.indexOf('</button>', refreshButtonStart)
    const refreshButton = page.slice(refreshButtonStart, refreshButtonEnd)

    expect(refreshFunctionStart).toBeGreaterThan(-1)
    expect(refreshFunction).toContain('setScheduleRefreshing(true)')
    expect(refreshFunction).toContain('loadSchedules()')
    expect(refreshFunction).toContain('loadImportHistory()')
    expect(refreshFunction).not.toContain('importWebsite')
    expect(refreshFunction).not.toContain('saveSchedule')
    expect(refreshButtonStart).toBeGreaterThan(-1)
    expect(refreshButton).toContain('disabled={scheduleRefreshing}')
    expect(refreshButton).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(refreshButton).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
    expect(refreshButton).toContain("{scheduleRefreshing ? 'Refreshing...' : 'Refresh'}")
  })

  it('uses the brand-green Add Schedule button in active and disabled states', () => {
    const addScheduleButtonStart = page.indexOf('onClick={saveSchedule}')
    const addScheduleButtonEnd = page.indexOf('</button>', addScheduleButtonStart)
    const addScheduleButton = page.slice(addScheduleButtonStart, addScheduleButtonEnd)

    expect(addScheduleButtonStart).toBeGreaterThan(-1)
    expect(addScheduleButton).toContain('Add Schedule')
    expect(addScheduleButton).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(addScheduleButton).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
  })

  it('uses the brand-green Chatbot Activity refresh button while preserving safe reload behavior', () => {
    const activitySectionStart = page.indexOf('<h2 className="text-lg font-bold text-white">Chatbot Activity & Unanswered Questions</h2>')
    const activityRefreshButtonStart = page.indexOf('loadLogs()', activitySectionStart)
    const activityRefreshButtonEnd = page.indexOf('</button>', activityRefreshButtonStart)
    const activityRefreshButton = page.slice(activityRefreshButtonStart, activityRefreshButtonEnd)

    expect(activitySectionStart).toBeGreaterThan(-1)
    expect(activityRefreshButtonStart).toBeGreaterThan(-1)
    expect(activityRefreshButton).toContain('loadLogs()')
    expect(activityRefreshButton).toContain('loadKnowledgeGaps()')
    expect(activityRefreshButton).toContain('disabled={logsLoading}')
    expect(activityRefreshButton).toContain('border border-[#3ddf84] bg-[#3ddf84]')
    expect(activityRefreshButton).toContain('disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70')
    expect(activityRefreshButton).toContain("{logsLoading ? 'Refreshing...' : 'Refresh'}")
  })

  it('opens a review-only draft modal and publishes only from Save Knowledge', () => {
    expect(page).toContain("setShowWebsiteReviewModal(payload.job?.status === 'draft_ready')")
    expect(page).toContain('showWebsiteReviewModal && websiteImportJob')
    expect(page).toContain('Review Imported Website Knowledge')
    expect(page).toContain('{job.websiteUrl}')
    expect(page).toContain('Imported content')
    expect(page).toContain('Raw characters')
    expect(page).toContain('Duplicate/junk removed')
    expect(page).toContain('Skipped reasons:')
    expect(page).toContain('Imported pages')
    expect(page).toContain('No readable website knowledge was found.')
    expect(page).toContain('Saved Knowledge will not change until you click Save Knowledge.')
    expect(page).toContain('onDiscard={() => saveWebsiteDraft(\'discard\')}')
    expect(page).toContain('onSave={() => saveWebsiteDraft(\'publish\')}')
    expect(page).toContain('embeddingProgress={websiteEmbeddingProgress}')
    const reviewModalStart = page.indexOf('function WebsiteKnowledgeReviewModal')
    const reviewFooterStart = page.indexOf('<footer', reviewModalStart)
    const reviewFooterEnd = page.indexOf('</footer>', reviewFooterStart)
    const reviewBody = page.slice(reviewModalStart, reviewFooterStart)
    const reviewFooter = page.slice(reviewFooterStart, reviewFooterEnd)

    expect(reviewModalStart).toBeGreaterThan(-1)
    expect(reviewFooterStart).toBeGreaterThan(reviewModalStart)
    expect(reviewFooter).toContain('EmbeddingPreparationPanel progress={embeddingProgress} compact')
    expect(reviewFooter).toContain('lg:flex-row lg:items-center lg:justify-between')
    expect(reviewFooter).toContain('min-w-0 flex-1 lg:max-w-2xl')
    expect(reviewFooter).toContain('flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end')
    expect(reviewFooter).not.toContain('className="mb-3"')
    expect(reviewBody).not.toContain('EmbeddingPreparationPanel progress={embeddingProgress}')
    expect(page).toContain('Getting your knowledge ready for the chatbot')
    expect(page).toContain('chunks prepared')
    expect(page).toContain('% complete')
    expect(page).toContain("saving && embeddingProgress?.status === 'running' ? 'Preparing...' : saving ? 'Saving...' : 'Save Knowledge'")
    expect(page).toContain('disabled={saving || !hasContent || !title.trim()}')
    expect(page).toContain('Could not save imported knowledge. Please try again.')
    expect(page).toContain('await loadKnowledge()')
    expect(page).toContain('setShowWebsiteReviewModal(false)')
  })

  it('publishes unchanged website review drafts by job id without reposting huge content', () => {
    const saveDraftStart = page.indexOf("async function saveWebsiteDraft(action: 'update' | 'publish' | 'discard')")
    const saveDraftEnd = page.indexOf('async function saveKnowledge()', saveDraftStart)
    const saveDraft = page.slice(saveDraftStart, saveDraftEnd)

    expect(saveDraftStart).toBeGreaterThan(-1)
    expect(saveDraftEnd).toBeGreaterThan(saveDraftStart)
    expect(saveDraft).toContain('const requestBody: {')
    expect(saveDraft).toContain("const storedDraftContent = websiteImportJob.draftContent ?? ''")
    expect(saveDraft).toContain('const draftContentChanged = websiteDraftContent !== storedDraftContent')
    expect(saveDraft).toContain("if (action === 'update' || (action === 'publish' && draftContentChanged))")
    expect(saveDraft).toContain('requestBody.content = websiteDraftContent')
    expect(saveDraft).toContain('body: JSON.stringify(requestBody)')
    expect(saveDraft).not.toContain('content: websiteDraftContent,')
    expect(page).toContain('websiteDraftActionErrorMessage')
    expect(page).toContain('Imported knowledge is too large to save as one item')
    expect(page).toContain('Knowledge saved, but embeddings could not be created. Check AI provider settings.')
    expect(saveDraft).toContain('payload.userMessage ?? payload.embeddingSummary?.userMessage ?? payload.embeddingSummary?.message')
  })

  it('keeps completed import details in the modal instead of a duplicate page card', () => {
    expect(page).not.toContain('Website import summary')
    expect(page).toContain('<h4 className="text-sm font-black text-white">Import summary</h4>')
    expect(page).toContain('setWebsiteImportJob(null)')
    expect(page).toContain('setWebsiteImportPages([])')
    expect(page).toContain('setWebsiteImportStats(null)')
    expect(page).toContain('setWebsiteImportProgress(null)')
    expect(page).toContain('<h2 className="text-lg font-bold text-white">Saved Knowledge</h2>')
  })

  it('restores one workspace-scoped pending review draft after refresh', () => {
    expect(page).toContain('loadPendingWebsiteImport()')
    expect(page).toContain("fetch('/api/rag/website-import')")
    expect(page).toContain("pending.job.status !== 'draft_ready'")
    expect(page).toContain('Pending website import review')
    expect(page).toContain('setShowWebsiteReviewModal(true)')
    expect(page).toContain("onClick={() => saveWebsiteDraft('discard')}")
    expect(page).toContain("if (action === 'publish')")
    expect(page).toContain("} else if (action === 'discard') {")
    expect(page).toContain('setWebsiteImportMessage(null)')
    expect(page).toContain('setWebsiteImportProgress(null)')
    expect(ragDashboardStore).toContain('getLatestPendingRagWebsiteImportJob')
    expect(ragDashboardStore).toContain(".eq('workspace_id', workspaceId)")
    expect(ragDashboardStore).toContain(".eq('status', 'draft_ready')")
    expect(ragDashboardStore).toContain("status: 'published'")
    expect(ragDashboardStore).toContain("status: 'discarded'")
    expect(websiteImportRoute).toContain("requireRagPermission('view_rag_chatbot')")
    expect(websiteImportRoute).toContain('getLatestPendingRagWebsiteImportJob(auth.workspace.workspaceId)')
  })

  it('removes pricing preview cards while retaining pricing and visible evidence in the imported draft', () => {
    expect(page).not.toContain('const pricingRecords = stats?.pricingRecords ?? []')
    expect(page).not.toContain('pricingRecords.length > 0 &&')
    expect(page).not.toContain('Pricing found')
    expect(page).not.toContain('Exact pricing evidence detected before publishing.')
    expect(page).not.toContain('{pricingRecords.length.toLocaleString()} records')
    expect(page).not.toContain('interface WebsitePricingRecord')
    expect(websiteImport).toContain('formatPricingRecordsForKnowledge(pricingRecords)')
    expect(websiteImport).toContain('formatVisiblePricingEvidenceForKnowledge(pricingRecords)')
    expect(websiteImport).toContain('structureRagWebsiteKnowledgeForWorkspace')
    expect(page).toContain('visibleWebsiteImportWarnings')
    expect(page).toContain('browser-rendered')
    expect(page).toContain('dynamic pricing options')
    expect(page).not.toContain('Dynamic pricing may need review')
    expect(page).not.toContain('Some prices may require browser-rendered extraction in a future upgrade.')
  })

  it('sets a non-guaranteed website import time expectation', () => {
    expect(page).toContain('websiteImportTimeEstimate(websitePageLimit)')
    expect(page).toContain('pageLimit={websitePageLimit}')
    expect(page).toContain('websiteImportTimeEstimate(pageLimit)')
    expect(page).toContain('Estimated time: Up to 25 pages may take around 2–3 minutes')
    expect(page).toContain('depending on website speed and page size')
    expect(page).toContain('Larger imports may take several minutes and can take longer')
  })

  it('keeps website import progress visible and does not open review on failure', () => {
    expect(page).toContain('<WebsiteImportLiveScreen')
    expect(page).toContain('setWebsiteImportProgress(createKnowledgeProgress(\'website\'))')
    expect(page).toContain("setWebsiteImportProgress(createKnowledgeProgress('website', 'failed', message))")

    const importCatchStart = page.indexOf('} catch (importError) {')
    const importFinallyStart = page.indexOf('} finally {', importCatchStart)
    const importFailurePath = page.slice(importCatchStart, importFinallyStart)
    expect(importFailurePath).not.toContain('setShowWebsiteReviewModal(true)')
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
    expect(providerModelsRoute).toContain("requireRagPermission('manage_rag_provider')")
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

  it('saves simplified provider settings with backend defaults instead of user-selected models', () => {
    expect(providerRoute).toContain('isSimpleRagProviderType')
    expect(providerRoute).toContain("return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 })")
    expect(providerRoute).toContain("baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : null")
    expect(providerRoute).not.toContain("const chatModel = typeof body.chatModel === 'string'")
    expect(providerRoute).not.toContain("const embeddingModel = typeof body.embeddingModel === 'string'")
    expect(providerRoute).not.toContain('embeddingDimensions =')
    expect(ragSettings).toContain('const defaults = AI_PROVIDER_DEFAULTS[args.provider]')
    expect(ragSettings).toContain("baseUrl: args.provider === 'ollama' ? args.baseUrl || defaults.baseUrl : defaults.baseUrl")
    expect(ragSettings).toContain('chatModel: defaults.chatModel')
    expect(ragSettings).toContain('embeddingModel: defaults.embeddingModel')
    expect(ragSettings).toContain('embeddingDimensions: defaults.embeddingDimensions')
    expect(ragSettings).toContain("args.provider === 'ollama' ? 'ollama-local' : ''")
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

  it('uses static backend provider defaults instead of live model dropdowns', () => {
    expect(providerConfig).toContain('AI_PROVIDER_CONFIG')
    expect(providerConfig).toContain('AI_PROVIDER_DEFAULTS')
    expect(providerConfig).toContain("defaultBaseUrl: 'https://api.openai.com/v1'")
    expect(providerConfig).toContain("defaultBaseUrl: 'https://openrouter.ai/api/v1'")
    expect(providerConfig).toContain("defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/'")
    expect(providerConfig).toContain("defaultBaseUrl: 'http://localhost:11434/v1'")
    expect(providerConfig).toContain("defaultChatModel: 'gpt-4o-mini'")
    expect(providerConfig).toContain("defaultEmbeddingModel: 'text-embedding-3-small'")
    expect(providerConfig).toContain("defaultEmbeddingModel: 'gemini-embedding-001'")
    expect(providerConfig).toContain('defaultEmbeddingDimensions: 1536')
    expect(providerConfig).toContain('isSimpleRagProviderType')

    expect(page).toContain('changeProvider(event.target.value as RagProviderType)')
    expect(page).toContain('SIMPLE_RAG_PROVIDER_TYPES.map')
    expect(page).toContain("provider === 'ollama'")
    expect(page).toContain('baseUrl: provider === \'ollama\' ? effectiveProviderBaseUrl : null')
    expect(page).toContain('This provider is no longer shown in the simplified setup.')
    expect(page).not.toContain('filteredProviderModelOptions')
    expect(page).not.toContain('providerModelChoice')
    expect(page).not.toContain('providerModelSearch')
    expect(page).not.toContain("provider === 'custom_openai_compatible'")
  })

  it('keeps any provider model fetch route unused by the simplified dashboard', () => {
    expect(providerModelsRoute).toContain('listRagProviderModels')
    expect(providerModelsRoute).not.toContain('encrypted_api_key')
    expect(providerModelsRoute).not.toContain('apiKey')
    expect(page).not.toContain('/api/rag/provider-models')
    expect(page).not.toContain('/models')
    expect(providerModels).toContain('/models')
  })

  it('stores and returns Firecrawl credits for activity details when available', () => {
    expect(ragDashboardStore).toContain('creditsUsed: readHistoryCreditsUsed(row)')
    expect(ragDashboardStore).toContain('credits_used: stats.creditsUsed ?? null')
    expect(ragDashboardStore).toContain('readHistoryCreditsUsed')
    expect(ragDashboardStore).toContain("'firecrawlCreditsUsed'")
    expect(ragDashboardStore).toContain('rag_website_import_jobs(credits_used, stats)')
    expect(websiteImport).toContain('readonly creditsUsed?: number | null')
    expect(websiteImport).toContain('interface FirecrawlPagesResult')
    expect(websiteImport).toContain('if (typeof crawlResult.creditsUsed === \'number\') creditsUsed = crawlResult.creditsUsed')
    expect(websiteImport).toContain('if (typeof batchResult.creditsUsed === \'number\') creditsUsed = batchResult.creditsUsed')
    expect(websiteImport).toContain('creditsUsed = (creditsUsed ?? 0) + scraped.creditsUsed')
    expect(page).toContain('if (typeof history.creditsUsed === \'number\') return history.creditsUsed.toLocaleString()')
    expect(page).toContain('if (pages > 0) return `${pages.toLocaleString()} pages`')
    expect(page).toContain("['Credit used', typeof activity.creditsUsed === 'number' ? activity.creditsUsed.toLocaleString() : '—']")
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
