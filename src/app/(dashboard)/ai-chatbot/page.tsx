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
  ShieldCheck,
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
  readonly lastTestStatus: ConnectionStatus
  readonly lastTestError: string | null
}

interface FirecrawlView {
  readonly configured: boolean
  readonly maskedKey: string | null
  readonly lastTestStatus: ConnectionStatus
  readonly lastTestError: string | null
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
  readonly sourceType: 'manual' | 'website'
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

interface WebsiteImportStats {
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
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

const providerLabels: Record<RagProviderType, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  custom_openai_compatible: 'Custom Provider',
}

const providers = Object.entries(providerLabels) as Array<[RagProviderType, string]>

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
  return sourceType === 'website' ? 'Website' : 'Manual'
}

type KnowledgeProgressKind = 'manual' | 'website' | 'prepare'
type KnowledgeProgressStatus = 'running' | 'done' | 'warning' | 'failed'

interface EmbeddingSummaryView {
  readonly status?: 'ready' | 'partial' | 'failed' | 'not_configured' | 'skipped'
  readonly message?: string
  readonly embeddingsReady?: boolean
  readonly embeddingErrorCategory?: string | null
  readonly userMessage?: string
}

interface KnowledgeProgressState {
  readonly kind: KnowledgeProgressKind
  readonly status: KnowledgeProgressStatus
  readonly currentStep: number
  readonly message: string | null
}

const knowledgeProgressSteps: Record<KnowledgeProgressKind, ReadonlyArray<string>> = {
  manual: [
    'Saving knowledge...',
    'Cleaning content...',
    'Creating chunks...',
    'Chunks ready',
    'Preparing embeddings in batches...',
    'Ready for chatbot',
  ],
  website: [
    'Importing website...',
    'Reading website content...',
    'Cleaning content...',
    'Creating chunks...',
    'Chunks ready',
    'Preparing embeddings in batches...',
    'Ready for chatbot',
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

function createProgressFromEmbeddingSummary(
  kind: Extract<KnowledgeProgressKind, 'manual' | 'website'>,
  summary: EmbeddingSummaryView | null | undefined,
  fallbackMessage: string,
): KnowledgeProgressState {
  const steps = knowledgeProgressSteps[kind]
  const chunkReadyStep = steps.indexOf('Chunks ready')
  const preparingStep = steps.indexOf('Preparing embeddings in batches...')
  const message = cleanOperationMessage(summary?.userMessage ?? summary?.message, fallbackMessage)

  if (summary?.status === 'ready') {
    return createKnowledgeProgress(kind, 'done', message)
  }

  if (summary?.status === 'failed' || summary?.status === 'partial' || summary?.status === 'not_configured') {
    return createKnowledgeProgress(kind, 'warning', message, preparingStep)
  }

  return createKnowledgeProgress(kind, 'warning', message, chunkReadyStep)
}

function createPrepareProgressFromEmbeddingSummary(
  summary: EmbeddingSummaryView | null | undefined,
  fallbackMessage: string,
): KnowledgeProgressState {
  const message = cleanOperationMessage(summary?.userMessage ?? summary?.message, fallbackMessage)
  if (summary?.status === 'ready') return createKnowledgeProgress('prepare', 'done', message)
  return createKnowledgeProgress('prepare', 'warning', message, 1)
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
  const [firecrawlKey, setFirecrawlKey] = useState('')
  const [providerSaving, setProviderSaving] = useState(false)
  const [firecrawlSaving, setFirecrawlSaving] = useState(false)
  const [providerMessage, setProviderMessage] = useState<string | null>(null)
  const [firecrawlMessage, setFirecrawlMessage] = useState<string | null>(null)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceItem[]>([])
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeText, setKnowledgeText] = useState('')
  const [knowledgeMessage, setKnowledgeMessage] = useState<string | null>(null)
  const [knowledgeSaving, setKnowledgeSaving] = useState(false)
  const [knowledgeProgress, setKnowledgeProgress] = useState<KnowledgeProgressState | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteImportMessage, setWebsiteImportMessage] = useState<string | null>(null)
  const [websiteImportStats, setWebsiteImportStats] = useState<WebsiteImportStats | null>(null)
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
  const [autoReply, setAutoReply] = useState<RagAutoReplySettings | null>(null)
  const [autoReplySaving, setAutoReplySaving] = useState(false)
  const [autoReplyMessage, setAutoReplyMessage] = useState<string | null>(null)

  const cards = useMemo(() => {
    const providerConfigured = status?.provider.configured === true
    const firecrawlConfigured = status?.firecrawl.configured === true

    return [
      {
        title: 'AI Provider',
        value: providerConfigured ? 'Configured' : 'Not configured',
        icon: KeyRound,
        tone: providerConfigured ? 'good' : 'muted',
      },
      {
        title: 'Firecrawl',
        value: firecrawlConfigured ? 'Configured' : 'Not configured',
        icon: Globe,
        tone: firecrawlConfigured ? 'good' : 'muted',
      },
      {
        title: 'Knowledge Sources',
        value: String(status?.knowledge.sources ?? 0),
        icon: Database,
        tone: 'muted',
      },
      {
        title: 'Chunks',
        value: String(status?.knowledge.chunks ?? 0),
        icon: FileText,
        tone: 'muted',
      },
      {
        title: 'Embeddings',
        value: `${status?.knowledge.readyEmbeddings ?? 0} ready`,
        icon: Sparkles,
        tone: (status?.knowledge.readyEmbeddings ?? 0) > 0 ? 'good' : 'muted',
      },
      {
        title: 'Embedding Issues',
        value: `${status?.knowledge.failedEmbeddings ?? 0} failed`,
        icon: XCircle,
        tone: (status?.knowledge.failedEmbeddings ?? 0) > 0 ? 'warn' : 'muted',
      },
      {
        title: 'WhatsApp Auto Reply',
        value: autoReply?.enabled ? 'Enabled' : 'Disabled',
        icon: Send,
        tone: autoReply?.enabled ? 'good' : 'muted',
      },
    ] as const
  }, [status, autoReply])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.loading, canView])

  useEffect(() => {
    if (workspace.loading || !canView) return
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter, workspace.loading, canView])

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

  async function saveProvider() {
    setProviderSaving(true)
    setProviderMessage(null)
    try {
      const response = await fetch('/api/rag/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: providerKey }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save provider.')
      setStatus((current) => current ? { ...current, provider: payload.provider } : current)
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
    setKnowledgeProgress(createKnowledgeProgress('website'))
    try {
      const response = await fetch('/api/rag/website-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Import failed.')

      setWebsiteUrl('')
      setSelectedKnowledge(payload.source ?? null)
      setWebsiteImportStats(payload.stats ?? null)
      const message = cleanOperationMessage(
        payload.userMessage ?? payload.embeddingSummary?.userMessage ?? payload.embeddingSummary?.message ?? payload.message,
        'Website imported, cleaned, and chunked.',
      )
      setKnowledgeProgress(
        createProgressFromEmbeddingSummary('website', payload.embeddingSummary, message),
      )
      setWebsiteImportMessage(message)
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (importError) {
      const message = cleanOperationMessage(
        importError instanceof Error ? importError.message : null,
        'Import failed.',
      )
      setKnowledgeProgress(createKnowledgeProgress('website', 'failed', message))
      setWebsiteImportMessage(message)
    } finally {
      setWebsiteImporting(false)
    }
  }

  async function saveKnowledge() {
    setKnowledgeSaving(true)
    setKnowledgeMessage(null)
    setKnowledgeProgress(createKnowledgeProgress('manual'))
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
          status: 'active',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to save knowledge.')

      setKnowledgeTitle('')
      setKnowledgeText('')
      setEditingKnowledgeId(null)
      setSelectedKnowledge(payload.source ?? null)
      const message = cleanOperationMessage(
        payload.userMessage ?? payload.embeddingSummary?.userMessage ?? payload.embeddingSummary?.message,
        editingKnowledgeId ? 'Knowledge updated, cleaned, and chunked.' : 'Knowledge added, cleaned, and chunked.',
      )
      setKnowledgeProgress(
        createProgressFromEmbeddingSummary('manual', payload.embeddingSummary, message),
      )
      setKnowledgeMessage(message)
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (saveError) {
      const message = cleanOperationMessage(
        saveError instanceof Error ? saveError.message : null,
        'Failed to save knowledge.',
      )
      setKnowledgeProgress(createKnowledgeProgress('manual', 'failed', message))
      setKnowledgeMessage(message)
    } finally {
      setKnowledgeSaving(false)
    }
  }

  async function viewKnowledge(id: string) {
    setKnowledgeMessage(null)
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
    await viewKnowledge(id)
    const response = await fetch(`/api/rag/knowledge/${id}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setKnowledgeMessage(payload.error ?? 'Failed to edit knowledge source.')
      return
    }
    setEditingKnowledgeId(id)
    setKnowledgeTitle(payload.source.title)
    setKnowledgeText(payload.source.content)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    setKnowledgeProgress(createKnowledgeProgress('prepare'))
    try {
      const response = await fetch(`/api/rag/knowledge/${id}/embed`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to prepare knowledge.')

      const message = cleanOperationMessage(
        payload.userMessage ?? payload.summary?.userMessage ?? payload.summary?.message,
        'Knowledge prepared for chatbot.',
      )
      setKnowledgeProgress(createPrepareProgressFromEmbeddingSummary(payload.summary, message))
      setKnowledgeMessage(message)
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (prepareError) {
      const message = cleanOperationMessage(
        prepareError instanceof Error ? prepareError.message : null,
        'Failed to prepare knowledge.',
      )
      setKnowledgeProgress(createKnowledgeProgress('prepare', 'failed', message))
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
      <section className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#07130e]/80 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Bot className="size-3.5" />
                New RAG AI Chatbot
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                AI Chatbot
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b8cfc7]">
                Connect your AI and Firecrawl keys, add manual or website knowledge,
                and test answers in the dashboard. New knowledge is fully chunked after
                save; larger sources can be prepared when you are ready.
              </p>
            </div>
            <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/80 p-3 text-sm text-[#c7ddd5]">
              <ShieldCheck className="mb-2 size-5 text-emerald-300" />
              Keys are encrypted and never shown back in full.
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-[#17402f] bg-[#07130e]/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <card.icon className="size-5 text-emerald-300" />
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        card.tone === 'good'
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : card.tone === 'warn'
                      ? 'bg-red-400/15 text-red-100'
                      : 'bg-slate-700/40 text-slate-200',
                )}
              >
                {card.value}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{card.title}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard
          title="AI Provider Settings"
          description="Choose your provider and save your API key. Advanced model and vector settings are handled safely by the backend."
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
          description="Save your Firecrawl key so you can import one website page into the knowledge base."
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
        </SettingsCard>
      </div>

      <section className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Globe className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Website Import</h2>
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

        <div className="flex flex-col gap-3 rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4 lg:flex-row lg:items-end">
          <label className="flex-1 space-y-2">
            <span className="text-sm font-medium text-[#d8fff1]">Website URL</span>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              disabled={!canManageKnowledge || websiteImporting}
              className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={importWebsite}
            disabled={!canManageKnowledge || websiteImporting || !websiteUrl.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#54f398] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {websiteImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Globe className="size-4" />
            )}
            {websiteImporting ? 'Importing website...' : 'Import Website'}
          </button>
        </div>
        {websiteImportMessage && (
          <p className="mt-4 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
            {websiteImportMessage}
          </p>
        )}
        {websiteImportStats && (
          <div className="mt-4 rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
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
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <FileText className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Knowledge Base</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Add business information manually or from a website page. Knowledge is fully chunked
              after save. Use Prepare for Chatbot when you are ready to create embeddings and
              control provider API cost.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
            500,000 character limit
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4 rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
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
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#54f398] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {knowledgeSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {editingKnowledgeId ? 'Saving...' : 'Creating chunks...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      {editingKnowledgeId ? 'Update Knowledge' : 'Add Knowledge'}
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
            {knowledgeProgress && (
              <KnowledgeProgressPanel progress={knowledgeProgress} />
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70">
              <div className="border-b border-[#214b39] px-4 py-3">
                <h3 className="font-bold text-white">Knowledge List</h3>
                <p className="text-xs text-[#8bb4a5]">Manual and website sources for the chatbot.</p>
              </div>
              <div className="divide-y divide-[#214b39]">
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
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300/40 px-2.5 text-xs font-bold text-emerald-100 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#315846] px-2.5 text-xs font-bold text-[#d8fff1] hover:bg-[#123226]"
                          >
                            <Eye className="size-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => editKnowledge(source.id)}
                            disabled={!canManageKnowledge}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#315846] px-2.5 text-xs font-bold text-[#d8fff1] hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
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

            {selectedKnowledge && (
              <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{selectedKnowledge.title}</h3>
                    <p className="text-xs text-[#8bb4a5]">
                      {sourceTypeLabel(selectedKnowledge.sourceType)} · {selectedKnowledge.status}
                    </p>
                    {selectedKnowledge.sourceUrl && (
                      <p className="mt-1 break-all text-xs text-[#8bb4a5]">{selectedKnowledge.sourceUrl}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKnowledge(null)}
                    className="rounded-lg border border-[#315846] px-2 py-1 text-xs font-bold text-[#d8fff1] hover:bg-[#123226]"
                  >
                    Close
                  </button>
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-[#315846] bg-[#07130e] p-3 text-sm leading-6 text-[#d8fff1]">
                  {selectedKnowledge.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Test Chat</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Ask a question from prepared manual or website knowledge. This dashboard test uses
              the same core RAG answer path as WhatsApp auto-reply and keeps recent messages in
              this browser tab so follow-up questions keep their recent context.
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-4 rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
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
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#54f398] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageSquare className="size-4" />
                  {chatLoading ? 'Asking...' : 'Ask'}
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
            <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
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

            {chatAnswer?.sources.length ? (
              <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70">
                <div className="border-b border-[#214b39] px-4 py-3">
                  <h3 className="font-bold text-white">Retrieved Knowledge</h3>
                  <p className="text-xs text-[#8bb4a5]">Safe snippets used to answer.</p>
                </div>
                <div className="divide-y divide-[#214b39]">
                  {chatAnswer.sources.map((source, index) => (
                    <article key={`${source.title}-${index}`} className="space-y-2 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white">{source.title}</h4>
                        <span className="rounded-full border border-[#315846] px-2 py-1 text-[11px] font-bold text-[#d8fff1]">
                          Match quality {Math.round(source.matchQuality * 100)}%
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-[#a9c6bb]">{source.snippet}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Clock className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">Logs</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
                Recent chatbot activity for this workspace. Secrets, raw prompts,
                provider JSON, and embeddings are never shown here.
              </p>
            </div>
            <button
              type="button"
              onClick={loadLogs}
              disabled={logsLoading}
              className="h-9 rounded-xl border border-[#315846] px-3 text-xs font-bold text-[#d8fff1] hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {logsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
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

          {logsMessage && (
            <p className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
              {logsMessage}
            </p>
          )}

          <div className="divide-y divide-[#214b39] overflow-hidden rounded-2xl border border-[#214b39] bg-[#0d1b15]/70">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#8bb4a5]">
                No chatbot logs yet.
              </div>
            ) : (
              logs.map((log) => (
                <article key={log.id} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#315846] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#d8fff1]">
                        {log.channel}
                      </span>
                      <span className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                        log.status === 'answered'
                          ? 'bg-emerald-400/15 text-emerald-100'
                          : log.status === 'fallback'
                            ? 'bg-amber-300/15 text-amber-100'
                            : 'bg-red-400/15 text-red-100',
                      )}>
                        {log.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-[#8bb4a5]">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="grid gap-3 text-sm lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Question</p>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#d8fff1]">{log.userQuestion}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Answer</p>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[#a9c6bb]">
                        {log.answer || 'No answer recorded.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[#8bb4a5]">
                    <span>{log.retrievedSourceCount} retrieved sources</span>
                    {typeof log.latencyMs === 'number' && <span>{log.latencyMs} ms latency</span>}
                    {log.fallbackReason && <span>Fallback: {log.fallbackReason}</span>}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Send className="size-5 text-emerald-300" />
                <h2 className="text-lg font-bold text-white">WhatsApp Auto Reply</h2>
              </div>
              <p className="text-sm leading-6 text-[#a9c6bb]">
                Optional RAG replies for inbound WhatsApp text messages. It is OFF by default
                and never sends debug text.
              </p>
            </div>
            <span className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-bold',
              autoReply?.enabled
                ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-100'
                : 'border-[#315846] bg-[#0d1b15] text-[#d8fff1]',
            )}>
              {autoReply?.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="mb-5 grid gap-2 text-sm">
            {[
              ['WhatsApp', autoReply?.whatsappConnected],
              ['AI Provider', autoReply?.providerConfigured],
              ['Knowledge', autoReply?.knowledgeReady],
            ].map(([label, ready]) => (
              <div key={label as string} className="flex items-center justify-between rounded-xl border border-[#214b39] bg-[#0d1b15]/70 px-3 py-2">
                <span className="text-[#a9c6bb]">{label as string}</span>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                  ready ? 'bg-emerald-400/15 text-emerald-100' : 'bg-amber-300/15 text-amber-100',
                )}>
                  {ready ? 'Ready' : 'Not ready'}
                </span>
              </div>
            ))}
          </div>

          {autoReply ? (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
                <input
                  type="checkbox"
                  checked={autoReply.enabled}
                  disabled={!canEnableAutoReply || autoReplySaving}
                  onChange={(event) => saveAutoReply({ enabled: event.target.checked })}
                  className="mt-1 size-4 accent-emerald-400"
                />
                <span>
                  <span className="block font-bold text-white">Enable AI replies on WhatsApp</span>
                  <span className="mt-1 block text-sm text-[#a9c6bb]">
                    When disabled, the webhook behavior stays the same and no AI call is made.
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70 p-4">
                <p className="text-sm font-bold text-white">Auto-reply mode</p>
                <p className="mt-1 text-sm text-[#a9c6bb]">Answer only when knowledge is available.</p>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Fallback behavior</span>
                <select
                  value={autoReply.fallbackMode}
                  disabled={!canEnableAutoReply || autoReplySaving}
                  onChange={(event) =>
                    saveAutoReply({ fallbackMode: event.target.value as RagAutoReplySettings['fallbackMode'] })
                  }
                  className="h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="do_not_reply">Do not send message if answer is not found</option>
                  <option value="send_fallback">Send fallback message</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#d8fff1]">Fallback message</span>
                <textarea
                  value={autoReply.fallbackMessage}
                  disabled={!canEnableAutoReply || autoReplySaving}
                  rows={4}
                  maxLength={500}
                  onChange={(event) =>
                    setAutoReply((current) => current ? { ...current, fallbackMessage: event.target.value } : current)
                  }
                  onBlur={() => saveAutoReply()}
                  className="w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              {!canEnableAutoReply && (
                <p className="text-xs text-[#8bb4a5]">
                  Enable RAG Auto Reply permission is required to change these settings.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
              Auto reply settings will load after the migration is applied.
            </p>
          )}

          {autoReplyMessage && (
            <p className="mt-4 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
              {autoReplyMessage}
            </p>
          )}
        </div>
      </section>

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
  const steps = progress.status === 'done'
    ? knowledgeProgressSteps[progress.kind]
    : knowledgeProgressSteps[progress.kind].filter((step) => step !== 'Ready for chatbot')
  const isDone = progress.status === 'done'
  const isFailed = progress.status === 'failed'
  const isWarning = progress.status === 'warning'

  return (
    <div className={cn(
      'rounded-2xl border p-4',
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
          <p className="text-sm font-bold text-white">Knowledge processing status</p>
          <p className="text-xs text-[#a9c6bb]">
            The CRM saves the full content, creates chunks, then prepares embeddings when safe.
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
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const complete = isDone || index < progress.currentStep
          const active = (progress.status === 'running' || isWarning) && index === progress.currentStep
          return (
            <li key={step} className="flex items-center gap-2 text-xs text-[#d8fff1]">
              <span className={cn(
                'flex size-5 items-center justify-center rounded-full border text-[10px] font-bold',
                complete
                  ? 'border-emerald-300/60 bg-emerald-300/20 text-emerald-100'
                  : active
                    ? isWarning
                      ? 'border-amber-300/60 bg-amber-300/10 text-amber-100'
                      : 'border-emerald-300/60 bg-emerald-300/10 text-emerald-100'
                    : 'border-[#315846] bg-[#0d1b15] text-[#8bb4a5]',
              )}>
                {complete ? '✓' : index + 1}
              </span>
              <span className={cn(active && 'font-bold', active && (isWarning ? 'text-amber-100' : 'text-emerald-100'))}>{step}</span>
            </li>
          )
        })}
      </ol>
      {progress.message && (
        <p className="mt-3 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-xs text-[#d8fff1]">
          {progress.message}
        </p>
      )}
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
    <section className="rounded-3xl border border-[#17402f] bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
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
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#54f398] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {busy ? 'Saving...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onTest}
        disabled={!canManage || busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] transition hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
        {busy ? 'Testing...' : 'Test'}
      </button>
      {!canManage && (
        <p className="basis-full text-xs text-[#8bb4a5]">
          Provider management permission is required to save or test keys.
        </p>
      )}
    </div>
  )
}
