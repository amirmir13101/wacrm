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
  }
}

interface KnowledgeSourceItem {
  readonly id: string
  readonly title: string
  readonly sourceType: 'manual'
  readonly status: 'draft' | 'active' | 'archived' | 'failed'
  readonly createdAt: string
  readonly updatedAt: string
  readonly characterCount: number
  readonly chunkCount: number
  readonly content?: string
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
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
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeSourceItem | null>(null)
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null)

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
        value: 'Coming soon',
        icon: Sparkles,
        tone: 'soon',
      },
      {
        title: 'WhatsApp Auto Reply',
        value: 'Not connected yet',
        icon: Send,
        tone: 'soon',
      },
    ] as const
  }, [status])

  const canManageKnowledge = workspace.has('manage_rag_chatbot')
  const knowledgeCharacters = knowledgeText.length
  const knowledgeOverLimit = knowledgeCharacters > RAG_KNOWLEDGE_CHARACTER_LIMIT

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
  }, [workspace.loading, canView])

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
      setFirecrawlMessage('Firecrawl key saved. Website import is coming soon.')
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

  async function saveKnowledge() {
    setKnowledgeSaving(true)
    setKnowledgeMessage(null)
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
      setKnowledgeMessage(editingKnowledgeId ? 'Knowledge updated.' : 'Knowledge added.')
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (saveError) {
      setKnowledgeMessage(saveError instanceof Error ? saveError.message : 'Failed to save knowledge.')
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

  async function archiveKnowledge(id: string) {
    if (!window.confirm('Archive this knowledge source?')) return
    setKnowledgeMessage(null)
    try {
      const response = await fetch(`/api/rag/knowledge/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Failed to archive knowledge.')
      if (selectedKnowledge?.id === id) setSelectedKnowledge(null)
      setKnowledgeMessage('Knowledge archived.')
      await loadKnowledge()
      await refreshStatusCounts()
    } catch (archiveError) {
      setKnowledgeMessage(archiveError instanceof Error ? archiveError.message : 'Failed to archive knowledge.')
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
                Connect your AI and Firecrawl keys now. Knowledge, website import,
                test chat, logs, and WhatsApp auto reply are coming in later phases.
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
                    : card.tone === 'soon'
                      ? 'bg-amber-300/15 text-amber-100'
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
          description="Save your Firecrawl key now. Website import is intentionally not active in this phase."
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
              <FileText className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">Knowledge Base</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#a9c6bb]">
              Add business information the chatbot will use later. Manual knowledge is chunked now,
              but embeddings and chat answers come in the next phase.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
            200,000 character limit
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
                  <CheckCircle2 className="size-4" />
                  {editingKnowledgeId ? 'Update Knowledge' : 'Add Knowledge'}
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

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#214b39] bg-[#0d1b15]/70">
              <div className="border-b border-[#214b39] px-4 py-3">
                <h3 className="font-bold text-white">Knowledge List</h3>
                <p className="text-xs text-[#8bb4a5]">Manual sources only. Website import is not active yet.</p>
              </div>
              <div className="divide-y divide-[#214b39]">
                {knowledgeSources.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#8bb4a5]">
                    No manual knowledge added yet.
                  </div>
                ) : (
                  knowledgeSources.map((source) => (
                    <article key={source.id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="font-bold text-white">{source.title}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                            Manual · {source.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
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
                            onClick={() => archiveKnowledge(source.id)}
                            disabled={!canManageKnowledge}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-400/40 px-2.5 text-xs font-bold text-red-100 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                            Archive
                          </button>
                        </div>
                      </div>
                      <dl className="grid gap-2 text-xs text-[#a9c6bb] sm:grid-cols-2 xl:grid-cols-3">
                        <div>Created: {formatDate(source.createdAt)}</div>
                        <div>Updated: {formatDate(source.updatedAt)}</div>
                        <div>{source.characterCount.toLocaleString()} characters</div>
                        <div>
                          {source.chunkCount > 0
                            ? `${source.chunkCount.toLocaleString()} chunks · Not embedded yet`
                            : 'Not embedded yet'}
                        </div>
                      </dl>
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
                    <p className="text-xs text-[#8bb4a5]">Manual · {selectedKnowledge.status}</p>
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

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Coming Soon</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Website Import', Globe],
            ['Test Chat', MessageSquare],
            ['Logs', Clock],
            ['WhatsApp Auto Reply', Send],
          ].map(([title, Icon]) => (
            <div key={title as string} className="rounded-2xl border border-dashed border-[#315846] bg-[#0d1b15]/60 p-4 opacity-80">
              <Icon className="mb-3 size-5 text-[#8bb4a5]" />
              <p className="font-semibold text-white">{title as string}</p>
              <p className="mt-1 text-xs text-[#8bb4a5]">Not active yet</p>
            </div>
          ))}
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
        <CheckCircle2 className="size-4" />
        Save
      </button>
      <button
        type="button"
        onClick={onTest}
        disabled={!canManage || busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] transition hover:bg-[#123226] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <XCircle className="size-4" />
        Test
      </button>
      {!canManage && (
        <p className="basis-full text-xs text-[#8bb4a5]">
          Provider management permission is required to save or test keys.
        </p>
      )}
    </div>
  )
}
