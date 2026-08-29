"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bot,
  Brain,
  CheckCircle2,
  Database,
  Loader2,
  MessageSquareText,
  Play,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"

type Provider = "openai" | "openrouter" | "groq" | "gemini" | "ollama" | "custom_openai_compatible"

interface ConfigView {
  configured: boolean
  provider: Provider
  maskedKey: string | null
  baseUrl: string | null
  chatModel: string
  embeddingModel: string
  embeddingDimensions: number
  systemPrompt: string
  isActive: boolean
  autoReplyEnabled: boolean
  autoReplyMaxPerConversation: number
  handoffMessage: string
  lastTestedAt: string | null
  lastTestStatus: "not_tested" | "success" | "failed" | null
  lastTestError: string | null
}

interface KnowledgeDocument {
  id: string
  title: string
  content: string
  sourceType: string
  status: "active" | "archived"
  chunkCount: number
  createdAt: string
  updatedAt: string
}

interface UsageSummary {
  totalRuns: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  recent: Array<{
    id: string
    mode: string
    provider: string
    model: string
    totalTokens: number
    question: string | null
    createdAt: string
  }>
}

interface PlaygroundResult {
  answer: string
  usedKnowledge: Array<{ id: string; documentId: string; content: string }>
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

const providerOptions: Array<{ value: Provider; label: string; model: string; baseUrl: string }> = [
  { value: "openai", label: "OpenAI", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  { value: "openrouter", label: "OpenRouter", model: "openai/gpt-4o-mini", baseUrl: "https://openrouter.ai/api/v1" },
  { value: "groq", label: "Groq", model: "llama-3.1-8b-instant", baseUrl: "https://api.groq.com/openai/v1" },
  { value: "gemini", label: "Gemini", model: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/" },
  { value: "ollama", label: "Ollama", model: "llama3.1", baseUrl: "http://localhost:11434/v1" },
  { value: "custom_openai_compatible", label: "Custom compatible", model: "", baseUrl: "" },
]

const defaultConfig: ConfigView = {
  configured: false,
  provider: "openai",
  maskedKey: null,
  baseUrl: "https://api.openai.com/v1",
  chatModel: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  systemPrompt:
    "You are a helpful AI agent for this business. Answer only from approved workspace knowledge when business-specific facts are requested. If the information is missing, say you do not have that information and suggest handing off to a team member.",
  isActive: false,
  autoReplyEnabled: false,
  autoReplyMaxPerConversation: 3,
  handoffMessage: "I can connect you with a team member for this.",
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestError: null,
}

const cardClass =
  "rounded-3xl border border-[#3ddf84]/60 bg-[#07130e]/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition hover:border-[#3ddf84]/80"
const innerCardClass =
  "rounded-2xl border border-[#3ddf84]/40 bg-[#0d1b15]/70 p-4 transition hover:border-[#3ddf84]/60"
const inputClass =
  "h-11 w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
const textareaClass =
  "w-full rounded-xl border border-[#315846] bg-[#07130e] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#789486] focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
const greenButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#3ddf84] bg-[#3ddf84] px-4 text-sm font-bold text-[#07130e] transition hover:bg-[#ffbd29] disabled:cursor-not-allowed disabled:border-[#3ddf84] disabled:bg-[#3ddf84] disabled:text-[#07130e] disabled:opacity-70"

export default function AiAgentPage() {
  const [config, setConfig] = useState<ConfigView>(defaultConfig)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [knowledgeSaving, setKnowledgeSaving] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [knowledgeId, setKnowledgeId] = useState<string | null>(null)
  const [knowledgeTitle, setKnowledgeTitle] = useState("")
  const [knowledgeType, setKnowledgeType] = useState("manual")
  const [knowledgeContent, setKnowledgeContent] = useState("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<PlaygroundResult | null>(null)

  const selectedProvider = useMemo(
    () => providerOptions.find((item) => item.value === config.provider) ?? providerOptions[0],
    [config.provider],
  )

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [configRes, knowledgeRes, usageRes] = await Promise.all([
        fetch("/api/ai-agent/config"),
        fetch("/api/ai-agent/knowledge"),
        fetch("/api/ai-agent/usage"),
      ])
      const configJson = await readJson(configRes)
      const knowledgeJson = await readJson(knowledgeRes)
      const usageJson = usageRes.ok ? await usageRes.json() : { usage: null }
      setConfig(configJson.config ?? defaultConfig)
      setDocuments(knowledgeJson.documents ?? [])
      setUsage(usageJson.usage ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Agent failed to load.")
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/ai-agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, apiKey }),
      })
      const json = await readJson(res)
      setConfig(json.config)
      setApiKey("")
      setNotice("AI Agent settings saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settings could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/ai-agent/config", { method: "PATCH" })
      const json = await readJson(res)
      setConfig(json.config)
      setNotice(json.config.lastTestStatus === "success" ? "Connection test passed." : "Connection test failed.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.")
    } finally {
      setTesting(false)
    }
  }

  async function saveKnowledge() {
    setKnowledgeSaving(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/ai-agent/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: knowledgeId,
          title: knowledgeTitle,
          content: knowledgeContent,
          sourceType: knowledgeType,
        }),
      })
      const json = await readJson(res)
      setDocuments(json.documents ?? [])
      clearKnowledgeForm()
      setNotice("AI Agent knowledge saved and chunked.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge could not be saved.")
    } finally {
      setKnowledgeSaving(false)
    }
  }

  async function deleteKnowledge(id: string) {
    if (!confirm("Delete this AI Agent knowledge item permanently?")) return
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/ai-agent/knowledge/${id}`, { method: "DELETE" })
      await readJson(res)
      setDocuments((prev) => prev.filter((item) => item.id !== id))
      setNotice("Knowledge deleted.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge could not be deleted.")
    }
  }

  async function askQuestion() {
    setAsking(true)
    setAnswer(null)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/ai-agent/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })
      const json = await readJson(res)
      setAnswer(json)
      await refreshUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Agent could not answer.")
    } finally {
      setAsking(false)
    }
  }

  async function refreshUsage() {
    const res = await fetch("/api/ai-agent/usage")
    if (!res.ok) return
    const json = await res.json()
    setUsage(json.usage ?? null)
  }

  function editKnowledge(item: KnowledgeDocument) {
    setKnowledgeId(item.id)
    setKnowledgeTitle(item.title)
    setKnowledgeType(item.sourceType)
    setKnowledgeContent(item.content)
  }

  function clearKnowledgeForm() {
    setKnowledgeId(null)
    setKnowledgeTitle("")
    setKnowledgeType("manual")
    setKnowledgeContent("")
  }

  function updateProvider(provider: Provider) {
    const defaults = providerOptions.find((item) => item.value === provider) ?? providerOptions[0]
    setConfig((prev) => ({
      ...prev,
      provider,
      baseUrl: defaults.baseUrl || prev.baseUrl,
      chatModel: defaults.model || prev.chatModel,
    }))
  }

  const activeTone = config.configured && config.isActive

  return (
    <main className="min-h-screen bg-[#07130e] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-[#3ddf84]/60 bg-gradient-to-br from-[#07130e] via-[#0d1b15] to-[#123226] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#3ddf84]">Separate workspace module</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">AI Agent</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a9c6bb] sm:text-base">
                Configure a separate AI agent, add approved knowledge, test replies, and monitor usage without changing the existing AI Chatbot tab.
              </p>
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black",
                activeTone
                  ? "border-[#3ddf84]/70 bg-[#3ddf84] text-[#07130e]"
                  : "border-[#ffbd29]/60 bg-[#ffbd29]/10 text-[#ffe09a]",
              )}
            >
              <Bot className="h-4 w-4" />
              {activeTone ? "Active" : "Setup needed"}
            </div>
          </div>
        </header>

        {loading ? (
          <section className={cardClass}>
            <div className="flex items-center gap-3 text-[#d8fff1]">
              <Loader2 className="h-5 w-5 animate-spin text-[#3ddf84]" />
              Loading AI Agent...
            </div>
          </section>
        ) : null}

        {notice ? <StatusBox tone="success" message={notice} /> : null}
        {error ? <StatusBox tone="error" message={error} /> : null}

        <section className="grid gap-5 md:grid-cols-3">
          <StatusCard
            icon={Sparkles}
            label="Provider"
            value={config.configured ? selectedProvider.label : "Not connected"}
            helper={config.maskedKey ? `Key ${config.maskedKey}` : "Add an API key to activate the agent."}
            good={config.configured}
          />
          <StatusCard
            icon={Database}
            label="Knowledge"
            value={`${documents.length} items`}
            helper={`${documents.reduce((sum, item) => sum + item.chunkCount, 0)} chunks ready`}
            good={documents.length > 0}
          />
          <StatusCard
            icon={MessageSquareText}
            label="Playground usage"
            value={`${usage?.totalRuns ?? 0} runs`}
            helper={`${usage?.totalTokens ?? 0} tokens logged`}
            good={(usage?.totalRuns ?? 0) > 0}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className={cardClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">AI Provider Settings</h2>
                <p className="mt-1 text-sm text-[#a9c6bb]">Bring your own provider key. Stored encrypted at rest.</p>
              </div>
              <span className="rounded-full border border-[#3ddf84]/40 bg-[#0d1b15] px-3 py-1 text-xs font-bold text-[#d8fff1]">
                Separate
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Provider</span>
                <select className={inputClass} value={config.provider} onChange={(event) => updateProvider(event.target.value as Provider)}>
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Chat model</span>
                <input className={inputClass} value={config.chatModel} onChange={(event) => setConfig((prev) => ({ ...prev, chatModel: event.target.value }))} />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-bold text-[#d8fff1]">API key</span>
                <input
                  className={inputClass}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={config.maskedKey ? `${config.maskedKey} saved — leave blank to keep it` : "Paste provider API key"}
                  type="password"
                />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-bold text-[#d8fff1]">Base URL</span>
                <input className={inputClass} value={config.baseUrl ?? ""} onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Embedding model</span>
                <input className={inputClass} value={config.embeddingModel} onChange={(event) => setConfig((prev) => ({ ...prev, embeddingModel: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Embedding dimensions</span>
                <input className={inputClass} value={config.embeddingDimensions} onChange={(event) => setConfig((prev) => ({ ...prev, embeddingDimensions: Number(event.target.value) || 1536 }))} />
              </label>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#3ddf84]/40 bg-[#0d1b15]/70 p-4">
                <span>
                  <span className="block text-sm font-black text-white">AI Agent active</span>
                  <span className="block text-xs text-[#a9c6bb]">Turns the separate AI Agent playground on.</span>
                </span>
                <input type="checkbox" checked={config.isActive} onChange={(event) => setConfig((prev) => ({ ...prev, isActive: event.target.checked }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">System instructions</span>
                <textarea className={textareaClass} rows={5} value={config.systemPrompt} onChange={(event) => setConfig((prev) => ({ ...prev, systemPrompt: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Handoff message</span>
                <textarea className={textareaClass} rows={3} value={config.handoffMessage} onChange={(event) => setConfig((prev) => ({ ...prev, handoffMessage: event.target.value }))} />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className={greenButtonClass} onClick={saveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </button>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#315846] px-4 text-sm font-bold text-[#d8fff1] transition hover:border-[#3ddf84]/60 hover:bg-[#123226] disabled:opacity-60" onClick={testConnection} disabled={testing || !config.configured}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Test Connection
              </button>
            </div>

            {config.lastTestStatus ? (
              <p className="mt-4 rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
                Last test: <span className="font-bold">{config.lastTestStatus}</span>
                {config.lastTestError ? ` — ${config.lastTestError}` : ""}
              </p>
            ) : null}
          </div>

          <div className={cardClass}>
            <div className="mb-5">
              <h2 className="text-xl font-black">AI Agent Playground</h2>
              <p className="mt-1 text-sm text-[#a9c6bb]">Ask a test question against this AI Agent’s separate knowledge base.</p>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-bold text-[#d8fff1]">Customer question</span>
              <textarea
                className={textareaClass}
                rows={5}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Example: What services do you offer?"
              />
            </label>
            <div className="mt-4 flex justify-end">
              <button className={greenButtonClass} onClick={askQuestion} disabled={asking || !question.trim()}>
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Ask AI Agent
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-[#3ddf84]/40 bg-[#0d1b15]/70 p-4">
              <h3 className="text-lg font-black">Answer</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#d8fff1]">
                {answer?.answer || "The AI Agent answer will appear here after you ask a question."}
              </p>
              {answer ? (
                <div className="mt-4 grid gap-3 text-xs text-[#a9c6bb]">
                  <span>{answer.usage.totalTokens} tokens used</span>
                  <span>{answer.usedKnowledge.length} knowledge chunks used</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className={cardClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Knowledge Base</h2>
                <p className="mt-1 text-sm text-[#a9c6bb]">Save approved facts for this separate AI Agent.</p>
              </div>
              {knowledgeId ? (
                <button className="rounded-xl border border-[#315846] px-3 py-2 text-xs font-bold text-[#d8fff1]" onClick={clearKnowledgeForm}>
                  New item
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Title</span>
                <input className={inputClass} value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder="Business pricing" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-bold text-[#d8fff1]">Type</span>
                <select className={inputClass} value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="faq">FAQ</option>
                  <option value="policy">Policy</option>
                  <option value="product">Product</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-bold text-[#d8fff1]">Content</span>
                <textarea className={textareaClass} rows={9} value={knowledgeContent} onChange={(event) => setKnowledgeContent(event.target.value)} placeholder="Paste approved business knowledge here..." />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button className={greenButtonClass} onClick={saveKnowledge} disabled={knowledgeSaving || !knowledgeTitle.trim() || !knowledgeContent.trim()}>
                {knowledgeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Save Knowledge
              </button>
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-5">
              <h2 className="text-xl font-black">Saved Knowledge</h2>
              <p className="mt-1 text-sm text-[#a9c6bb]">These records are separate from the AI Chatbot tab.</p>
            </div>
            <div className="space-y-3">
              {documents.length === 0 ? (
                <div className={innerCardClass}>
                  <p className="text-sm text-[#a9c6bb]">No AI Agent knowledge saved yet.</p>
                </div>
              ) : (
                documents.map((item) => (
                  <article key={item.id} className={innerCardClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-black text-white">{item.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#a9c6bb]">{item.content}</p>
                        <p className="mt-2 text-xs font-bold text-[#3ddf84]">
                          {item.sourceType} · {item.chunkCount} chunks
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-[#315846] px-3 py-2 text-xs font-bold text-[#d8fff1] hover:border-[#3ddf84]/70" onClick={() => editKnowledge(item)}>
                          Edit
                        </button>
                        <button className="rounded-lg border border-red-400/50 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/10" onClick={() => deleteKnowledge(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-5">
            <h2 className="text-xl font-black">Usage</h2>
            <p className="mt-1 text-sm text-[#a9c6bb]">Provider token usage logged by the AI Agent playground.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Runs" value={usage?.totalRuns ?? 0} />
            <Metric label="Total tokens" value={usage?.totalTokens ?? 0} />
            <Metric label="Output tokens" value={usage?.completionTokens ?? 0} />
          </div>
          <div className="mt-5 space-y-3">
            {(usage?.recent ?? []).length === 0 ? (
              <p className="rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#a9c6bb]">No usage logged yet.</p>
            ) : (
              usage!.recent.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#315846] bg-[#0d1b15] px-3 py-2 text-sm text-[#d8fff1]">
                  <span className="font-bold">{item.mode}</span> · {item.provider} / {item.model} · {item.totalTokens} tokens
                  {item.question ? <span className="block truncate text-xs text-[#8bb4a5]">{item.question}</span> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
  helper,
  good,
}: {
  icon: typeof Bot
  label: string
  value: string
  helper: string
  good: boolean
}) {
  return (
    <article
      className={cn(
        "rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition",
        good
          ? "border-[#3ddf84]/60 bg-[#07130e]/85 hover:border-[#3ddf84]/80"
          : "border-[#ffbd29]/55 bg-[#2a220b]/20 hover:border-[#ffbd29]/75",
      )}
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#3ddf84]/40 bg-[#0d1b15]">
        <Icon className={cn("h-5 w-5", good ? "text-[#3ddf84]" : "text-[#ffbd29]")} />
      </div>
      <p className="text-sm font-bold text-[#a9c6bb]">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-[#a9c6bb]">{helper}</p>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={innerCardClass}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8bb4a5]">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  )
}

function StatusBox({ tone, message }: { tone: "success" | "error"; message: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-bold",
        tone === "success"
          ? "border-[#3ddf84]/60 bg-[#3ddf84]/10 text-[#d8fff1]"
          : "border-red-400/60 bg-red-500/10 text-red-100",
      )}
    >
      {message}
    </div>
  )
}

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error || "Request failed.")
  return json
}
