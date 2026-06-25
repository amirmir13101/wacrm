import { NextResponse } from 'next/server'

import { embedRagManualKnowledgeSource } from '@/lib/rag/embedding-store'
import { requireRagPermission, safeErrorMessage } from '../../../_helpers'

export async function POST(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const auth = await requireRagPermission('manage_rag_chatbot')
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const summary = await embedRagManualKnowledgeSource({
      workspaceId: auth.workspace.workspaceId,
      sourceId: id,
    })

    return NextResponse.json({ summary })
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
  }
}
