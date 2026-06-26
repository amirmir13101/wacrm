'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

type ProviderType = 'openai' | 'openrouter'

interface StarterRagSettings {
  readonly provider: ProviderType
  readonly apiKeyConfigured: boolean
  readonly maskedKey: string | null
  readonly databaseUrlConfigured: boolean
  readonly databaseUrlPreview: string
  readonly chatModel: string
  readonly embeddingModel: string
}

interface StarterRagResource {
  readonly id: string
  readonly content: string
  readonly characterCount: number
  readonly embeddingCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

const starterRagSetupHelp = [
  'Open Docker Desktop.',
  'cd "G:\\ai-sdk-rag-starter-main\\ai-sdk-rag-starter-main"',
  'docker compose up -d',
  'Database URL: postgres://postgres:postgres@localhost:5433/rag_test',
]

function shortContent(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function StarterRagPage() {
  const workspace = useWorkspacePermissions()
  const canView = workspace.has('view_rag_chatbot')
  const canManageKnowledge = workspace.has('manage_rag_chatbot')
  const canManageProvider = workspace.has('manage_rag_provider')

  const [settings, setSettings] = useState<StarterRagSettings | null>(null)
  const [provider, setProvider] = useState<ProviderType>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [chatModel, setChatModel] = useState('openai/gpt-4o-mini')
  const [embeddingModel, setEmbeddingModel] = useState('openai/text-embedding-3-small')
  const [resources, setResources] = useState<StarterRagResource[]>([])
  const [characterLimit, setCharacterLimit] = useState(500_000)
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const remainingCharacters = useMemo(() => characterLimit - content.length, [
    characterLimit,
    content,
  ])

  async function readJson<T>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      setupHelp?: string[]
    }
    if (!response.ok) {
      const setupHelp = payload.setupHelp?.length
        ? `\n\nSetup:\n${payload.setupHelp.join('\n')}`
        : ''
      throw new Error(`${payload.error ?? 'Request failed.'}${setupHelp}`)
    }
    return payload as T
  }

  async function loadSettings() {
    const payload = await readJson<{ settings: StarterRagSettings }>(
      await fetch('/api/starter-rag/settings'),
    )
    setSettings(payload.settings)
    setProvider(payload.settings.provider)
    setDatabaseUrl('')
    setChatModel(payload.settings.chatModel)
    setEmbeddingModel(payload.settings.embeddingModel)
  }

  async function loadResources() {
    const payload = await readJson<{
      resources: StarterRagResource[]
      characterLimit: number
    }>(await fetch('/api/starter-rag/resources'))
    setResources(payload.resources)
    setCharacterLimit(payload.characterLimit)
  }

  async function refreshAll() {
    setError(null)
    setNotice(null)
    try {
      await Promise.all([loadSettings(), loadResources()])
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Starter RAG failed to load.')
    }
  }

  useEffect(() => {
    if (canView) {
      void refreshAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await readJson<{ settings: StarterRagSettings }>(
        await fetch('/api/starter-rag/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey,
            databaseUrl,
            chatModel,
            embeddingModel,
          }),
        }),
      )
      setSettings(payload.settings)
      setApiKey('')
      setNotice('Starter RAG settings saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save settings.')
    } finally {
      setLoading(false)
    }
  }

  async function testSettings() {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await readJson<{ message: string }>(
        await fetch('/api/starter-rag/settings/test', { method: 'POST' }),
      )
      setNotice(payload.message)
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Starter RAG test failed.')
    } finally {
      setLoading(false)
    }
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint = editingId
        ? `/api/starter-rag/resources/${editingId}`
        : '/api/starter-rag/resources'
      const method = editingId ? 'PUT' : 'POST'
      await readJson(
        await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }),
      )
      setContent('')
      setEditingId(null)
      setNotice(editingId ? 'Starter knowledge updated and re-embedded.' : 'Starter knowledge added and embedded.')
      await loadResources()
    } catch (resourceError) {
      setError(resourceError instanceof Error ? resourceError.message : 'Could not save knowledge.')
    } finally {
      setLoading(false)
    }
  }

  async function editResource(id: string) {
    setLoading(true)
    setError(null)
    try {
      const payload = await readJson<{ resource: StarterRagResource }>(
        await fetch(`/api/starter-rag/resources/${id}`),
      )
      setEditingId(id)
      setContent(payload.resource.content)
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Could not load knowledge.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteResource(id: string) {
    if (!window.confirm('Delete this Starter RAG knowledge resource?')) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      await readJson(await fetch(`/api/starter-rag/resources/${id}`, { method: 'DELETE' }))
      setNotice('Starter knowledge deleted.')
      if (editingId === id) {
        setEditingId(null)
        setContent('')
      }
      await loadResources()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete knowledge.')
    } finally {
      setLoading(false)
    }
  }

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (!cleanQuestion) return
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: cleanQuestion }]
    setMessages(nextMessages)
    setQuestion('')
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await readJson<{ answer: string }>(
        await fetch('/api/starter-rag/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages }),
        }),
      )
      setMessages([...nextMessages, { role: 'assistant', content: payload.answer }])
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Starter RAG chat failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!canView) {
    return (
      <div className="p-6 text-[#eafff3]">
        <h1 className="text-2xl font-bold">Starter RAG</h1>
        <p className="mt-2 text-[#b8cfc7]">You do not have permission to view this area.</p>
      </div>
    )
  }

  return (
    <main className="min-h-full overflow-y-auto bg-[#07130e] p-4 text-[#eafff3] lg:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-[#17402f] bg-[#092017] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3ddf84]">
            Separate Starter RAG
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-white">
            Starter RAG Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#b8cfc7]">
            This tab is isolated from the CRM RAG system. It uses the Starter RAG
            pgvector database, Starter-style chunking, embeddings, vector retrieval,
            and the getInformation tool flow.
          </p>
        </section>

        {notice ? (
          <div className="rounded-2xl border border-[#2c7a51] bg-[#123226] p-3 text-sm text-[#d8fff1]">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="whitespace-pre-wrap rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={saveSettings}
            className="rounded-3xl border border-[#17402f] bg-[#092017] p-5"
          >
            <h2 className="text-xl font-bold text-white">Provider and database</h2>
            <p className="mt-1 text-sm text-[#b8cfc7]">
              Saved values go to a local ignored Starter RAG config file. API keys are not
              returned to the browser.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-[#b8cfc7]">Provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as ProviderType)}
                  disabled={!canManageProvider || loading}
                  className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[#b8cfc7]">API Key</span>
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  disabled={!canManageProvider || loading}
                  type="password"
                  placeholder={
                    settings?.apiKeyConfigured
                      ? `Configured (${settings.maskedKey ?? 'masked'})`
                      : 'Paste Starter RAG provider API key'
                  }
                  className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[#b8cfc7]">Starter database URL</span>
                <input
                  value={databaseUrl}
                  onChange={(event) => setDatabaseUrl(event.target.value)}
                  disabled={!canManageProvider || loading}
                  placeholder={settings?.databaseUrlPreview ?? 'postgres://postgres:postgres@localhost:5433/rag_test'}
                  className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
                />
                {settings?.databaseUrlConfigured ? (
                  <span className="text-xs text-[#8bb4a5]">
                    Current: {settings.databaseUrlPreview}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[#b8cfc7]">Chat model</span>
                <input
                  value={chatModel}
                  onChange={(event) => setChatModel(event.target.value)}
                  disabled={!canManageProvider || loading}
                  className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-[#b8cfc7]">Embedding model</span>
                <input
                  value={embeddingModel}
                  onChange={(event) => setEmbeddingModel(event.target.value)}
                  disabled={!canManageProvider || loading}
                  className="rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canManageProvider || loading}
                className="rounded-xl bg-[#3ddf84] px-4 py-2 text-sm font-bold text-[#07130e] disabled:opacity-50"
              >
                Save Starter Settings
              </button>
              <button
                type="button"
                onClick={testSettings}
                disabled={!canManageProvider || loading}
                className="rounded-xl border border-[#3ddf84] px-4 py-2 text-sm font-bold text-[#d8fff1] disabled:opacity-50"
              >
                Test Starter Connection
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[#17402f] bg-[#07130e] p-3 text-xs leading-5 text-[#b8cfc7]">
              <p>Starter DB help:</p>
              <ul className="mt-1 list-disc pl-5">
                {starterRagSetupHelp.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </form>

          <form
            onSubmit={saveResource}
            className="rounded-3xl border border-[#17402f] bg-[#092017] p-5"
          >
            <h2 className="text-xl font-bold text-white">
              {editingId ? 'Edit Starter knowledge' : 'Add Starter knowledge'}
            </h2>
            <p className="mt-1 text-sm text-[#b8cfc7]">
              Manual knowledge is embedded using the Starter chunking and embedding flow.
            </p>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={!canManageKnowledge || loading}
              rows={14}
              placeholder="Paste business knowledge here..."
              className="mt-4 w-full rounded-2xl border border-[#315846] bg-[#07130e] p-3 text-sm text-white outline-none focus:border-[#3ddf84]"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-[#8bb4a5]">
              <span>{content.length.toLocaleString()} / {characterLimit.toLocaleString()} characters</span>
              <span className={remainingCharacters < 0 ? 'text-red-300' : ''}>
                {remainingCharacters.toLocaleString()} remaining
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canManageKnowledge || loading || content.trim().length === 0}
                className="rounded-xl bg-[#3ddf84] px-4 py-2 text-sm font-bold text-[#07130e] disabled:opacity-50"
              >
                {editingId ? 'Update and Re-embed' : 'Add and Embed'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setContent('')
                  }}
                  className="rounded-xl border border-[#315846] px-4 py-2 text-sm font-bold text-[#d8fff1]"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-[#17402f] bg-[#092017] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Starter knowledge list</h2>
              <button
                type="button"
                onClick={refreshAll}
                disabled={loading}
                className="rounded-xl border border-[#315846] px-3 py-1.5 text-xs font-bold text-[#d8fff1]"
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {resources.length === 0 ? (
                <p className="rounded-2xl border border-[#17402f] bg-[#07130e] p-4 text-sm text-[#b8cfc7]">
                  No Starter RAG resources found yet, or the Starter database is not running.
                </p>
              ) : (
                resources.map((resource) => (
                  <article
                    key={resource.id}
                    className="rounded-2xl border border-[#17402f] bg-[#07130e] p-4"
                  >
                    <p className="text-sm text-white">{shortContent(resource.content)}</p>
                    <div className="mt-3 grid gap-1 text-xs text-[#8bb4a5]">
                      <span>ID: {resource.id}</span>
                      <span>
                        {resource.characterCount.toLocaleString()} chars ·{' '}
                        {resource.embeddingCount.toLocaleString()} embeddings
                      </span>
                      <span>Updated: {formatDate(resource.updatedAt)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => editResource(resource.id)}
                        disabled={!canManageKnowledge || loading}
                        className="rounded-lg border border-[#3ddf84] px-3 py-1.5 text-xs font-bold text-[#d8fff1] disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteResource(resource.id)}
                        disabled={!canManageKnowledge || loading}
                        className="rounded-lg border border-red-400/50 px-3 py-1.5 text-xs font-bold text-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[#17402f] bg-[#092017] p-5">
            <h2 className="text-xl font-bold text-white">Starter test chat</h2>
            <p className="mt-1 text-sm text-[#b8cfc7]">
              This calls the separate Starter-style getInformation tool flow.
            </p>
            <div className="mt-4 flex h-[430px] flex-col gap-3 overflow-y-auto rounded-2xl border border-[#17402f] bg-[#07130e] p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-[#8bb4a5]">
                  Ask a question from the Starter RAG knowledge base.
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === 'user'
                        ? 'ml-auto max-w-[85%] rounded-2xl bg-[#3ddf84] p-3 text-sm text-[#07130e]'
                        : 'mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[#123226] p-3 text-sm text-[#eafff3]'
                    }
                  >
                    {message.content}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendQuestion} className="mt-4 flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={loading}
                placeholder="Ask Starter RAG..."
                className="min-w-0 flex-1 rounded-xl border border-[#315846] bg-[#07130e] px-3 py-2 text-white outline-none focus:border-[#3ddf84]"
              />
              <button
                type="submit"
                disabled={loading || question.trim().length === 0}
                className="rounded-xl bg-[#3ddf84] px-4 py-2 text-sm font-bold text-[#07130e] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
