import { NextResponse } from 'next/server'

import { testRagFirecrawlSettings } from '@/lib/rag/settings'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../../_helpers'

export async function POST() {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const firecrawl = await testRagFirecrawlSettings(auth.workspace.workspaceId)
    return NextResponse.json({
      firecrawl,
      message: firecrawl.lastTestStatus === 'success'
        ? 'Firecrawl connection works. Website import is ready.'
        : firecrawl.lastTestError ?? 'Firecrawl connection test failed.',
    })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
