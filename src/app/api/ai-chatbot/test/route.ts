import { NextResponse } from 'next/server'

import {
  DEFAULT_AI_CHATBOT_SETTINGS,
  generateChatbotAnswer,
  isAiProviderConfigured,
  logAiChatbotEvent,
  type AiChatbotSettings,
} from '@/lib/ai/chatbot'
import { getPublicProviderSettings } from '@/lib/ai/provider'
import { hybridRetrieveKnowledge } from '@/lib/ai/retrieval'
import { logKnowledgeGap } from '@/lib/ai/knowledge-gaps'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 1000) : ''
  if (!question) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: settings } = await admin
    .from('ai_chatbot_settings')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()

  const effectiveSettings = (settings ?? {
    workspace_id: workspace.workspaceId,
    ...DEFAULT_AI_CHATBOT_SETTINGS,
  }) as AiChatbotSettings

  const retrieval = await hybridRetrieveKnowledge({
    workspaceId: workspace.workspaceId,
    question,
    client: admin,
  })
  const [providerConfigured, providerSettings, embeddingCounts] = await Promise.all([
    isAiProviderConfigured(workspace.workspaceId),
    getPublicProviderSettings(workspace.workspaceId).catch(() => null),
    countEmbeddingStatuses(admin, workspace.workspaceId),
  ])
  if (retrieval.fallbackReason) {
    const fallback = effectiveSettings.fallback_message.trim() || DEFAULT_AI_CHATBOT_SETTINGS.fallback_message
    await logKnowledgeGap({
      workspaceId: workspace.workspaceId,
      question,
      fallbackReason: retrieval.fallbackReason,
      retrievalScore: retrieval.evidence[0]?.finalScore ?? null,
      chunkCountRetrieved: retrieval.evidence.length,
      embeddingUsed: retrieval.evidence.some((candidate) => candidate.vectorScore > 0),
    }, admin)
    return NextResponse.json({
      status: 'fallback',
      answer: fallback,
      reason: retrieval.fallbackReason,
      usedChunks: retrieval.chunks,
      providerConfigured,
      debug: buildSafeDebug({
        workspaceId: workspace.workspaceId,
        providerConfigured,
        providerSettings,
        embeddingCounts,
        retrieval,
        fallbackReason: retrieval.fallbackReason,
      }),
    })
  }
  const answer = await generateChatbotAnswer({
    question,
    settings: effectiveSettings,
    chunks: retrieval.chunks,
    workspaceId: workspace.workspaceId,
    calculation: retrieval.calculation,
    gapContext: {
      retrievalScore: retrieval.evidence[0]?.finalScore ?? null,
      chunkCountRetrieved: retrieval.evidence.length,
      embeddingUsed: retrieval.evidence.some((candidate) => candidate.vectorScore > 0),
    },
  })

  await logAiChatbotEvent({
    workspaceId: workspace.workspaceId,
    userMessage: question,
    aiResponse: answer.answer,
    status: answer.status,
    reason: answer.reason,
  })

  return NextResponse.json({
    ...answer,
    debug: buildSafeDebug({
      workspaceId: workspace.workspaceId,
      providerConfigured,
      providerSettings,
      embeddingCounts,
      retrieval,
      fallbackReason: answer.status === 'fallback' ? answer.reason : null,
    }),
  })
}

async function countEmbeddingStatuses(admin: ReturnType<typeof supabaseAdmin>, workspaceId: string): Promise<Record<string, number>> {
  const { data } = await admin
    .from('ai_knowledge_chunks')
    .select('embedding_status')
    .eq('workspace_id', workspaceId)

  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    const status = typeof row.embedding_status === 'string' ? row.embedding_status : 'unknown'
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})
}

function buildSafeDebug(args: {
  readonly workspaceId: string
  readonly providerConfigured: boolean
  readonly providerSettings: Awaited<ReturnType<typeof getPublicProviderSettings>> | null
  readonly embeddingCounts: Record<string, number>
  readonly retrieval: Awaited<ReturnType<typeof hybridRetrieveKnowledge>>
  readonly fallbackReason: string | null
}) {
  return {
    query: args.retrieval.analysis.question,
    workspaceId: args.workspaceId,
    providerConfigured: args.providerConfigured,
    provider: args.providerSettings
      ? {
          provider: args.providerSettings.provider,
          model: args.providerSettings.model,
          baseUrl: args.providerSettings.baseUrl,
          embeddingsEnabled: args.providerSettings.embeddingsEnabled,
          embeddingModel: args.providerSettings.embeddingModel,
          embeddingDimensions: args.providerSettings.embeddingDimensions,
        }
      : null,
    embeddingCounts: args.embeddingCounts,
    retrieval: {
      terms: args.retrieval.analysis.terms,
      entityTerms: args.retrieval.analysis.entityTerms,
      entityPhrases: args.retrieval.analysis.entityPhrases,
      queryVariants: args.retrieval.analysis.queryVariants,
      intents: args.retrieval.analysis.intents,
      activeChunkCount: args.retrieval.debug.activeChunkCount,
      exactCandidatesCount: args.retrieval.debug.exactCandidatesCount,
      keywordCandidatesCount: args.retrieval.debug.keywordCandidatesCount,
      vectorCandidatesCount: args.retrieval.debug.vectorCandidatesCount,
      answerBearingCandidatesCount: args.retrieval.debug.answerBearingCandidatesCount,
      selectedChunkIds: args.retrieval.debug.selectedChunkIds,
      selectedEvidence: args.retrieval.debug.selectedEvidence,
      fallbackReason: args.fallbackReason,
      calculation: args.retrieval.calculation
        ? {
            status: args.retrieval.calculation.status,
            value: args.retrieval.calculation.value,
            unit: args.retrieval.calculation.unit,
            formula: args.retrieval.calculation.formula,
          }
        : null,
    },
  }
}
