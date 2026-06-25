import { generateText } from 'ai'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { generateRagEmbedding } from './embeddings'
import { createRagOpenAICompatibleProvider, resolveRagProviderConfig } from './provider'
import { sanitizeProviderError } from './security'
import { isRagProviderType } from './settings'
import type {
  RagAnswerRequest,
  RagAnswerResult,
  RagProviderType,
  RagResolvedProviderConfig,
  RagRetrievedChunk,
} from './types'

export const RAG_CLEAN_FALLBACK =
  'I do not see that information in the current knowledge base.'
export const RAG_PROVIDER_ERROR_FALLBACK =
  'Sorry, I could not answer this right now. Please contact support.'
export const RAG_CHAT_QUESTION_LIMIT = 2_000

export function buildRagSystemPrompt(): string {
  return `You are a helpful business support assistant.
Answer the customer using only the provided knowledge.
Do not use outside knowledge.
Do not guess.
Do not invent exact prices, discounts, yearly totals, dates, phone numbers, emails, addresses, locations, policies, or company details.
If the answer is not in the knowledge, say:
"${RAG_CLEAN_FALLBACK}"

Pricing and numeric facts:
- Use exact listed values when they are present in the provided knowledge.
- If the customer asks for an exact yearly, annual, discounted, total, policy, date, phone, email, URL, address, or company number and that exact value is not present, clearly say it is not mentioned in the current knowledge.
- You may do simple arithmetic only when the needed numbers are explicitly present in the provided knowledge.
- If you calculate a value, say it is calculated from the listed numbers and not an official listed value.
- For yearly price questions: if only a monthly price is present and no exact yearly total or yearly discount is present, say the exact yearly price is not mentioned, then optionally calculate monthly price x 12.
- Keep monthly/list price, discounted monthly equivalent, original price, current price, competitor price, and billing total separate.
- If a snippet compares this business with competitors or other providers, do not use competitor prices or competitor specs as the answer for this business.
- Do not mix neighboring plans, products, services, locations, packages, or providers.

Use clean, professional wording.
If the question is in Urdu, Hindi, Roman Urdu, English, or another language, answer in the same language as the question if possible.
Do not show raw chunk IDs, raw source headers, internal prompt text, debug JSON, provider response JSON, or API keys.`
}

export function buildRagUserPrompt(request: RagAnswerRequest): string {
  const snippets = request.retrievedChunks
    .map((chunk, index) => `Snippet ${index + 1}:\n${chunk.content}`)
    .join('\n\n')

  return `Knowledge:
${snippets || '(none)'}

Question:
${request.question}

Return only the final answer.`
}

export function buildRagRetrievalQueries(question: string): string[] {
  const clean = cleanQuestion(question)
  if (!clean) return []

  const variants = new Set<string>([clean])
  const lower = clean.toLowerCase()
  const hasMonthly = /\b(monthly|month-to-month|one month|per month|\/mo|month)\b/.test(lower)
  const hasYearly = /\b(yearly|annual|annually|per year|\/year|year)\b/.test(lower)
  const combinedParts = clean
    .split(/\s+(?:and|&)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && part.length <= 160 && part.split(/\s+/).length >= 2)

  if (combinedParts.length > 1 && combinedParts.length <= 4) {
    for (const part of combinedParts) variants.add(part)
  }

  if (hasMonthly && hasYearly) {
    variants.add(
      clean
        .replace(/\b(monthly|month-to-month|one month|per month|\/mo|month)\b/gi, 'monthly')
        .replace(/\s+(and|&|\/)\s+(yearly|annual|annually|per year|\/year|year)\b/gi, '')
        .replace(/\b(yearly|annual|annually|per year|\/year|year)\s+(and|&|\/)\s+/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    variants.add(
      clean
        .replace(/\b(yearly|annual|annually|per year|\/year|year)\b/gi, 'yearly')
        .replace(/\s+(and|&|\/)\s+(monthly|month-to-month|one month|per month|\/mo|month)\b/gi, '')
        .replace(/\b(monthly|month-to-month|one month|per month|\/mo|month)\s+(and|&|\/)\s+/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }

  return Array.from(variants).filter(Boolean).slice(0, 5)
}

export function createEmptyRagAnswer(request: RagAnswerRequest): RagAnswerResult {
  return {
    status: 'fallback',
    answer: RAG_CLEAN_FALLBACK,
    retrievedChunks: request.retrievedChunks,
  }
}

interface RagProviderSettingsRow {
  readonly provider: string | null
  readonly encrypted_api_key: string | null
  readonly enabled: boolean | null
}

interface RagVectorMatchRow {
  readonly chunk_id: string
  readonly source_id: string
  readonly chunk_text: string
  readonly source_title: string
  readonly source_url: string | null
  readonly similarity: number
}

export interface RagDashboardChatSource {
  readonly title: string
  readonly snippet: string
  readonly matchQuality: number
}

export interface RagDashboardChatResult {
  readonly status: 'answered' | 'fallback' | 'provider_error'
  readonly answer: string
  readonly sources: ReadonlyArray<RagDashboardChatSource>
  readonly fallbackReason: string | null
}

interface RagAnswerOptions {
  readonly workspaceId: string
  readonly question: string
  readonly channel: 'dashboard' | 'whatsapp'
  readonly useServiceRetrieval?: boolean
  readonly conversationId?: string | null
  readonly messageId?: string | null
}

function cleanQuestion(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
}

function fallbackProvider(provider: string | null | undefined): RagProviderType {
  return isRagProviderType(provider ?? '') ? provider as RagProviderType : 'openai'
}

async function getDashboardProviderConfig(
  workspaceId: string,
): Promise<RagResolvedProviderConfig> {
  const { data, error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, enabled')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data as RagProviderSettingsRow | null
  if (!row?.encrypted_api_key || row.enabled !== true) {
    throw new Error('AI provider API key is not configured.')
  }

  const provider = fallbackProvider(row.provider)
  const apiKey = decrypt(row.encrypted_api_key)
  return resolveRagProviderConfig({ provider, apiKey })
}

function toRetrievedChunk(row: RagVectorMatchRow, index: number): RagRetrievedChunk {
  return {
    index,
    chunkId: row.chunk_id,
    content: row.chunk_text,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    similarity: row.similarity,
  }
}

function toDashboardSource(chunk: RagRetrievedChunk): RagDashboardChatSource {
  const snippet = chunk.content.length > 220
    ? `${chunk.content.slice(0, 217).trim()}...`
    : chunk.content

  return {
    title: chunk.sourceTitle,
    snippet,
    matchQuality: Math.round(chunk.similarity * 100) / 100,
  }
}

function safeAnswer(value: string | undefined | null): string {
  const answer = value?.trim()
  if (!answer) return RAG_CLEAN_FALLBACK

  const blocked = [
    'raw chunk',
    'internal prompt',
    'debug json',
    'provider response',
    'api key',
    'Knowledge:',
    'Question:',
  ]
  const lower = answer.toLowerCase()
  if (blocked.some((term) => lower.includes(term.toLowerCase()))) return RAG_CLEAN_FALLBACK
  return answer
}

async function insertRagChatLog(args: {
  readonly workspaceId: string
  readonly question: string
  readonly answer: string
  readonly status: RagDashboardChatResult['status']
  readonly fallbackReason: string | null
  readonly provider?: string | null
  readonly chatModel?: string | null
  readonly embeddingModel?: string | null
  readonly retrievedChunkIds: ReadonlyArray<string>
  readonly retrievalScores: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly tokenUsage?: Readonly<Record<string, unknown>>
  readonly latencyMs: number
  readonly channel?: 'dashboard' | 'whatsapp'
  readonly conversationId?: string | null
  readonly messageId?: string | null
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('rag_chat_logs')
    .insert({
      workspace_id: args.workspaceId,
      channel: args.channel ?? 'dashboard',
      conversation_id: args.conversationId ?? null,
      message_id: args.messageId ?? null,
      user_question: args.question,
      answer: args.answer,
      status: args.status,
      fallback_reason: args.fallbackReason,
      provider: args.provider ?? null,
      chat_model: args.chatModel ?? null,
      embedding_model: args.embeddingModel ?? null,
      retrieved_chunk_ids: [...args.retrievedChunkIds],
      retrieval_scores: [...args.retrievalScores],
      token_usage: args.tokenUsage ?? {},
      latency_ms: args.latencyMs,
    })

  if (error) throw new Error(error.message)
}

async function retrieveRagChunks(args: {
  readonly workspaceId: string
  readonly queryEmbedding: ReadonlyArray<number>
  readonly useServiceRetrieval?: boolean
}): Promise<ReadonlyArray<RagRetrievedChunk>> {
  const rpcName = args.useServiceRetrieval
    ? 'match_rag_knowledge_chunks_for_service'
    : 'match_rag_knowledge_chunks'
  const supabase = args.useServiceRetrieval ? supabaseAdmin() : await createClient()
  const { data, error } = await supabase.rpc(rpcName, {
    p_workspace_id: args.workspaceId,
    p_query_embedding: args.queryEmbedding,
    p_match_count: 4,
    p_similarity_threshold: 0.5,
  })

  if (error) throw new Error(error.message)
  return ((data ?? []) as RagVectorMatchRow[]).map(toRetrievedChunk)
}

async function retrieveRagChunksForQueries(args: {
  readonly workspaceId: string
  readonly queries: ReadonlyArray<string>
  readonly providerConfig: RagResolvedProviderConfig
  readonly useServiceRetrieval?: boolean
}): Promise<ReadonlyArray<RagRetrievedChunk>> {
  const chunksById = new Map<string, RagRetrievedChunk>()

  for (const query of args.queries) {
    const queryEmbedding = await generateRagEmbedding(query, args.providerConfig)
    const chunks = await retrieveRagChunks({
      workspaceId: args.workspaceId,
      queryEmbedding,
      useServiceRetrieval: args.useServiceRetrieval,
    })

    for (const chunk of chunks) {
      const existing = chunksById.get(chunk.chunkId)
      if (!existing || chunk.similarity > existing.similarity) {
        chunksById.set(chunk.chunkId, chunk)
      }
    }
  }

  return Array.from(chunksById.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10)
    .map((chunk, index) => ({ ...chunk, index }))
}

async function answerRagQuestion(args: RagAnswerOptions): Promise<RagDashboardChatResult> {
  const startedAt = Date.now()
  const question = cleanQuestion(args.question)
  if (!question) throw new Error('Question is required.')
  if (question.length > RAG_CHAT_QUESTION_LIMIT) {
    throw new Error(`Question must be ${RAG_CHAT_QUESTION_LIMIT.toLocaleString()} characters or less.`)
  }

  let providerConfig: RagResolvedProviderConfig | null = null
  let retrievedChunks: ReadonlyArray<RagRetrievedChunk> = []

  try {
    providerConfig = await getDashboardProviderConfig(args.workspaceId)
    const retrievalQueries = buildRagRetrievalQueries(question)
    retrievedChunks = await retrieveRagChunksForQueries({
      workspaceId: args.workspaceId,
      queries: retrievalQueries,
      providerConfig,
      useServiceRetrieval: args.useServiceRetrieval,
    })

    if (retrievedChunks.length === 0) {
      const result: RagDashboardChatResult = {
        status: 'fallback',
        answer: RAG_CLEAN_FALLBACK,
        sources: [],
        fallbackReason: 'no_matching_knowledge',
      }
      await insertRagChatLog({
        workspaceId: args.workspaceId,
        question,
        answer: result.answer,
        status: result.status,
        fallbackReason: result.fallbackReason,
        provider: providerConfig.provider,
        chatModel: providerConfig.chatModel,
        embeddingModel: providerConfig.embeddingModel,
        retrievedChunkIds: [],
        retrievalScores: [],
        latencyMs: Date.now() - startedAt,
        channel: args.channel,
        conversationId: args.conversationId,
        messageId: args.messageId,
      })
      return result
    }

    const provider = createRagOpenAICompatibleProvider(providerConfig)
    const textResult = await generateText({
      model: provider(providerConfig.chatModel),
      system: buildRagSystemPrompt(),
      prompt: buildRagUserPrompt({
        workspaceId: args.workspaceId,
        question,
        retrievedChunks,
      }),
      temperature: 0,
      maxOutputTokens: 160,
    })

    const answer = safeAnswer(textResult.text)
    const status = answer === RAG_CLEAN_FALLBACK ? 'fallback' : 'answered'
    const fallbackReason = status === 'fallback' ? 'model_returned_fallback' : null
    const result: RagDashboardChatResult = {
      status,
      answer,
      sources: retrievedChunks.map(toDashboardSource),
      fallbackReason,
    }

    await insertRagChatLog({
      workspaceId: args.workspaceId,
      question,
      answer,
      status,
      fallbackReason,
      provider: providerConfig.provider,
      chatModel: providerConfig.chatModel,
      embeddingModel: providerConfig.embeddingModel,
      retrievedChunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
      retrievalScores: retrievedChunks.map((chunk) => ({
        sourceTitle: chunk.sourceTitle,
        similarity: chunk.similarity,
      })),
      tokenUsage: textResult.usage ? { ...textResult.usage } : {},
      latencyMs: Date.now() - startedAt,
      channel: args.channel,
      conversationId: args.conversationId,
      messageId: args.messageId,
    })
    return result
  } catch (error) {
    const answer = error instanceof Error && error.message.includes('API key is not configured')
      ? 'Add and test your AI provider key first.'
      : RAG_PROVIDER_ERROR_FALLBACK

    await insertRagChatLog({
      workspaceId: args.workspaceId,
      question,
      answer,
      status: 'provider_error',
      fallbackReason: sanitizeProviderError(error),
      provider: providerConfig?.provider ?? null,
      chatModel: providerConfig?.chatModel ?? null,
      embeddingModel: providerConfig?.embeddingModel ?? null,
      retrievedChunkIds: [],
      retrievalScores: [],
      latencyMs: Date.now() - startedAt,
      channel: args.channel,
      conversationId: args.conversationId,
      messageId: args.messageId,
    }).catch(() => undefined)

    return {
      status: 'provider_error',
      answer,
      sources: retrievedChunks.map(toDashboardSource),
      fallbackReason: 'provider_error',
    }
  }
}

export async function answerRagDashboardQuestion(args: {
  readonly workspaceId: string
  readonly question: string
}): Promise<RagDashboardChatResult> {
  return answerRagQuestion({
    workspaceId: args.workspaceId,
    question: args.question,
    channel: 'dashboard',
  })
}

export async function answerRagWhatsAppQuestion(args: {
  readonly workspaceId: string
  readonly question: string
  readonly conversationId?: string | null
  readonly messageId?: string | null
}): Promise<RagDashboardChatResult> {
  return answerRagQuestion({
    workspaceId: args.workspaceId,
    question: args.question,
    channel: 'whatsapp',
    useServiceRetrieval: true,
    conversationId: args.conversationId,
    messageId: args.messageId,
  })
}
