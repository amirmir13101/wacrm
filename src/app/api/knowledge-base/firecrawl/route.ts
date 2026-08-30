import { NextResponse } from 'next/server'

import {
  getRagFirecrawlSettings,
  saveRagFirecrawlSettings,
} from '@/lib/rag/settings'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const firecrawl = await getRagFirecrawlSettings(auth.workspace.workspaceId)
    return NextResponse.json({ firecrawl })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireKnowledgeBasePermission('manage_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
    const firecrawl = await saveRagFirecrawlSettings({
      workspaceId: auth.workspace.workspaceId,
      apiKey,
    })

    return NextResponse.json({ firecrawl })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
