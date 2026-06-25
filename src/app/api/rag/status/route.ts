import { NextResponse } from 'next/server'

import {
  getRagFirecrawlSettings,
  getRagKnowledgeCounts,
  getRagProviderSettings,
} from '@/lib/rag/settings'
import { requireRagPermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireRagPermission('view_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const [provider, firecrawl, counts] = await Promise.all([
      getRagProviderSettings(auth.workspace.workspaceId),
      getRagFirecrawlSettings(auth.workspace.workspaceId),
      getRagKnowledgeCounts(auth.workspace.workspaceId),
    ])

    return NextResponse.json({
      provider,
      firecrawl,
      knowledge: counts,
      embeddings: {
        ready: counts.readyEmbeddings > 0,
        failed: counts.failedEmbeddings,
        label: `${counts.readyEmbeddings} ready`,
      },
      whatsappAutoReply: {
        connected: false,
        label: 'Not connected yet',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
