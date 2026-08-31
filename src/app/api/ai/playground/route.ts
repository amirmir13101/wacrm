import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { retrieveKnowledge } from '@/lib/ai/knowledge'
import { generateReply } from '@/lib/ai/generate'
import { buildSystemPrompt } from '@/lib/ai/defaults'
import { latestUserMessage } from '@/lib/ai/query'
import { AiError, type ChatMessage } from '@/lib/ai/types'
import { recordKnowledgeActivity } from '@/lib/rag/activity'

// Keep the tested transcript bounded, mirroring the live context window.
const MAX_TURNS = 20

/**
 * POST /api/ai/playground  (agent+)
 *
 * Test-chat with the account's agent WITHOUT touching WhatsApp. Runs the
 * exact same path the auto-reply bot uses — knowledge-base retrieval +
 * `auto_reply` system prompt + the configured provider — so what you see
 * here is what a real customer would get. Reads the config even when the
 * master switch is off (requireActive:false) so you can try it before
 * going live. Stateless: the client sends the running transcript each turn.
 */
export async function POST(request: Request) {
  const activityStartedAt = Date.now()
  let failedActivity: {
    readonly workspaceId: string
    readonly question: string
    readonly provider: string
    readonly model: string
    readonly retrievedSourceCount: number
  } | null = null
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`ai-playground:${userId}`, RATE_LIMITS.aiDraft)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null
    if (!rawMessages) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 })
    }

    const messages: ChatMessage[] = rawMessages
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          ((m as ChatMessage).role === 'user' ||
            (m as ChatMessage).role === 'assistant') &&
          typeof (m as ChatMessage).content === 'string' &&
          (m as ChatMessage).content.trim().length > 0,
      )
      .slice(-MAX_TURNS)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Send a message to test the agent.' },
        { status: 400 },
      )
    }

    const config = await loadAiConfig(supabase, accountId, {
      requireActive: false,
    }).catch((err) => {
      console.error('[ai/playground] loadAiConfig error:', err)
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      })
    })
    if (!config) {
      return NextResponse.json(
        {
          error: 'No agent configured yet. Add your provider key in Setup.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      )
    }

    const knowledge = await retrieveKnowledge(
      supabase,
      accountId,
      config,
      latestUserMessage(messages),
    )
    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
    })
    failedActivity = {
      workspaceId: accountId,
      question: latestUserMessage(messages),
      provider: config.provider,
      model: config.model,
      retrievedSourceCount: knowledge.length,
    }

    const { text, handoff } = await generateReply({ config, systemPrompt, messages })
    await recordKnowledgeActivity({
      workspaceId: accountId,
      channel: 'dashboard',
      question: latestUserMessage(messages),
      answer: text,
      status: handoff ? 'fallback' : text ? 'answered' : 'failed',
      fallbackReason: handoff ? 'human_handoff' : text ? null : 'empty_answer',
      provider: config.provider,
      chatModel: config.model,
      embeddingModel: null,
      retrievedSourceCount: knowledge.length,
      latencyMs: Date.now() - activityStartedAt,
      handoff,
    })
    return NextResponse.json({ reply: text, handoff })
  } catch (err) {
    if (failedActivity) {
      await recordKnowledgeActivity({
        workspaceId: failedActivity.workspaceId,
        channel: 'dashboard',
        question: failedActivity.question,
        status: 'provider_error',
        fallbackReason: err instanceof Error ? err.message.slice(0, 240) : 'AI processing failed',
        provider: failedActivity.provider,
        chatModel: failedActivity.model,
        embeddingModel: null,
        retrievedSourceCount: failedActivity.retrievedSourceCount,
        latencyMs: Date.now() - activityStartedAt,
        handoff: false,
      })
    }
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }
    return toErrorResponse(err)
  }
}
