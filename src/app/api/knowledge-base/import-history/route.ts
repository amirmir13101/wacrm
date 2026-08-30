import { NextResponse } from 'next/server'

import { listRagImportHistory } from '@/lib/rag/dashboard-store'
import { requireKnowledgeBasePermission, safeErrorMessage } from '../_helpers'

export async function GET() {
  const auth = await requireKnowledgeBasePermission('view_knowledge_base')
  if (!auth.ok) return auth.response

  try {
    const history = await listRagImportHistory(auth.workspace.workspaceId)
    return NextResponse.json({ history })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
