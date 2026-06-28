'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'

import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'
import { RAG_KNOWLEDGE_CHARACTER_LIMIT } from '@/lib/rag/knowledge'
import { cn } from '@/lib/utils'
import type { RagProviderType } from '@/lib/rag/types'

type ConnectionStatus = 'not_tested' | 'success' | 'failed' | null

interface ProviderView {
  readonly configured: boolean
  readonly provider: RagProviderType
  readonly maskedKey: string | null
  readonly baseUrl: string | null
  readonly chatModel: string | null
  readonly lastTestStatus: ConnectionStatus
  readonly lastTestError: string | null
}

interface FirecrawlView {
  readonly configured: boolean
  readonly maskedKey: string | null
  readonly lastTestedAt: string | null
  readonly lastTestStatus: ConnectionStatus
  readonly lastTestError: string | null
  readonly creditUsage?: FirecrawlCreditUsage | null
}

interface FirecrawlCreditUsage {
  readonly remainingCredits: number | null
  readonly totalCredits: number | null
  readonly usedCredits: number | null
  readonly plan: string | null
  readonly limit: number | null
  readonly lastUpdatedAt: string
}

interface RagStatusPayload {
  readonly provider: ProviderView
  readonly firecrawl: FirecrawlView
  readonly knowledge: {
    readonly sources: number
    readonly chunks: number
    readonly readyEmbeddings: number
    readonly failedEmbeddings: number
  }
}

interface KnowledgeSourceItem {
  readonly id: string
  readonly title: string
  readonly sourceType: 'manual' | 'website' | 'faq' | 'note'
  readonly sourceUrl: string | null
  readonly status: 'draft' | 'active' | 'archived' | 'failed'
  readonly createdAt: string
  readonly updatedAt: string
  readonly characterCount: number
  readonly chunkCount: number
  readonly readyEmbeddingCount: number
  readonly failedEmbeddingCount: number
  readonly embeddingStatus: 'not_embedded' | 'ready' | 'failed' | 'partial'
  readonly content?: string
}

interface RagChatSource {
  readonly title: string
  readonly snippet: string
  readonly matchQuality: number
}

interface RagChatResponse {
  readonly status: 'answered' | 'fallback' | 'provider_error'
  readonly answer: string
  readonly sources: ReadonlyArray<RagChatSource>
  readonly fallbackReason: string | null
}

interface RagChatMemoryMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

interface RagChatLogItem {
  readonly id: string
  readonly createdAt: string
  readonly channel: 'dashboard' | 'whatsapp'
  readonly userQuestion: string
  readonly answer: string | null
  readonly status: 'answered' | 'fallback' | 'provider_error' | 'failed'
  readonly fallbackReason: string | null
  readonly latencyMs: number | null
  readonly retrievedSourceCount: number
}

interface RagAutoReplySettings {
  readonly enabled: boolean
  readonly fallbackMode: 'do_not_reply' | 'send_fallback'
  readonly fallbackMessage: string
  readonly whatsappConnected: boolean
  readonly providerConfigured: boolean
  readonly knowledgeReady: boolean
}

interface RagChatbotSettings {
  readonly enabled: boolean
  readonly tone: 'professional' | 'friendly' | 'concise' | 'helpful'
  readonly handoverEnabled: boolean
  readonly fallbackMessage: string
  readonly handoverMessage: string
}

interface WebsiteImportStats {
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly pages?: ReadonlyArray<{
    readonly url: string
    readonly canonicalUrl: string | null
    readonly title: string | null
    readonly status: 'imported' | 'skipped' | 'failed' | 'duplicate'
    readonly skipReason: string | null
  }>
  readonly rawCharacters?: number
  readonly duplicateJunkCharactersRemoved?: number
  readonly savedCharacters: number
  readonly capped: boolean
  readonly pageLimit: number
  readonly lowValuePagesSkipped?: number
  readonly aiStructuringUsed?: boolean
  readonly deterministicFallbackUsed?: boolean
  readonly firecrawlModesUsed?: ReadonlyArray<string>
  readonly structuredRecords?: Readonly<Record<string, number>>
  readonly warnings?: ReadonlyArray<string>
  readonly skippedReasons?: Readonly<Record<string, number>>
}

interface WebsiteImportJob {
  readonly id: string
  readonly websiteUrl: string
  readonly status: 'running' | 'draft_ready' | 'published' | 'failed' | 'discarded'
  readonly pageLimit: number
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly savedCharacters: number
  readonly capped: boolean
  readonly draftTitle: string | null
  readonly draftContent: string | null
  readonly qualityWarnings: ReadonlyArray<string>
  readonly createdAt: string
}

interface WebsiteImportPage {
  readonly id?: string
  readonly url: string
  readonly canonicalUrl: string | null
  readonly title: string | null
  readonly status: 'imported' | 'skipped' | 'failed' | 'duplicate'
  readonly skipReason: string | null
  readonly characterCount?: number
}

interface RagImportHistoryItem {
  readonly id: string
  readonly url: string | null
  readonly triggerType: string
  readonly status: string
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly createdAt: string
  readonly changeSummary: string | null
  readonly errorMessage: string | null
}

interface RagScrapeSchedule {
  readonly id: string
  readonly url: string
  readonly frequency: 'daily' | 'weekly' | 'monthly'
  readonly pageLimit: number
  readonly autoPublish: boolean
  readonly isActive: boolean
  readonly lastRunStatus: string | null
  readonly createdAt: string
}

interface RagKnowledgeGap {
  readonly id: string
  readonly question: string
  readonly channel: string
  readonly reason: string
  readonly count: number
  readonly suggestedAction: string | null
  readonly lastAskedAt: string
}

const providerLabels: Record<RagProviderType, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama',
  custom_openai_compatible: 'Custom OpenAI-compatible',
  gemini: 'Gemini',
}

const providers = Object.entries(providerLabels) as Array<[RagProviderType, string]>
const chatbotCardBorderClass =
  'border border-[#3ddf84]/60 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:border-[#3ddf84]/80'
const chatbotPanelBorderClass =
  'border border-[#3ddf84]/40 shadow-[0_12px_35px_rgba(0,0,0,0.14)] transition hover:border-[#3ddf84]/60'

function statusLabel(status: ConnectionStatus, configured: boolean): string {
  if (!configured) return 'Not configured'
  if (status === 'success') return 'Connected'
  if (status === 'failed') return 'Failed'
  return 'Not tested'
}

function statusClasses(status: ConnectionStatus, configured: boolean): string {
  if (!configured) return 'border-slate-700 bg-slate-900/50 text-slate-300'
  if (status === 'success') return 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
  if (status === 'failed') return 'border-red-400/50 bg-red-400/10 text-red-200'
  return 'border-amber-300/50 bg-amber-300/10 text-amber-100'
}

function embeddingStatusLabel(status: KnowledgeSourceItem['embeddingStatus']): string {
  if (status === 'ready') return 'Ready for Chatbot'
  if (status === 'failed') return 'Needs attention'
  if (status === 'partial') return 'Partially ready'
  return 'Chunks ready'
}

function embeddingStatusClasses(status: KnowledgeSourceItem['embeddingStatus']): string {
  if (status === 'ready') return 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100'
  if (status === 'failed') return 'border-red-300/40 bg-red-300/10 text-red-100'
  if (status === 'partial') return 'border-amber-300/40 bg-amber-300/10 text-amber-100'
  return 'border-slate-500/40 bg-slate-700/30 text-slate-200'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function sourceTypeLabel(sourceType: KnowledgeSourceItem['sourceType']): string {
  if (sourceType === 'website') return 'Website import'
  if (sourceType === 'faq') return 'FAQ'
  if (sourceType === 'note') return 'Instructions'
  return 'Business knowledge'
}

type KnowledgeProgressKind = 'manual' | 'website' | 'prepare'
type KnowledgeProgressStatus = 'running' | 'done' | 'warning' | 'failed'

interface KnowledgeProgressState {
  readonly kind: KnowledgeProgressKind
  readonly status: KnowledgeProgressStatus
  readonly currentStep: number
  readonly message: string | null
}

const knowledgeProgressSteps: Record<KnowledgeProgressKind, ReadonlyArray<string>> = {
  manual: [
    'Saving knowledge...',
    'Preparing your content...',
    'Creating knowledge chunks...',
    'Knowledge saved.',
    'Embeddings are pending. Click Prepare for Chatbot when ready.',
  ],
  website: [
    'Starting website import...',
    'Checking website pages...',
    'Reading useful website content...',
    'Cleaning unnecessary website text...',
    'Preparing chatbot knowledge...',
    'Creating searchable knowledge chunks...',
    'Website knowledge saved.',
    'Embeddings are pending. Click Prepare for Chatbot when ready.',
  ],
  prepare: [
    'Checking chunks...',
    'Preparing embeddings in batches...',
    'Ready for chatbot',
  ],
}

function createKnowledgeProgress(
  kind: KnowledgeProgressKind,
  status: KnowledgeProgressStatus = 'running',
  message: string | null = null,
  currentStep?: number,
): KnowledgeProgressState {
  const steps = knowledgeProgressSteps[kind]
  return {
    kind,
    status,
    currentStep: currentStep ?? (status === 'done' ? steps.length - 1 : 0),
    message,
  }
}

function knowledgeStatusLabel(source: KnowledgeSourceItem): string {
  if (source.chunkCount === 0) return 'Saved'
  if (source.embeddingStatus === 'ready') return 'Ready for Chatbot'
  if (source.embeddingStatus === 'failed') return 'Needs attention'
  if (source.embeddingStatus === 'partial') return 'Partially ready'
  return 'Chunks ready'
}

function cleanOperationMessage(message: unknown, fallback: string): string {
  if (typeof message !== 'string' || !message.trim()) return fallback
  const cleaned = message.replace(/\s+/g, ' ').trim()
  if (/typeerror:\s*fetch failed|fetch failed/i.test(cleaned)) {
    return 'Could not connect to the embedding provider right now. Please try again.'
  }
  return cleaned.slice(0, 240)
}

export default function RagChatbotPage() {
  const workspace = useWorkspacePermissions()
  const canView = workspace.has('view_rag_chatbot')
  const canManageProvider = workspace.has('manage_rag_provider')
  const [status, setStatus] = useState<RagStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<RagProviderType>('openai')
  const [providerKey, setProviderKey] = useState('')
  const [providerBaseUrl, setProviderBaseUrl] = useState('')
  const [providerModel, setProviderModel] = useState('')
  const [firecrawlKey, setFirecrawlKey] = useState('')
  const [providerSaving, setProviderSaving] = useState(false)
  const [firecrawlSaving, setFirecrawlSaving] = useState(false)
  const [providerMessage, setProviderMessage] = useState<string | null>(null)
  const [firecrawlMessage, setFirecrawlMessage] = useState<string | null>(null)
  const [firecrawlCredits, setFirecrawlCredits] = useState<FirecrawlCreditUsage | null>(null)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceItem[]>([])
  const [knowledgeSourceType, setKnowledgeSourceType] = useState<'manual' | 'faq' | 'note' | 'website'>('manual')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeText, setKnowledgeText] = useState('')
  const [knowledgeMessage, setKnowledgeMessage] = useState<string | null>(null)
  const [knowledgeSaving, setKnowledgeSaving] = useState(false)
  const [manualKnowledgeProgress, setManualKnowledgeProgress] = useState<KnowledgeProgressState | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websitePageLimit, setWebsitePageLimit] = useState(25)
  const [websiteImportMessage, setWebsiteImportMessage] = useState<string | null>(null)
  const [websiteImportStats, setWebsiteImportStats] = useState<WebsiteImportStats | null>(null)
  const [websiteImportProgress, setWebsiteImportProgress] = useState<KnowledgeProgressState | null>(null)
  const [websiteImportJob, setWebsiteImportJob] = useState<WebsiteImportJob | null>(null)
  const [websiteImportPages, setWebsiteImportPages] = useState<WebsiteImportPage[]>([])
  const [websiteDraftTitle, setWebsiteDraftTitle] = useState('')
  const [websiteDraftContent, setWebsiteDraftContent] = useState('')
  const [websiteDraftSaving, setWebsiteDraftSaving] = useState(false)
  const [websiteImporting, setWebsiteImporting] = useState(false)
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeSourceItem | null>(null)
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null)
  const [preparingKnowledgeId, setPreparingKnowledgeId] = useState<string | null>(null)
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatAnswer, setChatAnswer] = useState<RagChatResponse | null>(null)
  const [chatHistory, setChatHistory] = useState<RagChatMemoryMessage[]>([])
  const [chatMessage, setChatMessage] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [logs, setLogs] = useState<RagChatLogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsMessage, setLogsMessage] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState('all')
  const [activityVisibleCount, setActivityVisibleCount] = useState(10)
  const [autoReply, setAutoReply] = useState<RagAutoReplySettings | null>(null)
  const [autoReplySaving, setAutoReplySaving] = useState(false)
  const [autoReplyMessage, setAutoReplyMessage] = useState<string | null>(null)
  const [chatbotSettings, setChatbotSettings] = useState<RagChatbotSettings | null>(null)
  const [chatbotSettingsSaving, setChatbotSettingsSaving] = useState(false)
  const [chatbotSettingsMessage, setChatbotSettingsMessage] = useState<string | null>(null)
  const [importHistory, setImportHistory] = useState<RagImportHistoryItem[]>([])
  const [schedules, setSchedules] = useState<RagScrapeSchedule[]>([])
  const [scheduleUrl, setScheduleUrl] = useState('')
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [schedulePageLimit, setSchedulePageLimit] = useState(25)
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1)
  const [scheduleHourUtc, setScheduleHourUtc] = useState(9)
  const [scheduleAutoPublish, setScheduleAutoPublish] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [knowledgeGaps, setKnowledgeGaps] = useState<RagKnowledgeGap[]>([])
  const [gapsMessage, setGapsMessage] = useState<string | null>(null)

  const cards = useMemo(() => {
    const providerConfigured = status?.provider.configured === true
    const providerStatus = statusLabel(status?.provider.lastTestStatus ?? null, providerConfigured)
    const providerName = providerLabels[status?.provider.provider ?? provider]
    const providerModelName = status?.provider.chatModel || providerModel || 'Model not set'
    const autoReplyOn = autoReply?.enabled === true
    const autoReplyReady = autoReply?.whatsappConnected && autoReply.providerConfigured && autoReply.knowledgeReady
    const readyEmbeddings = status?.knowledge.readyEmbeddings ?? 0
    const failedEmbeddings = status?.knowledge.failedEmbeddings ?? 0
    const chunks = status?.knowledge.chunks ?? 0
    const knowledgeReady = chunks > 0 && failedEmbeddings === 0 && readyEmbeddings > 0

    return [
      {
        title: 'AI Provider',
        value: providerStatus,
        eyebrow: providerConfigured ? 'API key configured' : 'API key required',
        detail: `${providerName} / ${providerModelName}`,
        icon: KeyRound,
        tone: providerConfigured && status?.provider.lastTestStatus !== 'failed' ? 'good' : status?.provider.lastTestStatus === 'failed' ? 'warn' : 'muted',
      },
      {
        title: 'WhatsApp Auto Reply',
        value: autoReplyOn ? 'On' : 'Off',
        eyebrow: autoReplyReady ? 'Ready' : 'Not ready',
        detail: autoReply?.whatsappConnected ? 'Workspace connection available' : 'Connection status pending',
        icon: Send,
        tone: autoReplyReady ? 'good' : autoReplyOn ? 'warn' : 'muted',
      },
      {
        title: 'Knowledge Base',
        value: knowledgeReady ? 'Ready' : failedEmbeddings > 0 ? 'Issues' : 'Needs Prepare',
        eyebrow: `${status?.knowledge.sources ?? 0} sources · ${chunks} chunks`,
        detail: `${readyEmbeddings} ready embeddings · ${failedEmbeddings} failed`,
        icon: Database,
        tone: knowledgeReady ? 'good' : failedEmbeddings > 0 ? 'warn' : 'muted',
      },
    ] as const
  }, [status, autoReply, provider, providerModel])

  const canManageKnowledge = workspace.has('manage_rag_chatbot')
  const canEnableAutoReply = workspace.has('enable_rag_auto_reply')
  const knowledgeCharacters = knowledgeText.length
  const knowledgeOverLimit = knowledgeCharacters > RAG_KNOWLEDGE_CHARACTER_LIMIT
  const providerReady = status?.provider.configured === true
  const firecrawlReady = status?.firecrawl.configured === true
  const embeddingsReady = (status?.knowledge.readyEmbeddings ?? 0) > 0
  const chatUnavailableMessage = !providerReady
    ? 'Add and test your AI provider key first.'
    : !embeddingsReady
      ? 'Prepare your knowledge for chatbot first.'
      : null
  const activityItems = useMemo(() => {
    const logItems = logs.map((log) => ({
      id: `log:${log.id}`,
      kind: 'log' as const,
      channel: log.channel,
      status: log.status,
      question: log.userQuestion,
      answer: log.answer,
      reason: log.fallbackReason,
      count: null as number | null,
      date: log.createdAt,
      meta: `${log.retrievedSourceCount} retrieved sources${typeof log.latencyMs === 'number' ? ` · ${log.latencyMs} ms` : ''}`,
    }))
    const gapItems = knowledgeGaps.map((gap) => ({
      id: `gap:${gap.id}`,
      kind: 'gap' as const,
      channel: gap.channel,
      status: 'unanswered' as const,
      question: gap.question,
      answer: gap.suggestedAction,
      reason: gap.reason,
      count: gap.count,
      date: gap.lastAskedAt,
      meta: 'Missing knowledge',
    }))

    return [...logItems, ...gapItems].sort((first, second) =>
      new Date(second.date).getTime() - new Date(first.date).getTime(),
    )
  }, [logs, knowledgeGaps])
  const visibleActivityItems = activityItems.slice(0, activityVisibleCount)

  useEffect(() => {
    if (workspace.loading || !canView) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch('/api/rag/status')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load AI Chatbot status.')
        return payload as RagStatusPayload
      })
      .then((payload) => {
        if (cancelled) return
        setStatus(payload)
        setProvider(payload.provider.provider)
        setProviderBaseUrl(payload.provider.baseUrl ?? '')
        setProviderModel(payload.provider.chatModel ?? '')
        setFirecrawlCredits(payload.firecrawl.creditUsage ?? null)
        setError(null)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to load.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspace.loading, canView])

  useEffect(() => {
    if (workspace.loading || !canView) return
    loadKnowledge()
    loadLogs()
    loadAutoReply()
    loadChatbotSettings()
    loadImportHistory()
    loadSchedules()
    loadKnowledgeGaps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.loading, canView])

  useEffect(() => {
    if (workspace.loading || !canView) return
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter, workspace.loading, canView])

  useEffect(() => {
    if (!websiteImporting) return
    const timer = window.setInterval(() => {
      setWebsiteImportProgress((current) => {
        if (!current || current.kind !== 'website' || current.status !== 'running') return current
        const maxProgressStep = Math.max(0, knowledgeProgressSteps.website.length - 3)
        return {
          ...current,
          currentStep: Math.min(current.currentStep + 1, maxProgressStep),
        }
      })
    }, 900)

    return () => window.clearInterval(timer)
  }, [websiteImporting])

  useEffect(() => {
    if (!knowledgeSaving) return
    const timer = window.setInterval(() => {
      setManualKnowledgeProgress((current) => {
        if (!current || current.kind !== 'manual' || current.status !== 'running') return current
        const maxProgressStep = Math.max(0, knowledgeProgressSteps.manual.length - 2)
        return {
          ...current,
          currentStep: Math.min(current.currentStep + 1, maxProgressStep),
        }
      })
    }, 900)

    return () => window.clearInterval(timer)
  }, [knowledgeSaving])

  async function refreshStatusCounts() {
    const response = await fetch('/api/rag/status')
    const payload = await response.json().catch(() => ({}))
    if (response.ok) setStatus(payload as RagStatusPayload)
  }

  async function loadKnowledge() {
    try {
      const response = await fetch('/api/rag/knowledge')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load knowledge.')
      setKnowledgeSources(payload.sources ?? [])
    } catch (loadError) {
      setKnowledgeMessage(loadError instanceof Error ? loadError.message : 'Failed to load knowledge.')
    }
  }

  async function loadChatbotSettings() {
    setChatbotSettingsMessage(null)
    try {
      const response = await fetch('/api/rag/chatbot-settings')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load chatbot instructions.')
      setChatbotSettings(payload.settings)
    } catch (loadError) {
      setChatbotSettingsMessage(
        loadError instanceof Error
          ? loadError.message
          : 'Chatbot instructions will load after the dashboard migration is applied.',
      )
    }
  }

  async function saveChatbotSettings(next?: Partial<RagChatbotSettings>) {
    const updated: RagChatbotSettings = {
      enabled: chatbotSettings?.enabled ?? true,
      tone: chatbotSettings?.tone ?? 'professional',
      handoverEnabled: chatbotSettings?.handoverEnabled ?? true,
      fallbackMessage:
        chatbotSettings?.fallbackMessage ?? 'I do not see that information in the current knowledge base.',
      handoverMessage:
        chatbotSettings?.handoverMessage ?? 'I can connect you with a team member if you want.',
      ...(next ?? {}),
    }
    setChatbotSettingsSaving(true)
    setChatbotSettingsMessage(null)
    try {
      const response = await fetch('/api/rag/chatbot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save chatbot instructions.')
      setChatbotSettings(payload.settings)
      setChatbotSettingsMessage('Chatbot instructions saved.')
    } catch (saveError) {
      setChatbotSettingsMessage(saveError instanceof Error ? saveError.message : 'Failed to save chatbot instructions.')
    } finally {
      setChatbotSettingsSaving(false)
    }
  }

  async function loadImportHistory() {
    try {
      const response = await fetch('/api/rag/import-history')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load import history.')
      setImportHistory(payload.history ?? [])
    } catch {
      setImportHistory([])
    }
  }

  async function loadSchedules() {
    setScheduleMessage(null)
    try {
      const response = await fetch('/api/rag/schedules')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load schedules.')
      setSchedules(payload.schedules ?? [])
    } catch (loadError) {
      setScheduleMessage(loadError instanceof Error ? loadError.message : 'Schedules will load after the dashboard migration is applied.')
    }
  }

  async function saveSchedule() {
    setScheduleSaving(true)
    setScheduleMessage(null)
    try {
      const response = await fetch('/api/rag/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scheduleUrl,
          frequency: scheduleFrequency,
          pageLimit: schedulePageLimit,
          dayOfWeek: scheduleDayOfWeek,
          hourUtc: scheduleHourUtc,
          autoPublish: scheduleAutoPublish,
          isActive: false,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save schedule.')
      setScheduleUrl('')
      setScheduleMessage('Schedule saved. The scheduler is storage-only until scheduled sync is approved.')
      await loadSchedules()
    } catch (saveError) {
      setScheduleMessage(saveError instanceof Error ? saveError.message : 'Failed to save schedule.')
    } finally {
      setScheduleSaving(false)
    }
  }

  async function deleteSchedule(id: string) {
    if (!window.confirm('Delete this scrape schedule?')) return
    setScheduleSaving(true)
    setScheduleMessage(null)
    try {
      const response = await fetch(`/api/rag/schedules/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to delete schedule.')
      setScheduleMessage('Schedule deleted.')
      await loadSchedules()
    } catch (deleteError) {
      setScheduleMessage(deleteError instanceof Error ? deleteError.message : 'Failed to delete schedule.')
    } finally {
      setScheduleSaving(false)
    }
  }

  async function loadKnowledgeGaps() {
    setGapsMessage(null)
    try {
      const response = await fetch('/api/rag/gaps')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load unanswered questions.')
      setKnowledgeGaps(payload.gaps ?? [])
    } catch (loadError) {
      setGapsMessage(loadError instanceof Error ? loadError.message : 'Unanswered questions will load after the dashboard migration is applied.')
    }
  }

  async function saveProvider() {
    setProviderSaving(true)
    setProviderMessage(null)
    try {
      const response = await fetch('/api/rag/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: providerKey,
          baseUrl: providerBaseUrl,
          chatModel: providerModel,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save provider.')
      setStatus((current) => current ? { ...current, provider: payload.provider } : current)
      setProviderBaseUrl(payload.provider?.baseUrl ?? providerBaseUrl)
      setProviderModel(payload.provider?.chatModel ?? providerModel)
      setProviderKey('')
      setProviderMessage('Provider saved. Your key is stored securely.')
    } catch (saveError) {
      setProviderMessage(saveError instanceof Error ? saveError.message : 'Failed to save provider.')
    } finally {
      setProviderSaving(false)
    }
  }

  async function testProvider() {
    setProviderSaving(true)
    setProviderMessage(null)
    try {
      const response = await fetch('/api/rag/provider/test', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Provider test failed.')
      setStatus((current) => current ? { ...current, provider: payload.provider } : current)
      setProviderMessage(payload.message ?? 'Provider settings checked.')
    } catch (testError) {
      setProviderMessage(testError instanceof Error ? testError.message : 'Provider test failed.')
    } finally {
      setProviderSaving(false)
    }
  }

  async function saveFirecrawl() {
    setFirecrawlSaving(true)
    setFirecrawlMessage(null)
    try {
      const response = await fetch('/api/rag/firecrawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: firecrawlKey }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save Firecrawl key.')
      setStatus((current) => current ? { ...current, firecrawl: payload.firecrawl } : current)
      setFirecrawlKey('')
      setFirecrawlMessage('Firecrawl key saved. You can now import a website page.')
    } catch (saveError) {
      setFirecrawlMessage(saveError instanceof Error ? saveError.message : 'Failed to save Firecrawl.')
    } finally {
      setFirecrawlSaving(false)
    }
  }

  async function testFirecrawl() {
    setFirecrawlSaving(true)
    setFirecrawlMessage(null)
    try {
      const response = await fetch('/api/rag/firecrawl/test', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Firecrawl test failed.')
      setStatus((current) => current ? { ...current, firecrawl: payload.firecrawl } : current)
      setFirecrawlCredits(payload.firecrawl?.creditUsage ?? null)
      setFirecrawlMessage(payload.message ?? 'Firecrawl settings checked.')
    } catch (testError) {
      setFirecrawlMessage(testError instanceof Error ? testError.message : 'Firecrawl test failed.')
    } finally {
      setFirecrawlSaving(false)
    }
  }

  async function loadLogs() {
    setLogsLoading(true)
    setLogsMessage(null)
    try {
      const params = new URLSearchParams({ limit: '25' })
      if (logFilter === 'dashboard' || logFilter === 'whatsapp') {
        params.set('channel', logFilter)
      } else if (logFilter !== 'all') {
        params.set('status', logFilter)
      }
      const response = await fetch(`/api/rag/logs?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load logs.')
      setLogs(payload.logs ?? [])
    } catch (loadError) {
      setLogsMessage(loadError instanceof Error ? loadError.message : 'Failed to load logs.')
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadAutoReply() {
    setAutoReplyMessage(null)
    try {
      const response = await fetch('/api/rag/auto-reply')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load auto reply settings.')
      setAutoReply(payload.settings)
    } catch (loadError) {
      setAutoReplyMessage(
        loadError instanceof Error ? loadError.message : 'Failed to load auto reply settings.',
      )
    }
  }

  async function saveAutoReply(next?: Partial<RagAutoReplySettings>) {
    if (!autoReply) return
    const updated = { ...autoReply, ...(next ?? {}) }
    setAutoReplySaving(true)
    setAutoReplyMessage(null)
    try {
      const response = await fetch('/api/rag/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: updated.enabled,
          fallbackMode: updated.fallbackMode,
          fallbackMessage: updated.fallbackMessage,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save auto reply settings.')
      setAutoReply(payload.settings)
      setAutoReplyMessage('WhatsApp auto reply settings saved.')
    } catch (saveError) {
      setAutoReplyMessage(saveError instanceof Error ? saveError.message : 'Failed to save settings.')
    } finally {
      setAutoReplySaving(false)
    }
  }

  async function importWebsite() {
    setWebsiteImporting(true)
    setWebsiteImportMessage(null)
    setWebsiteImportStats(null)
    setWebsiteImportProgress(createKnowledgeProgress('website'))
    try {
      const response = await fetch('/api/rag/website-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, pageLimit: websitePageLimit }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Import failed.')

      setWebsiteUrl('')
      setWebsiteImportStats(payload.stats ?? null)
      setFirecrawlCredits((current) => {
        const creditsUsed = typeof payload.stats?.creditsUsed === 'number' ? payload.stats.creditsUsed : null
        if (creditsUsed === null && current === null) return null
        return {
          remainingCredits: current?.remainingCredits ?? null,
          totalCredits: current?.totalCredits ?? null,
          usedCredits: typeof current?.usedCredits === 'number' && creditsUsed !== null
            ? current.usedCredits + creditsUsed
            : current?.usedCredits ?? creditsUsed,
          plan: current?.plan ?? null,
          limit: current?.limit ?? null,
          lastUpdatedAt: new Date().toISOString(),
        }
      })
      setWebsiteImportJob(payload.job ?? null)
      setWebsiteImportPages(payload.pages ?? payload.stats?.pages ?? [])
      setWebsiteDraftTitle(payload.job?.draftTitle ?? 'Website knowledge')
      setWebsiteDraftContent(payload.job?.draftContent ?? '')
      const message = cleanOperationMessage(
        payload.userMessage ?? payload.embeddingSummary?.userMessage ?? payload.embeddingSummary?.message ?? payload.message,
        'Website draft created. Review before publishing.',
      )
      setWebsiteImportProgress(createKnowledgeProgress('website', 'done', message))
      setWebsiteImportMessage(message)
      await loadImportHistory()
      await refreshStatusCounts()
    } catch (importError) {
      const message = cleanOperationMessage(
        importError instanceof Error ? importError.message : null,
        'Import failed.',
      )
      setWebsiteImportProgress(createKnowledgeProgress('website', 'failed', message))
      setWebsiteImportMessage(message)
    } finally {
      setWebsiteImporting(false)
    }
  }

  async function saveWebsiteDraft(action: 'update' | 'publish' | 'discard') {
    if (!websiteImportJob) return
    setWebsiteDraftSaving(true)
    setWebsiteImportMessage(null)
    try {
      const response = await fetch(`/api/rag/website-import/${websiteImportJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: websiteDraftTitle,
          content: websiteDraftContent,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to update website draft.')

      setWebsiteImportJob(payload.job ?? null)
      setWebsiteImportPages(payload.pages ?? [])
      if (action === 'publish') {
        setWebsiteImportMessage('Website draft published to the knowledge base. Use Prepare for Chatbot when ready.')
        setWebsiteDraftTitle('')
        setWebsiteDraftContent('')
        await loadKnowledge()
        await refreshStatusCounts()
      } else if (action === 'discard') {
        setWebsiteImportMessage('Website draft discarded.')
        setWebsiteDraftTitle('')
        setWebsiteDraftContent('')
      } else {
        setWebsiteImportMessage('Website draft saved.')
      }
      await loadImportHistory()
    } catch (draftError) {
      setWebsiteImportMessage(draftError instanceof Error ? draftError.message : 'Failed to update website draft.')
    } finally {
      setWebsiteDraftSaving(false)
    }
  }

  async function saveKnowledge() {
    setKnowledgeSaving(true)
    setKnowledgeMessage(null)
    setManualKnowledgeProgress(createKnowledgeProgress('manual'))
    try {
      const method = editingKnowledgeId ? 'PATCH' : 'POST'
      const url = editingKnowledgeId
        ? `/api/rag/knowledge/${editingKnowledgeId}`
        : '/api/rag/knowledge'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: knowledgeTitle,
          content: knowledgeText,
          sourceType: knowledgeSourceType,
          status: 'active',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save knowledge.')

      setKnowledgeTitle('')
      setKnowledgeText('')
      setKnowledgeSourceType('manual')
      setEditingKnowledgeId(null)
      setSelectedKnowledge(payload.source ?? null)
      const message = cleanOperationMessage(
        payload.userMessage ?? payload.embeddingSummary?.userMessage ?? payload.embeddingSummary?.message,
        editingKnowledgeId ? 'Knowledge updated, cleaned, and chunked.' : 'Knowledge added, cleaned, and chunked.',
      )
      setManualKnowledgeProgress(createKnowledgeProgress('manual', 'done', message))
      setKnowledgeMessage(message)
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (saveError) {
      const message = cleanOperationMessage(
        saveError instanceof Error ? saveError.message : null,
        'Failed to save knowledge.',
      )
      setManualKnowledgeProgress(createKnowledgeProgress('manual', 'failed', message))
      setKnowledgeMessage(message)
    } finally {
      setKnowledgeSaving(false)
    }
  }

  async function viewKnowledge(id: string) {
    setKnowledgeMessage(null)
    setEditingKnowledgeId(null)
    try {
      const response = await fetch(`/api/rag/knowledge/${id}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load knowledge source.')
      setSelectedKnowledge(payload.source)
    } catch (viewError) {
      setKnowledgeMessage(viewError instanceof Error ? viewError.message : 'Failed to load knowledge source.')
    }
  }

  async function editKnowledge(id: string) {
    const response = await fetch(`/api/rag/knowledge/${id}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setKnowledgeMessage(payload.error ?? 'Failed to edit knowledge source.')
      return
    }
    setEditingKnowledgeId(id)
    setKnowledgeTitle(payload.source.title)
    setKnowledgeText(payload.source.content)
    setKnowledgeSourceType(payload.source.sourceType ?? 'manual')
    setSelectedKnowledge(null)
  }

  async function deleteKnowledge(id: string) {
    if (!window.confirm('Delete this knowledge source permanently? This will remove its content, chunks, and embeddings. This cannot be undone.')) return
    setKnowledgeMessage(null)
    try {
      const response = await fetch(`/api/rag/knowledge/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to delete knowledge.')
      if (selectedKnowledge?.id === id) setSelectedKnowledge(null)
      setKnowledgeSources((current) => current.filter((source) => source.id !== id))
      setKnowledgeMessage('Knowledge deleted permanently.')
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (deleteError) {
      setKnowledgeMessage(deleteError instanceof Error ? deleteError.message : 'Failed to delete knowledge.')
    }
  }

  async function prepareKnowledge(id: string) {
    setPreparingKnowledgeId(id)
    setKnowledgeMessage(null)
    try {
      const response = await fetch(`/api/rag/knowledge/${id}/embed`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to prepare knowledge.')

      const message = cleanOperationMessage(
        payload.userMessage ?? payload.summary?.userMessage ?? payload.summary?.message,
        'Knowledge prepared for chatbot.',
      )
      setKnowledgeMessage(message)
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (prepareError) {
      const message = cleanOperationMessage(
        prepareError instanceof Error ? prepareError.message : null,
        'Failed to prepare knowledge.',
      )
      setKnowledgeMessage(message)
    } finally {
      setPreparingKnowledgeId(null)
    }
  }

  async function askTestChat() {
    setChatLoading(true)
    setChatMessage(null)
    setChatAnswer(null)
    const question = chatQuestion.trim()
    try {
      if (chatUnavailableMessage) throw new Error(chatUnavailableMessage)

      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          messages: chatHistory.slice(-20),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Chat request failed.')

      const result = payload as RagChatResponse
      setChatAnswer(result)
      setChatHistory((current) => [
        ...current,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: result.answer },
      ].slice(-20))
      setChatQuestion('')
      await loadLogs()
    } catch (chatError) {
      setChatMessage(chatError instanceof Error ? chatError.message : 'Chat request failed.')
    } finally {
      setChatLoading(false)
    }
  }

  if (!workspace.loading && !canView) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-950/20 p-6 text-red-100">
        <h1 className="text-xl font-bold">AI Chatbot</h1>
        <p className="mt-2 text-sm text-red-100/80">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section data-ai-status-cards className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={cn(
              'group min-h-44 rounded-[2rem] bg-gradient-to-br from-[#07130e] via-[#0a1a13] to-[#10261b] p-6 hover:bg-[#123226]/70 sm:p-7',
              chatbotCardBorderClass,
            )}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <span className="flex size-14 items-center justify-center rounded-3xl border border-emerald-300/25 bg-emerald-300/12 shadow-[0_12px_35px_rgba(61,223,132,0.12)]">
                <card.icon className="size-6 text-emerald-300" />
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide',
                  card.tone === 'good'
                    ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100'
                    : card.tone === 'warn'
                      ? 'border-amber-300/45 bg-amber-300/15 text-amber-100'
                      : 'border-[#5f5326] bg-[#3a3215] text-amber-100',
                )}
              >
                {card.value}
              </span>
            </div>
            <p className="text-lg font-black tracking-tight text-white">{card.title}</p>
            <p className="mt-3 text-sm font-bold text-emerald-100">{card.eyebrow}</p>
            <p className="mt-2 text-sm leading-6 text-[#a9c6bb]">{card.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard
          title="AI Provider Settings"
          description="Choose your provider and save your API key. Model and base URL are stored server-side; no API key is returned to the browser."
          icon={KeyRound}
          status={statusLabel(status?.provider.lastTestStatus ?? null, status?.provider.configured === true)}
          statusClassName={statusClasses(status?.provider.lastTestStatus ?? null, status?.provider.configured === true)}
          maskedKey={status?.provider.maskedKey}
          message={providerMessage}
        >
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as RagProviderType)}
              disabled={!canManageProvider}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {providers.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">Model</span>
            <input
              value={providerModel}
              onChange={(event) => setProviderModel(event.target.value)}
              placeholder="Example: gpt-4o-mini, openai/gpt-4o-mini, gemini-2.0-flash"
              disabled={!canManageProvider}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">Base URL</span>
            <input
              value={providerBaseUrl}
              onChange={(event) => setProviderBaseUrl(event.target.value)}
              placeholder="Optional OpenAI-compatible base URL"
              disabled={!canManageProvider}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">API Key</span>
            <input
              type="password"
              value={providerKey}
              onChange={(event) => setProviderKey(event.target.value)}
              placeholder="Paste your API key"
              disabled={!canManageProvider}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <ActionRow
            canManage={canManageProvider}
            busy={providerSaving}
            onSave={saveProvider}
            onTest={testProvider}
            saveDisabled={!providerKey.trim()}
          />
        </SettingsCard>

        <SettingsCard
          title="Firecrawl Settings"
          description="Save your Firecrawl key so website import can crawl, clean, and create a review draft before publishing."
          icon={Globe}
          status={statusLabel(status?.firecrawl.lastTestStatus ?? null, status?.firecrawl.configured === true)}
          statusClassName={statusClasses(status?.firecrawl.lastTestStatus ?? null, status?.firecrawl.configured === true)}
          maskedKey={status?.firecrawl.maskedKey}
          message={firecrawlMessage}
        >
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">Firecrawl API Key</span>
            <input
              type="password"
              value={firecrawlKey}
              onChange={(event) => setFirecrawlKey(event.target.value)}
              placeholder="Paste your Firecrawl API key"
              disabled={!canManageProvider}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <ActionRow
            canManage={canManageProvider}
            busy={firecrawlSaving}
            onSave={saveFirecrawl}
            onTest={testFirecrawl}
            saveDisabled={!firecrawlKey.trim()}
          />
          <FirecrawlCreditsPanel credits={firecrawlCredits} lastTestedAt={status?.firecrawl.lastTestedAt ?? null} />
        </SettingsCard>
      </div>

      <section className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Globe className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Website Knowledge Import</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Import public website pages into the knowledge base. Firecrawl discovers pages,
              the CRM skips private paths, and saved content is chunked up to the knowledge limit.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
            Multi-page import
          </span>
        </div>

        {!firecrawlReady && (
          <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Add your Firecrawl API key first.
          </div>
        )}

        <div className="grid gap-5 rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#0d1b15]/75 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-4 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 p-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Website URL</span>
              <input
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://example.com"
                disabled={!canManageKnowledge || websiteImporting}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Page limit</span>
              <select
                value={websitePageLimit}
                onChange={(event) => setWebsitePageLimit(Number(event.target.value))}
                disabled={!canManageKnowledge || websiteImporting}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {[5, 25, 50, 100].map((limit) => (
                  <option key={limit} value={limit}>{limit} pages</option>
                ))}
              </select>
            </label>
            <p className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15] p-3 text-xs leading-5 text-[#a9c6bb]">
              The import creates a review draft and chunks only. Embeddings stay pending until you click Prepare for Chatbot.
            </p>
            <button
              type="button"
              onClick={importWebsite}
              disabled={!canManageKnowledge || websiteImporting || !websiteUrl.trim()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
            >
              {websiteImporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
                {websiteImporting ? 'Importing...' : 'Import Website Knowledge'}
            </button>
            <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 px-3 py-2 text-[#d8fff1]">
                Page limit: {websitePageLimit.toLocaleString()} pages
              </div>
              <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 px-3 py-2 text-[#d8fff1]">
                Firecrawl: {firecrawlReady ? 'Configured' : 'Needs API key'}
              </div>
              {websiteImportStats && (
                <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 px-3 py-2 text-[#d8fff1] sm:col-span-2 xl:col-span-1">
                  Last import: {websiteImportStats.pagesImported} imported · {websiteImportStats.pagesSkipped} skipped · {websiteImportStats.pagesFailed} failed
                </div>
              )}
            </div>
          </div>

          <WebsiteImportLiveScreen
            importing={websiteImporting}
            progress={websiteImportProgress}
            url={websiteUrl || websiteImportJob?.websiteUrl || websiteImportStats?.pages?.[0]?.url || ''}
            stats={websiteImportStats}
            pages={websiteImportPages}
            message={websiteImportMessage}
          />
        </div>
        {websiteImportMessage && (
          <p className="mt-4 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
            {websiteImportMessage}
          </p>
        )}
        {websiteImportStats && (
          <div className="mt-4 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Website import summary</h3>
              <span className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                websiteImportStats.capped
                  ? 'border-amber-300/50 bg-amber-300/10 text-amber-100'
                  : 'border-emerald-300/50 bg-emerald-300/10 text-emerald-100',
              )}>
                {websiteImportStats.capped ? 'Content limit reached' : 'Imported'}
              </span>
            </div>
            <dl className="grid gap-2 text-xs text-[#a9c6bb] sm:grid-cols-2 lg:grid-cols-4">
              <div>{websiteImportStats.pagesFound.toLocaleString()} pages found</div>
              <div>{websiteImportStats.pagesImported.toLocaleString()} pages imported</div>
              <div>{websiteImportStats.pagesSkipped.toLocaleString()} pages skipped</div>
              <div>{websiteImportStats.pagesFailed.toLocaleString()} pages failed</div>
              <div>{websiteImportStats.duplicatePages.toLocaleString()} duplicates</div>
              <div>{(websiteImportStats.lowValuePagesSkipped ?? 0).toLocaleString()} low-value pages skipped</div>
              <div>{(websiteImportStats.rawCharacters ?? 0).toLocaleString()} raw characters collected</div>
              <div>{(websiteImportStats.duplicateJunkCharactersRemoved ?? 0).toLocaleString()} duplicate/junk characters removed</div>
              <div>{websiteImportStats.savedCharacters.toLocaleString()} characters saved</div>
              <div>Limit: {websiteImportStats.pageLimit.toLocaleString()} pages</div>
              <div>{websiteImportStats.capped ? 'Saved content was capped.' : 'Content was not capped.'}</div>
              <div>AI structuring: {websiteImportStats.aiStructuringUsed ? 'yes' : 'no'}</div>
              <div>Deterministic fallback: {websiteImportStats.deterministicFallbackUsed ? 'yes' : 'no'}</div>
              <div className="sm:col-span-2">Firecrawl modes: {(websiteImportStats.firecrawlModesUsed ?? ['crawl']).join(', ')}</div>
            </dl>
            {websiteImportStats.structuredRecords && (
              <p className="mt-3 text-xs leading-5 text-[#8bb4a5]">
                Structured records:{' '}
                {Object.entries(websiteImportStats.structuredRecords)
                  .filter(([, count]) => count > 0)
                  .map(([name, count]) => `${name.replace(/([A-Z])/g, ' $1').toLowerCase()} (${count})`)
                  .join(', ') || 'none detected'}
              </p>
            )}
            {websiteImportStats.warnings && websiteImportStats.warnings.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-amber-100">
                Warnings: {websiteImportStats.warnings.join(' ')}
              </p>
            )}
            {websiteImportStats.skippedReasons && Object.keys(websiteImportStats.skippedReasons).length > 0 && (
              <p className="mt-3 text-xs leading-5 text-[#8bb4a5]">
                Skipped reasons:{' '}
                {Object.entries(websiteImportStats.skippedReasons)
                  .map(([reason, count]) => `${reason.replaceAll('_', ' ')} (${count})`)
                  .join(', ')}
              </p>
            )}
            {websiteImportStats.pages && websiteImportStats.pages.length > 0 && (
              <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-200">Pages checked</p>
                <div className="space-y-2">
                  {websiteImportStats.pages.slice(0, 50).map((importPage, index) => (
                    <div key={`${importPage.status}:${importPage.url}:${index}`} className="rounded-xl border border-[#1b3c2d] bg-[#091811] p-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 break-words font-semibold text-white">
                          {importPage.title ?? importPage.canonicalUrl ?? importPage.url}
                        </p>
                        <span className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase',
                          importPage.status === 'imported'
                            ? 'border-emerald-300/50 text-emerald-100'
                            : importPage.status === 'failed'
                              ? 'border-red-300/50 text-red-100'
                              : 'border-amber-300/50 text-amber-100',
                        )}>
                          {importPage.status}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-[#8bb4a5]">{importPage.canonicalUrl ?? importPage.url}</p>
                      {importPage.skipReason && (
                        <p className="mt-1 text-amber-100">Reason: {importPage.skipReason.replaceAll('_', ' ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {websiteImportJob && (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Review draft before publishing</h3>
                  <p className="text-xs text-[#8bb4a5]">
                    Draft status: {websiteImportJob.status.replace('_', ' ')} · {websiteImportJob.savedCharacters.toLocaleString()} characters
                  </p>
                  <p className="mt-1 text-xs text-amber-100">
                    Existing published knowledge remains unchanged until you publish this draft.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-100">
                  Provider: Firecrawl
                </span>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Draft title</span>
                <input
                  value={websiteDraftTitle}
                  onChange={(event) => setWebsiteDraftTitle(event.target.value)}
                  disabled={websiteDraftSaving || websiteImportJob.status !== 'draft_ready'}
                  className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <label className="mt-3 block space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Draft content</span>
                <textarea
                  value={websiteDraftContent}
                  onChange={(event) => setWebsiteDraftContent(event.target.value)}
                  disabled={websiteDraftSaving || websiteImportJob.status !== 'draft_ready'}
                  rows={12}
                  className="min-h-72 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#8bb4a5]">
                  {(websiteDraftContent.length || 0).toLocaleString()} / {RAG_KNOWLEDGE_CHARACTER_LIMIT.toLocaleString()} characters
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveWebsiteDraft('discard')}
                    disabled={websiteDraftSaving || websiteImportJob.status !== 'draft_ready'}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-3 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    onClick={() => saveWebsiteDraft('update')}
                    disabled={websiteDraftSaving || websiteImportJob.status !== 'draft_ready'}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-3 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={() => saveWebsiteDraft('publish')}
                    disabled={websiteDraftSaving || websiteImportJob.status !== 'draft_ready' || !websiteDraftContent.trim()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                  >
                    Publish to Knowledge Base
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <h3 className="text-sm font-bold text-white">Page review list</h3>
              <p className="mt-1 text-xs text-[#8bb4a5]">Showing up to 30 checked pages.</p>
              <div className="mt-3 max-h-[34rem] space-y-2 overflow-y-auto">
                {websiteImportPages.slice(0, 30).map((importPage, index) => (
                  <div key={`${importPage.url}:${index}`} className="rounded-xl border border-[#1b3c2d] bg-[#07130e]/80 p-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold text-white">
                        {importPage.title ?? importPage.canonicalUrl ?? importPage.url}
                      </p>
                      <span className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 font-bold uppercase',
                        importPage.status === 'imported'
                          ? 'border-emerald-300/50 text-emerald-100'
                          : importPage.status === 'failed'
                            ? 'border-red-300/50 text-red-100'
                            : 'border-amber-300/50 text-amber-100',
                      )}>
                        {importPage.status}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-[#8bb4a5]">{importPage.canonicalUrl ?? importPage.url}</p>
                    {typeof importPage.characterCount === 'number' && (
                      <p className="mt-1 text-[#8bb4a5]">{importPage.characterCount.toLocaleString()} characters</p>
                    )}
                    {importPage.skipReason && (
                      <p className="mt-1 text-amber-100">Reason: {importPage.skipReason.replaceAll('_', ' ')}</p>
                    )}
                  </div>
                ))}
                {websiteImportPages.length === 0 && (
                  <p className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 px-3 py-6 text-center text-sm text-[#8bb4a5]">
                    Page review details will appear after an import.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Manual Knowledge Base</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Add business knowledge, FAQs, instructions, or reviewed website text. Chunks will be
              created automatically. Use Prepare for Chatbot when you are ready to create embeddings;
              this can use provider API cost.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
            500,000 character limit
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Knowledge type</span>
              <select
                value={knowledgeSourceType}
                onChange={(event) => setKnowledgeSourceType(event.target.value as typeof knowledgeSourceType)}
                disabled={!canManageKnowledge}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="manual">Business knowledge</option>
                <option value="faq">FAQ</option>
                <option value="note">Instructions</option>
                <option value="website">Website import</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Knowledge Title</span>
              <input
                value={knowledgeTitle}
                onChange={(event) => setKnowledgeTitle(event.target.value)}
                placeholder="Example: Company contact details"
                disabled={!canManageKnowledge}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Knowledge Text</span>
              <textarea
                value={knowledgeText}
                onChange={(event) => setKnowledgeText(event.target.value)}
                placeholder="Paste your business information, FAQs, pricing, policies, or service details here."
                disabled={!canManageKnowledge}
                rows={10}
                className="min-h-52 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn('text-xs', knowledgeOverLimit ? 'text-red-200' : 'text-[#8bb4a5]')}>
                {knowledgeCharacters.toLocaleString()} / {RAG_KNOWLEDGE_CHARACTER_LIMIT.toLocaleString()} characters
              </p>
              <div className="flex gap-2">
                {editingKnowledgeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKnowledgeId(null)
                      setKnowledgeTitle('')
                      setKnowledgeText('')
                      setKnowledgeSourceType('manual')
                    }}
                    className="h-10 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] hover:bg-[#123226]"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveKnowledge}
                  disabled={
                    !canManageKnowledge ||
                    knowledgeSaving ||
                    knowledgeOverLimit ||
                    !knowledgeTitle.trim() ||
                    !knowledgeText.trim()
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                >
                  {knowledgeSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {editingKnowledgeId ? 'Saving...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      {editingKnowledgeId ? 'Update Knowledge' : 'Save Knowledge'}
                    </>
                  )}
                </button>
              </div>
            </div>
            {!canManageKnowledge && (
              <p className="text-xs text-[#8bb4a5]">Manage AI Chatbot permission is required to add or edit knowledge.</p>
            )}
            {knowledgeMessage && (
              <p className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-sm text-[#d8fff1]">
                {knowledgeMessage}
              </p>
            )}
          </div>

          <ManualKnowledgeStatusScreen progress={manualKnowledgeProgress} saving={knowledgeSaving} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Database className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Saved Knowledge</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Review active sources, prepare chunks for chatbot answers, edit content, or permanently delete old knowledge.
            </p>
          </div>
          <span className="rounded-full border border-[#315846] bg-[#0d1b15] px-3 py-1 text-xs font-bold text-[#d8fff1]">
            {knowledgeSources.length.toLocaleString()} sources
          </span>
        </div>

        <div className="space-y-4">
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70">
              <div className="border-b border-[#3ddf84]/35 px-4 py-3">
                <h3 className="font-bold text-white">Knowledge Preview</h3>
                <p className="text-xs text-[#8bb4a5]">Knowledge preview, preparation status, and source actions.</p>
              </div>
              <div className="divide-y divide-[#3ddf84]/25">
                {knowledgeSources.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#8bb4a5]">
                    No knowledge added yet.
                  </div>
                ) : (
                  knowledgeSources.map((source) => (
                    <article key={source.id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="font-bold text-white">{source.title}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                            {sourceTypeLabel(source.sourceType)} · {source.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => prepareKnowledge(source.id)}
                            disabled={!canManageKnowledge || preparingKnowledgeId === source.id}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#3ddf84] bg-[#3ddf84] px-2.5 text-xs font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                          >
                            {preparingKnowledgeId === source.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                          {preparingKnowledgeId === source.id ? 'Preparing...' : 'Prepare for Chatbot'}
                          </button>
                          <button
                            type="button"
                            onClick={() => viewKnowledge(source.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#3ddf84] bg-[#3ddf84] px-2.5 text-xs font-bold text-[#07130e] transition hover:bg-[#ffbd29]"
                          >
                            <Eye className="size-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => editKnowledge(source.id)}
                            disabled={!canManageKnowledge}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#3ddf84] bg-[#3ddf84] px-2.5 text-xs font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteKnowledge(source.id)}
                            disabled={!canManageKnowledge}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-400/40 px-2.5 text-xs font-bold text-red-100 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                      <dl className="grid gap-2 text-xs text-[#a9c6bb] sm:grid-cols-2 xl:grid-cols-3">
                        <div>Created: {formatDate(source.createdAt)}</div>
                        <div>Updated: {formatDate(source.updatedAt)}</div>
                        <div>{source.characterCount.toLocaleString()} characters</div>
                        <div>{source.chunkCount.toLocaleString()} chunks</div>
                        <div>Status: {knowledgeStatusLabel(source)}</div>
                        <div>{source.readyEmbeddingCount.toLocaleString()} ready embeddings</div>
                        <div>{source.failedEmbeddingCount.toLocaleString()} failed embeddings</div>
                        {source.sourceUrl && (
                          <div className="truncate xl:col-span-3">URL: {source.sourceUrl}</div>
                        )}
                      </dl>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                          embeddingStatusClasses(source.embeddingStatus),
                        )}
                      >
                        {embeddingStatusLabel(source.embeddingStatus)}
                      </span>
                    </article>
                  ))
                )}
              </div>
            </div>

        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Bot className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Chatbot Instructions</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
                Control the customer-facing tone, fallback wording, handover prompt, and live
                WhatsApp auto-reply switch without changing webhook credentials.
              </p>
            </div>
            <span className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold',
              chatbotSettings?.enabled === false
                ? 'border-amber-300/40 bg-amber-300/10 text-amber-100'
                : 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
            )}>
              {chatbotSettings?.enabled === false ? 'Paused' : 'Enabled'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => saveChatbotSettings({ enabled: !(chatbotSettings?.enabled ?? true) })}
                disabled={chatbotSettingsSaving}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4 text-left transition hover:border-emerald-300/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-bold text-white">Chatbot enabled</span>
                  <span className="mt-1 block text-xs text-[#8bb4a5]">Allow dashboard and channel replies.</span>
                </span>
                <SwitchPill checked={chatbotSettings?.enabled ?? true} />
              </button>
              <button
                type="button"
                onClick={() => saveChatbotSettings({ handoverEnabled: !(chatbotSettings?.handoverEnabled ?? true) })}
                disabled={chatbotSettingsSaving}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4 text-left transition hover:border-emerald-300/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-bold text-white">Handover enabled</span>
                  <span className="mt-1 block text-xs text-[#8bb4a5]">Offer team help when answers are missing.</span>
                </span>
                <SwitchPill checked={chatbotSettings?.handoverEnabled ?? true} />
              </button>
              <button
                type="button"
                onClick={() => saveAutoReply({ enabled: !(autoReply?.enabled ?? false) })}
                disabled={!autoReply || autoReplySaving || !canEnableAutoReply}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4 text-left transition hover:border-emerald-300/50 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
              >
                <span>
                  <span className="block text-sm font-bold text-white">Live WhatsApp auto-reply</span>
                  <span className="mt-1 block text-xs text-[#8bb4a5]">
                    Uses the existing WhatsApp connection only when provider and knowledge are ready.
                  </span>
                </span>
                <SwitchPill checked={autoReply?.enabled === true} />
              </button>
            </div>

            {autoReply && (!autoReply.whatsappConnected || !autoReply.providerConfigured || !autoReply.knowledgeReady) && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Auto-reply readiness: WhatsApp {autoReply.whatsappConnected ? 'connected' : 'not connected'},
                provider {autoReply.providerConfigured ? 'configured' : 'not configured'}, knowledge{' '}
                {autoReply.knowledgeReady ? 'ready' : 'needs preparation'}.
              </div>
            )}

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Tone & Style</span>
              <select
                value={chatbotSettings?.tone ?? 'professional'}
                onChange={(event) => saveChatbotSettings({ tone: event.target.value as RagChatbotSettings['tone'] })}
                disabled={chatbotSettingsSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="concise">Concise</option>
                <option value="helpful">Supportive</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">General Instructions</span>
              <textarea
                value="Answer only from approved business knowledge. Do not guess, expose internal debug text, or reveal private configuration."
                readOnly
                rows={3}
                className="w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-[#a9c6bb] outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Fallback Message</span>
              <textarea
                value={chatbotSettings?.fallbackMessage ?? ''}
                onChange={(event) => setChatbotSettings((current) => current ? { ...current, fallbackMessage: event.target.value } : current)}
                placeholder="I do not see that information in the current knowledge base."
                rows={3}
                disabled={chatbotSettingsSaving}
                className="w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Handoff Message</span>
              <textarea
                value={chatbotSettings?.handoverMessage ?? ''}
                onChange={(event) => setChatbotSettings((current) => current ? { ...current, handoverMessage: event.target.value } : current)}
                placeholder="I can connect you with a team member if you want."
                rows={3}
                disabled={chatbotSettingsSaving}
                className="w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#8bb4a5]">
                WhatsApp fallback mode: {autoReply?.fallbackMode === 'send_fallback' ? 'Send fallback message' : 'Do not send message if answer is not found'}
              </p>
              <button
                type="button"
                onClick={() => saveChatbotSettings()}
                disabled={chatbotSettingsSaving || !chatbotSettings}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
              >
                {chatbotSettingsSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save Settings
              </button>
            </div>

            {(chatbotSettingsMessage || autoReplyMessage) && (
              <p className="rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
                {chatbotSettingsMessage ?? autoReplyMessage}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Test Chatbot</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
                Ask a customer-style question from prepared manual or website knowledge. Debug and
                retrieval internals stay hidden so the preview matches a clean customer answer.
                Recent browser memory helps follow-up questions keep their recent context.
              </p>
            </div>
            <span className="rounded-full border border-[#315846] bg-[#0d1b15] px-3 py-1 text-xs font-bold text-[#d8fff1]">
              Dashboard only
            </span>
          </div>

          {chatUnavailableMessage && (
            <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              {chatUnavailableMessage}
            </div>
          )}

          <div className="grid gap-5">
          <div className="space-y-4 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Question</span>
              <textarea
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                placeholder="Ask a question from your saved knowledge..."
                rows={5}
                maxLength={2000}
                disabled={Boolean(chatUnavailableMessage)}
                className="min-h-32 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#8bb4a5]">
                {chatQuestion.length.toLocaleString()} / 2,000 characters
                {chatHistory.length > 0 ? ` · ${chatHistory.length} memory messages` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {chatHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setChatHistory([])}
                    disabled={chatLoading}
                    className="inline-flex h-10 items-center rounded-xl border border-[#315846] px-3 text-sm font-bold text-[#d8fff1] transition hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear memory
                  </button>
                )}
                <button
                  type="button"
                  onClick={askTestChat}
                  disabled={chatLoading || Boolean(chatUnavailableMessage) || !chatQuestion.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                >
                  <MessageSquare className="size-4" />
                  {chatLoading ? 'Asking...' : 'Ask Test Question'}
                </button>
              </div>
            </div>
            {chatMessage && (
              <p className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-sm text-[#d8fff1]">
                {chatMessage}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <h3 className="font-bold text-white">Answer</h3>
              {chatAnswer ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#d8fff1]">
                  {chatAnswer.answer}
                </p>
              ) : (
                <p className="mt-3 text-sm text-[#8bb4a5]">
                  The answer will appear here after you ask a question.
                </p>
              )}
            </div>

            {chatAnswer && (
              <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4 text-sm text-[#a9c6bb]">
                This customer-style tester only shows the final chatbot answer. Retrieval/debug
                details are intentionally hidden from the restored dashboard UI.
              </div>
            )}
          </div>
        </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Clock className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Schedule & Import History</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
                Store planned re-scrape schedules and review recent website import activity.
                Actual scheduled sync remains pending until explicitly approved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                loadSchedules()
                loadImportHistory()
              }}
              className="h-9 rounded-xl border border-[#315846] px-3 text-xs font-bold text-[#d8fff1] hover:bg-[#123226]"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4 lg:grid-cols-[minmax(0,1fr)_140px_120px_120px_120px_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Website URL</span>
              <input
                value={scheduleUrl}
                onChange={(event) => setScheduleUrl(event.target.value)}
                placeholder="https://example.com"
                disabled={!canManageKnowledge || scheduleSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Frequency</span>
              <select
                value={scheduleFrequency}
                onChange={(event) => setScheduleFrequency(event.target.value as typeof scheduleFrequency)}
                disabled={!canManageKnowledge || scheduleSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option disabled>Manual only</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Limit</span>
              <select
                value={schedulePageLimit}
                onChange={(event) => setSchedulePageLimit(Number(event.target.value))}
                disabled={!canManageKnowledge || scheduleSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {[5, 25, 50, 100].map((limit) => (
                  <option key={limit} value={limit}>{limit}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Day</span>
              <select
                value={scheduleDayOfWeek}
                onChange={(event) => setScheduleDayOfWeek(Number(event.target.value))}
                disabled={!canManageKnowledge || scheduleSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#d8fff1]">Hour UTC</span>
              <select
                value={scheduleHourUtc}
                onChange={(event) => setScheduleHourUtc(Number(event.target.value))}
                disabled={!canManageKnowledge || scheduleSaving}
                className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {Array.from({ length: 24 }, (_item, hour) => (
                  <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setScheduleAutoPublish((value) => !value)}
              disabled={!canManageKnowledge || scheduleSaving}
              className="flex h-11 items-center justify-between gap-3 rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-[#d8fff1] transition hover:border-[#3ddf84]/60 hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Auto-publish</span>
              <SwitchPill checked={scheduleAutoPublish} />
            </button>
            <button
              type="button"
              onClick={saveSchedule}
              disabled={!canManageKnowledge || scheduleSaving || !scheduleUrl.trim()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
            >
              Add Schedule
            </button>
          </div>
          {scheduleMessage && (
            <p className="mt-3 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
              {scheduleMessage}
            </p>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70">
              <div className="border-b border-[#3ddf84]/35 px-4 py-3">
                <h3 className="font-bold text-white">Saved schedules</h3>
              </div>
              <div className="divide-y divide-[#3ddf84]/25">
                {schedules.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#8bb4a5]">No schedules saved yet.</p>
                ) : schedules.map((schedule) => (
                  <article key={schedule.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="break-all font-bold text-white">{schedule.url}</p>
                        <p className="text-xs text-[#8bb4a5]">
                          {schedule.frequency} · {schedule.pageLimit} pages · {schedule.autoPublish ? 'auto-publish enabled' : 'review required'} · {schedule.isActive ? 'active' : 'paused'}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-[#315846] px-2 py-1 text-xs font-bold text-[#8bb4a5] opacity-70"
                        >
                          {schedule.isActive ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-[#315846] px-2 py-1 text-xs font-bold text-[#8bb4a5] opacity-70"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-[#315846] px-2 py-1 text-xs font-bold text-[#8bb4a5] opacity-70"
                        >
                          Require Review
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSchedule(schedule.id)}
                          disabled={!canManageKnowledge || scheduleSaving}
                          className="rounded-lg border border-red-300/40 px-2 py-1 text-xs font-bold text-red-100 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70">
              <div className="border-b border-[#3ddf84]/35 px-4 py-3">
                <h3 className="font-bold text-white">Import history</h3>
              </div>
              <div className="max-h-80 divide-y divide-[#3ddf84]/25 overflow-y-auto">
                {importHistory.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#8bb4a5]">No import history yet.</p>
                ) : importHistory.map((history) => (
                  <article key={history.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full border border-[#315846] px-2 py-1 text-[11px] font-bold uppercase text-[#d8fff1]">
                        {history.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-[#8bb4a5]">{formatDateTime(history.createdAt)}</span>
                    </div>
                    <p className="break-all font-semibold text-white">{history.url ?? 'Manual import'}</p>
                    <p className="text-xs text-[#8bb4a5]">
                      {history.pagesFound} found · {history.pagesImported} imported · {history.pagesSkipped} skipped · {history.pagesFailed} failed
                    </p>
                    {(history.changeSummary || history.errorMessage) && (
                      <p className="text-xs text-[#a9c6bb]">{history.errorMessage ?? history.changeSummary}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {history.status === 'draft_ready' && (
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border border-[#3ddf84]/30 bg-[#3ddf84]/20 px-2 py-1 text-xs font-bold text-[#d8fff1] opacity-80"
                        >
                          Review & Publish
                        </button>
                      )}
                      <button
                        type="button"
                        disabled
                        className="rounded-lg border border-[#3ddf84]/30 bg-[#3ddf84]/20 px-2 py-1 text-xs font-bold text-[#d8fff1] opacity-70"
                      >
                        Load More
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

      </section>

      <section className="grid gap-6">
        <div className="rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Chatbot Activity & Unanswered Questions</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
                Review recent activity, fallbacks, failures, and unanswered questions in one place.
                Secrets, raw prompts, provider JSON, and embeddings are never shown here.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  loadLogs()
                  loadKnowledgeGaps()
                }}
                disabled={logsLoading}
                className="h-9 rounded-xl border border-[#315846] px-3 text-xs font-bold text-[#d8fff1] hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {logsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={loadKnowledgeGaps}
                className="h-9 rounded-xl border border-[#315846] px-3 text-xs font-bold text-[#d8fff1] hover:bg-[#123226]"
              >
                Show Recent 20
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Answered</p>
              <p className="mt-1 text-2xl font-black text-emerald-100">{logs.filter((log) => log.status === 'answered').length}</p>
            </div>
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Fallback / Failed</p>
              <p className="mt-1 text-2xl font-black text-amber-100">{logs.filter((log) => log.status !== 'answered').length}</p>
            </div>
            <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Unanswered</p>
              <p className="mt-1 text-2xl font-black text-white">{knowledgeGaps.length}</p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['dashboard', 'Dashboard'],
              ['whatsapp', 'WhatsApp'],
              ['answered', 'Answered'],
              ['fallback', 'Fallback'],
              ['failed', 'Failed'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLogFilter(value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold transition',
                  logFilter === value
                    ? 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100'
                    : 'border-[#315846] bg-[#0d1b15] text-[#a9c6bb] hover:bg-[#123226]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {(logsMessage || gapsMessage) && (
            <p className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
              {logsMessage ?? gapsMessage}
            </p>
          )}

          <div className="divide-y divide-[#3ddf84]/25 overflow-hidden rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70">
            {visibleActivityItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#8bb4a5]">
                No chatbot activity or unanswered questions yet.
              </div>
            ) : (
              visibleActivityItems.map((item) => (
                <article key={item.id} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#315846] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#d8fff1]">
                        {item.channel}
                      </span>
                      <span className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                        item.status === 'answered'
                          ? 'bg-emerald-400/15 text-emerald-100'
                          : item.status === 'unanswered' || item.status === 'fallback'
                            ? 'bg-[#ffbd29]/15 text-[#ffbd29]'
                            : 'bg-red-400/15 text-red-100',
                      )}>
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.kind === 'gap' && (
                        <span className="rounded-full border border-[#ffbd29]/40 px-2.5 py-1 text-[11px] font-bold uppercase text-[#ffbd29]">
                          Missing knowledge
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#8bb4a5]">{formatDateTime(item.date)}</span>
                  </div>
                  <div className="grid gap-3 text-sm lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Question</p>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#d8fff1]">{item.question}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Answer / Note</p>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#a9c6bb]">
                        {item.answer || 'No answer recorded.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#8bb4a5]">
                    <span>{item.meta}</span>
                    {typeof item.count === 'number' && <span>{item.count} asks</span>}
                    {item.reason && <span>Reason: {item.reason.replaceAll('_', ' ')}</span>}
                    {item.kind === 'gap' && (
                      <button
                        type="button"
                        disabled
                        className="rounded-lg border border-[#3ddf84]/30 bg-[#3ddf84]/20 px-2 py-1 text-xs font-bold text-[#d8fff1] opacity-80"
                      >
                        Add to Knowledge Base
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          {activityItems.length > visibleActivityItems.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setActivityVisibleCount((count) => count + 10)}
                className="h-10 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29]"
              >
                Load More
              </button>
            </div>
          )}
        </div>

      </section>

      {selectedKnowledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#3ddf84]/35 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Knowledge source</p>
                <h3 className="mt-1 text-xl font-black text-white">{selectedKnowledge.title}</h3>
                <p className="mt-1 text-sm text-[#8bb4a5]">
                  {sourceTypeLabel(selectedKnowledge.sourceType)} · {selectedKnowledge.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKnowledge(null)}
                className="rounded-xl border border-[#315846] px-3 py-2 text-xs font-bold text-[#d8fff1] hover:bg-[#123226]"
              >
                Close
              </button>
            </div>
            <div className="grid max-h-[calc(90vh-7rem)] gap-4 overflow-y-auto p-5 lg:grid-cols-[0.8fr_1.2fr]">
              <dl className="space-y-3 text-sm text-[#a9c6bb]">
                <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Created</dt>
                  <dd className="mt-1 text-white">{formatDate(selectedKnowledge.createdAt)}</dd>
                </div>
                <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Updated</dt>
                  <dd className="mt-1 text-white">{formatDate(selectedKnowledge.updatedAt)}</dd>
                </div>
                <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
                  <dt className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Chunks / Embeddings</dt>
                  <dd className="mt-1 text-white">
                    {selectedKnowledge.chunkCount} chunks · {selectedKnowledge.readyEmbeddingCount} ready · {selectedKnowledge.failedEmbeddingCount} failed
                  </dd>
                </div>
                {selectedKnowledge.sourceUrl && (
                  <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#0d1b15]/70 p-4">
                    <dt className="text-xs uppercase tracking-[0.16em] text-[#8bb4a5]">Source URL</dt>
                    <dd className="mt-1 break-all text-white">{selectedKnowledge.sourceUrl}</dd>
                  </div>
                )}
              </dl>
              <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#315846] bg-[#04100b] p-4 text-sm leading-6 text-[#d8fff1]">
                {selectedKnowledge.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {editingKnowledgeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#07130e] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="border-b border-[#3ddf84]/35 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Edit knowledge</p>
              <h3 className="mt-1 text-xl font-black text-white">Update Knowledge</h3>
              <p className="mt-1 text-sm text-[#8bb4a5]">
                Updating regenerates chunks and keeps embeddings pending until Prepare for Chatbot.
              </p>
            </div>
            <div className="max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto p-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Knowledge type</span>
                <select
                  value={knowledgeSourceType}
                  onChange={(event) => setKnowledgeSourceType(event.target.value as typeof knowledgeSourceType)}
                  className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
                >
                  <option value="manual">Business knowledge</option>
                  <option value="faq">FAQ</option>
                  <option value="note">Instructions</option>
                  <option value="website">Website import</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Title</span>
                <input
                  value={knowledgeTitle}
                  onChange={(event) => setKnowledgeTitle(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Content</span>
                <textarea
                  value={knowledgeText}
                  onChange={(event) => setKnowledgeText(event.target.value)}
                  rows={12}
                  className="min-h-72 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKnowledgeId(null)
                    setKnowledgeTitle('')
                    setKnowledgeText('')
                    setKnowledgeSourceType('manual')
                  }}
                  className="h-10 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] hover:bg-[#123226]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveKnowledge}
                  disabled={knowledgeSaving || knowledgeOverLimit || !knowledgeTitle.trim() || !knowledgeText.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
                >
                  {knowledgeSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Update Knowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-full border border-[#315846] bg-[#07130e] px-4 py-2 text-sm text-[#d8fff1] shadow-xl">
          Loading AI Chatbot settings...
        </div>
      )}
    </div>
  )
}

function KnowledgeProgressPanel({
  progress,
}: {
  readonly progress: KnowledgeProgressState
}) {
  const steps = knowledgeProgressSteps[progress.kind]
  const isDone = progress.status === 'done'
  const isFailed = progress.status === 'failed'
  const isWarning = progress.status === 'warning'
  const safeStep = Math.min(progress.currentStep, Math.max(steps.length - 1, 0))
  const currentMessage = progress.message || steps[safeStep] || 'Working...'
  const label = progress.kind === 'website'
    ? 'Website import progress'
    : progress.kind === 'manual'
      ? 'Manual knowledge progress'
      : 'Knowledge preparation progress'

  return (
    <div className={cn(
      'rounded-2xl border p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]',
      isFailed
        ? 'border-red-300/40 bg-red-400/10'
        : isWarning
          ? 'border-amber-300/40 bg-amber-300/10'
          : isDone
          ? 'border-emerald-300/40 bg-emerald-400/10'
          : 'border-[#315846] bg-[#07130e]',
    )}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-xs text-[#a9c6bb]">
            {isDone
              ? 'Finished. Review the result and prepare embeddings when you are ready.'
              : isFailed
                ? 'Something stopped the process. Review the message below and try again.'
                : 'The CRM is working through this safely without preparing embeddings yet.'}
          </p>
        </div>
        {progress.status === 'running' ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-emerald-200" />
        ) : isDone ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-200" />
        ) : isWarning ? (
          <XCircle className="size-4 shrink-0 text-amber-200" />
        ) : (
          <XCircle className="size-4 shrink-0 text-red-200" />
        )}
      </div>
      <div className="rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#04100b]/80 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
          {isDone ? 'Complete' : isFailed ? 'Needs attention' : `Step ${safeStep + 1} of ${steps.length}`}
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-white">{currentMessage}</p>
        <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step}
              className={cn(
                'h-1.5 min-w-6 flex-1 rounded-full',
                isDone || index <= safeStep ? 'bg-[#3ddf84]' : 'bg-[#315846]',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FirecrawlCreditsPanel({
  credits,
  lastTestedAt,
}: {
  readonly credits: FirecrawlCreditUsage | null
  readonly lastTestedAt: string | null
}) {
  const remaining = credits?.remainingCredits
  const total = credits?.totalCredits ?? credits?.limit
  const updatedAt = credits?.lastUpdatedAt ?? lastTestedAt
  const creditLine = typeof remaining === 'number'
    ? total
      ? `Credits left: ${remaining.toLocaleString()} / ${total.toLocaleString()}`
      : `Credits left: ${remaining.toLocaleString()}`
    : 'Credits left: run Test Connection'

  return (
    <div className="rounded-2xl border border-[#3ddf84]/60 transition hover:border-[#3ddf84]/80 bg-[#0d1b15]/80 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Firecrawl credits</p>
          <p className="mt-1 text-base font-bold text-emerald-100">{creditLine}</p>
          <p className="mt-1 text-xs text-[#8bb4a5]">
            Last updated: {updatedAt ? formatDateTime(updatedAt) : 'Not tested yet'}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold text-emerald-100">
          Credits
        </span>
      </div>
    </div>
  )
}

function WebsiteImportLiveScreen({
  importing,
  progress,
  url,
  stats,
  pages,
  message,
}: {
  readonly importing: boolean
  readonly progress: KnowledgeProgressState | null
  readonly url: string
  readonly stats: WebsiteImportStats | null
  readonly pages: ReadonlyArray<WebsiteImportPage>
  readonly message: string | null
}) {
  if (!importing && !stats) {
    return (
      <div className={cn('min-h-[18rem] bg-[#04100b] p-5', chatbotPanelBorderClass)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Ready to import website</p>
            <p className="mt-1 text-xs leading-5 text-[#8bb4a5]">
              Enter a website URL and click Import Website Knowledge. The CRM will collect useful public website information and prepare it for your chatbot.
            </p>
          </div>
          <span className="rounded-full border border-[#ffbd29]/60 bg-[#ffbd29] px-2.5 py-1 text-[11px] font-bold uppercase text-[#07130e]">
            Idle
          </span>
        </div>
        <div className="mt-5 grid gap-2 text-xs">
          {[
            'Website pages will be checked',
            'Useful content will be cleaned',
            'Knowledge chunks will be created',
            'Embeddings stay pending until Prepare for Chatbot',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/80 px-3 py-2 text-[#d8fff1]">
              <span className="size-2 rounded-full bg-[#3ddf84]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (importing) {
    return (
      <div className={cn('min-h-[22rem] bg-[#04100b] p-5', chatbotPanelBorderClass)}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">Live import screen</p>
            <p className="mt-1 break-all text-xs text-[#8bb4a5]">{url || 'Starting website import'}</p>
          </div>
          <span className="w-fit rounded-full border border-emerald-300/50 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
            Running
          </span>
        </div>
        <KnowledgeProgressPanel progress={progress ?? createKnowledgeProgress('website')} />
      </div>
    )
  }

  return (
    <div className={cn('min-h-[22rem] bg-[#04100b] p-5', chatbotPanelBorderClass)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">Website import result</p>
          <p className="mt-1 break-all text-xs text-[#8bb4a5]">{url || 'Website import completed'}</p>
        </div>
        <span className="w-fit rounded-full border border-emerald-300/50 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
          Completed
        </span>
      </div>
      {stats && (
        <dl className="grid gap-2 text-xs text-[#d8fff1] sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Pages imported: {stats.pagesImported}</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Pages skipped: {stats.pagesSkipped}</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Pages failed: {stats.pagesFailed}</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Duplicate pages: {stats.duplicatePages}</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Chunks ready</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e] p-3">Next step: Prepare for Chatbot</div>
        </dl>
      )}
      {stats?.warnings && stats.warnings.length > 0 && (
        <p className="mt-3 rounded-xl border border-[#ffbd29]/40 bg-[#ffbd29]/10 px-3 py-2 text-xs text-amber-100">
          Quality warnings: {stats.warnings.join(' ')}
        </p>
      )}
      {pages.length > 0 && (
        <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
          {pages.slice(0, 8).map((page, index) => (
            <div key={`${page.url}:${index}`} className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/80 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-[#d8fff1]">{page.title ?? page.url}</span>
                <span className="rounded-full border border-[#315846] px-2 py-0.5 uppercase text-[#8bb4a5]">{page.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-xs leading-5 text-[#d8fff1]">
          {message}
        </p>
      )}
    </div>
  )
}

function ManualKnowledgeStatusScreen({
  progress,
  saving,
}: {
  readonly progress: KnowledgeProgressState | null
  readonly saving: boolean
}) {
  if (!progress) {
    return (
      <div className={cn('bg-[#0d1b15]/80 p-5', chatbotPanelBorderClass)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Ready to save knowledge</p>
            <p className="mt-2 text-sm leading-6 text-[#a9c6bb]">
              Add your knowledge content and click Save Knowledge. The CRM will save it and create chunks automatically.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[#ffbd29]/70 bg-[#ffbd29] px-2.5 py-1 text-[11px] font-bold uppercase text-[#07130e]">
            Idle
          </span>
        </div>
        <div className="mt-5 grid gap-2 text-xs">
          {[
            'Content will be saved',
            'Chunks will be created automatically',
            'Embeddings will stay pending until Prepare for Chatbot',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/80 px-3 py-2 text-[#d8fff1]">
              <span className="size-2 rounded-full bg-[#3ddf84]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-[#0d1b15]/80 p-4', chatbotPanelBorderClass)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">
            {progress.status === 'done' ? 'Manual knowledge result' : 'Manual save progress'}
          </p>
          <p className="text-xs leading-5 text-[#8bb4a5]">
            Your knowledge is saved and chunked first. Embeddings stay pending until you click Prepare for Chatbot.
          </p>
        </div>
        <span className={cn(
          'rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
          saving
            ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-100'
            : 'border-[#ffbd29]/70 bg-[#ffbd29] text-[#07130e]',
        )}>
          {saving ? 'Processing' : 'Chunks ready'}
        </span>
      </div>
      <KnowledgeProgressPanel progress={progress} />
      <div className="mt-4 rounded-2xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#07130e]/70 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Result</p>
        <dl className="mt-2 grid gap-2 text-sm leading-6 text-[#d8fff1] sm:grid-cols-3">
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#04100b]/70 px-3 py-2">Knowledge saved</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#04100b]/70 px-3 py-2">Chunks ready</div>
          <div className="rounded-xl border border-[#3ddf84]/40 transition hover:border-[#3ddf84]/60 bg-[#04100b]/70 px-3 py-2">Embeddings pending</div>
        </dl>
        <p className="mt-2 text-sm leading-6 text-[#d8fff1]">
          Next step: Prepare for Chatbot when you are ready.
        </p>
      </div>
    </div>
  )
}

function SettingsCard({
  title,
  description,
  icon: Icon,
  status,
  statusClassName,
  maskedKey,
  message,
  children,
}: {
  readonly title: string
  readonly description: string
  readonly icon: typeof KeyRound
  readonly status: string
  readonly statusClassName: string
  readonly maskedKey?: string | null
  readonly message?: string | null
  readonly children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-3xl bg-[#07130e]/85 p-5', chatbotCardBorderClass)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Icon className="size-5 text-emerald-300" />
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <p className="text-sm leading-6 text-[#a9c6bb]">{description}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-bold', statusClassName)}>
          {status}
        </span>
      </div>
      {maskedKey && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#315846] bg-[#0d1b15] px-3 py-1.5 text-sm text-[#d8fff1]">
          <Lock className="size-3.5 text-emerald-300" />
          Saved key: {maskedKey}
        </div>
      )}
      <div className="space-y-4">{children}</div>
      {message && (
        <p className="mt-4 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
          {message}
        </p>
      )}
    </section>
  )
}

function ActionRow({
  canManage,
  busy,
  saveDisabled,
  onSave,
  onTest,
}: {
  readonly canManage: boolean
  readonly busy: boolean
  readonly saveDisabled: boolean
  readonly onSave: () => void
  readonly onTest: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onClick={onSave}
        disabled={!canManage || busy || saveDisabled}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84]/30 disabled:bg-[#3ddf84]/30 disabled:text-[#d8fff1]"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {busy ? 'Saving...' : 'Save Settings'}
      </button>
      <button
        type="button"
        onClick={onTest}
        disabled={!canManage || busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] transition hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
        {busy ? 'Testing...' : 'Test Connection'}
      </button>
      {!canManage && (
        <p className="basis-full text-xs text-[#8bb4a5]">
          Provider management permission is required to save or test keys.
        </p>
      )}
    </div>
  )
}

function SwitchPill({ checked }: { readonly checked: boolean }) {
  return (
    <span
      aria-hidden="true"
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-emerald-300/60 bg-emerald-400'
            : 'border-[#ffbd29]/70 bg-[#ffbd29]',
        )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition',
          checked ? 'left-5' : 'left-0.5',
        )}
      />
    </span>
  )
}
