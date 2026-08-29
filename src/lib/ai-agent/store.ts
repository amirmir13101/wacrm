import { generateText } from 'ai'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createRagOpenAICompatibleProvider, resolveRagProviderConfig } from '@/lib/rag/provider'
import { AI_PROVIDER_DEFAULTS } from '@/lib/rag/provider-config'
import { getSecretLast4, maskSecret, sanitizeProviderError } from '@/lib/rag/security'
import { isRagProviderType } from '@/lib/rag/settings'
import type { RagProviderType } from '@/lib/rag/types'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import type {
  AiAgentAnswerResult,
  AiAgentConfigView,
  AiAgentKnowledgeDocument,
  AiAgentSourceType,
  AiAgentUsageSummary,
} from './types'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful AI agent for this business. Answer only from approved workspace knowledge when business-specific facts are requested. If the information is missing, say you do not have that information and suggest handing off to a team member.'
const DEFAULT_HANDOFF = 'I can connect you with a team member for this.'
const CHUNK_SIZE = 1_100
const CHUNK_OVERLAP = 160

interface AiAgentConfigRow {
  readonly provider?: string | null
  readonly encrypted_api_key?: string | null
  readonly api_key_last4?: string | null
  readonly base_url?: string | null
  readonly chat_model?: string | null
  readonly embedding_model?: string | null
  readonly embedding_dimensions?: number | null
  readonly system_prompt?: string | null
  readonly is_active?: boolean | null
  readonly auto_reply_enabled?: boolean | null
  readonly auto_reply_max_per_conversation?: number | null
  readonly handoff_message?: string | null
  readonly last_tested_at?: string | null
  readonly last_test_status?: string | null
  readonly last_test_error?: string | null
}

interface AiAgentDocumentRow {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly source_type: string
  readonly status: string
  readonly created_at: string
  readonly updated_at: string
  readonly ai_agent_knowledge_chunks?: Array<{ id: string }> | null
}

interface AiAgentChunkRow {
  readonly id: string
  readonly document_id: string
  readonly content: string
}

function normalizeStatus(value: string | null | undefined): AiAgentConfigView['lastTestStatus'] {
  if (value === 'not_tested' || value === 'success' || value === 'failed') return value
  return null
}

function configToView(row: AiAgentConfigRow | null): AiAgentConfigView {
  const provider = isRagProviderType(row?.provider ?? '') ? row!.provider as RagProviderType : 'openai'
  const defaults = AI_PROVIDER_DEFAULTS[provider]
  const keyLast4 = row?.api_key_last4 ?? getSecretLast4(row?.encrypted_api_key)

  return {
    configured: Boolean(row?.encrypted_api_key),
    provider,
    maskedKey: maskSecret(keyLast4),
    keyLast4,
    baseUrl: row?.base_url ?? defaults.baseUrl,
    chatModel: row?.chat_model || defaults.chatModel,
    embeddingModel: row?.embedding_model || defaults.embeddingModel,
    embeddingDimensions: row?.embedding_dimensions || defaults.embeddingDimensions,
    systemPrompt: row?.system_prompt || DEFAULT_SYSTEM_PROMPT,
    isActive: row?.is_active === true,
    autoReplyEnabled: row?.auto_reply_enabled === true,
    autoReplyMaxPerConversation: row?.auto_reply_max_per_conversation ?? 3,
    handoffMessage: row?.handoff_message || DEFAULT_HANDOFF,
    lastTestedAt: row?.last_tested_at ?? null,
    lastTestStatus: normalizeStatus(row?.last_test_status),
    lastTestError: row?.last_test_error ?? null,
  }
}

export async function getAiAgentConfig(workspaceId: string): Promise<AiAgentConfigView> {
  const { data, error } = await supabaseAdmin()
    .from('ai_agent_configs')
    .select('provider, encrypted_api_key, api_key_last4, base_url, chat_model, embedding_model, embedding_dimensions, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, handoff_message, last_tested_at, last_test_status, last_test_error')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return configToView(data as AiAgentConfigRow | null)
}

export async function saveAiAgentConfig(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly provider: RagProviderType
  readonly apiKey?: string | null
  readonly baseUrl?: string | null
  readonly chatModel?: string | null
  readonly embeddingModel?: string | null
  readonly embeddingDimensions?: number | null
  readonly systemPrompt?: string | null
  readonly isActive?: boolean
  readonly autoReplyEnabled?: boolean
  readonly autoReplyMaxPerConversation?: number
  readonly handoffMessage?: string | null
}): Promise<AiAgentConfigView> {
  const defaults = AI_PROVIDER_DEFAULTS[args.provider]
  const existing = await getRawAiAgentConfig(args.workspaceId)
  const apiKey = args.apiKey?.trim()
  const encryptedApiKey = apiKey ? encrypt(apiKey) : existing?.encrypted_api_key ?? null

  if (!encryptedApiKey) throw new Error('AI provider API key is required.')

  const chatModel = args.chatModel?.trim() || defaults.chatModel
  const embeddingModel = args.embeddingModel?.trim() || defaults.embeddingModel
  const embeddingDimensions = Number(args.embeddingDimensions || defaults.embeddingDimensions)
  const baseUrl = args.baseUrl?.trim() || defaults.baseUrl
  const maxReplies = Math.min(20, Math.max(1, Number(args.autoReplyMaxPerConversation ?? 3)))

  const { error } = await supabaseAdmin()
    .from('ai_agent_configs')
    .upsert(
      {
        workspace_id: args.workspaceId,
        created_by: args.userId,
        provider: args.provider,
        encrypted_api_key: encryptedApiKey,
        api_key_last4: apiKey ? getSecretLast4(apiKey) : existing?.api_key_last4 ?? null,
        base_url: baseUrl,
        chat_model: chatModel,
        embedding_model: embeddingModel,
        embedding_dimensions: embeddingDimensions,
        system_prompt: args.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
        is_active: args.isActive === true,
        auto_reply_enabled: args.autoReplyEnabled === true,
        auto_reply_max_per_conversation: maxReplies,
        handoff_message: args.handoffMessage?.trim() || DEFAULT_HANDOFF,
        last_test_status: existing?.last_test_status ?? 'not_tested',
      },
      { onConflict: 'workspace_id' },
    )

  if (error) throw new Error(error.message)
  return getAiAgentConfig(args.workspaceId)
}

async function getRawAiAgentConfig(workspaceId: string): Promise<AiAgentConfigRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('ai_agent_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as AiAgentConfigRow | null
}

export async function testAiAgentConfig(workspaceId: string): Promise<AiAgentConfigView> {
  try {
    const raw = await getRawAiAgentConfig(workspaceId)
    const resolved = resolveAiAgentProvider(raw)
    const provider = createRagOpenAICompatibleProvider(resolved)
    await generateText({
      model: provider(resolved.chatModel),
      prompt: 'Reply with exactly: OK',
      maxOutputTokens: 8,
    })
    await updateAiAgentTestStatus(workspaceId, 'success', null)
  } catch (error) {
    await updateAiAgentTestStatus(workspaceId, 'failed', sanitizeProviderError(error))
  }
  return getAiAgentConfig(workspaceId)
}

async function updateAiAgentTestStatus(
  workspaceId: string,
  status: 'success' | 'failed',
  errorMessage: string | null,
) {
  const { error } = await supabaseAdmin()
    .from('ai_agent_configs')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: status,
      last_test_error: errorMessage,
    })
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

function resolveAiAgentProvider(row: AiAgentConfigRow | null) {
  if (!row?.encrypted_api_key) throw new Error('AI provider API key is not configured.')
  const provider = isRagProviderType(row.provider ?? '') ? row.provider as RagProviderType : 'openai'
  const defaults = AI_PROVIDER_DEFAULTS[provider]
  const apiKey = decrypt(row.encrypted_api_key)

  return resolveRagProviderConfig({
    provider,
    apiKey,
    baseUrl: row.base_url || defaults.baseUrl,
    chatModel: row.chat_model || defaults.chatModel,
    embeddingModel: row.embedding_model || defaults.embeddingModel,
    embeddingDimensions: row.embedding_dimensions || defaults.embeddingDimensions,
  })
}

export async function listAiAgentKnowledge(workspaceId: string): Promise<AiAgentKnowledgeDocument[]> {
  const { data, error } = await supabaseAdmin()
    .from('ai_agent_knowledge_documents')
    .select('id, title, content, source_type, status, created_at, updated_at, ai_agent_knowledge_chunks(id)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as AiAgentDocumentRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    sourceType: normalizeSourceType(row.source_type),
    status: row.status === 'archived' ? 'archived' : 'active',
    chunkCount: row.ai_agent_knowledge_chunks?.length ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function saveAiAgentKnowledge(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly title: string
  readonly content: string
  readonly sourceType: AiAgentSourceType
  readonly id?: string | null
}): Promise<AiAgentKnowledgeDocument[]> {
  const title = args.title.trim()
  const content = args.content.trim()
  if (!title) throw new Error('Knowledge title is required.')
  if (!content) throw new Error('Knowledge content is required.')

  const row = {
    workspace_id: args.workspaceId,
    created_by: args.userId,
    title,
    content,
    source_type: args.sourceType,
    status: 'active',
  }

  const query = args.id
    ? supabaseAdmin()
        .from('ai_agent_knowledge_documents')
        .update(row)
        .eq('id', args.id)
        .eq('workspace_id', args.workspaceId)
        .select('id')
        .single()
    : supabaseAdmin()
        .from('ai_agent_knowledge_documents')
        .insert(row)
        .select('id')
        .single()

  const { data, error } = await query
  if (error) throw new Error(error.message)

  await replaceAiAgentChunks(args.workspaceId, data.id as string, content)
  return listAiAgentKnowledge(args.workspaceId)
}

export async function deleteAiAgentKnowledge(workspaceId: string, documentId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('ai_agent_knowledge_documents')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', documentId)
  if (error) throw new Error(error.message)
}

async function replaceAiAgentChunks(workspaceId: string, documentId: string, content: string): Promise<void> {
  const chunks = chunkText(content)
  const admin = supabaseAdmin()
  const { error: deleteError } = await admin
    .from('ai_agent_knowledge_chunks')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('document_id', documentId)
  if (deleteError) throw new Error(deleteError.message)

  if (!chunks.length) return
  const { error } = await admin.from('ai_agent_knowledge_chunks').insert(
    chunks.map((chunk, index) => ({
      workspace_id: workspaceId,
      document_id: documentId,
      chunk_index: index,
      content: chunk,
    })),
  )
  if (error) throw new Error(error.message)
}

export async function askAiAgent(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly question: string
}): Promise<AiAgentAnswerResult> {
  const question = args.question.trim()
  if (!question) throw new Error('Question is required.')
  if (question.length > 2_000) throw new Error('Question is too long.')

  const raw = await getRawAiAgentConfig(args.workspaceId)
  if (!raw?.is_active) throw new Error('AI Agent is not active.')
  const resolved = resolveAiAgentProvider(raw)
  const chunks = await retrieveAiAgentKnowledge(args.workspaceId, question)
  const knowledge = chunks.map((chunk, index) => `Source ${index + 1}:\n${chunk.content}`).join('\n\n')

  const provider = createRagOpenAICompatibleProvider(resolved)
  const result = await generateText({
    model: provider(resolved.chatModel),
    system: raw.system_prompt || DEFAULT_SYSTEM_PROMPT,
    prompt: `Approved workspace knowledge:\n${knowledge || '(no matching knowledge found)'}\n\nCustomer question:\n${question}\n\nReturn a helpful answer. If the answer is not supported by the approved knowledge, say you do not have that information and suggest a human handoff.`,
  })

  const usage = {
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
  }

  await logAiAgentUsage({
    workspaceId: args.workspaceId,
    userId: args.userId,
    mode: 'playground',
    provider: resolved.provider,
    model: resolved.chatModel,
    question,
    ...usage,
  })

  return {
    answer: result.text,
    usedKnowledge: chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.document_id,
      content: chunk.content,
    })),
    usage,
  }
}

async function retrieveAiAgentKnowledge(workspaceId: string, question: string): Promise<AiAgentChunkRow[]> {
  const { data, error } = await supabaseAdmin().rpc('match_ai_agent_knowledge', {
    p_workspace_id: workspaceId,
    p_query: question,
    p_match_count: 6,
  })
  if (error) {
    const fallback = await supabaseAdmin()
      .from('ai_agent_knowledge_chunks')
      .select('id, document_id, content')
      .eq('workspace_id', workspaceId)
      .limit(6)
    if (fallback.error) throw new Error(error.message)
    return (fallback.data ?? []) as AiAgentChunkRow[]
  }
  return (data ?? []) as AiAgentChunkRow[]
}

async function logAiAgentUsage(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly mode: 'playground' | 'draft' | 'test' | 'auto_reply'
  readonly provider: string
  readonly model: string
  readonly promptTokens: number
  readonly completionTokens: number
  readonly totalTokens: number
  readonly question?: string | null
}) {
  await supabaseAdmin().from('ai_agent_usage_log').insert({
    workspace_id: args.workspaceId,
    created_by: args.userId,
    mode: args.mode,
    provider: args.provider,
    model: args.model,
    prompt_tokens: args.promptTokens,
    completion_tokens: args.completionTokens,
    total_tokens: args.totalTokens,
    question: args.question ?? null,
  })
}

export async function getAiAgentUsage(workspaceId: string): Promise<AiAgentUsageSummary> {
  const { data, error } = await supabaseAdmin()
    .from('ai_agent_usage_log')
    .select('id, mode, provider, model, prompt_tokens, completion_tokens, total_tokens, question, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{
    id: string
    mode: string
    provider: string
    model: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    question: string | null
    created_at: string
  }>

  return {
    totalRuns: rows.length,
    totalTokens: rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0),
    promptTokens: rows.reduce((sum, row) => sum + (row.prompt_tokens ?? 0), 0),
    completionTokens: rows.reduce((sum, row) => sum + (row.completion_tokens ?? 0), 0),
    recent: rows.slice(0, 10).map((row) => ({
      id: row.id,
      mode: row.mode,
      provider: row.provider,
      model: row.model,
      totalTokens: row.total_tokens,
      question: row.question,
      createdAt: row.created_at,
    })),
  }
}

function chunkText(content: string): string[] {
  const clean = content.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  let index = 0
  while (index < clean.length) {
    chunks.push(clean.slice(index, index + CHUNK_SIZE).trim())
    index += Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP)
  }
  return chunks.filter(Boolean)
}

function normalizeSourceType(value: string): AiAgentSourceType {
  if (value === 'manual' || value === 'website' || value === 'faq' || value === 'policy' || value === 'product' || value === 'other') {
    return value
  }
  return 'other'
}
