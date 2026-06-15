"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Bot, BookOpen, KeyRound, Loader2, MessageCircle, ShieldCheck, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type Tone = "friendly" | "professional" | "concise" | "supportive"
type SourceType = "manual" | "faq" | "instructions"
type Provider = "openai" | "openrouter" | "groq" | "ollama" | "custom" | "anthropic"

interface ChatbotSettings {
  workspace_id: string
  enabled: boolean
  tone: Tone
  fallback_message: string
  handover_enabled: boolean
  handover_message: string
  auto_reply_enabled: boolean
}

interface KnowledgeSource {
  id: string
  source_type: SourceType
  title: string
  content: string
  status: "active" | "archived"
  created_at?: string
}

interface ChatbotState {
  settings: ChatbotSettings
  sources: KnowledgeSource[]
  planAccess: {
    canUseAutoReply: boolean
    reason: string | null
  }
  providerConfigured: boolean
  providerSettings: ProviderSettings
  permissions: {
    canManage: boolean
    canEnableAutoReply: boolean
  }
}

interface ProviderSettings {
  provider: Provider
  model: string
  baseUrl: string | null
  apiKeyConfigured: boolean
  apiKeyMasked: string | null
  apiKeyLast4: string | null
  apiKeyConfiguredAt: string | null
  lastTestedAt: string | null
  lastTestStatus: "success" | "failed" | "not_tested" | null
  lastTestError: string | null
  supportedForChat: boolean
}

interface TestAnswer {
  status: "answered" | "fallback" | "skipped" | "failed"
  answer: string
  reason: string
  providerConfigured: boolean
}

const sourceTypeLabels: Record<SourceType, string> = {
  manual: "Business knowledge",
  faq: "FAQ",
  instructions: "Instructions",
}

export default function AiChatbotPage() {
  const [state, setState] = useState<ChatbotState | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingSource, setSavingSource] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [testingProvider, setTestingProvider] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftSettings, setDraftSettings] = useState<ChatbotSettings | null>(null)
  const [draftProvider, setDraftProvider] = useState<ProviderSettings | null>(null)
  const [providerApiKey, setProviderApiKey] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("manual")
  const [sourceTitle, setSourceTitle] = useState("")
  const [sourceContent, setSourceContent] = useState("")
  const [question, setQuestion] = useState("")
  const [testAnswer, setTestAnswer] = useState<TestAnswer | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai-chatbot")
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to load AI Chatbot")
      setState(body as ChatbotState)
      setDraftSettings((body as ChatbotState).settings)
      setDraftProvider((body as ChatbotState).providerSettings)
      setProviderApiKey("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI Chatbot")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const knowledgeCount = state?.sources.filter((source) => source.status === "active").length ?? 0
  const canManage = Boolean(state?.permissions.canManage)
  const canTurnOnAutoReply = Boolean(
    state?.permissions.canEnableAutoReply &&
      state?.planAccess.canUseAutoReply &&
      state?.providerConfigured,
  )
  const providerChanged = useMemo(
    () => JSON.stringify(state?.providerSettings ?? null) !== JSON.stringify(draftProvider ?? null) || providerApiKey.trim().length > 0,
    [draftProvider, providerApiKey, state?.providerSettings],
  )
  const settingsChanged = useMemo(
    () => JSON.stringify(state?.settings ?? null) !== JSON.stringify(draftSettings ?? null),
    [draftSettings, state?.settings],
  )

  async function saveSettings() {
    if (!draftSettings) return
    setSavingSettings(true)
    try {
      const res = await fetch("/api/ai-chatbot", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftSettings),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to save settings")
      toast.success("AI Chatbot settings saved")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveSource() {
    setSavingSource(true)
    try {
      const res = await fetch("/api/ai-chatbot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          title: sourceTitle,
          content: sourceContent,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to save knowledge")
      toast.success("Knowledge saved")
      setSourceTitle("")
      setSourceContent("")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save knowledge")
    } finally {
      setSavingSource(false)
    }
  }

  async function saveProviderSettings() {
    if (!draftProvider) return
    setSavingProvider(true)
    try {
      const res = await fetch("/api/ai-chatbot/provider", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: draftProvider.provider,
          model: draftProvider.model,
          base_url: draftProvider.baseUrl,
          api_key: providerApiKey,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to save AI provider")
      if (body?.warning) toast.message(body.warning)
      toast.success("AI provider settings saved")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save AI provider")
    } finally {
      setSavingProvider(false)
    }
  }

  async function testProviderConnection() {
    setTestingProvider(true)
    try {
      const res = await fetch("/api/ai-chatbot/provider", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? "Provider test failed")
      toast.success(body?.message ?? "AI provider connection works")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Provider test failed")
      await load()
    } finally {
      setTestingProvider(false)
    }
  }

  async function deleteSource(source: KnowledgeSource) {
    if (!window.confirm(`Delete "${source.title}" from AI knowledge?`)) return
    const res = await fetch(`/api/ai-chatbot/sources/${source.id}`, { method: "DELETE" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(body?.error ?? "Failed to delete knowledge")
      return
    }
    toast.success("Knowledge deleted")
    setState((prev) =>
      prev
        ? {
            ...prev,
            sources: prev.sources.filter((item) => item.id !== source.id),
          }
        : prev,
    )
  }

  async function testChatbot() {
    setTesting(true)
    setTestAnswer(null)
    try {
      const res = await fetch("/api/ai-chatbot/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to test chatbot")
      setTestAnswer(body as TestAnswer)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to test chatbot")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-300" />
      </div>
    )
  }

  if (error || !state || !draftSettings || !draftProvider) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-300">{error ?? "AI Chatbot could not load."}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Chatbot</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#b8cfc7]">
            Add workspace knowledge, test answers, and control safe AI replies for customer messages.
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-4 py-2 text-sm font-semibold text-emerald-100">
          {state.planAccess.canUseAutoReply ? "Active Pro: auto-reply available" : "Draft mode only"}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatusCard
          icon={Bot}
          label="Chatbot"
          value={draftSettings.enabled ? "Enabled" : "Disabled"}
          detail={`${knowledgeCount} active knowledge source${knowledgeCount === 1 ? "" : "s"}`}
        />
        <StatusCard
          icon={MessageCircle}
          label="Auto-reply"
          value={draftSettings.auto_reply_enabled ? "On" : "Off"}
          detail={state.planAccess.reason ?? "Allowed on this workspace"}
        />
        <StatusCard
          icon={ShieldCheck}
          label="AI provider"
          value={state.providerConfigured ? "API key configured" : "API key missing"}
          detail={
            state.providerConfigured
              ? `${state.providerSettings.provider} · ${state.providerSettings.apiKeyMasked ?? "server default"}`
              : "Add an API key before testing live AI replies"
          }
        />
      </section>

      <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-emerald-300" />
              <h2 className="text-lg font-bold text-white">AI Provider Settings</h2>
            </div>
            <p className="mt-1 text-sm text-[#9dbfb5]">
              Add a workspace API key first, then save knowledge, test responses, and enable auto-reply.
            </p>
          </div>
          <StatusPill
            label={
              state.providerSettings.lastTestStatus === "success"
                ? "Connection working"
                : state.providerSettings.apiKeyConfigured
                  ? "Key saved"
                  : "Key missing"
            }
            tone={state.providerSettings.lastTestStatus === "success" ? "success" : "warning"}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-emerald-50">Provider</span>
            <select
              className="h-11 w-full rounded-lg border border-emerald-700 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
              disabled={!canManage}
              value={draftProvider.provider}
              onChange={(event) => {
                const next = event.target.value as Provider
                const defaults: Record<Provider, { model: string; baseUrl: string | null }> = {
                  openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
                  openrouter: { model: "openai/gpt-4o-mini", baseUrl: "https://openrouter.ai/api/v1" },
                  groq: { model: "llama-3.1-8b-instant", baseUrl: "https://api.groq.com/openai/v1" },
                  ollama: { model: "llama3.1", baseUrl: "http://localhost:11434/v1" },
                  custom: { model: "gpt-4o-mini", baseUrl: "" },
                  anthropic: { model: "claude-3-5-haiku-latest", baseUrl: "https://api.anthropic.com" },
                }
                setDraftProvider({
                  ...draftProvider,
                  provider: next,
                  model: defaults[next].model,
                  baseUrl: defaults[next].baseUrl,
                  supportedForChat: next !== "anthropic",
                })
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="groq">Groq</option>
              <option value="ollama">Ollama / OpenAI-compatible</option>
              <option value="custom">Custom OpenAI-compatible API</option>
              <option value="anthropic">Anthropic Claude (saved only)</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-emerald-50">Model</span>
            <input
              className="h-11 w-full rounded-lg border border-emerald-700 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
              disabled={!canManage}
              value={draftProvider.model}
              onChange={(event) => setDraftProvider({ ...draftProvider, model: event.target.value })}
              placeholder="gpt-4o-mini"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-emerald-50">API key</span>
            <input
              className="h-11 w-full rounded-lg border border-emerald-700 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
              disabled={!canManage}
              value={providerApiKey}
              onChange={(event) => setProviderApiKey(event.target.value)}
              placeholder={draftProvider.apiKeyMasked ?? "Paste API key. It will not be shown again."}
              type="password"
            />
            <p className="text-xs text-[#9dbfb5]">
              {draftProvider.apiKeyConfigured
                ? `Saved key: ${draftProvider.apiKeyMasked}. Leave blank to keep it.`
                : "Your key is encrypted on the server and never returned to the browser."}
            </p>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-emerald-50">Base URL</span>
            <input
              className="h-11 w-full rounded-lg border border-emerald-700 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
              disabled={!canManage}
              value={draftProvider.baseUrl ?? ""}
              onChange={(event) => setDraftProvider({ ...draftProvider, baseUrl: event.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </label>
        </div>

        {draftProvider.provider === "anthropic" && (
          <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            Anthropic Claude can be saved for future support, but Phase 1 live chat currently supports OpenAI-compatible chat APIs only.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            className="border border-emerald-500/50 bg-[#0b241c] text-white hover:bg-emerald-900"
            disabled={!canManage || testingProvider || !draftProvider.apiKeyConfigured}
            onClick={() => void testProviderConnection()}
            variant="outline"
          >
            {testingProvider && <Loader2 className="size-4 animate-spin" />}
            Test Connection
          </Button>
          <Button
            className="bg-white text-emerald-950 hover:bg-emerald-100"
            disabled={!canManage || savingProvider || !providerChanged}
            onClick={() => void saveProviderSettings()}
          >
            {savingProvider && <Loader2 className="size-4 animate-spin" />}
            Save API Settings
          </Button>
        </div>
      </section>

      {!state.planAccess.canUseAutoReply && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          {state.planAccess.reason}
        </div>
      )}

      <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Chatbot Instructions</h2>
            <p className="mt-1 text-sm text-[#9dbfb5]">
              These settings control the test chatbot and guarded WhatsApp auto-replies.
            </p>
          </div>
          <ToggleControl
            checked={draftSettings.enabled}
            disabled={!canManage}
            label={draftSettings.enabled ? "Enabled" : "Disabled"}
            onCheckedChange={(checked) => setDraftSettings({ ...draftSettings, enabled: checked })}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-emerald-50">Tone</span>
            <select
              className="h-11 w-full rounded-lg border border-emerald-800 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
              disabled={!canManage}
              value={draftSettings.tone}
              onChange={(event) =>
                setDraftSettings({ ...draftSettings, tone: event.target.value as Tone })
              }
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="concise">Concise</option>
              <option value="supportive">Supportive</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-emerald-800 bg-[#07130e]/70 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-emerald-50">Handover enabled</span>
              <span className="text-xs text-[#9dbfb5]">Use a human handover message when needed.</span>
            </span>
            <ToggleControl
              checked={draftSettings.handover_enabled}
              disabled={!canManage}
              label={draftSettings.handover_enabled ? "On" : "Off"}
              onCheckedChange={(checked) =>
                setDraftSettings({ ...draftSettings, handover_enabled: checked })
              }
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextAreaField
            disabled={!canManage}
            label="Fallback message"
            value={draftSettings.fallback_message}
            onChange={(value) => setDraftSettings({ ...draftSettings, fallback_message: value })}
          />
          <TextAreaField
            disabled={!canManage}
            label="Handover message"
            value={draftSettings.handover_message}
            onChange={(value) => setDraftSettings({ ...draftSettings, handover_message: value })}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-800 bg-[#07130e]/70 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-white">Live WhatsApp auto-reply</h3>
            <p className="text-sm text-[#9dbfb5]">
              Only active Pro workspaces can turn this on. Assigned human conversations are skipped.
            </p>
          </div>
          <ToggleControl
            checked={draftSettings.auto_reply_enabled}
            disabled={!canManage || !canTurnOnAutoReply}
            label={draftSettings.auto_reply_enabled ? "On" : "Off"}
            onCheckedChange={(checked) =>
              setDraftSettings({ ...draftSettings, auto_reply_enabled: checked })
            }
          />
        </div>

        {canManage && (
          <div className="mt-5 flex justify-end">
            <Button
              className="bg-white text-emerald-950 hover:bg-emerald-100"
              disabled={!settingsChanged || savingSettings}
              onClick={() => void saveSettings()}
            >
              {savingSettings && <Loader2 className="size-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
          <h2 className="text-lg font-bold text-white">Business Knowledge</h2>
          <p className="mt-1 text-sm text-[#9dbfb5]">
            Add FAQs, business rules, service details, pricing notes, and support instructions manually.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-emerald-50">Knowledge type</span>
              <select
                className="h-11 w-full rounded-lg border border-emerald-800 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
                disabled={!canManage}
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as SourceType)}
              >
                <option value="manual">Business knowledge</option>
                <option value="faq">FAQ</option>
                <option value="instructions">Instructions</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-emerald-50">Title</span>
              <input
                className="h-11 w-full rounded-lg border border-emerald-800 bg-[#07130e] px-3 text-sm text-white outline-none focus:border-emerald-300"
                disabled={!canManage}
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Example: Delivery policy, Product FAQ, Support hours"
              />
            </label>
            <TextAreaField
              disabled={!canManage}
              label="Knowledge content"
              minHeight="min-h-52"
              value={sourceContent}
              onChange={setSourceContent}
              placeholder="Write the exact business information the chatbot is allowed to use."
            />
            {canManage && (
              <Button
                className="w-fit bg-white text-emerald-950 hover:bg-emerald-100"
                disabled={savingSource || !sourceTitle.trim() || !sourceContent.trim()}
                onClick={() => void saveSource()}
              >
                {savingSource && <Loader2 className="size-4 animate-spin" />}
                Save Knowledge
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
          <h2 className="text-lg font-bold text-white">Test Chatbot</h2>
          <p className="mt-1 text-sm text-[#9dbfb5]">
            Ask a test question. Answers are restricted to this workspace knowledge.
          </p>
          <textarea
            className="mt-4 min-h-28 w-full rounded-lg border border-emerald-800 bg-[#07130e] p-3 text-sm text-white outline-none focus:border-emerald-300"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: What are your support hours?"
          />
          <Button
            className="mt-3 bg-white text-emerald-950 hover:bg-emerald-100"
            disabled={testing || !question.trim()}
            onClick={() => void testChatbot()}
          >
            {testing && <Loader2 className="size-4 animate-spin" />}
            Ask Test Question
          </Button>
          {testAnswer && (
            <div
              className={cn(
                "mt-4 rounded-xl border p-4 text-sm",
                testAnswer.status === "answered"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-50"
                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-50",
              )}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                {testAnswer.status} · {testAnswer.reason}
              </p>
              <p>{testAnswer.answer || "No answer was generated."}</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-emerald-300" />
          <h2 className="text-lg font-bold text-white">Knowledge Preview</h2>
        </div>
        <div className="mt-4 grid gap-3">
          {state.sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-800 p-6 text-sm text-[#9dbfb5]">
              No AI knowledge has been added yet.
            </div>
          ) : (
            state.sources.map((source) => (
              <article
                key={source.id}
                className="rounded-xl border border-emerald-900 bg-[#07130e]/70 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      {sourceTypeLabels[source.source_type]}
                    </p>
                    <h3 className="mt-1 font-semibold text-white">{source.title}</h3>
                  </div>
                  {canManage && (
                    <Button
                      className="text-red-200 hover:text-red-100"
                      size="icon"
                      variant="ghost"
                      onClick={() => void deleteSource(source)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-[#b8cfc7]">
                  {source.content}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bot
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
      <div className="flex items-center gap-3 text-emerald-200">
        <Icon className="size-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-[#9dbfb5]">{detail}</p>
    </div>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: "success" | "warning"
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold",
        tone === "success"
          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
          : "border-yellow-400/40 bg-yellow-400/15 text-yellow-100",
      )}
    >
      {label}
    </span>
  )
}

function ToggleControl({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-w-28 items-center justify-end gap-3">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold",
          checked
            ? "bg-emerald-300 text-emerald-950"
            : "bg-slate-800 text-slate-100",
          disabled && "opacity-60",
        )}
      >
        {label}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  minHeight = "min-h-28",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  minHeight?: string
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-emerald-50">{label}</span>
      <textarea
        className={cn(
          "w-full rounded-lg border border-emerald-800 bg-[#07130e] p-3 text-sm text-white outline-none focus:border-emerald-300",
          minHeight,
        )}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
