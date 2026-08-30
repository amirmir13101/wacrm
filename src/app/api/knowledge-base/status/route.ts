import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  getRagFirecrawlSettings,
  getRagKnowledgeCounts,
} from '@/lib/rag/settings'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const [agentResult, firecrawl, counts] = await Promise.all([
      supabaseAdmin()
        .from('ai_agent_configs')
        .select('api_key, embeddings_api_key, is_active')
        .eq('workspace_id', auth.workspace.workspaceId)
        .maybeSingle(),
      getRagFirecrawlSettings(auth.workspace.workspaceId),
      getRagKnowledgeCounts(auth.workspace.workspaceId),
    ])

    if (agentResult.error) throw new Error(agentResult.error.message)

    return NextResponse.json({
      agent: {
        configured: Boolean(agentResult.data?.api_key),
        embeddingsConfigured: Boolean(agentResult.data?.embeddings_api_key),
        active: agentResult.data?.is_active === true,
      },
      firecrawl,
      knowledge: counts,
      embeddings: {
        ready: counts.readyEmbeddings > 0,
        failed: counts.failedEmbeddings,
        label: `${counts.readyEmbeddings} ready`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
