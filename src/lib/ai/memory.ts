import { resolveAiProviderConfig, resolveMemorySettings, type AiMemorySettings } from '@/lib/ai/provider'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface ContactMemory {
  readonly contactId: string
  readonly memorySummary: string | null
  readonly keyFacts: Record<string, string>
  readonly topicsDiscussed: string[]
  readonly lastIntent: string | null
  readonly sentiment: 'positive' | 'neutral' | 'negative' | null
  readonly preferredLanguage: string | null
  readonly unresolvedQuestions: string[]
  readonly conversationCount: number
  readonly lastConversationAt: string | null
}

export interface ConversationSummaryResult {
  readonly summary: string
  readonly topics: string[]
  readonly intent: string | null
  readonly sentiment: 'positive' | 'neutral' | 'negative' | null
  readonly resolved: boolean
  readonly unresolvedQuestions: string[]
  readonly keyFactsExtracted: Record<string, string>
  readonly languageDetected: string | null
}

export interface ConversationMessage {
  readonly sender_type?: string | null
  readonly content_text?: string | null
  readonly created_at?: string | null
}

interface MemoryRow {
  readonly contact_id: string
  readonly memory_summary: string | null
  readonly key_facts: Record<string, unknown> | null
  readonly topics_discussed: string[] | null
  readonly last_intent: string | null
  readonly sentiment: string | null
  readonly preferred_language: string | null
  readonly unresolved_questions: string[] | null
  readonly conversation_count: number | null
  readonly last_conversation_at: string | null
  readonly memory_enabled: boolean | null
}

const MEMORY_CONTEXT_MAX_WORDS = 200
const SENSITIVE_KEY_PATTERN = /\b(?:password|passcode|otp|security\s*code|card|credit|debit|cvv|cvc|iban|bank|government\s*id|passport|ssn|cnic)\b/i
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d|wa\.me\/\d+)/gi

export async function loadContactMemory(
  workspaceId: string,
  contactId: string,
): Promise<ContactMemory | null> {
  try {
    const result = await withTimeout(loadContactMemoryUnsafe(workspaceId, contactId), 1_000)
    return result
  } catch {
    return null
  }
}

async function loadContactMemoryUnsafe(workspaceId: string, contactId: string): Promise<ContactMemory | null> {
  const { data, error } = await supabaseAdmin()
    .from('ai_contact_memories')
    .select('contact_id, memory_summary, key_facts, topics_discussed, last_intent, sentiment, preferred_language, unresolved_questions, conversation_count, last_conversation_at, memory_enabled')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .maybeSingle<MemoryRow>()
  if (error || !data || data.memory_enabled === false) return null
  return mapMemoryRow(data)
}

export async function summarizeConversation(
  workspaceId: string,
  contactId: string,
  conversationId: string,
  messages: readonly ConversationMessage[],
  workspaceAiSettings?: AiMemorySettings,
): Promise<ConversationSummaryResult> {
  const settings = workspaceAiSettings ?? await resolveMemorySettings(workspaceId)
  if (!settings.memoryEnabled) return emptyConversationSummary()
  const result = await requestConversationSummary(workspaceId, messages).catch(() => emptyConversationSummary())
  const safeResult = sanitizeConversationSummary(result)
  await persistConversationSummary({
    workspaceId,
    contactId,
    conversationId,
    messages,
    summary: safeResult,
  }).catch(() => undefined)
  return safeResult
}

export function mergeContactMemory(
  existing: ContactMemory,
  newSummary: ConversationSummaryResult,
): Partial<ContactMemory> {
  const resolvedTokens = newSummary.resolved
    ? new Set(tokenize([...newSummary.topics, newSummary.intent ?? '', newSummary.summary].join(' ')))
    : new Set<string>()
  const unresolved = unionStrings(existing.unresolvedQuestions, newSummary.unresolvedQuestions)
    .filter((question) => {
      if (!newSummary.resolved || resolvedTokens.size === 0) return true
      const questionTokens = tokenize(question)
      return questionTokens.length === 0 || questionTokens.some((token) => !resolvedTokens.has(token))
    })
    .slice(0, 10)

  return {
    memorySummary: newSummary.summary || existing.memorySummary,
    keyFacts: { ...existing.keyFacts, ...newSummary.keyFactsExtracted },
    topicsDiscussed: unionStrings(existing.topicsDiscussed, newSummary.topics).slice(0, 20),
    lastIntent: newSummary.intent || existing.lastIntent,
    sentiment: newSummary.sentiment,
    preferredLanguage: newSummary.languageDetected || existing.preferredLanguage,
    unresolvedQuestions: unresolved,
    conversationCount: existing.conversationCount + 1,
    lastConversationAt: new Date().toISOString(),
  }
}

export function formatMemoryContext(memory: ContactMemory): string {
  const lines = [
    '--- Returning Customer Context ---',
    `This customer has contacted us ${Math.max(1, memory.conversationCount)} time${memory.conversationCount === 1 ? '' : 's'} before.`,
    memory.topicsDiscussed.length > 0 ? `Previous topics: ${memory.topicsDiscussed.slice(0, 8).join(', ')}.` : '',
    memory.lastIntent ? `Last interaction intent: ${memory.lastIntent}.` : '',
    memory.memorySummary ? `Last interaction: ${memory.memorySummary}` : '',
    formatSafeFacts(memory.keyFacts),
    memory.unresolvedQuestions.length > 0 ? `Unresolved: ${memory.unresolvedQuestions.slice(0, 4).join('; ')}.` : '',
    memory.preferredLanguage ? `Language: ${memory.preferredLanguage}.` : '',
    '--- End Context ---',
  ].filter(Boolean)

  return limitWords(stripSensitiveText(lines.join('\n')), MEMORY_CONTEXT_MAX_WORDS)
}

export async function clearContactMemory(workspaceId: string, contactId: string): Promise<void> {
  await supabaseAdmin()
    .from('ai_contact_memories')
    .upsert({
      workspace_id: workspaceId,
      contact_id: contactId,
      memory_enabled: false,
      memory_summary: null,
      key_facts: {},
      topics_discussed: [],
      unresolved_questions: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,contact_id' })
}

export function buildMemoryRetrievalContext(memory: ContactMemory | null): {
  readonly topicsDiscussed: string[]
  readonly lastIntent: string | null
  readonly unresolvedQuestions: string[]
} | null {
  if (!memory) return null
  return {
    topicsDiscussed: memory.topicsDiscussed,
    lastIntent: memory.lastIntent,
    unresolvedQuestions: memory.unresolvedQuestions,
  }
}

async function requestConversationSummary(
  workspaceId: string,
  messages: readonly ConversationMessage[],
): Promise<ConversationSummaryResult> {
  const config = await resolveAiProviderConfig(workspaceId)
  if (!config) return emptyConversationSummary()
  const transcript = messages
    .slice(-20)
    .map((message) => {
      const speaker = message.sender_type === 'customer' ? 'Customer' : message.sender_type === 'bot' ? 'Assistant' : 'Team'
      return `${speaker}: ${(message.content_text ?? '').trim().slice(0, 1000)}`
    })
    .filter((line) => !line.endsWith(':'))
    .join('\n')
  if (!transcript) return emptyConversationSummary()

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'You are a customer interaction analyzer for a business support system. Analyze this conversation and extract: 1. A brief summary (2-3 sentences max) of what the customer asked and what was resolved. 2. Topics discussed (list of short labels) 3. Customer intent (what they want: inquiry, purchase, complaint, support, general_question) 4. Sentiment: positive, neutral, or negative 5. Whether the conversation was resolved: true or false 6. Any unresolved questions or issues (list) 7. Key facts the customer shared about themselves (name, company, what they use, what they need, etc.) 8. Language the customer was writing in (ISO code). Do not store payment card numbers, financial data, government ID numbers, passwords, security codes, or third-party personal data. Reply ONLY with a valid JSON object matching this schema: { "summary": string, "topics": string[], "intent": string, "sentiment": string, "resolved": boolean, "unresolvedQuestions": string[], "keyFactsExtracted": object, "languageDetected": string }. Do not include any text outside the JSON object. Do not invent facts not present in the conversation.',
        },
        { role: 'user', content: transcript },
      ],
    }),
  })
  if (!response.ok) return emptyConversationSummary()
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return parseSummaryJson(body.choices?.[0]?.message?.content ?? '')
}

async function persistConversationSummary(args: {
  readonly workspaceId: string
  readonly contactId: string
  readonly conversationId: string
  readonly messages: readonly ConversationMessage[]
  readonly summary: ConversationSummaryResult
}): Promise<void> {
  const admin = supabaseAdmin()
  const messageCount = args.messages.filter((message) => (message.content_text ?? '').trim()).length
  const aiMessageCount = args.messages.filter((message) => message.sender_type === 'bot').length
  await admin.from('ai_conversation_summaries').insert({
    workspace_id: args.workspaceId,
    contact_id: args.contactId,
    conversation_id: args.conversationId,
    summary: args.summary.summary,
    topics: args.summary.topics,
    intent: args.summary.intent,
    sentiment: args.summary.sentiment,
    resolved: args.summary.resolved,
    unresolved_questions: args.summary.unresolvedQuestions,
    key_facts_extracted: args.summary.keyFactsExtracted,
    message_count: messageCount,
    ai_message_count: aiMessageCount,
    language_detected: args.summary.languageDetected,
  })

  const { data } = await admin
    .from('ai_contact_memories')
    .select('contact_id, memory_summary, key_facts, topics_discussed, last_intent, sentiment, preferred_language, unresolved_questions, conversation_count, last_conversation_at, memory_enabled')
    .eq('workspace_id', args.workspaceId)
    .eq('contact_id', args.contactId)
    .maybeSingle<MemoryRow>()
  const existing = data ? mapMemoryRow(data) : emptyContactMemory(args.contactId)
  const merged = mergeContactMemory(existing, args.summary)
  await admin.from('ai_contact_memories').upsert({
    workspace_id: args.workspaceId,
    contact_id: args.contactId,
    memory_summary: merged.memorySummary ?? null,
    key_facts: merged.keyFacts ?? {},
    topics_discussed: merged.topicsDiscussed ?? [],
    last_intent: merged.lastIntent ?? null,
    sentiment: merged.sentiment ?? null,
    preferred_language: merged.preferredLanguage ?? null,
    unresolved_questions: merged.unresolvedQuestions ?? [],
    conversation_count: merged.conversationCount ?? 1,
    last_conversation_at: merged.lastConversationAt ?? new Date().toISOString(),
    memory_enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,contact_id' })
}

function parseSummaryJson(content: string): ConversationSummaryResult {
  try {
    const json = JSON.parse(content.trim().replace(/^```json\s*|\s*```$/g, '')) as Record<string, unknown>
    return sanitizeConversationSummary({
      summary: readString(json.summary),
      topics: readStringArray(json.topics),
      intent: readString(json.intent),
      sentiment: readSentiment(json.sentiment),
      resolved: json.resolved === true,
      unresolvedQuestions: readStringArray(json.unresolvedQuestions),
      keyFactsExtracted: readFacts(json.keyFactsExtracted),
      languageDetected: readString(json.languageDetected),
    })
  } catch {
    return emptyConversationSummary()
  }
}

function sanitizeConversationSummary(summary: ConversationSummaryResult): ConversationSummaryResult {
  return {
    summary: stripSensitiveText(summary.summary).slice(0, 800),
    topics: readStringArray(summary.topics).slice(0, 12),
    intent: stripSensitiveText(summary.intent ?? '').slice(0, 80) || null,
    sentiment: readSentiment(summary.sentiment),
    resolved: Boolean(summary.resolved),
    unresolvedQuestions: readStringArray(summary.unresolvedQuestions).map(stripSensitiveText).slice(0, 10),
    keyFactsExtracted: readFacts(summary.keyFactsExtracted),
    languageDetected: normalizeLanguage(summary.languageDetected),
  }
}

function mapMemoryRow(row: MemoryRow): ContactMemory {
  return {
    contactId: row.contact_id,
    memorySummary: row.memory_summary,
    keyFacts: readFacts(row.key_facts),
    topicsDiscussed: readStringArray(row.topics_discussed),
    lastIntent: row.last_intent,
    sentiment: readSentiment(row.sentiment),
    preferredLanguage: row.preferred_language,
    unresolvedQuestions: readStringArray(row.unresolved_questions),
    conversationCount: row.conversation_count ?? 0,
    lastConversationAt: row.last_conversation_at,
  }
}

function emptyContactMemory(contactId: string): ContactMemory {
  return {
    contactId,
    memorySummary: null,
    keyFacts: {},
    topicsDiscussed: [],
    lastIntent: null,
    sentiment: null,
    preferredLanguage: null,
    unresolvedQuestions: [],
    conversationCount: 0,
    lastConversationAt: null,
  }
}

function emptyConversationSummary(): ConversationSummaryResult {
  return {
    summary: '',
    topics: [],
    intent: null,
    sentiment: null,
    resolved: false,
    unresolvedQuestions: [],
    keyFactsExtracted: {},
    languageDetected: null,
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => stripSensitiveText(item.trim()).slice(0, 160)).filter(Boolean))]
    : []
}

function readFacts(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, fact]) => typeof fact === 'string' && key.trim() && !SENSITIVE_KEY_PATTERN.test(key) && !SENSITIVE_KEY_PATTERN.test(fact))
      .map(([key, fact]) => [key.trim().slice(0, 80), stripSensitiveText(String(fact)).slice(0, 240)])
      .filter(([, fact]) => fact),
  )
}

function readSentiment(value: unknown): 'positive' | 'neutral' | 'negative' | null {
  return value === 'positive' || value === 'neutral' || value === 'negative' ? value : null
}

function normalizeLanguage(value: string | null): string | null {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z-]/g, '')
  return normalized || null
}

function formatSafeFacts(facts: Record<string, string>): string {
  const entries = Object.entries(facts).filter(([key, value]) => !SENSITIVE_KEY_PATTERN.test(key) && !SENSITIVE_KEY_PATTERN.test(value))
  return entries.length > 0
    ? `Known preferences: ${entries.slice(0, 6).map(([key, value]) => `${key}: ${value}`).join('; ')}.`
    : ''
}

function stripSensitiveText(text: string): string {
  return text.replace(PHONE_PATTERN, '[contact hidden]').replace(/\s+/g, ' ').trim()
}

function limitWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(' ')}...`
}

function unionStrings(left: readonly string[], right: readonly string[]): string[] {
  return [...new Set([...left, ...right].map((item) => item.trim()).filter(Boolean))]
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('timeout')), milliseconds)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
